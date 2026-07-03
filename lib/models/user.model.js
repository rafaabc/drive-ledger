const mongoose = require('mongoose');
const { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } = require('../constants/currencies');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../constants/languages');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, default: DEFAULT_CURRENCY },
    language: { type: String, enum: SUPPORTED_LANGUAGES, default: DEFAULT_LANGUAGE },
    googleId: { type: String, unique: true, sparse: true },
    authProviders: { type: [String], default: ['password'], enum: ['password', 'google'] },
    currentKm: { type: Number, default: 0, min: 0 },
    currentKmUpdatedAt: { type: Date },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    reminderEmailsEnabled: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpiresAt: { type: Date },
    lastLoginAt: { type: Date },
    consent: {
      policyVersion: { type: String },
      acceptedAt: { type: Date },
      ipHash: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        delete ret.password;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpiresAt;
        delete ret.consent;
        delete ret.__v;
      },
    },
  },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Query-filter values must be primitive strings — passing an object (e.g. `{ $ne: null }`)
// straight into Mongoose's filter lets an attacker inject query operators, and passing
// `undefined` gets dropped during BSON serialization, silently widening the filter to `{}`
// and matching the first document in the collection. Fail closed: skip the query entirely
// for anything that isn't a string.
const findOneByString = (field, value) =>
  typeof value === 'string' ? User.findOne({ [field]: value }) : Promise.resolve(null);

module.exports = {
  findByUsername: (username) => findOneByString('username', username),
  findByEmail: (email) => findOneByString('email', email),
  findById: (id) => User.findById(id),
  findByGoogleId: (googleId) => findOneByString('googleId', googleId),
  create: (data) => User.create(data),
  updatePassword: (username, hashedPassword) =>
    User.updateOne({ username }, { $set: { password: hashedPassword } }),
  updateCurrency: (id, currency) => User.updateOne({ _id: id }, { $set: { currency } }),
  updateLanguage: (id, language) => User.updateOne({ _id: id }, { $set: { language } }),
  updatePlan: (id, plan) => User.updateOne({ _id: id }, { $set: { plan } }),
  updateCurrencyAndReturn: (id, currency) =>
    User.findOneAndUpdate({ _id: id }, { $set: { currency } }, { returnDocument: 'after' }),
  updateLanguageAndReturn: (id, language) =>
    User.findOneAndUpdate({ _id: id }, { $set: { language } }, { returnDocument: 'after' }),
  updateReminderEmailsEnabledAndReturn: (id, reminderEmailsEnabled) =>
    User.findOneAndUpdate(
      { _id: id },
      { $set: { reminderEmailsEnabled } },
      { returnDocument: 'after' },
    ),
  findAllForReminderDigest: () =>
    User.find({ emailVerified: true, reminderEmailsEnabled: { $ne: false } }),
  linkGoogleId: (userId, googleId) =>
    User.updateOne({ _id: userId }, { $set: { googleId }, $addToSet: { authProviders: 'google' } }),
  unlinkGoogleId: (userId) =>
    User.updateOne(
      { _id: userId },
      { $unset: { googleId: '' }, $pull: { authProviders: 'google' } },
    ),
  updateOdometerAndReturn: (id, currentKm) =>
    User.findOneAndUpdate(
      { _id: id },
      { $set: { currentKm, currentKmUpdatedAt: new Date() } },
      { returnDocument: 'after' },
    ),
  findByEmailVerificationToken: (token) => findOneByString('emailVerificationToken', token),
  setEmailVerified: (id) =>
    User.findOneAndUpdate(
      { _id: id },
      {
        $set: { emailVerified: true },
        $unset: { emailVerificationToken: '', emailVerificationExpiresAt: '' },
      },
      { returnDocument: 'after' },
    ),
  setEmailVerificationToken: (id, token, expiresAt) =>
    User.updateOne(
      { _id: id },
      { $set: { emailVerificationToken: token, emailVerificationExpiresAt: expiresAt } },
    ),
  setLastLoginAt: (id) => User.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }),
  deleteById: (id) => User.deleteOne({ _id: id }),
  _reset: () => User.deleteMany({}),
};
