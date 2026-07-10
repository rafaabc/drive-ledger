'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const mongoose = require('mongoose');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const remindersService = require('../../../lib/services/reminders.service');
const reminderModel = require('../../../lib/models/reminder.model');
const userModel = require('../../../lib/models/user.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const FUTURE_DATE = (days) => new Date(Date.now() + days * 86400000);
const PAST_DATE = (days) => new Date(Date.now() - days * 86400000);

describe('remindersService.computeStatus()', () => {
  it('returns "done" when completedAt is set', () => {
    const s = remindersService.computeStatus({ completedAt: new Date() }, 0);
    assert.strictEqual(s, 'done');
  });

  it('returns "overdue" when dueDate is in the past', () => {
    const s = remindersService.computeStatus({ dueDate: PAST_DATE(1) }, 0);
    assert.strictEqual(s, 'overdue');
  });

  it('returns "overdue" when currentKm >= dueKm', () => {
    const s = remindersService.computeStatus({ dueKm: 10000 }, 10000);
    assert.strictEqual(s, 'overdue');
  });

  it('returns "dueSoon" when dueDate within 7 days', () => {
    const s = remindersService.computeStatus({ dueDate: FUTURE_DATE(3) }, 0);
    assert.strictEqual(s, 'dueSoon');
  });

  it('returns "dueSoon" when dueKm within 500 km', () => {
    const s = remindersService.computeStatus({ dueKm: 10000 }, 9700);
    assert.strictEqual(s, 'dueSoon');
  });

  it('returns "upcoming" otherwise', () => {
    const s = remindersService.computeStatus({ dueDate: FUTURE_DATE(30), dueKm: 20000 }, 5000);
    assert.strictEqual(s, 'upcoming');
  });
});

const USER_ID = () => new mongoose.Types.ObjectId().toString();

describe('remindersService.createReminder()', () => {
  it('creates with valid dueDate only', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, {
      type: 'Maintenance',
      dueDate: FUTURE_DATE(30),
    });
    assert.strictEqual(r.type, 'Maintenance');
    assert.strictEqual(r.userId.toString(), u);
  });

  it('creates with valid dueKm only', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 60000 });
    assert.strictEqual(r.dueKm, 60000);
  });

  it('rejects when both dueDate and dueKm missing', async () => {
    await assert.rejects(
      () => remindersService.createReminder(USER_ID(), { type: 'Maintenance' }),
      (err) => err.status === 400 && /must provide dueDate or dueKm/i.test(err.message),
    );
  });

  it('rejects clearly past dueDate', async () => {
    await assert.rejects(
      () =>
        remindersService.createReminder(USER_ID(), { type: 'Maintenance', dueDate: PAST_DATE(3) }),
      (err) => err.status === 400 && /dueDate cannot be in the past/i.test(err.message),
    );
  });

  it('accepts a dueDate serialized as UTC midnight of tomorrow (client west of UTC)', async () => {
    // Simulates a browser west of UTC (e.g. Brazil, UTC-3) sending <input type="date">
    // "tomorrow" as new Date(dateStr).toISOString() — UTC midnight of tomorrow's date.
    const now = new Date();
    const tomorrowUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    const r = await remindersService.createReminder(USER_ID(), {
      type: 'Maintenance',
      dueDate: tomorrowUtcMidnight,
    });
    assert.strictEqual(new Date(r.dueDate).getTime(), tomorrowUtcMidnight.getTime());
  });

  it('accepts a dueDate serialized as UTC midnight of today, even late in the UTC day', async () => {
    const now = new Date();
    const todayUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const r = await remindersService.createReminder(USER_ID(), {
      type: 'Maintenance',
      dueDate: todayUtcMidnight,
    });
    assert.strictEqual(new Date(r.dueDate).getTime(), todayUtcMidnight.getTime());
  });

  it('rejects invalid type', async () => {
    await assert.rejects(
      () => remindersService.createReminder(USER_ID(), { type: 'nope', dueKm: 100 }),
      (err) => err.status === 400 && /type must be one of/i.test(err.message),
    );
  });

  it('rejects intervalMonths without dueDate', async () => {
    await assert.rejects(
      () =>
        remindersService.createReminder(USER_ID(), {
          type: 'Maintenance',
          dueKm: 1000,
          intervalMonths: 12,
        }),
      (err) => err.status === 400 && /intervalMonths requires dueDate/i.test(err.message),
    );
  });

  it('rejects intervalKm without dueKm', async () => {
    await assert.rejects(
      () =>
        remindersService.createReminder(USER_ID(), {
          type: 'Maintenance',
          dueDate: FUTURE_DATE(30),
          intervalKm: 10000,
        }),
      (err) => err.status === 400 && /intervalKm requires dueKm/i.test(err.message),
    );
  });
});

describe('remindersService.listReminders()', () => {
  it('returns only this users reminders with computed status', async () => {
    const me = USER_ID();
    const other = USER_ID();
    await userModel.create({
      _id: me,
      username: 'a',
      password: 'x',
      email: 'a@test.com',
      currentKm: 0,
    });
    await remindersService.createReminder(me, { type: 'Maintenance', dueKm: 10000 });
    await remindersService.createReminder(other, { type: 'Maintenance', dueKm: 5000 });

    const list = await remindersService.listReminders(me, {});
    assert.strictEqual(list.length, 1);
    assert.ok(['upcoming', 'dueSoon', 'overdue'].includes(list[0].status));
  });

  it('filters by status=active hides done', async () => {
    const me = USER_ID();
    await userModel.create({
      _id: me,
      username: 'b',
      password: 'x',
      email: 'b@test.com',
      currentKm: 0,
    });
    const r = await remindersService.createReminder(me, { type: 'Maintenance', dueKm: 10000 });
    await reminderModel.update(r._id, { completedAt: new Date(), completedKm: 10000 });

    const list = await remindersService.listReminders(me, { status: 'active' });
    assert.strictEqual(list.length, 0);
  });
});

