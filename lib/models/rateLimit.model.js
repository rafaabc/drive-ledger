'use strict';

const mongoose = require('mongoose');

const rateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  windowStart: { type: Date, required: true },
  // TTL index below auto-purges documents once their window has been stale
  // for a while, so the collection doesn't grow unbounded.
  expireAt: { type: Date, required: true },
});
rateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitEntry =
  mongoose.models.RateLimitEntry || mongoose.model('RateLimitEntry', rateLimitSchema);

// Atomically increments the counter for `key` within its current window, resetting
// to a fresh window (count=1) if the previous window has gone stale. Uses a
// pipeline-style update so the "is this window still live?" check and the
// increment/reset happen as a single atomic operation on the server — no
// read-then-write race between concurrent requests hitting the same key.
async function incrementWindow(key, windowMs) {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - windowMs);
  const freshExpireAt = new Date(now.getTime() + windowMs);

  const pipeline = [
    {
      $set: {
        count: {
          $cond: [{ $gt: ['$windowStart', staleThreshold] }, { $add: ['$count', 1] }, 1],
        },
        windowStart: {
          $cond: [{ $gt: ['$windowStart', staleThreshold] }, '$windowStart', now],
        },
        expireAt: {
          $cond: [{ $gt: ['$windowStart', staleThreshold] }, '$expireAt', freshExpireAt],
        },
      },
    },
  ];

  const options = {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true,
    updatePipeline: true,
  };

  let doc;
  try {
    doc = await RateLimitEntry.findOneAndUpdate({ key }, pipeline, options);
  } catch (err) {
    // Concurrent first-writers on a brand-new key can race the upsert and hit the
    // unique index (E11000). Retry once — the racing writer's document now exists,
    // so this becomes a plain update.
    if (err.code === 11000) {
      doc = await RateLimitEntry.findOneAndUpdate({ key }, pipeline, options);
    } else {
      throw err;
    }
  }

  return { count: doc.count, windowStart: doc.windowStart.getTime() };
}

module.exports = {
  incrementWindow,
  _reset: () => RateLimitEntry.deleteMany({}),
};
