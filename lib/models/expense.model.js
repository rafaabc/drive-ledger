const mongoose = require('mongoose');
const { scopedFind, scopedDeleteMany } = require('./queryScope');

const CATEGORIES = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    date: { type: Date, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    amount: { type: Number, required: true },
    litres: { type: Number },
    price_per_litre: { type: Number },
    odometer: { type: Number, min: 0 },
    recurringRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringRule',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        ret.id = ret._id.toString();
        ret.userId = ret.userId.toString();
        if (ret.vehicleId) ret.vehicleId = ret.vehicleId.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  },
);

const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

module.exports = {
  findAll: () => Expense.find(),
  findById: (id) => Expense.findById(id),
  findByUserId: (userId) => scopedFind(Expense, 'userId', userId),
  findByVehicleId: (vehicleId) => scopedFind(Expense, 'vehicleId', vehicleId),
  create: (data) => Expense.create(data),
  update: (id, data) => Expense.findByIdAndUpdate(id, data, { returnDocument: 'after' }),
  remove: (id) => Expense.findByIdAndDelete(id),
  removeAllByUser: (userId) => scopedDeleteMany(Expense, 'userId', userId),
  _reset: () => Expense.deleteMany({}),
};
