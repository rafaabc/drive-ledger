'use strict';

// Suppress outbound email in tests. Require this before loading auth.service
// so the in-process module cache mutation takes effect before any register/send call.
const emailService = require('../../lib/services/email.service');
emailService.sendVerificationEmail = async () => {};
emailService.sendPasswordResetEmail = async () => {};
emailService.sendReminderDigest = async () => {};

module.exports = emailService;
