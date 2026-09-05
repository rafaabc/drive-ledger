'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const expenseModel = require('../models/expense.model');
const reminderModel = require('../models/reminder.model');
const emailService = require('./email.service');
const passwordPolicy = require('./passwordPolicy');
const googleAuthService = require('./google-auth.service');
const expensesService = require('./expenses.service');
const remindersService = require('./reminders.service');
const recurringService = require('./recurring.service');
const vehiclesService = require('./vehicles.service');
const incomeService = require('./income.service');
const logger = require('../logger');
const stripeLib = require('../stripe.js');
const { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } = require('../constants/currencies');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../constants/languages');
const { POLICY_VERSION } = require('../constants/legal');
const { assertInviteAllowed } = require('../inviteGate');

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Account lockout: after LOCKOUT_THRESHOLD consecutive bad passwords, lock the
// account with an exponentially increasing backoff (indexed by how far past the
// threshold the attempt count is), capped at LOCKOUT_MAX_MS. This throttles
// brute force targeted at one account independent of the caller's IP.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];
const LOCKOUT_MAX_MS = 60 * 60_000;

function lockoutDurationMs(attempts) {
  const idx = attempts - LOCKOUT_THRESHOLD;
  if (idx < 0) return 0;
  return LOCKOUT_BACKOFF_MS[idx] ?? LOCKOUT_MAX_MS;
}

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function register({ username, password, email, currency, consent, ip, inviteCode }) {
  if (!username || !password || !email)
    throw makeError(400, 'username, password and email are required');
  if (!USERNAME_REGEX.test(username))
    throw makeError(400, 'username must be 3-50 characters, alphanumeric and underscores only');
  if (password.length < 8) throw makeError(400, 'password must be at least 8 characters');
  if (password.length > 128) throw makeError(400, 'password must be at most 128 characters');
  if (!EMAIL_REGEX.test(email)) throw makeError(400, 'invalid email format');
  if (currency !== undefined && !SUPPORTED_CURRENCIES.includes(currency))
    throw makeError(400, `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`);
  if (!consent || !consent.policyVersion || !consent.acceptedAt)
    throw makeError(400, 'consent with policyVersion and acceptedAt is required');
  if (consent.policyVersion !== POLICY_VERSION)
    throw makeError(400, 'consent policyVersion does not match current policy');
  assertInviteAllowed(inviteCode);
  if (await userModel.findByUsername(username)) throw makeError(409, 'username already taken');

  // Email enumeration fix: unlike username (a deliberately public handle), email is
  // the sensitive identifier — confirming "this email is already registered" via a
  // 409 lets an attacker enumerate accounts. Return the same generic success shape
  // either way, and notify the existing account instead of creating a duplicate.
  if (await userModel.findByEmail(email)) {
    await emailService.sendAccountExistsEmail({ to: email });
    return { id: null, username };
  }

  await passwordPolicy.assertStrongPassword(password);

  const ipHash = crypto
    .createHash('sha256')
    .update(ip || '')
    .digest('hex')
    .slice(0, 16);
  const hash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const user = await userModel.create({
    username,
    password: hash,
    email,
    currency: currency || DEFAULT_CURRENCY,
    emailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpiresAt: verificationExpiresAt,
    consent: {
      policyVersion: consent.policyVersion,
      acceptedAt: new Date(consent.acceptedAt),
      ipHash,
    },
  });
  const verifyUrl = `${process.env.FRONTEND_URL || process.env.BASE_URL}/verify-email?token=${verificationToken}`;
  await emailService.sendVerificationEmail({ to: email, verifyUrl });
  return { id: user._id.toString(), username: user.username };
}

async function login({ username, password }) {
  if (typeof username !== 'string' || typeof password !== 'string')
    throw makeError(400, 'username and password are required');
  const user = await userModel.findByUsername(username);
  if (!user) throw makeError(401, 'Invalid credentials');
  // Locked-out accounts get the same generic message as any other failure — revealing
  // the lock state would hand an attacker a lockout oracle and confirm the account exists.
  if (user.lockUntil && user.lockUntil > new Date()) throw makeError(401, 'Invalid credentials');
  if (!user.password) throw makeError(401, 'Invalid credentials');
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    const updated = await userModel.incrementFailedLogins(user._id);
    if (updated.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
      const lockUntil = new Date(Date.now() + lockoutDurationMs(updated.failedLoginAttempts));
      await userModel.setLockUntil(user._id, lockUntil);
    }
    throw makeError(401, 'Invalid credentials');
  }

  await userModel.resetFailedLogins(user._id);
  await userModel.setLastLoginAt(user._id);
  return { token: issueToken(user) };
}

async function changePassword({ username, currentPassword, newPassword }) {
  if (!username || !currentPassword || !newPassword)
    throw makeError(400, 'username, currentPassword and newPassword are required');
  if (newPassword.length < 8) throw makeError(400, 'password must be at least 8 characters');
  if (newPassword.length > 128) throw makeError(400, 'password must be at most 128 characters');
  const user = await userModel.findByUsername(username);
  if (!user) throw makeError(404, 'User not found');
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) throw makeError(401, 'Invalid credentials');
  await passwordPolicy.assertStrongPassword(newPassword);

  const hash = await bcrypt.hash(newPassword, 12);
  await userModel.updatePassword(username, hash);
  return { message: 'Password updated successfully' };
}

