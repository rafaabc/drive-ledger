'use strict';

const mongoose = require('mongoose');

// Guards find()/deleteMany() calls that scope by a foreign-key ObjectId field
// (userId, vehicleId, ...). Passing an invalid/undefined value straight into a
// Mongoose filter is a widening risk: `{ userId: undefined }` can be dropped during
// BSON serialization, turning the filter into `{}` and matching every document
// across every user. user.model.js's findOneByString guards the equivalent risk for
// findOne()-by-string fields; this is the same defense for find()/deleteMany() by
// ObjectId foreign key. Fail closed with a filter that is guaranteed to match
// nothing, rather than skip the query — callers can keep chaining .sort() etc. on
// whatever this returns exactly as they would on Model.find(filter) directly.
const NOTHING_MATCHES = { _id: { $in: [] } };

function scopedFilter(field, value) {
  return mongoose.isValidObjectId(value) ? { [field]: value } : NOTHING_MATCHES;
}

function scopedFind(Model, field, value) {
  return Model.find(scopedFilter(field, value));
}

function scopedDeleteMany(Model, field, value) {
  return Model.deleteMany(scopedFilter(field, value));
}

function scopedCount(Model, field, value) {
  return Model.countDocuments(scopedFilter(field, value));
}

module.exports = { scopedFind, scopedDeleteMany, scopedCount };
