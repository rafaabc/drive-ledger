'use strict';

const { checkBotId } = require('botid/server');

// Vercel BotID gate for auth endpoints. Opt-in via BOTID_ENABLED so CI/test
// environments (which run `next build && next start` outside Vercel, with no
// browser executing the client-side challenge) don't get blocked — checkBotId()
// requires the client's initBotId() headers, which only a real Vercel deployment
// with the paired client instrumentation can produce.
async function isBotRequest(_checkBotId = checkBotId) {
  if (process.env.BOTID_ENABLED !== 'true') return false;
  const verification = await _checkBotId();
  return verification.isBot;
}

module.exports = { isBotRequest };