async function forgotPassword({ email }, _sendEmail = emailService.sendPasswordResetEmail) {
  if (typeof email !== 'string') throw makeError(400, 'email is required');
  const user = await userModel.findByEmail(email);

  if (user) {
    const token = jwt.sign({ username: user.username, purpose: 'reset' }, process.env.JWT_SECRET, {
      expiresIn: process.env.RESET_PASSWORD_EXPIRES_IN || '15m',
    });
    const resetUrl = `${process.env.FRONTEND_URL || process.env.BASE_URL}/reset-password?token=${token}`;
    await _sendEmail({ to: email, resetUrl });
  }

  return { message: 'If the email exists, a reset link was sent.' };
}

async function resetPassword({ token, newPassword }) {
  if (!token || !newPassword) throw makeError(400, 'token and newPassword are required');
  if (newPassword.length < 8) throw makeError(400, 'password must be at least 8 characters');
  if (newPassword.length > 128) throw makeError(400, 'password must be at most 128 characters');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw makeError(401, 'Invalid or expired reset token');
  }

  if (payload.purpose !== 'reset') throw makeError(401, 'Invalid or expired reset token');
  await passwordPolicy.assertStrongPassword(newPassword);

  const hash = await bcrypt.hash(newPassword, 12);
  await userModel.updatePassword(payload.username, hash);
  return { message: 'Password updated successfully' };
}

