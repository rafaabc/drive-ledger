const users = [];
let nextId = 1;

module.exports = {
  findAll: () => users,
  findById: (id) => users.find((u) => u.id === id),
  findByUsername: (username) => users.find((u) => u.username === username),
  create: (data) => {
    const user = { id: nextId++, ...data };
    users.push(user);
    return user;
  },
  _reset: () => { users.length = 0; nextId = 1; },
};
