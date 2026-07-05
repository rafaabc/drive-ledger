'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { assertInviteAllowed } = require('../../lib/inviteGate.js');

// Save original env vars to restore after each test
let originalInviteOnly;
let originalInviteCodes;

beforeEach(() => {
  originalInviteOnly = process.env.INVITE_ONLY;
  originalInviteCodes = process.env.INVITE_CODES;
});

afterEach(() => {
  // Restore original env state to avoid leaking into other tests
  if (originalInviteOnly === undefined) {
    delete process.env.INVITE_ONLY;
  } else {
    process.env.INVITE_ONLY = originalInviteOnly;
  }

  if (originalInviteCodes === undefined) {
    delete process.env.INVITE_CODES;
  } else {
    process.env.INVITE_CODES = originalInviteCodes;
  }
});

describe('assertInviteAllowed()', () => {
  it('does not throw when gate is off (INVITE_ONLY unset)', () => {
    delete process.env.INVITE_ONLY;
    assert.doesNotThrow(() => {
      assertInviteAllowed('any-code');
    });
  });

  it('does not throw when gate is off (INVITE_ONLY=false)', () => {
    process.env.INVITE_ONLY = 'false';
    assert.doesNotThrow(() => {
      assertInviteAllowed('any-code');
    });
  });

  it('does not throw when gate is off even with undefined code', () => {
    delete process.env.INVITE_ONLY;
    assert.doesNotThrow(() => {
      assertInviteAllowed(undefined);
    });
  });

  it('does not throw when gate is on and code is in INVITE_CODES', () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'code1, code2, code3';
    assert.doesNotThrow(() => {
      assertInviteAllowed('code2');
    });
  });

  it('throws 403 when gate is on and code is not provided', () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'code1, code2';
    assert.throws(
      () => {
        assertInviteAllowed(undefined);
      },
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'invite_required');
        return true;
      },
    );
  });

  it('throws 403 when gate is on and code is empty string', () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'code1, code2';
    assert.throws(
      () => {
        assertInviteAllowed('');
      },
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'invite_required');
        return true;
      },
    );
  });

  it('throws 403 when gate is on and code is not in INVITE_CODES', () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = 'code1, code2, code3';
    assert.throws(
      () => {
        assertInviteAllowed('invalid-code');
      },
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'invite_required');
        return true;
      },
    );
  });

  it('handles INVITE_CODES with whitespace correctly', () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = '  code1  ,  code2  ,  code3  ';
    assert.doesNotThrow(() => {
      assertInviteAllowed('code2');
    });
  });

  it('throws 403 when INVITE_CODES is empty string and gate is on', () => {
    process.env.INVITE_ONLY = 'true';
    process.env.INVITE_CODES = '';
    assert.throws(
      () => {
        assertInviteAllowed('any-code');
      },
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'invite_required');
        return true;
      },
    );
  });

  it('throws 403 when INVITE_CODES is unset and gate is on', () => {
    process.env.INVITE_ONLY = 'true';
    delete process.env.INVITE_CODES;
    assert.throws(
      () => {
        assertInviteAllowed('any-code');
      },
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'invite_required');
        return true;
      },
    );
  });
});
