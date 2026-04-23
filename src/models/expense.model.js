const expenses = [];
let nextId = 1;

module.exports = {
  findAll: () => expenses,
  findById: (id) => expenses.find((e) => e.id === id),
  findByUserId: (userId) => expenses.filter((e) => e.userId === userId),
  create: (data) => {
    const expense = { id: nextId++, ...data };
    expenses.push(expense);
    return expense;
  },
  update: (id, data) => {
    const index = expenses.findIndex((e) => e.id === id);
    if (index === -1) return null;
    expenses[index] = { ...expenses[index], ...data };
    return expenses[index];
  },
  remove: (id) => {
    const index = expenses.findIndex((e) => e.id === id);
    if (index === -1) return false;
    expenses.splice(index, 1);
    return true;
  },
};
