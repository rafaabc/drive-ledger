const mongoose = require('mongoose');
const { scopedFind, scopedDeleteMany } = require('./queryScope');

const INCOME_SOURCES = ['Uber', '99', 'iFood', 'Wolt', 'Other'];

const incomeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    source: { type: String, enum: INCOME_SOURCES, required: true },
    note: { type: String },
    // Optional delivery-shift fields (e.g. Wolt) — all nullable so plain income rows are unaffected.
    startTime: { type: String },
    endTime: { type: String },
    hours: { type: Number, min: 0 },
    km: { type: Number, min: 0 },
    deliveries: { type: Number, min: 0 },
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

const Income = mongoose.models.Income || mongoose.model('Income', incomeSchema);

module.exports = {
  INCOME_SOURCES,
  findById: (id) => Income.findById(id),
  findByUserId: (userId) => scopedFind(Income, 'userId', userId),
  findByVehicleId: (vehicleId) => scopedFind(Income, 'vehicleId', vehicleId),
  create: (data) => Income.create(data),
  update: (id, data) => Income.findByIdAndUpdate(id, data, { returnDocument: 'after' }),
  remove: (id) => Income.findByIdAndDelete(id),
  removeAllByUser: (userId) => scopedDeleteMany(Income, 'userId', userId),
  _reset: () => Income.deleteMany({}),
};
