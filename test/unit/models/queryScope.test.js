'use strict';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const { scopedFind, scopedDeleteMany, scopedCount } = require('../../../lib/models/queryScope');

// A throwaway model, isolated from the real schemas, just to exercise the guard
// against a plain Mongoose collection with a userId-shaped field.
const Widget = mongoose.model(
  'Widget',
  new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, name: String }),
);

before(async () => await startMongo());
after(async () => await stopMongo());
// resetMongo() only clears the app's own registered models, not this file's
// throwaway Widget collection — clear it too so tests stay isolated.
beforeEach(async () => {
  await resetMongo();
  await Widget.deleteMany({});
});

describe('queryScope.scopedFind()', () => {
  it('returns only documents matching a valid ObjectId', async () => {
    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();
    await Widget.create({ userId: u1, name: 'mine' });
    await Widget.create({ userId: u2, name: 'not mine' });

    const results = await scopedFind(Widget, 'userId', u1);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'mine');
  });

  // Regression guard for the audit finding: `Model.find({ userId: undefined })` can
  // have that key dropped during BSON serialization, widening the filter to `{}` and
  // returning every document across every user. This must fail closed by
  // construction, not by incidental driver behavior.
  it('returns an empty array — not every document — when userId is undefined', async () => {
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'someone else' });
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'someone else too' });

    const results = await scopedFind(Widget, 'userId', undefined);
    assert.deepStrictEqual(results, []);
  });

  it('returns an empty array for a non-ObjectId string (e.g. an injected operator)', async () => {
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'someone else' });
    const results = await scopedFind(Widget, 'userId', { $ne: null });
    assert.deepStrictEqual(results, []);
  });

  it('still supports chaining .sort() on the returned query', async () => {
    const u = new mongoose.Types.ObjectId();
    await Widget.create({ userId: u, name: 'b' });
    await Widget.create({ userId: u, name: 'a' });

    const results = await scopedFind(Widget, 'userId', u).sort({ name: 1 });
    assert.deepStrictEqual(
      results.map((r) => r.name),
      ['a', 'b'],
    );
  });
});

describe('queryScope.scopedDeleteMany()', () => {
  it('deletes only documents matching a valid ObjectId', async () => {
    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();
    await Widget.create({ userId: u1, name: 'mine' });
    await Widget.create({ userId: u2, name: 'not mine' });

    await scopedDeleteMany(Widget, 'userId', u1);
    assert.strictEqual(await Widget.countDocuments({}), 1);
  });

  it('deletes nothing when userId is undefined instead of wiping the collection', async () => {
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'someone else' });
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'someone else too' });

    const result = await scopedDeleteMany(Widget, 'userId', undefined);
    assert.strictEqual(result.deletedCount, 0);
    assert.strictEqual(await Widget.countDocuments({}), 2);
  });
});

describe('queryScope.scopedCount()', () => {
  it('counts only documents matching a valid ObjectId', async () => {
    const u = new mongoose.Types.ObjectId();
    await Widget.create({ userId: u, name: 'mine' });
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'not mine' });

    assert.strictEqual(await scopedCount(Widget, 'userId', u), 1);
  });

  it('returns 0 — not the total collection count — when userId is undefined', async () => {
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'a' });
    await Widget.create({ userId: new mongoose.Types.ObjectId(), name: 'b' });

    assert.strictEqual(await scopedCount(Widget, 'userId', undefined), 0);
  });
});
