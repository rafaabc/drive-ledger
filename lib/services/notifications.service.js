const userModel = require('../models/user.model');
const reminderModel = require('../models/reminder.model');
const remindersService = require('./reminders.service');
const emailService = require('./email.service');

/**
 * Scans every opted-in, verified user's active reminders and emails a digest
 * of overdue/dueSoon items — but only reminders that just *entered* that
 * status since the last run (lastNotifiedStatus dedup), so a user isn't
 * re-emailed daily for the same reminder.
 */
async function runReminderDigest(now = new Date()) {
  const users = await userModel.findAllForReminderDigest();

  let emailsSent = 0;
  let remindersMarked = 0;

  for (const user of users) {
    const userId = user._id.toString();
    const active = await remindersService.listReminders(userId, { status: 'active' });
    const needsNotify = active.filter(
      (r) =>
        (r.status === 'overdue' || r.status === 'dueSoon') && r.lastNotifiedStatus !== r.status,
    );
    if (needsNotify.length === 0) continue;

    const overdue = needsNotify.filter((r) => r.status === 'overdue');
    const dueSoon = needsNotify.filter((r) => r.status === 'dueSoon');

    await emailService.sendReminderDigest({ to: user.email, overdue, dueSoon });
    emailsSent += 1;

    for (const r of needsNotify) {
      await reminderModel.update(r.id, { lastNotifiedStatus: r.status, lastNotifiedAt: now });
      remindersMarked += 1;
    }
  }

  return { emailsSent, remindersMarked };
}

module.exports = { runReminderDigest };
