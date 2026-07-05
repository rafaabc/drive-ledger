'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
require('../../helpers/email-mock');
const authService = require('../../../lib/services/auth.service');

const VALID_CONSENT = { policyVersion: '2026-05-20', acceptedAt: new Date().toISOString() };
const expensesService = require('../../../lib/services/expenses.service');
const remindersService = require('../../../lib/services/reminders.service');
const userModel = require('../../../lib/models/user.model');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const TODAY = new Date().toISOString().slice(0, 10);
const future = (d) => new Date(Date.now() + d * 86400000);

describe('Reminder full flow', () => {
  it('create reminder → fuel updates currentKm → status flips → complete → next exists', async () => {
    await authService.register({
      username: 'flow1',
      password: 'Zx7Qw2vNp9Lm4Rk8',
      email: 'flow1@test.com',
      consent: VALID_CONSENT,
    });
    const user = await userModel.findByUsername('flow1');
    const uid = user._id.toString();

    const r = await remindersService.createReminder(uid, {
      type: 'Maintenance',
      dueDate: future(30),
      dueKm: 10000,
      intervalMonths: 12,
      intervalKm: 10000,
    });
    let listed = await remindersService.listReminders(uid, { status: 'active' });
    assert.strictEqual(listed[0].status, 'upcoming');

    await expensesService.createExpense(uid, {
      date: TODAY,
      category: 'Fuel',
      litres: 40,
      price_per_litre: 1.5,
      odometer: 9700,
    });
    listed = await remindersService.listReminders(uid, { status: 'active' });
    assert.strictEqual(listed[0].status, 'dueSoon');

    const result = await remindersService.completeReminder(uid, r._id.toString(), {
      completedKm: 10100,
    });
    assert.ok(result.next);
    assert.strictEqual(result.next.dueKm, 20100);

    const active = await remindersService.listReminders(uid, { status: 'active' });
    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0]._id?.toString() ?? active[0].id, result.next._id.toString());

    const done = await remindersService.listReminders(uid, { status: 'done' });
    assert.strictEqual(done.length, 1);
  });
});
