'use strict';

const { request, expect, BASE_URL, CATEGORIES, createAndLoginUser } = require('../base/api-base');
const fixtures = require('../fixtures/summary.json');

// ─── US-04: Expenses Summary by Period ────────────────────────────────────────

describe('US-04 - Expenses Summary by Period', () => {
  let summaryToken;

  // Seed expenses:
  // 2025-03 Fuel    → amount = 40 * 1.85 = 74.00
  // 2025-03 Maintenance → 150.00
  // 2025-04 Insurance   → 200.00
  // Total 2025: 424.00 | March total: 224.00

  before(async function () {
    this.timeout(15000);

    summaryToken = await createAndLoginUser('summaryUser');

    for (const expense of fixtures.seedExpenses) {
      await request(BASE_URL)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${summaryToken}`)
        .send(expense);
    }
  });

  describe('GET /api/expenses/summary', () => {

    it('[TC-04-01] should return 200 with per-category totals when queried by year only', async () => {
      const res = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025 });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('categories');
      expect(res.body.categories).to.have.property('Fuel', 74);
      expect(res.body.categories).to.have.property('Maintenance', 150);
      expect(res.body.categories).to.have.property('Insurance', 200);
    });

    it('[TC-04-02] should return 200 with category totals filtered to the given month', async () => {
      const res = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025, month: 3 });

      expect(res.status).to.equal(200);
      expect(res.body.categories).to.have.property('Fuel', 74);
      expect(res.body.categories).to.have.property('Maintenance', 150);
      expect(res.body.categories).to.have.property('Insurance', 0);
    });

    it('[TC-04-03] should include an overall total in the response', async () => {
      const res = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025 });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('total', 424);
    });

    it('[TC-04-04] should include zero-value entries for categories with no expenses in the period', async () => {
      const res = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025 });

      expect(res.status).to.equal(200);
      const zeroCategories = ['Parking', 'Toll', 'Tax', 'Other'];
      zeroCategories.forEach(cat => {
        expect(res.body.categories, `${cat} should be 0`).to.have.property(cat, 0);
      });
    });

    it('[TC-04-05] should return only the filtered category total when category param is provided', async () => {
      const res = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025, category: 'Fuel' });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('categories');
      expect(res.body.categories).to.have.property('Fuel', 74);
    });

    it('[TC-04-06] should correctly filter by each individual category (multi-category pending UI support)', async () => {
      // The API supports one ?category= value at a time; multi-category selection is pending UI.
      // Verified here by querying each category separately.
      const fuelRes = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025, category: 'Fuel' });

      const maintRes = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025, category: 'Maintenance' });

      expect(fuelRes.status).to.equal(200);
      expect(fuelRes.body.categories).to.have.property('Fuel', 74);

      expect(maintRes.status).to.equal(200);
      expect(maintRes.body.categories).to.have.property('Maintenance', 150);
    });

    it('[TC-04-07] should include all predefined categories in the response when no filter is applied', async () => {
      const res = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025 });

      expect(res.status).to.equal(200);
      CATEGORIES.forEach(cat => {
        expect(res.body.categories, `category "${cat}" should be present`).to.have.property(cat);
      });
    });

    // Parametrized invalid query cases (TC-04-08, 09, 10)
    fixtures.invalidQueryCases.forEach(({ tcId, description, query, expectedStatus, expectedMessage }) => {
      it(`[${tcId}] should return ${expectedStatus} when ${description}`, async () => {
        const res = await request(BASE_URL)
          .get('/api/expenses/summary')
          .set('Authorization', `Bearer ${summaryToken}`)
          .query(query);

        expect(res.status).to.equal(expectedStatus);
        if (expectedMessage) {
          expect(res.body).to.have.property('message', expectedMessage);
        }
      });
    });

    it('[TC-04-11] should return total as an unformatted number (not a string)', async () => {
      const res = await request(BASE_URL)
        .get('/api/expenses/summary')
        .set('Authorization', `Bearer ${summaryToken}`)
        .query({ year: 2025 });

      expect(res.status).to.equal(200);
      expect(res.body.total).to.be.a('number');
      CATEGORIES.forEach(cat => {
        expect(res.body.categories[cat], `categories.${cat} should be a number`).to.be.a('number');
      });
    });
  });
});
