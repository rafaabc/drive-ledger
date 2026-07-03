const mongoose = require('mongoose');

const INCOME_SOURCES = ['Uber', '99', 'iFood', 'Other'];

const incomeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    source: { type: String, enum: INCOME_SOURCES, required: true },
    note: { type: String },
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
  findByUserId: (userId) => Income.find({ userId }),
  findByVehicleId: (vehicleId) => Income.find({ vehicleId }),
  create: (data) => Income.create(data),
  update: (id, data) => Income.findByIdAndUpdate(id, data, { returnDocument: 'after' }),
  remove: (id) => Income.findByIdAndDelete(id),
  removeAllByUser: (userId) => Income.deleteMany({ userId }),
  _reset: () => Income.deleteMany({}),
};
