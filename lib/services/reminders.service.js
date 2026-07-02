'use strict';

const mongoose = require('mongoose');
const reminderModel = require('../models/reminder.model');
const vehicleModel = require('../models/vehicle.model');
const vehiclesService = require('./vehicles.service');
const { REMINDER_TYPES } = reminderModel;

const LEAD_DAYS = 7;
const LEAD_KM = 500;
const DAY_MS = 86400000;

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function computeStatus(reminder, currentKm, now = new Date()) {
  if (reminder.completedAt) return 'done';
  const overdueByDate = reminder.dueDate && new Date(reminder.dueDate) < now;
  const overdueByKm =
    reminder.dueKm !== undefined && reminder.dueKm !== null && currentKm >= reminder.dueKm;
  if (overdueByDate || overdueByKm) return 'overdue';

  const dueSoonByDate = reminder.dueDate && new Date(reminder.dueDate) - now <= LEAD_DAYS * DAY_MS;
  const dueSoonByKm =
    reminder.dueKm !== undefined &&
    reminder.dueKm !== null &&
    reminder.dueKm - currentKm <= LEAD_KM;
  if (dueSoonByDate || dueSoonByKm) return 'dueSoon';

  return 'upcoming';
}

function validateCreateBody(body) {
  if (!body.type) throw makeError(400, 'type is required');
  if (!REMINDER_TYPES.includes(body.type))
    throw makeError(400, `type must be one of: ${REMINDER_TYPES.join(', ')}`);
  if (body.dueDate === undefined && body.dueKm === undefined)
    throw makeError(400, 'must provide dueDate or dueKm');

  if (body.dueDate !== undefined) {
    const d = new Date(body.dueDate);
    if (isNaN(d.getTime())) throw makeError(400, 'dueDate is invalid');
    if (d < new Date()) throw makeError(400, 'dueDate cannot be in the past');
  }
  if (body.dueKm !== undefined) {
    if (typeof body.dueKm !== 'number' || body.dueKm <= 0)
      throw makeError(400, 'dueKm must be a positive number');
  }
  if (body.intervalMonths !== undefined) {
    if (typeof body.intervalMonths !== 'number' || body.intervalMonths <= 0)
      throw makeError(400, 'intervalMonths must be a positive number');
    if (body.dueDate === undefined) throw makeError(400, 'intervalMonths requires dueDate');
  }
  if (body.intervalKm !== undefined) {
    if (typeof body.intervalKm !== 'number' || body.intervalKm <= 0)
      throw makeError(400, 'intervalKm must be a positive number');
    if (body.dueKm === undefined) throw makeError(400, 'intervalKm requires dueKm');
  }
}

function assertValidObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw makeError(404, 'Reminder not found');
}

function serialize(reminder, currentKm) {
  const obj = reminder.toJSON ? reminder.toJSON() : reminder;
  obj.status = computeStatus(reminder, currentKm);
  return obj;
}

async function createReminder(userId, body) {
  validateCreateBody(body);
  const vehicle = await vehiclesService.resolveVehicleId(userId, body.vehicleId);
  return reminderModel.create({
    userId,
    vehicleId: vehicle.id,
    type: body.type,
    title: body.title,
    dueDate: body.dueDate,
    dueKm: body.dueKm,
    intervalMonths: body.intervalMonths,
    intervalKm: body.intervalKm,
  });
}

async function currentKmByVehicle(userId) {
  const vehicles = await vehicleModel.findByUserId(userId);
  const map = new Map();
  for (const v of vehicles) map.set(v.id, v.currentKm || 0);
  return map;
}

async function listReminders(userId, query) {
  const kmByVehicle = await currentKmByVehicle(userId);
  let all = await reminderModel.findByUserId(userId);
  if (query.vehicleId) all = all.filter((r) => r.vehicleId?.toString() === query.vehicleId);
  const decorated = all.map((r) => serialize(r, kmByVehicle.get(r.vehicleId?.toString()) || 0));
  const status = query.status || 'active';
  if (status === 'active') return decorated.filter((r) => r.status !== 'done');
  if (['upcoming', 'dueSoon', 'overdue', 'done'].includes(status))
    return decorated.filter((r) => r.status === status);
  return decorated;
}

