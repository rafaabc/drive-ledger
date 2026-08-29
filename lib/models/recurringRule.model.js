const mongoose = require('mongoose');
const { scopedFind, scopedDeleteMany } = require('./queryScope');

const RECURRING_CATEGORIES = ['Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];

const recurringRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    category: { type: String, enum: RECURRING_CATEGORIES, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    startDate: { type: Date, required: true },
    interval: { type: Number, enum: [1, 6, 12], required: true },
    dayOfMonth: { type: Number, min: 1, max: 31, required: true },
    active: { type: Boolean, default: true },
    lastGeneratedDate: { type: Date, default: null },
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

const RecurringRule =
  mongoose.models.RecurringRule || mongoose.model('RecurringRule', recurringRuleSchema);

module.exports = {
  RECURRING_CATEGORIES,
  findById: (id) => RecurringRule.findById(id),
  findByUserId: (userId) => scopedFind(RecurringRule, 'userId', userId).sort({ createdAt: -1 }),
  findByVehicleId: (vehicleId) =>
    scopedFind(RecurringRule, 'vehicleId', vehicleId).sort({ createdAt: -1 }),
  findAllActive: () => RecurringRule.find({ active: true }),
  create: (data) => RecurringRule.create(data),
  update: (id, data) => RecurringRule.findByIdAndUpdate(id, data, { returnDocument: 'after' }),
  remove: (id) => RecurringRule.findByIdAndDelete(id),
  removeAllByUser: (userId) => scopedDeleteMany(RecurringRule, 'userId', userId),
  _reset: () => RecurringRule.deleteMany({}),
};
