'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { isBotRequest } = require('../../../lib/middleware/botid');

describe('isBotRequest()', () => {
  it('should return false without calling checkBotId when BOTID_ENABLED is not "true"', async () => {
    delete process.env.BOTID_ENABLED;
    let called = false;
    const fakeCheckBotId = async () => {
      called = true;
      return { isBot: true };
    };
    const result = await isBotRequest(fakeCheckBotId);
    assert.strictEqual(result, false);
    assert.strictEqual(called, false, 'checkBotId must not run when the gate is disabled');
  });

  it('should return true when enabled and checkBotId reports a bot', async () => {
    process.env.BOTID_ENABLED = 'true';
    try {
      const fakeCheckBotId = async () => ({ isBot: true });
      assert.strictEqual(await isBotRequest(fakeCheckBotId), true);
    } finally {
      delete process.env.BOTID_ENABLED;
    }
  });

  it('should return false when enabled and checkBotId reports a human', async () => {
    process.env.BOTID_ENABLED = 'true';
    try {
      const fakeCheckBotId = async () => ({ isBot: false });
      assert.strictEqual(await isBotRequest(fakeCheckBotId), false);
    } finally {
      delete process.env.BOTID_ENABLED;
    }
  });
});
