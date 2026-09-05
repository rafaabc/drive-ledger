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

// Mongoose builds the schema's indexes (the `key` unique index above) in the
// background after connect — it is NOT guaranteed to exist yet when the first
// requests land. incrementWindow's whole concurrency strategy below depends on
// that unique index (it detects a race via E11000, see the catch block), so
// every caller awaits this once before its first write. Model.init() resolves
// when index builds finish; it's a no-op on every call after the first.
let indexesReady = null;
function ensureIndexes() {
  if (!indexesReady) {
    // Don't cache a rejected promise — a transient failure (or a pre-existing
    // duplicate blocking the build) should be retried by the next caller, not
    // leave the limiter permanently unable to enforce anything.
    indexesReady = RateLimitEntry.init().catch((err) => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

// Atomically increments the counter for `key` within its current window, resetting
// to a fresh window (count=1) if the previous window has gone stale. Uses a
// pipeline-style update so the "is this window still live?" check and the
// increment/reset happen as a single atomic operation on the server — no
// read-then-write race between concurrent requests hitting the same key.
async function incrementWindow(key, windowMs) {
  await ensureIndexes();
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

  // Concurrent first-writers on a brand-new key can race the upsert and hit the
  // unique index (E11000). Retry — the racing writer's document now exists, so
  // the next attempt becomes a plain update. Bounded (not just one retry) since
  // a retry can itself race another concurrent first-writer.
  const MAX_ATTEMPTS = 3;
  let doc;
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      doc = await RateLimitEntry.findOneAndUpdate({ key }, pipeline, options);
      lastErr = null;
      break;
    } catch (err) {
      if (err.code !== 11000) throw err;
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;

  return { count: doc.count, windowStart: doc.windowStart.getTime() };
}

module.exports = {
  incrementWindow,
  ensureIndexes,
  _reset: () => RateLimitEntry.deleteMany({}),
  // Test-only: clears the memoized index-readiness promise so a test can
  // simulate the pre-index-build window (e.g. after dropping the collection).
  _resetIndexCache: () => {
    indexesReady = null;
  },
};
