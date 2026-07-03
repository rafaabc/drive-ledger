const mongoose = require('mongoose');
const incomeModel = require('../models/income.model');
const expenseModel = require('../models/expense.model');
const vehiclesService = require('./vehicles.service');
const expensesService = require('./expenses.service');
const { assertProPlan } = require('../planGate');

const { INCOME_SOURCES } = incomeModel;

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw makeError(400, 'date is invalid');
  return d;
}

function assertValidObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw makeError(404, 'Income not found');
}

function validateIncomeFields(body) {
  const { date, amount, source } = body;
  if (!date) throw makeError(400, 'date is required');
  const d = parseDate(date);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (d > today) throw makeError(400, 'date cannot be in the future');

  if (!source) throw makeError(400, 'source is required');
  if (!INCOME_SOURCES.includes(source))
    throw makeError(400, `source must be one of: ${INCOME_SOURCES.join(', ')}`);

  if (amount === undefined || amount === null) throw makeError(400, 'amount is required');
  if (typeof amount !== 'number' || amount <= 0)
    throw makeError(400, 'amount must be a positive number');
}

async function createIncome(userId, body) {
  await assertProPlan(userId, 'income_feature_locked');
  validateIncomeFields(body);
  const vehicle = await vehiclesService.resolveVehicleId(userId, body.vehicleId);
  return incomeModel.create({
    userId,
    vehicleId: vehicle.id,
    date: body.date,
    amount: body.amount,
    source: body.source,
    note: body.note,
  });
}

async function listIncome(userId, query = {}) {
  let results = await incomeModel.findByUserId(userId);
  if (query.vehicleId) results = results.filter((i) => i.vehicleId?.toString() === query.vehicleId);
  if (query.year)
    results = results.filter((i) => new Date(i.date).getUTCFullYear() === Number(query.year));
  if (query.month)
    results = results.filter((i) => new Date(i.date).getUTCMonth() + 1 === Number(query.month));
  return results;
}

async function getIncome(userId, id) {
  assertValidObjectId(id);
  const income = await incomeModel.findById(id);
  if (!income || income.userId.toString() !== userId) throw makeError(404, 'Income not found');
  return income;
}

async function updateIncome(userId, id, body) {
  assertValidObjectId(id);
  const existing = await incomeModel.findById(id);
  if (!existing || existing.userId.toString() !== userId) throw makeError(404, 'Income not found');

  const merged = {
    date: body.date === undefined ? existing.date : body.date,
    amount: body.amount === undefined ? existing.amount : body.amount,
    source: body.source === undefined ? existing.source : body.source,
    note: body.note === undefined ? existing.note : body.note,
  };
  validateIncomeFields(merged);
  return incomeModel.update(id, merged);
}

async function deleteIncome(userId, id) {
  assertValidObjectId(id);
  const income = await incomeModel.findById(id);
  if (!income || income.userId.toString() !== userId) throw makeError(404, 'Income not found');
  await incomeModel.remove(id);
}

async function deleteAllByUser(userId) {
  await incomeModel.removeAllByUser(userId);
}

function daysInPeriod(year, month) {
  if (month) return new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

/**
 * Estimates km driven in the period from Fuel expenses' odometer readings
 * (max - min reading recorded during the period). Returns null when fewer
 * than two readings exist — no reliable distance can be estimated.
 */
function estimateKmDriven(expenses) {
  const readings = expenses
    .filter((e) => e.category === 'Fuel' && typeof e.odometer === 'number')
    .map((e) => e.odometer);
  if (readings.length < 2) return null;
  return Math.max(...readings) - Math.min(...readings);
}

async function getProfitSummary(userId, query) {
  if (!query.year) throw makeError(400, 'year query parameter is required');
  const year = Number(query.year);
  if (Number.isNaN(year)) throw makeError(400, 'year must be a number');
  if (year > new Date().getUTCFullYear()) throw makeError(400, 'year cannot be in the future');

  const month = query.month ? Number(query.month) : null;
  if (query.month && (Number.isNaN(month) || month < 1 || month > 12))
    throw makeError(400, 'month must be a number between 1 and 12');

  const expenseSummary = await expensesService.getSummary(userId, {
    year: query.year,
    month: query.month,
    vehicleId: query.vehicleId,
  });

  const income = await listIncome(userId, { year, month, vehicleId: query.vehicleId });
  const totalIncome = Math.round(income.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const totalExpenses = expenseSummary.total;
  const profit = Math.round((totalIncome - totalExpenses) * 100) / 100;

  const allExpenses = await expenseModel.findByUserId(userId);
  const periodExpenses = allExpenses.filter((e) => {
    const d = new Date(e.date);
    const matchYear = d.getUTCFullYear() === year;
    const matchMonth = month ? d.getUTCMonth() + 1 === month : true;
    const matchVehicle = query.vehicleId ? e.vehicleId?.toString() === query.vehicleId : true;
    return matchYear && matchMonth && matchVehicle;
  });
  const kmDriven = estimateKmDriven(periodExpenses);
  const profitPerKm = kmDriven ? Math.round((profit / kmDriven) * 100) / 100 : null;
  const profitPerDay = Math.round((profit / daysInPeriod(year, month)) * 100) / 100;

  const period = { year };
  if (month) period.month = month;

  return { period, totalIncome, totalExpenses, profit, profitPerKm, profitPerDay, kmDriven };
}

module.exports = {
  INCOME_SOURCES,
  createIncome,
  listIncome,
  getIncome,
  updateIncome,
  deleteIncome,
  deleteAllByUser,
  getProfitSummary,
};
