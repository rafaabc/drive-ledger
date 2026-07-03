const { expect } = require('chai');
const request = require('supertest');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

describe('POST /api/billing/webhook', () => {
  it('rejects a request with no stripe-signature header', async () => {
    const res = await request(BASE_URL)
      .post('/api/billing/webhook')
      .send(JSON.stringify({ id: 'evt_fake', type: 'checkout.session.completed' }))
      .set('Content-Type', 'application/json');
    expect(res.status).to.equal(400);
  });

  it('rejects a request with an invalid stripe-signature header', async () => {
    const res = await request(BASE_URL)
      .post('/api/billing/webhook')
      .send(JSON.stringify({ id: 'evt_fake', type: 'checkout.session.completed' }))
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=not_a_real_signature');
    expect(res.status).to.equal(400);
  });
});

describe('POST /api/billing/checkout', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(BASE_URL)
      .post('/api/billing/checkout')
      .send({ interval: 'monthly' })
      .set('Content-Type', 'application/json');
    expect(res.status).to.equal(401);
  });
});

describe('POST /api/billing/portal', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(BASE_URL).post('/api/billing/portal');
    expect(res.status).to.equal(401);
  });
});
