const expensesService = require('../services/expenses.service');

function create(req, res) {
  try {
    const expense = expensesService.createExpense(req.user.id, req.body);
    res.status(201).json(expense);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

function list(req, res) {
  try {
    const expenses = expensesService.listExpenses(req.user.id, req.query);
    res.status(200).json(expenses);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

function summary(req, res) {
  try {
    const result = expensesService.getSummary(req.user.id, req.query);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

function getOne(req, res) {
  try {
    const expense = expensesService.getExpense(req.user.id, req.params.id);
    res.status(200).json(expense);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

function update(req, res) {
  try {
    const expense = expensesService.updateExpense(req.user.id, req.params.id, req.body);
    res.status(200).json(expense);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

function remove(req, res) {
  try {
    expensesService.deleteExpense(req.user.id, req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { create, list, summary, getOne, update, remove };
