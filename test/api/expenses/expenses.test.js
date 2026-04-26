'use strict';

const { request, expect, BASE_URL, authHeader, createAndLoginUser, uniqueUsername } = require('../base/api-base');
const fixtures = require('../fixtures/expenses.json');

const today = new Date().toISOString().split('T')[0];

// ─── US-03: Register / Manage Vehicle Expense ─────────────────────────────────

describe('US-03 - Register / Manage Vehicle Expense', () => {

  describe('POST /api/expenses', () => {

    it('[TC-03-01] should return 201 and the created expense when payload is valid (Fuel)', async () => {
      const res = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send(fixtures.validFuel);

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('id').that.is.a('number');
      expect(res.body).to.have.property('userId').that.is.a('number');
      expect(res.body).to.have.property('date').that.is.a('string');
      expect(res.body).to.have.property('category', 'Fuel');
      expect(res.body).to.have.property('amount').that.is.a('number');
    });

    it('[TC-03-02] should return the created expense when retrieved by id after creation', async () => {
      const createRes = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send(fixtures.validFuel);

      expect(createRes.status).to.equal(201);
      const { id } = createRes.body;

      const getRes = await request(BASE_URL)
        .get(`/api/expenses/${id}`)
        .set(authHeader());

      expect(getRes.status).to.equal(200);
      expect(getRes.body).to.have.property('id', id);
      expect(getRes.body).to.have.property('category', 'Fuel');
    });

    it('[TC-03-03] should return 201 for each of the predefined categories', async () => {
      for (const expense of fixtures.validNonFuel) {
        const res = await request(BASE_URL)
          .post('/api/expenses')
          .set(authHeader())
          .send(expense);

        expect(res.status, `failed for category ${expense.category}`).to.equal(201);
      }

      const fuelRes = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send(fixtures.validFuel);

      expect(fuelRes.status).to.equal(201);
    });

    it('[TC-03-04] should return 400 when category is not in the predefined list', async () => {
      const tc = fixtures.invalidCases.find(c => c.tcId === 'TC-03-04');

      const res = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send(tc.body);

      expect(res.status).to.equal(400);
    });

    it('[TC-03-05] should allow duplicate expenses and return 201 for both with different ids', async () => {
      const payload = { date: '2026-01-15', category: 'Parking', amount: 5.50 };

      const res1 = await request(BASE_URL).post('/api/expenses').set(authHeader()).send(payload);
      const res2 = await request(BASE_URL).post('/api/expenses').set(authHeader()).send(payload);

      expect(res1.status).to.equal(201);
      expect(res2.status).to.equal(201);
      expect(res1.body.id).to.not.equal(res2.body.id);
    });

    it('[TC-03-06] should auto-compute Fuel amount as litres × price_per_litre rounded to 2 decimals', async () => {
      const { litres, price_per_litre } = fixtures.validFuel;
      const expected = Math.round(litres * price_per_litre * 100) / 100;

      const res = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send(fixtures.validFuel);

      expect(res.status).to.equal(201);
      expect(res.body.amount).to.equal(expected);
    });

    // Parametrized invalid cases (TC-03-07, 08, 09, 11, 12)
    fixtures.invalidCases
      .filter(c => c.tcId !== 'TC-03-04')
      .forEach(({ tcId, description, body, expectedStatus, expectedMessage }) => {
        it(`[${tcId}] should return ${expectedStatus} when ${description}`, async () => {
          const res = await request(BASE_URL)
            .post('/api/expenses')
            .set(authHeader())
            .send(body);

          expect(res.status).to.equal(expectedStatus);
          if (expectedMessage) {
            expect(res.body).to.have.property('message', expectedMessage);
          }
        });
      });

    it("[TC-03-10] should return 201 when date is today", async () => {
      const res = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send({ date: today, category: 'Parking', amount: 3 });

      expect(res.status).to.equal(201);
    });
  });

  describe('PUT /api/expenses/:id', () => {
    let expenseId;

    before(async function () {
      const res = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send({ date: '2026-01-15', category: 'Maintenance', amount: 100 });
      expenseId = res.body.id;
    });

    it('[TC-03-13] should return 200 with the updated fields when expense exists', async () => {
      const res = await request(BASE_URL)
        .put(`/api/expenses/${expenseId}`)
        .set(authHeader())
        .send({ amount: 200 });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('amount', 200);
      expect(res.body).to.have.property('id', expenseId);
    });

    it('[TC-03-14] should return 404 when updating a non-existent expense', async () => {
      const res = await request(BASE_URL)
        .put('/api/expenses/999999999')
        .set(authHeader())
        .send({ amount: 50 });

      expect(res.status).to.equal(404);
    });
  });

  describe('DELETE /api/expenses/:id', () => {

    it('[TC-03-15] should return 204 and make the expense unreachable via GET afterwards', async () => {
      const createRes = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send({ date: '2026-01-15', category: 'Toll', amount: 3 });
      const { id } = createRes.body;

      const deleteRes = await request(BASE_URL)
        .delete(`/api/expenses/${id}`)
        .set(authHeader());

      expect(deleteRes.status).to.equal(204);

      const getRes = await request(BASE_URL)
        .get(`/api/expenses/${id}`)
        .set(authHeader());

      expect(getRes.status).to.equal(404);
    });

    it('[TC-03-16] should return 404 when deleting a non-existent expense', async () => {
      const res = await request(BASE_URL)
        .delete('/api/expenses/999999999')
        .set(authHeader());

      expect(res.status).to.equal(404);
    });
  });

  describe('Cross-user access control', () => {
    let userBToken;
    let expenseId;

    before(async function () {
      this.timeout(15000);

      const createRes = await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send({ date: '2026-01-15', category: 'Tax', amount: 120 });
      expenseId = createRes.body.id;

      userBToken = await createAndLoginUser('userB');
    });

    it("[TC-03-17] should return 404 when user B tries to access user A's expense", async () => {
      const res = await request(BASE_URL)
        .get(`/api/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).to.equal(404);
    });
  });

  describe('GET /api/expenses', () => {

    it('[TC-03-18] should return amount as an unformatted number (not a string)', async () => {
      await request(BASE_URL)
        .post('/api/expenses')
        .set(authHeader())
        .send({ date: '2026-01-15', category: 'Other', amount: 99.99 });

      const res = await request(BASE_URL)
        .get('/api/expenses')
        .set(authHeader());

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array').that.is.not.empty;
      res.body.forEach(expense => {
        expect(expense.amount, `expense id=${expense.id} amount should be a number`).to.be.a('number');
      });
    });
  });
});
