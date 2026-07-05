'use strict';

// Suppress outbound email in tests. Require this before loading auth.service
// so the in-process module cache mutation takes effect before any register/send call.
const emailService = require('../../lib/services/email.service');
emailService.sendVerificationEmail = async () => {};
emailService.sendPasswordResetEmail = async () => {};
emailService.sendReminderDigest = async () => {};

// passwordPolicy.assertStrongPassword() defaults to the global fetch for its HIBP
// breach check — stub it so integration tests never hit the real network.
global.fetch = async () => ({ ok: true, text: async () => '' });

module.exports = emailService;
