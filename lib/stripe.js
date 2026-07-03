'use strict';

const Stripe = require('stripe');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

let client = null;

function getStripe() {
  if (client) return client;
  if (!process.env.STRIPE_SECRET_KEY) throw makeError(500, 'billing_not_configured');
  client = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' });
  return client;
}

module.exports = { getStripe };
