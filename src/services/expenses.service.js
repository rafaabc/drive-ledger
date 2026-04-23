const expenseModel = require('../models/expense.model');

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

function validateExpenseFields({ category, amount, litres, price_per_litre, date }) {
  if (!date) throw makeError(400, 'date is required');
  const d = parseDate(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) throw makeError(400, 'date cannot be in the future');

  if (!category) throw makeError(400, 'category is required');
  if (!CATEGORIES.includes(category)) throw makeError(400, `category must be one of: ${CATEGORIES.join(', ')}`);

  if (category === 'Fuel') {
    if (amount !== undefined) throw makeError(400, 'amount is not allowed for Fuel; it is computed from litres * price_per_litre');
    if (litres === undefined || litres === null) throw makeError(400, 'litres is required for Fuel category');
    if (price_per_litre === undefined || price_per_litre === null) throw makeError(400, 'price_per_litre is required for Fuel category');
    if (typeof litres !== 'number' || litres <= 0) throw makeError(400, 'litres must be a positive number');
    if (typeof price_per_litre !== 'number' || price_per_litre <= 0) throw makeError(400, 'price_per_litre must be a positive number');
  } else {
    if (litres !== undefined || price_per_litre !== undefined)
      throw makeError(400, 'litres and price_per_litre are only valid for Fuel category');
    if (amount === undefined || amount === null) throw makeError(400, 'amount is required');
    if (typeof amount !== 'number' || amount <= 0) throw makeError(400, 'amount must be a positive number');
  }
}

function buildExpenseData({ category, amount, litres, price_per_litre, date }) {
  const base = { date, category };
  if (category === 'Fuel') {
    base.litres = litres;
    base.price_per_litre = price_per_litre;
    base.amount = Math.round(litres * price_per_litre * 100) / 100;
  } else {
    base.amount = amount;
  }
  return base;
}

function createExpense(userId, body) {
  validateExpenseFields(body);
  const data = buildExpenseData(body);
  return expenseModel.create({ userId, ...data });
}

function listExpenses(userId, query) {
  let results = expenseModel.findByUserId(userId);
  if (query.category) results = results.filter((e) => e.category === query.category);
  if (query.year) results = results.filter((e) => new Date(e.date).getFullYear() === Number(query.year));
  if (query.month) results = results.filter((e) => new Date(e.date).getMonth() + 1 === Number(query.month));
  return results;
}

function getExpense(userId, id) {
  const expense = expenseModel.findById(Number(id));
  if (!expense || expense.userId !== userId) throw makeError(404, 'Expense not found');
  return expense;
}

function updateExpense(userId, id, body) {
  const existing = expenseModel.findById(Number(id));
  if (!existing || existing.userId !== userId) throw makeError(404, 'Expense not found');

  const resolvedCategory = body.category !== undefined ? body.category : existing.category;
  const merged = {
    date: body.date !== undefined ? body.date : existing.date,
    category: resolvedCategory,
    litres: body.litres !== undefined ? body.litres : existing.litres,
    price_per_litre: body.price_per_litre !== undefined ? body.price_per_litre : existing.price_per_litre,
    ...(resolvedCategory !== 'Fuel' && {
      amount: body.amount !== undefined ? body.amount : existing.amount,
    }),
  };

  validateExpenseFields(merged);
  const data = buildExpenseData(merged);
  return expenseModel.update(Number(id), data);
}

function deleteExpense(userId, id) {
  const expense = expenseModel.findById(Number(id));
  if (!expense || expense.userId !== userId) throw makeError(404, 'Expense not found');
  expenseModel.remove(Number(id));
}

function getSummary(userId, query) {
  if (!query.year) throw makeError(400, 'year query parameter is required');
  const year = Number(query.year);
  if (isNaN(year)) throw makeError(400, 'year must be a number');
  if (year > new Date().getFullYear()) throw makeError(400, 'year cannot be in the future');

  const month = query.month ? Number(query.month) : null;
  if (query.month && (isNaN(month) || month < 1 || month > 12))
    throw makeError(400, 'month must be a number between 1 and 12');

  if (query.category && !CATEGORIES.includes(query.category))
    throw makeError(400, `category must be one of: ${CATEGORIES.join(', ')}`);

  const targetCategories = query.category ? [query.category] : [...CATEGORIES];

  let expenses = expenseModel.findByUserId(userId).filter((e) => {
    const d = new Date(e.date);
    const matchYear = d.getFullYear() === year;
    const matchMonth = month ? d.getMonth() + 1 === month : true;
    const matchCategory = query.category ? e.category === query.category : true;
    return matchYear && matchMonth && matchCategory;
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

module.exports = { createExpense, listExpenses, getExpense, updateExpense, deleteExpense, getSummary };