async function getReminder(userId, id) {
  assertValidObjectId(id);
  const r = await reminderModel.findById(id);
  if (!r || r.userId.toString() !== userId) throw makeError(404, 'Reminder not found');
  const kmByVehicle = await currentKmByVehicle(userId);
  return serialize(r, kmByVehicle.get(r.vehicleId?.toString()) || 0);
}

const FORBIDDEN_UPDATE_FIELDS = ['completedAt', 'completedKm', 'userId'];

async function updateReminder(userId, id, body) {
  assertValidObjectId(id);
  const existing = await reminderModel.findById(id);
  if (!existing || existing.userId.toString() !== userId)
    throw makeError(404, 'Reminder not found');
  if (existing.completedAt) throw makeError(400, 'cannot edit completed reminder');

  for (const f of FORBIDDEN_UPDATE_FIELDS) {
    if (body[f] !== undefined) throw makeError(400, `${f} cannot be updated directly`);
  }

  const merged = {
    type: body.type !== undefined ? body.type : existing.type,
    title: body.title !== undefined ? body.title : existing.title,
    dueDate: body.dueDate !== undefined ? body.dueDate : existing.dueDate,
    dueKm: body.dueKm !== undefined ? body.dueKm : existing.dueKm,
    intervalMonths:
      body.intervalMonths !== undefined ? body.intervalMonths : existing.intervalMonths,
    intervalKm: body.intervalKm !== undefined ? body.intervalKm : existing.intervalKm,
  };
  if (merged.dueDate === undefined && merged.dueKm === undefined)
    throw makeError(400, 'must provide dueDate or dueKm');
  if (!REMINDER_TYPES.includes(merged.type))
    throw makeError(400, `type must be one of: ${REMINDER_TYPES.join(', ')}`);

  return reminderModel.update(id, merged);
}

async function deleteReminder(userId, id) {
  assertValidObjectId(id);
  const r = await reminderModel.findById(id);
  if (!r || r.userId.toString() !== userId) throw makeError(404, 'Reminder not found');
  await reminderModel.remove(id);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function completeReminder(userId, id, body) {
  assertValidObjectId(id);
  if (body.completedKm === undefined || body.completedKm === null)
    throw makeError(400, 'completedKm is required');
  if (typeof body.completedKm !== 'number' || body.completedKm < 0)
    throw makeError(400, 'completedKm must be a non-negative number');

  const existing = await reminderModel.findById(id);
  if (!existing || existing.userId.toString() !== userId)
    throw makeError(404, 'Reminder not found');
  if (existing.completedAt) throw makeError(400, 'reminder already completed');

  const completed = await reminderModel.update(id, {
    completedAt: new Date(),
    completedKm: body.completedKm,
  });

  let next = null;
  const hasMonthRule = existing.intervalMonths && existing.dueDate;
  const hasKmRule = existing.intervalKm && existing.dueKm !== undefined && existing.dueKm !== null;
  if (hasMonthRule || hasKmRule) {
    next = await reminderModel.create({
      userId,
      vehicleId: existing.vehicleId,
      type: existing.type,
      title: existing.title,
      dueDate: hasMonthRule ? addMonths(new Date(), existing.intervalMonths) : undefined,
      dueKm: hasKmRule ? body.completedKm + existing.intervalKm : undefined,
      intervalMonths: existing.intervalMonths,
      intervalKm: existing.intervalKm,
    });
  }

  return { completed, next };
}

async function getBadgeCount(userId) {
  const kmByVehicle = await currentKmByVehicle(userId);
  const all = await reminderModel.findByUserId(userId);
  let dueSoon = 0,
    overdue = 0;
  for (const r of all) {
    const s = computeStatus(r, kmByVehicle.get(r.vehicleId?.toString()) || 0);
    if (s === 'dueSoon') dueSoon++;
    else if (s === 'overdue') overdue++;
  }
  return { dueSoon, overdue };
}

async function deleteAllByUser(userId) {
  await reminderModel.removeAllByUser(userId);
}

module.exports = {
  computeStatus,
  LEAD_DAYS,
  LEAD_KM,
  createReminder,
  listReminders,
  getReminder,
  updateReminder,
  deleteReminder,
  deleteAllByUser,
  completeReminder,
  getBadgeCount,
};
