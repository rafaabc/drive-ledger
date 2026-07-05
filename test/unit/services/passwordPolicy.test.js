'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { assertStrongPassword } = require('../../../lib/services/passwordPolicy');

// Stub fetch never called unless the strength check already passed.
const fetchNeverBreached = async () => ({ ok: true, text: async () => '' });

describe('passwordPolicy.assertStrongPassword()', () => {
  it('should reject a common weak password ("password1")', async () => {
    await assert.rejects(
      () => assertStrongPassword('password1', fetchNeverBreached),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /too weak/i);
        return true;
      },
    );
  });

  it('should reject an all-numeric password ("12345678")', async () => {
    await assert.rejects(
      () => assertStrongPassword('12345678', fetchNeverBreached),
      (err) => {
        assert.strictEqual(err.status, 400);
        return true;
      },
    );
  });

  it('should accept a reasonably random 8-character password (does not defeat the 8-char minimum)', async () => {
    await assert.doesNotReject(() => assertStrongPassword('fl9n1Sjo', fetchNeverBreached));
  });

  it('should accept a long, high-entropy passphrase', async () => {
    await assert.doesNotReject(() =>
      assertStrongPassword('correct horse battery staple 42!', fetchNeverBreached),
    );
  });

  it('should reject a password found in the HIBP breach range response', async () => {
    // 'fl9n1Sjo' passed strength above — simulate HIBP reporting its suffix as breached.
    const crypto = require('crypto');
    const sha1 = crypto.createHash('sha1').update('fl9n1Sjo').digest('hex').toUpperCase();
    const suffix = sha1.slice(5);
    const fetchBreached = async () => ({ ok: true, text: async () => `${suffix}:3` });

    await assert.rejects(
      () => assertStrongPassword('fl9n1Sjo', fetchBreached),
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /breach/i);
        return true;
      },
    );
  });

  it('should fail open (not reject) when the HIBP request throws', async () => {
    const fetchFails = async () => {
      throw new Error('network down');
    };
    await assert.doesNotReject(() => assertStrongPassword('fl9n1Sjo', fetchFails));
  });

  it('should fail open when HIBP responds with a non-OK status', async () => {
    const fetchDown = async () => ({ ok: false, text: async () => '' });
    await assert.doesNotReject(() => assertStrongPassword('fl9n1Sjo', fetchDown));
  });
});
