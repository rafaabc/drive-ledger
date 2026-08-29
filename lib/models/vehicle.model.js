const mongoose = require('mongoose');
const { scopedFind, scopedDeleteMany, scopedCount } = require('./queryScope');

const vehicleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    currentKm: { type: Number, default: 0, min: 0 },
    currentKmUpdatedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        ret.id = ret._id.toString();
        ret.userId = ret.userId.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  },
);

const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);

module.exports = {
  findById: (id) => Vehicle.findById(id),
  findByUserId: (userId) => scopedFind(Vehicle, 'userId', userId).sort({ createdAt: 1 }),
  countByUserId: (userId) => scopedCount(Vehicle, 'userId', userId),
  create: (data) => Vehicle.create(data),
  update: (id, data) => Vehicle.findByIdAndUpdate(id, data, { returnDocument: 'after' }),
  remove: (id) => Vehicle.findByIdAndDelete(id),
  removeAllByUser: (userId) => scopedDeleteMany(Vehicle, 'userId', userId),
  updateOdometerAndReturn: (id, currentKm) =>
    Vehicle.findOneAndUpdate(
      { _id: id },
      { $set: { currentKm, currentKmUpdatedAt: new Date() } },
      { returnDocument: 'after' },
    ),
  _reset: () => Vehicle.deleteMany({}),
};
