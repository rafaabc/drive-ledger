const mongoose = require('mongoose');
const expenseModel = require('../models/expense.model');
const vehiclesService = require('./vehicles.service');

const CATEGORIES = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw makeError(400, 'date is invalid');
  return d;
}

function validateExpenseFields(body) {
  const { category, amount, litres, price_per_litre, date, odometer } = body;
  if (!date) throw makeError(400, 'date is required');
  const d = parseDate(date);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (d > today) throw makeError(400, 'date cannot be in the future');

  if (!category) throw makeError(400, 'category is required');
  if (!CATEGORIES.includes(category))
    throw makeError(400, `category must be one of: ${CATEGORIES.join(', ')}`);

  if (category === 'Fuel') {
    if (amount !== undefined)
      throw makeError(
        400,
        'amount is not allowed for Fuel; it is computed from litres * price_per_litre',
      );
    if (litres === undefined || litres === null)
      throw makeError(400, 'litres is required for Fuel category');
    if (price_per_litre === undefined || price_per_litre === null)
      throw makeError(400, 'price_per_litre is required for Fuel category');
    if (typeof litres !== 'number' || litres <= 0)
      throw makeError(400, 'litres must be a positive number');
    if (typeof price_per_litre !== 'number' || price_per_litre <= 0)
      throw makeError(400, 'price_per_litre must be a positive number');
    if (odometer !== undefined && (typeof odometer !== 'number' || odometer <= 0))
      throw makeError(400, 'odometer must be a positive number');
  } else {
    if (litres !== undefined || price_per_litre !== undefined)
      throw makeError(400, 'litres and price_per_litre are only valid for Fuel category');
    if (odometer !== undefined) throw makeError(400, 'odometer is only valid for Fuel category');
    if (amount === undefined || amount === null) throw makeError(400, 'amount is required');
    if (typeof amount !== 'number' || amount <= 0)
      throw makeError(400, 'amount must be a positive number');
  }
}

function buildExpenseData(body) {
  const { category, amount, litres, price_per_litre, date, odometer } = body;
  const base = { date, category };
  if (category === 'Fuel') {
    base.litres = litres;
    base.price_per_litre = price_per_litre;
    base.amount = Math.round(litres * price_per_litre * 100) / 100;
    if (odometer !== undefined) base.odometer = odometer;
  } else {
    base.amount = amount;
  }
  return base;
}

function assertValidObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw makeError(404, 'Expense not found');
}

async function createExpense(userId, body) {
  validateExpenseFields(body);
  const data = buildExpenseData(body);
  const vehicle = await vehiclesService.resolveVehicleId(userId, body.vehicleId);
  const expense = await expenseModel.create({ userId, vehicleId: vehicle.id, ...data });
  await vehiclesService.updateOdometer(vehicle.id, data.odometer);
  return expense;
}

async function listExpenses(userId, query) {
  let results = await expenseModel.findByUserId(userId);
  if (query.vehicleId) results = results.filter((e) => e.vehicleId?.toString() === query.vehicleId);
  if (query.category) results = results.filter((e) => e.category === query.category);
  if (query.year)
    results = results.filter((e) => new Date(e.date).getUTCFullYear() === Number(query.year));
  if (query.month)
    results = results.filter((e) => new Date(e.date).getUTCMonth() + 1 === Number(query.month));
  return results;
}

async function getExpense(userId, id) {
  assertValidObjectId(id);
  const expense = await expenseModel.findById(id);
  if (!expense || expense.userId.toString() !== userId) throw makeError(404, 'Expense not found');
  return expense;
}

async function updateExpense(userId, id, body) {
  assertValidObjectId(id);
  const existing = await expenseModel.findById(id);
  if (!existing || existing.userId.toString() !== userId) throw makeError(404, 'Expense not found');

  const resolvedCategory = body.category !== undefined ? body.category : existing.category;
  const merged = {
    date: body.date !== undefined ? body.date : existing.date,
    category: resolvedCategory,
    litres: body.litres !== undefined ? body.litres : existing.litres,
    price_per_litre:
      body.price_per_litre !== undefined ? body.price_per_litre : existing.price_per_litre,
    odometer: body.odometer !== undefined ? body.odometer : existing.odometer,
    ...(resolvedCategory !== 'Fuel' && {
      amount: body.amount !== undefined ? body.amount : existing.amount,
    }),
  };

  validateExpenseFields(merged);
  const data = buildExpenseData(merged);
  const updated = await expenseModel.update(id, data);
  const vehicleId =
    existing.vehicleId?.toString() ??
    (await vehiclesService.resolveVehicleId(userId, undefined)).id;
  await vehiclesService.updateOdometer(vehicleId, data.odometer);
  return updated;
}

async function deleteExpense(userId, id) {
  assertValidObjectId(id);
  const expense = await expenseModel.findById(id);
  if (!expense || expense.userId.toString() !== userId) throw makeError(404, 'Expense not found');
  await expenseModel.remove(id);
}

async function deleteAllByUser(userId) {
  await expenseModel.removeAllByUser(userId);
}

async function getSummary(userId, query) {
  if (!query.year) throw makeError(400, 'year query parameter is required');
  const year = Number(query.year);
  if (isNaN(year)) throw makeError(400, 'year must be a number');
  if (year > new Date().getUTCFullYear()) throw makeError(400, 'year cannot be in the future');

  const month = query.month ? Number(query.month) : null;
  if (query.month && (isNaN(month) || month < 1 || month > 12))
    throw makeError(400, 'month must be a number between 1 and 12');

  if (query.category && !CATEGORIES.includes(query.category))
    throw makeError(400, `category must be one of: ${CATEGORIES.join(', ')}`);

  const targetCategories = query.category ? [query.category] : [...CATEGORIES];

  const allExpenses = await expenseModel.findByUserId(userId);
  const expenses = allExpenses.filter((e) => {
    const d = new Date(e.date);
    const matchYear = d.getUTCFullYear() === year;
    const matchMonth = month ? d.getUTCMonth() + 1 === month : true;
    const matchCategory = query.category ? e.category === query.category : true;
    const matchVehicle = query.vehicleId ? e.vehicleId?.toString() === query.vehicleId : true;
    return matchYear && matchMonth && matchCategory && matchVehicle;
  });

  const categories = {};
  for (const cat of targetCategories) categories[cat] = 0;
  for (const e of expenses) {
    if (categories[e.category] !== undefined) {
      categories[e.category] = Math.round((categories[e.category] + e.amount) * 100) / 100;
    }
  }

  const total = Math.round(Object.values(categories).reduce((s, v) => s + v, 0) * 100) / 100;

  const period = { year };
  if (month) period.month = month;

  return { period, categories, total };
}

module.exports = {
  createExpense,
  listExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  deleteAllByUser,
  getSummary,
};