function issueToken(user) {
  return jwt.sign(
    {
      // typ: 'access' distinguishes session tokens from single-purpose tokens
      // (e.g. the password-reset JWT below, signed with the same JWT_SECRET) —
      // withAuth requires it, so a leaked reset token can't be replayed as a session.
      typ: 'access',
      id: user._id.toString(),
      username: user.username,
      currency: user.currency || DEFAULT_CURRENCY,
      language: user.language || DEFAULT_LANGUAGE,
      emailVerified: user.emailVerified === true,
      plan: user.plan || 'free',
      role: user.role || 'user',
      reminderEmailsEnabled: user.reminderEmailsEnabled !== false,
      targetHourlyRate: user.targetHourlyRate ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
  );
}

async function googleLogin(
  { idToken, inviteCode },
  _verifyIdToken = googleAuthService.verifyIdToken,
) {
  if (!idToken) throw makeError(400, 'idToken is required');
  const { sub: googleId, email, emailVerified } = await _verifyIdToken(idToken);

  let user = await userModel.findByGoogleId(googleId);
  if (user) {
    await userModel.setLastLoginAt(user._id);
    return { token: issueToken(user) };
  }

  user = await userModel.findByEmail(email);
  if (user) {
    if (emailVerified) {
      await userModel.linkGoogleId(user._id, googleId);
      await userModel.setEmailVerified(user._id);
    }
    await userModel.setLastLoginAt(user._id);
    user = await userModel.findById(user._id);
    return { token: issueToken(user) };
  }

  assertInviteAllowed(inviteCode);
  const username = await googleAuthService.generateUsernameFromEmail(email);
  user = await userModel.create({
    username,
    email,
    googleId,
    authProviders: ['google'],
    emailVerified: emailVerified === true,
  });
  await userModel.setLastLoginAt(user._id);
  return { token: issueToken(user) };
}

async function linkGoogle({ userId, idToken }, _verifyIdToken = googleAuthService.verifyIdToken) {
  if (!idToken) throw makeError(400, 'idToken is required');
  const { sub: googleId, email } = await _verifyIdToken(idToken);

  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');
  if (user.email !== email)
    throw makeError(400, 'Google account email does not match your account email');

  const existing = await userModel.findByGoogleId(googleId);
  if (existing && existing._id.toString() !== userId)
    throw makeError(409, 'Google account already linked to another user');

  await userModel.linkGoogleId(userId, googleId);
  return { message: 'Google account linked successfully' };
}

async function unlinkGoogle({ userId }) {
  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');
  if (!user.password)
    throw makeError(400, 'Cannot unlink Google: no password set. Set a password first.');

  await userModel.unlinkGoogleId(userId);
  return { message: 'Google account unlinked successfully' };
}

async function getProviders({ userId }) {
  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');
  return {
    authProviders: user.authProviders || [],
    hasPassword: !!user.password,
  };
}

async function updateCurrency({ id, currency }) {
  if (!currency) throw makeError(400, 'currency is required');
  if (!SUPPORTED_CURRENCIES.includes(currency))
    throw makeError(400, `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`);

  const updated = await userModel.updateCurrencyAndReturn(id, currency);
  if (!updated) throw makeError(404, 'User not found');
  return { token: issueToken(updated) };
}

async function updateLanguage({ id, language }) {
  if (!language) throw makeError(400, 'language is required');
  if (!SUPPORTED_LANGUAGES.includes(language))
    throw makeError(400, `language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`);

  const updated = await userModel.updateLanguageAndReturn(id, language);
  if (!updated) throw makeError(404, 'User not found');
  return { token: issueToken(updated) };
}

async function updateNotificationPrefs({ id, reminderEmailsEnabled }) {
  if (typeof reminderEmailsEnabled !== 'boolean')
    throw makeError(400, 'reminderEmailsEnabled must be a boolean');

  const updated = await userModel.updateReminderEmailsEnabledAndReturn(id, reminderEmailsEnabled);
  if (!updated) throw makeError(404, 'User not found');
  return { token: issueToken(updated) };
}

async function updateProfitTarget({ id, targetHourlyRate }) {
  if (targetHourlyRate !== null) {
    if (typeof targetHourlyRate !== 'number' || Number.isNaN(targetHourlyRate))
      throw makeError(400, 'targetHourlyRate must be a number or null');
    if (targetHourlyRate < 0)
      throw makeError(400, 'targetHourlyRate must be a non-negative number');
  }

  const updated = await userModel.updateTargetHourlyRateAndReturn(id, targetHourlyRate);
  if (!updated) throw makeError(404, 'User not found');
  return { token: issueToken(updated) };
}

async function updateOdometer({ id, currentKm }) {
  if (currentKm === undefined || currentKm === null) throw makeError(400, 'currentKm is required');
  if (typeof currentKm !== 'number' || currentKm < 0)
    throw makeError(400, 'currentKm must be a non-negative number');

  const user = await userModel.findById(id);
  if (!user) throw makeError(404, 'User not found');
  const updated = await userModel.updateOdometerAndReturn(id, currentKm);
  return { token: issueToken(updated), currentKm: updated.currentKm };
}

async function refreshToken({ id }) {
  const user = await userModel.findById(id);
  if (!user) throw makeError(404, 'User not found');
  return { token: issueToken(user) };
}

async function verifyEmail({ token }) {
  if (typeof token !== 'string') throw makeError(400, 'token is required');
  const user = await userModel.findByEmailVerificationToken(token);
  if (!user) throw makeError(400, 'Invalid or expired verification token');
  if (user.emailVerified) throw makeError(400, 'Email already verified');
  if (user.emailVerificationExpiresAt < new Date())
    throw makeError(400, 'Verification token has expired');

  const updated = await userModel.setEmailVerified(user._id);
  return { token: issueToken(updated) };
}

async function resendVerification({ userId }) {
  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');
  if (user.emailVerified) throw makeError(400, 'Email already verified');

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await userModel.setEmailVerificationToken(user._id, token, expiresAt);

  const verifyUrl = `${process.env.FRONTEND_URL || process.env.BASE_URL}/verify-email?token=${token}`;
  await emailService.sendVerificationEmail({ to: user.email, verifyUrl });
  return { message: 'Verification email sent.' };
}

async function exportUserData({ userId }) {
  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');

  const expenses = await expenseModel.findByUserId(userId);
  const reminders = await reminderModel.findByUserId(userId);

  return {
    user: {
      username: user.username,
      email: user.email,
      currency: user.currency,
      language: user.language,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    expenses,
    reminders,
  };
}

async function deleteAccount({ userId, password }) {
  const user = await userModel.findById(userId);
  if (!user) throw makeError(404, 'User not found');

  if (user.password) {
    if (!password) throw makeError(400, 'password is required');
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw makeError(401, 'Invalid credentials');
  }

  try {
    await remindersService.deleteAllByUser(userId);
  } catch (err) {
    logger.error({ err, userId }, 'deleteAccount: failed to delete reminders');
    throw err;
  }

  try {
    await expensesService.deleteAllByUser(userId);
  } catch (err) {
    logger.error({ err, userId }, 'deleteAccount: failed to delete expenses');
    throw err;
  }

  try {
    await recurringService.deleteAllByUser(userId);
  } catch (err) {
    logger.error({ err, userId }, 'deleteAccount: failed to delete recurring rules');
    throw err;
  }

  try {
    await incomeService.deleteAllByUser(userId);
  } catch (err) {
    logger.error({ err, userId }, 'deleteAccount: failed to delete income');
    throw err;
  }

  try {
    await vehiclesService.deleteAllByUser(userId);
  } catch (err) {
    logger.error({ err, userId }, 'deleteAccount: failed to delete vehicles');
    throw err;
  }

  if (user.stripeSubscriptionId) {
    try {
      const stripe = stripeLib.getStripe();
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (err) {
      logger.error({ err, userId }, 'deleteAccount: failed to cancel Stripe subscription');
      throw err;
    }
  }

  try {
    await userModel.deleteById(userId);
  } catch (err) {
    logger.error({ err, userId }, 'deleteAccount: failed to delete user');
    throw err;
  }
}

module.exports = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  updateCurrency,
  updateLanguage,
  updateNotificationPrefs,
  updateProfitTarget,
  updateOdometer,
  refreshToken,
  googleLogin,
  linkGoogle,
  unlinkGoogle,
  getProviders,
  verifyEmail,
  resendVerification,
  exportUserData,
  deleteAccount,
};