describe('remindersService.getReminder()', () => {
  it('returns 404 when reminder does not belong to user', async () => {
    const me = USER_ID();
    const other = USER_ID();
    const r = await remindersService.createReminder(other, { type: 'Maintenance', dueKm: 10000 });
    await assert.rejects(
      () => remindersService.getReminder(me, r._id.toString()),
      (err) => err.status === 404,
    );
  });
});

describe('remindersService.updateReminder()', () => {
  it('updates allowed fields', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 });
    const updated = await remindersService.updateReminder(u, r._id.toString(), {
      dueKm: 12000,
      title: 'oil',
    });
    assert.strictEqual(updated.dueKm, 12000);
    assert.strictEqual(updated.title, 'oil');
  });

  it('rejects edits to completedAt/completedKm in body', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 });
    await assert.rejects(
      () => remindersService.updateReminder(u, r._id.toString(), { completedAt: new Date() }),
      (err) => err.status === 400,
    );
  });

  it('rejects edit on already-completed reminder', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 });
    await reminderModel.update(r._id, { completedAt: new Date(), completedKm: 10000 });
    await assert.rejects(
      () => remindersService.updateReminder(u, r._id.toString(), { dueKm: 99999 }),
      (err) => err.status === 400 && /cannot edit completed/i.test(err.message),
    );
  });
});

describe('remindersService.deleteReminder()', () => {
  it('deletes any state', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 });
    await remindersService.deleteReminder(u, r._id.toString());
    assert.strictEqual(await reminderModel.findById(r._id), null);
  });

  it('returns 404 when not owned by user', async () => {
    const me = USER_ID();
    const other = USER_ID();
    const r = await remindersService.createReminder(other, { type: 'Maintenance', dueKm: 10000 });
    await assert.rejects(
      () => remindersService.deleteReminder(me, r._id.toString()),
      (err) => err.status === 404,
    );
  });
});

describe('remindersService.completeReminder()', () => {
  it('marks current as completed and creates next with both intervals', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, {
      type: 'Maintenance',
      dueDate: FUTURE_DATE(30),
      dueKm: 10000,
      intervalMonths: 12,
      intervalKm: 10000,
    });
    const result = await remindersService.completeReminder(u, r._id.toString(), {
      completedKm: 10500,
    });
    assert.ok(result.completed.completedAt);
    assert.strictEqual(result.completed.completedKm, 10500);
    assert.ok(result.next);
    assert.strictEqual(result.next.dueKm, 20500);
  });

  it('returns next=null when no intervals', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 });
    const result = await remindersService.completeReminder(u, r._id.toString(), {
      completedKm: 10500,
    });
    assert.strictEqual(result.next, null);
  });

  it('rejects when completedKm missing', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 });
    await assert.rejects(
      () => remindersService.completeReminder(u, r._id.toString(), {}),
      (err) => err.status === 400 && /completedKm/i.test(err.message),
    );
  });

  it('rejects double-complete', async () => {
    const u = USER_ID();
    const r = await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 });
    await remindersService.completeReminder(u, r._id.toString(), { completedKm: 10000 });
    await assert.rejects(
      () => remindersService.completeReminder(u, r._id.toString(), { completedKm: 10000 }),
      (err) => err.status === 400 && /already completed/i.test(err.message),
    );
  });
});

describe('remindersService.getBadgeCount()', () => {
  it('counts dueSoon and overdue separately', async () => {
    const u = USER_ID();
    await userModel.create({
      _id: u,
      username: 'c',
      password: 'x',
      email: 'c@test.com',
      currentKm: 9700,
    });
    await remindersService.createReminder(u, { type: 'Maintenance', dueKm: 10000 }); // dueSoon
    await remindersService.createReminder(u, { type: 'Fuel', dueKm: 9000 }); // overdue (9700>=9000)

    const counts = await remindersService.getBadgeCount(u);
    assert.strictEqual(counts.dueSoon, 1);
    assert.strictEqual(counts.overdue, 1);
  });
});

// ---------------------------------------------------------------------------
// deleteAllByUser
// ---------------------------------------------------------------------------
describe('remindersService.deleteAllByUser()', () => {
  it('should delete all reminders for the given userId', async () => {
    const u = USER_ID();
    const other = USER_ID();
    await userModel.create({ _id: u, username: 'del1', password: 'x', email: 'del1@test.com' });
    await userModel.create({ _id: other, username: 'del2', password: 'x', email: 'del2@test.com' });
    await remindersService.createReminder(u, { type: 'Fuel', dueKm: 5000 });
    await remindersService.createReminder(u, { type: 'Tax', dueKm: 6000 });
    await remindersService.createReminder(other, { type: 'Parking', dueKm: 7000 });

    await remindersService.deleteAllByUser(u);

    const userRemaining = await remindersService.listReminders(u, {});
    assert.strictEqual(userRemaining.length, 0);

    const otherRemaining = await remindersService.listReminders(other, {});
    assert.strictEqual(otherRemaining.length, 1);
  });
});
