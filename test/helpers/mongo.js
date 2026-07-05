const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const userModel = require('../../lib/models/user.model');
const expenseModel = require('../../lib/models/expense.model');
const reminderModel = require('../../lib/models/reminder.model');
const recurringRuleModel = require('../../lib/models/recurringRule.model');
const vehicleModel = require('../../lib/models/vehicle.model');
const incomeModel = require('../../lib/models/income.model');
const rateLimitModel = require('../../lib/models/rateLimit.model');

let mongod;

async function startMongo() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function stopMongo() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function resetMongo() {
  await userModel._reset();
  await expenseModel._reset();
  await reminderModel._reset();
  await recurringRuleModel._reset();
  await vehicleModel._reset();
  await incomeModel._reset();
  await rateLimitModel._reset();
}

module.exports = { startMongo, stopMongo, resetMongo };
