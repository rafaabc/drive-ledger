'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startMongo, stopMongo, resetMongo } = require('../../helpers/mongo');
const notificationsService = require('../../../lib/services/notifications.service');
const emailService = require('../../../lib/services/email.service');
const userModel = require('../../../lib/models/user.model');
const remindersService = require('../../../lib/services/reminders.service');

before(async () => await startMongo());
after(async () => await stopMongo());
beforeEach(async () => await resetMongo());

const sentEmails = [];
emailService.sendReminderDigest = async (args) => {
  sentEmails.push(args);
};

async function makeUser(username, overrides = {}) {
  return userModel.create({
    username,
    password: 'x',
    email: `${username}@test.com`,
    emailVerified: true,
    ...overrides,
  });
}

describe('notificationsService.runReminderDigest()', () => {
  beforeEach(() => {
    sentEmails.length = 0;
  });

  it('emails a digest for overdue and dueSoon reminders on first run', async () => {
    const user = await makeUser('notif1');
    const uid = user._id.toString();
    await remindersService.createReminder(uid, { type: 'Maintenance', dueKm: 100 }); // dueSoon (currentKm 0, within 500km lead)

    const result = await notificationsService.runReminderDigest();
    assert.strictEqual(result.emailsSent, 1);
    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, 'notif1@test.com');
  });

  it('does not re-send for the same reminder on a second run (dedup)', async () => {
    const user = await makeUser('notif2');
    const uid = user._id.toString();
    await remindersService.createReminder(uid, { type: 'Maintenance', dueKm: 100 });

    await notificationsService.runReminderDigest();
    sentEmails.length = 0;
    const second = await notificationsService.runReminderDigest();

    assert.strictEqual(second.emailsSent, 0);
    assert.strictEqual(sentEmails.length, 0);
  });

  it('skips users who have not verified their email', async () => {
    const user = await makeUser('notif3', { emailVerified: false });
    const uid = user._id.toString();
    await remindersService.createReminder(uid, { type: 'Maintenance', dueKm: 100 });

    const result = await notificationsService.runReminderDigest();
    assert.strictEqual(result.emailsSent, 0);
  });

  it('skips users who opted out of reminder emails', async () => {
    const user = await makeUser('notif4', { reminderEmailsEnabled: false });
    const uid = user._id.toString();
    await remindersService.createReminder(uid, { type: 'Maintenance', dueKm: 100 });

    const result = await notificationsService.runReminderDigest();
    assert.strictEqual(result.emailsSent, 0);
  });

  it('skips a user with no reminders needing notification', async () => {
    await makeUser('notif5');
    const result = await notificationsService.runReminderDigest();
    assert.strictEqual(result.emailsSent, 0);
  });

  it('re-notifies when a reminder crosses into a new status', async () => {
    const user = await makeUser('notif6');
    const uid = user._id.toString();
    const r = await remindersService.createReminder(uid, {
      type: 'Maintenance',
      dueKm: 10000,
    }); // upcoming initially

    let result = await notificationsService.runReminderDigest();
    assert.strictEqual(result.emailsSent, 0); // upcoming, no notification yet

    await remindersService.updateReminder(uid, r._id.toString(), { dueKm: 100 }); // now dueSoon
    result = await notificationsService.runReminderDigest();
    assert.strictEqual(result.emailsSent, 1);
  });
});
