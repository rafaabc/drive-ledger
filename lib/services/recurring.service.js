const mongoose = require('mongoose');
const recurringRuleModel = require('../models/recurringRule.model');
const expenseModel = require('../models/expense.model');
const vehiclesService = require('./vehicles.service');
const { occurrencesDue } = require('../recurrence.js');

const RECURRING_CATEGORIES = recurringRuleModel.RECURRING_CATEGORIES;

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw makeError(400, 'startDate is invalid');
  return d;
}

function assertValidObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw makeError(404, 'Recurring rule not found');
}

function validateRuleFields(body) {
  const { category, amount, startDate, interval, litres, price_per_litre, odometer } = body;

  if (litres !== undefined || price_per_litre !== undefined)
    throw makeError(400, 'litres and price_per_litre are not valid for recurring rules');
  if (odometer !== undefined) throw makeError(400, 'odometer is not valid for recurring rules');

  if (!category) throw makeError(400, 'category is required');
  if (category === 'Fuel') throw makeError(400, 'Fuel cannot be recurring');
  if (!RECURRING_CATEGORIES.includes(category))
    throw makeError(400, `category must be one of: ${RECURRING_CATEGORIES.join(', ')}`);

  if (amount === undefined || amount === null) throw makeError(400, 'amount is required');
  if (typeof amount !== 'number' || amount <= 0)
    throw makeError(400, 'amount must be a positive number');

  if (!startDate) throw makeError(400, 'startDate is required');
  parseDate(startDate);

  if (interval === undefined || interval === null) throw makeError(400, 'interval is required');
  if (![1, 6, 12].includes(interval)) throw makeError(400, 'interval must be 1, 6, or 12 (months)');
}

async function createRule(userId, body) {
  validateRuleFields(body);
  const start = parseDate(body.startDate);
  const dayOfMonth = start.getUTCDate();
  const vehicle = await vehiclesService.resolveVehicleId(userId, body.vehicleId);
  const rule = await recurringRuleModel.create({
    userId,
    vehicleId: vehicle.id,
    category: body.category,
    description: body.description || undefined,
    amount: body.amount,
    startDate: start,
    interval: body.interval,
    dayOfMonth,
    active: body.active === undefined ? true : body.active,
    lastGeneratedDate: null,
  });
  return rule;
}

async function listRules(userId) {
  return recurringRuleModel.findByUserId(userId);
}

async function getRule(userId, id) {
  assertValidObjectId(id);
  const rule = await recurringRuleModel.findById(id);
  if (!rule || rule.userId.toString() !== userId) throw makeError(404, 'Recurring rule not found');
  return rule;
}

async function updateRule(userId, id, body) {
  assertValidObjectId(id);
  const existing = await recurringRuleModel.findById(id);
  if (!existing || existing.userId.toString() !== userId)
    throw makeError(404, 'Recurring rule not found');

  // Merge for validation — use incoming values or fall back to existing
  const merged = {
    category: body.category === undefined ? existing.category : body.category,
    amount: body.amount === undefined ? existing.amount : body.amount,
    startDate:
      body.startDate === undefined
        ? existing.startDate.toISOString().split('T')[0]
        : body.startDate,
    interval: body.interval === undefined ? existing.interval : body.interval,
  };

  validateRuleFields(merged);

  const updateData = {
    category: merged.category,
    amount: merged.amount,
    interval: merged.interval,
  };

  if (body.startDate !== undefined) {
    const newStart = parseDate(body.startDate);
    updateData.startDate = newStart;
    updateData.dayOfMonth = newStart.getUTCDate();
  }

  if (body.description !== undefined) updateData.description = body.description;
  if (body.active !== undefined) updateData.active = body.active;

  return recurringRuleModel.update(id, updateData);
}

async function deleteRule(userId, id) {
  assertValidObjectId(id);
  const rule = await recurringRuleModel.findById(id);
  if (!rule || rule.userId.toString() !== userId) throw makeError(404, 'Recurring rule not found');
  await recurringRuleModel.remove(id);
}

async function deleteAllByUser(userId) {
  await recurringRuleModel.removeAllByUser(userId);
}

async function generateForRules(activeRules, today) {
  let created = 0;
  for (const rule of activeRules) {
    const dates = occurrencesDue(
      {
        startDate: rule.startDate,
        interval: rule.interval,
        dayOfMonth: rule.dayOfMonth,
        lastGeneratedDate: rule.lastGeneratedDate,
      },
      today,
    );
    if (dates.length === 0) continue;
    for (const date of dates) {
      await expenseModel.create({
        userId: rule.userId,
        vehicleId: rule.vehicleId,
        date,
        category: rule.category,
        amount: rule.amount,
        recurringRuleId: rule._id,
      });
      created += 1;
    }
    const latestDate = dates.at(-1);
    await recurringRuleModel.update(rule._id.toString(), { lastGeneratedDate: latestDate });
  }
  return { created };
}

/**
 * Generate all overdue occurrences for one user's active rules.
 * Idempotent: safe to call multiple times (lastGeneratedDate prevents duplicates).
 * @returns {{ created: number }}
 */
async function runCatchUp(userId, today = new Date()) {
  const rules = await recurringRuleModel.findByUserId(userId);
  return generateForRules(
    rules.filter((r) => r.active),
    today,
  );
}

/**
 * Generate all overdue occurrences for ALL users' active rules.
 * Used by the daily cron.
 * @returns {{ created: number }}
 */
async function runCatchUpAllUsers(today = new Date()) {
  const allActiveRules = await recurringRuleModel.findAllActive();
  return generateForRules(allActiveRules, today);
}

module.exports = {
  createRule,
  listRules,
  getRule,
  updateRule,
  deleteRule,
  deleteAllByUser,
  runCatchUp,
  runCatchUpAllUsers,
};
