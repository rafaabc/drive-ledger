const mongoose = require('mongoose');
const { scopedFind, scopedDeleteMany } = require('./queryScope');

const REMINDER_TYPES = ['Fuel', 'Maintenance', 'Insurance', 'Parking', 'Toll', 'Tax', 'Other'];

const reminderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    type: { type: String, enum: REMINDER_TYPES, required: true },
    title: { type: String },
    dueDate: { type: Date },
    dueKm: { type: Number, min: 0 },
    intervalMonths: { type: Number, min: 0 },
    intervalKm: { type: Number, min: 0 },
    completedAt: { type: Date, default: null },
    completedKm: { type: Number, default: null },
    lastNotifiedStatus: { type: String, default: null },
    lastNotifiedAt: { type: Date, default: null },
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

const Reminder = mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);

module.exports = {
  REMINDER_TYPES,
  findById: (id) => Reminder.findById(id),
  findByUserId: (userId) => scopedFind(Reminder, 'userId', userId).sort({ dueDate: 1, dueKm: 1 }),
  findByVehicleId: (vehicleId) =>
    scopedFind(Reminder, 'vehicleId', vehicleId).sort({ dueDate: 1, dueKm: 1 }),
  create: (data) => Reminder.create(data),
  update: (id, d) => Reminder.findByIdAndUpdate(id, d, { returnDocument: 'after' }),
  remove: (id) => Reminder.findByIdAndDelete(id),
  removeAllByUser: (userId) => scopedDeleteMany(Reminder, 'userId', userId),
  _reset: () => Reminder.deleteMany({}),
};
