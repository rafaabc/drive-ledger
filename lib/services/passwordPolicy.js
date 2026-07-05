'use strict';

const crypto = require('crypto');
const { ZxcvbnFactory } = require('@zxcvbn-ts/core');
const zxcvbnCommonPackage = require('@zxcvbn-ts/language-common');
const zxcvbnEnPackage = require('@zxcvbn-ts/language-en');

const zxcvbn = new ZxcvbnFactory({
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  translations: zxcvbnEnPackage.translations,
});

// zxcvbn score bands: 0=too guessable, 1=very guessable, 2=somewhat guessable,
// 3=safely unguessable, 4=very unguessable. Reject only 0-1 ("wrongpass",
// "password1", "12345678", ...) — a strict >=3 floor would also fail a
// perfectly reasonable random 8-char password, defeating the app's existing
// 8-char minimum. Length + the HIBP breach check below carry the rest.
const MIN_STRENGTH_SCORE = 2;

function makeError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// HaveIBeenPwned k-anonymity range API: only the first 5 hex chars of the
// password's SHA-1 hash are sent, never the password itself or the full hash.
// Fails OPEN on any network/HTTP error — an HIBP outage must never block signups.
async function isBreached(password, fetchImpl) {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase(); // NOSONAR — SHA-1 is mandated by the HIBP k-anonymity protocol, not used for storage/integrity
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\n').some((line) => line.split(':')[0].trim() === suffix);
  } catch {
    return false;
  }
}

async function assertStrongPassword(password, _fetchImpl = fetch) {
  const { score } = zxcvbn.check(password);
  if (score < MIN_STRENGTH_SCORE) {
    throw makeError('password is too weak — choose a stronger, less predictable password');
  }

  if (await isBreached(password, _fetchImpl)) {
    throw makeError('password has appeared in a known data breach — choose a different password');
  }
}

module.exports = { assertStrongPassword, MIN_STRENGTH_SCORE };
