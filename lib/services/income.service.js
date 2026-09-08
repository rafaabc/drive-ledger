const mongoose = require('mongoose');
const incomeModel = require('../models/income.model');
const expenseModel = require('../models/expense.model');
const vehiclesService = require('./vehicles.service');
const expensesService = require('./expenses.service');
const { assertProPlan } = require('../planGate');

const { INCOME_SOURCES } = incomeModel;

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw makeError(400, 'date is invalid');
  return d;
}

function assertValidObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw makeError(404, 'Income not found');
}

const TIME_RE = /^\d{2}:\d{2}$/;

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function validateCoreFields({ date, amount, source }) {
  if (!date) throw makeError(400, 'date is required');
  const d = parseDate(date);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (d > today) throw makeError(400, 'date cannot be in the future');

  if (!source) throw makeError(400, 'source is required');
  if (!INCOME_SOURCES.includes(source))
    throw makeError(400, `source must be one of: ${INCOME_SOURCES.join(', ')}`);

  if (amount === undefined || amount === null) throw makeError(400, 'amount is required');
  if (typeof amount !== 'number' || amount <= 0)
    throw makeError(400, 'amount must be a positive number');
}

const MAX_SEGMENTS = 12;

/**
 * Resolves the single source of truth for a shift's time blocks: an explicit
 * `segments` array wins, else a legacy `startTime`/`endTime` pair is lifted
 * into a one-element array, else there are no times at all (undefined).
 */
function normalizeSegments({ segments, startTime, endTime }) {
  if (segments !== undefined) return segments;
  if (startTime !== undefined || endTime !== undefined) return [{ startTime, endTime }];
  return undefined;
}

function validateShiftTimes(body) {
  const hasSegments = body.segments !== undefined;
  const hasLegacyPair = body.startTime !== undefined || body.endTime !== undefined;

  if (hasSegments && hasLegacyPair)
    throw makeError(400, 'segments and startTime/endTime cannot be combined');

  if (hasLegacyPair && (body.startTime === undefined) !== (body.endTime === undefined))
    throw makeError(400, 'startTime and endTime must be provided together');

  const segments = normalizeSegments(body);
  if (segments === undefined) return;

  if (!Array.isArray(segments) || segments.length < 1 || segments.length > MAX_SEGMENTS)
    throw makeError(400, `segments must be an array of 1 to ${MAX_SEGMENTS} time blocks`);

  const sorted = segments
    .map((seg, index) => ({ seg, index }))
    .sort((a, b) => timeToMinutes(a.seg.startTime) - timeToMinutes(b.seg.startTime));

  sorted.forEach(({ seg }, i) => {
    if (!seg || !TIME_RE.test(seg.startTime) || !TIME_RE.test(seg.endTime))
      throw makeError(400, 'each time block needs startTime and endTime in HH:MM format');

    const startMin = timeToMinutes(seg.startTime);
    const endMin = timeToMinutes(seg.endTime);
    const wraps = endMin < startMin;
    if (wraps && i !== sorted.length - 1)
      throw makeError(400, 'only the last time block of the day may cross midnight');

    if (i > 0) {
      const prevEndMin = timeToMinutes(sorted[i - 1].seg.endTime);
      if (startMin < prevEndMin) throw makeError(400, 'time blocks must not overlap');
    }
  });

  if (body.hours !== undefined && body.hours !== null)
    throw makeError(400, 'hours is derived from time blocks and must not be provided');
}

function validateShiftMetrics({ hours, km, deliveries, tips, amount }) {
  if (hours !== undefined && hours !== null && (typeof hours !== 'number' || hours < 0))
    throw makeError(400, 'hours must be a non-negative number');
  if (km !== undefined && km !== null && (typeof km !== 'number' || km < 0))
    throw makeError(400, 'km must be a non-negative number');
  if (
    deliveries !== undefined &&
    deliveries !== null &&
    (typeof deliveries !== 'number' || deliveries < 0 || !Number.isInteger(deliveries))
  )
    throw makeError(400, 'deliveries must be a non-negative integer');
  if (tips !== undefined && tips !== null) {
    if (typeof tips !== 'number' || tips < 0)
      throw makeError(400, 'tips must be a non-negative number');
    if (typeof amount === 'number' && tips > amount)
      throw makeError(400, 'tips cannot exceed amount');
  }
}

function validateIncomeFields(body) {
  validateCoreFields(body);
  validateShiftTimes(body);
  validateShiftMetrics(body);
}

function segmentMinutes({ startTime, endTime }) {
  let diffMin = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (diffMin < 0) diffMin += 24 * 60;
  return diffMin;
}

/**
 * Derives `hours` from `segments` (or a legacy startTime/endTime pair, lifted
 * into a one-element segment list) as the sum of each block's duration — a
 * block crossing midnight adds 24h to itself, not the whole shift. Falls back
 * to an explicit `hours` when no times are given at all.
 */
function buildIncomeData(body) {
  const data = {
    date: body.date,
    amount: body.amount,
    source: body.source,
    note: body.note,
    km: body.km,
    deliveries: body.deliveries,
    tips: body.tips,
  };

  const segments = normalizeSegments(body);
  if (segments !== undefined) {
    data.segments = segments;
    data.startTime = undefined;
    data.endTime = undefined;
    const totalMin = segments.reduce((sum, seg) => sum + segmentMinutes(seg), 0);
    data.hours = Math.round((totalMin / 60) * 100) / 100;
  } else if (body.hours !== undefined) {
    data.hours = body.hours;
  }

  return data;
}

async function createIncome(userId, body) {
  await assertProPlan(userId, 'income_feature_locked');
  validateIncomeFields(body);
  const vehicle = await vehiclesService.resolveVehicleId(userId, body.vehicleId);
  return incomeModel.create({
    userId,
    vehicleId: vehicle.id,
    ...buildIncomeData(body),
  });
}

async function listIncome(userId, query = {}) {
  await assertProPlan(userId, 'income_feature_locked');
  let results = await incomeModel.findByUserId(userId);
  if (query.vehicleId) results = results.filter((i) => i.vehicleId?.toString() === query.vehicleId);
  if (query.year)
    results = results.filter((i) => new Date(i.date).getUTCFullYear() === Number(query.year));
  if (query.month)
    results = results.filter((i) => new Date(i.date).getUTCMonth() + 1 === Number(query.month));
  return results;
}

async function getIncome(userId, id) {
  assertValidObjectId(id);
  const income = await incomeModel.findById(id);
  if (!income || income.userId.toString() !== userId) throw makeError(404, 'Income not found');
  return income;
}

async function updateIncome(userId, id, body) {
  assertValidObjectId(id);
  const existing = await incomeModel.findById(id);
  if (!existing || existing.userId.toString() !== userId) throw makeError(404, 'Income not found');

  if (body.segments !== undefined && (body.startTime !== undefined || body.endTime !== undefined))
    throw makeError(400, 'segments and startTime/endTime cannot be combined');

  // An explicit `segments` or `startTime`/`endTime` in the body replaces the
  // shift's time representation entirely (clearing the other one), so an
  // untouched legacy row is never flagged as mixing both representations —
  // only the client's actual intent decides which one is in play.
  let timeFields;
  if (body.segments !== undefined) {
    timeFields = { segments: body.segments, startTime: undefined, endTime: undefined };
  } else if (body.startTime !== undefined || body.endTime !== undefined) {
    timeFields = { segments: undefined, startTime: body.startTime, endTime: body.endTime };
  } else {
    timeFields = {
      segments: existing.segments,
      startTime: existing.startTime,
      endTime: existing.endTime,
    };
  }

  const merged = {
    date: body.date === undefined ? existing.date : body.date,
    amount: body.amount === undefined ? existing.amount : body.amount,
    source: body.source === undefined ? existing.source : body.source,
    note: body.note === undefined ? existing.note : body.note,
    ...timeFields,
    // Raw client intent only — validateShiftTimes rejects a client-supplied
    // `hours` alongside times, so this must not be pre-filled from `existing`.
    hours: body.hours,
    km: body.km === undefined ? existing.km : body.km,
    deliveries: body.deliveries === undefined ? existing.deliveries : body.deliveries,
    tips: body.tips === undefined ? existing.tips : body.tips,
  };
  validateIncomeFields(merged);

  const built = buildIncomeData({
    ...merged,
    hours: merged.hours !== undefined ? merged.hours : existing.hours,
  });
  Object.assign(merged, built);

  if (body.vehicleId !== undefined) {
    const vehicle = await vehiclesService.resolveVehicleId(userId, body.vehicleId);
    merged.vehicleId = vehicle.id;
  }

  return incomeModel.update(id, merged);
}

async function deleteIncome(userId, id) {
  assertValidObjectId(id);
  const income = await incomeModel.findById(id);
  if (!income || income.userId.toString() !== userId) throw makeError(404, 'Income not found');
  await incomeModel.remove(id);
}

async function deleteAllByUser(userId) {
  await incomeModel.removeAllByUser(userId);
}

function daysInPeriod(year, month) {
  if (month) return new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

/**
 * A fill-to-fill km/litre above this is not achievable by any fuelled
 * vehicle (≈3.0 L/100km floor) — beyond it, the span almost certainly
 * contains fuel that was bought but never logged with an odometer. This is
 * deliberately generous (real cars/mopeds sit well under it) so it only
 * fires on genuinely implausible windows, not efficient ones.
 */
const MAX_KM_PER_LITRE = 33;

/**
 * Fill-to-fill fuel cost per km: each fill-up replaces the fuel burned since
 * the *previous* fill, so the first fill's cost is dropped from the
 * numerator — it pays for km driven before the window we can see, not the
 * km between it and the next fill. This is what removes the "just filled
 * the tank so today looks terrible" distortion, rather than merely flagging
 * it. Requires at least two Fuel expenses with an odometer reading; returns
 * null otherwise (not enough data for a reliable number).
 *
 * The result also carries `flags`: a fill-to-fill window is arithmetically
 * valid even when it silently omits a real fill-up that had no odometer
 * reading, which inflates the km span without adding to fuel spend and
 * collapses costPerKm toward zero. `impliedRangeTooHigh` catches that by
 * checking the physically implied km/litre against MAX_KM_PER_LITRE — it
 * needs no vehicle profile because it scales with each fill's own litres.
 */
function computeFuelCostPerKm(expenses) {
  const fills = expenses
    .filter((e) => e.category === 'Fuel' && typeof e.odometer === 'number')
    .sort((a, b) => a.odometer - b.odometer);
  if (fills.length < 2) return null;

  const spanKm = fills[fills.length - 1].odometer - fills[0].odometer;
  if (spanKm <= 0) return null;

  const paidFills = fills.slice(1);
  const fuelSpend = paidFills.reduce((s, f) => s + f.amount, 0);
  const litres = paidFills.reduce((s, f) => s + (f.litres || 0), 0);
  const costPerKm = Math.round((fuelSpend / spanKm) * 10000) / 10000;

  const flags = [];
  const flagDetails = [];
  for (let i = 1; i < fills.length; i++) {
    const kmBetween = fills[i].odometer - fills[i - 1].odometer;
    const litresAtFill = fills[i].litres || 0;
    if (litresAtFill > 0 && kmBetween > litresAtFill * MAX_KM_PER_LITRE) {
      flags.push('impliedRangeTooHigh');
      flagDetails.push({
        flag: 'impliedRangeTooHigh',
        date: fills[i].date,
        kmBetween,
        litres: litresAtFill,
      });
      break;
    }
  }

  return {
    costPerKm,
    kmDriven: spanKm,
    samples: fills.length - 1,
    spanKm,
    litres,
    flags,
    flagDetails,
  };
}

function parseSummaryPeriod(query) {
  if (!query.year) throw makeError(400, 'year query parameter is required');
  const year = Number(query.year);
  if (Number.isNaN(year)) throw makeError(400, 'year must be a number');
  if (year > new Date().getUTCFullYear()) throw makeError(400, 'year cannot be in the future');

  const month = query.month ? Number(query.month) : null;
  if (query.month && (Number.isNaN(month) || month < 1 || month > 12))
    throw makeError(400, 'month must be a number between 1 and 12');

  const breakdown = query.breakdown === 'monthly' ? 'monthly' : null;

  return { year, month, breakdown };
}

/**
 * Fuel cost/km for the period, using the fill-to-fill window widened with
 * the last fill *before* the period as an anchor (see computeFuelCostPerKm).
 *
 * The anchor is the highest-odometer fill before the period, matching the
 * odometer sort computeFuelCostPerKm uses internally — picking it by date
 * instead (as before) can select a different fill than the one the
 * arithmetic actually treats as first when odometer entries are out of
 * date order.
 */
function computeFuelWindowStats(vehicleExpenses, periodStart, periodEnd) {
  const inPeriodFills = vehicleExpenses.filter((e) => {
    if (e.category !== 'Fuel' || typeof e.odometer !== 'number') return false;
    const d = new Date(e.date);
    return d >= periodStart && d < periodEnd;
  });
  const priorFills = vehicleExpenses
    .filter(
      (e) =>
        e.category === 'Fuel' && typeof e.odometer === 'number' && new Date(e.date) < periodStart,
    )
    .sort((a, b) => b.odometer - a.odometer);
  const fuelWindow = priorFills.length ? [priorFills[0], ...inPeriodFills] : inPeriodFills;
  const result = computeFuelCostPerKm(fuelWindow);
  if (!result) return result;

  // A Fuel expense with no odometer inside the span's actual date range means
  // real fuel spend was invisible to the fill-to-fill calc above — flag it
  // even though the arithmetic itself succeeded on the fills it could see.
  const spanDates = fuelWindow
    .filter((e) => typeof e.odometer === 'number')
    .map((e) => new Date(e.date));
  const spanStart = new Date(Math.min(...spanDates));
  const spanEnd = new Date(Math.max(...spanDates));
  const unloggedFills = vehicleExpenses
    .filter((e) => {
      if (e.category !== 'Fuel' || typeof e.odometer === 'number') return false;
      const d = new Date(e.date);
      return d >= spanStart && d <= spanEnd;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (unloggedFills.length > 0) {
    result.flags = [...result.flags, 'missingOdometer'];
    result.flagDetails = [
      ...result.flagDetails,
      {
        flag: 'missingOdometer',
        count: unloggedFills.length,
        date: unloggedFills[0].date,
        lastDate: unloggedFills[unloggedFills.length - 1].date,
      },
    ];
  }

  return result;
}

/**
 * Splits fuel spend between work and personal driving using odometer distance
 * as the ground truth, rather than assuming all driven km were for work.
 *
 * `workKm` is the platform-reported (e.g. Wolt) distance already on income
 * entries — it already covers on- and off-task driving within a session, so
 * the only distance it misses is the offline tail (home to first online, last
 * offline to home). That tail is deliberately not modelled: it's small and
 * modelling it would require new per-shift input. `totalKm` is the true
 * physical distance from odometer readings on Fuel expenses (anchored with
 * the last fill before the period, same as computeFuelWindowStats), so
 * personalKm = totalKm - workKm falls out on its own — a detour, a grocery
 * run, a weekend trip all land there without ever being logged.
 *
 * Returns `workShare: null` (charge 100% of fuel to work — the conservative
 * failure direction) when there isn't enough odometer data to split it.
 */
function computeWorkShare(vehicleExpenses, periodIncome, periodStart, periodEnd) {
  const workKm = Math.round(periodIncome.reduce((s, i) => s + (i.km || 0), 0) * 100) / 100;

  const inPeriodFills = vehicleExpenses.filter((e) => {
    if (e.category !== 'Fuel' || typeof e.odometer !== 'number') return false;
    const d = new Date(e.date);
    return d >= periodStart && d < periodEnd;
  });
  const priorFills = vehicleExpenses
    .filter(
      (e) =>
        e.category === 'Fuel' && typeof e.odometer === 'number' && new Date(e.date) < periodStart,
    )
    .sort((a, b) => b.odometer - a.odometer);

  let totalKm = null;
  let basis = 'noOdometerData';
  if (priorFills.length > 0 && inPeriodFills.length > 0) {
    const highestInPeriod = inPeriodFills.reduce((max, e) => Math.max(max, e.odometer), -Infinity);
    const span = highestInPeriod - priorFills[0].odometer;
    if (span > 0) {
      totalKm = span;
      basis = 'odometerSplit';
    }
  } else if (inPeriodFills.length >= 2) {
    const odometers = inPeriodFills.map((e) => e.odometer);
    const span = Math.max(...odometers) - Math.min(...odometers);
    if (span > 0) {
      totalKm = span;
      basis = 'noAnchor';
    }
  }

  if (totalKm == null || workKm <= 0) {
    return {
      workKm: workKm || null,
      totalKm,
      personalKm: null,
      workShare: null,
      basis: 'noOdometerData',
    };
  }

  if (workKm > totalKm) {
    return { workKm, totalKm, personalKm: 0, workShare: 1, basis: 'clamped' };
  }

  const workShare = Math.round((workKm / totalKm) * 10000) / 10000;
  const personalKm = Math.round((totalKm - workKm) * 100) / 100;
  return { workKm, totalKm, personalKm, workShare, basis };
}

/** Shift totals (hours/km/deliveries/tips) plus the net metrics derived from fuelSpend x workShare. */
function computeShiftTotals(income, totalIncome, fuelSpend, workShare) {
  const hours = Math.round(income.reduce((s, i) => s + (i.hours || 0), 0) * 100) / 100;
  const workKm = Math.round(income.reduce((s, i) => s + (i.km || 0), 0) * 100) / 100;
  const deliveries = income.reduce((s, i) => s + (i.deliveries || 0), 0);
  const tips = Math.round(income.reduce((s, i) => s + (i.tips || 0), 0) * 100) / 100;

  const effectiveShare = workShare == null ? 1 : workShare;
  const fuelCost = fuelSpend != null ? Math.round(fuelSpend * effectiveShare * 100) / 100 : null;
  // "Does it pay" is meaningless with no income entries in the period — leave
  // netEarnings/netPerHour null rather than reporting a bare negative fuel bill.
  const netEarnings =
    fuelCost != null && income.length > 0 ? Math.round((totalIncome - fuelCost) * 100) / 100 : null;
  const netPerHour =
    netEarnings != null && hours > 0 ? Math.round((netEarnings / hours) * 100) / 100 : null;
  const netPerKm =
    netEarnings != null && workKm > 0 ? Math.round((netEarnings / workKm) * 100) / 100 : null;
  const grossPerHour = hours > 0 ? Math.round((totalIncome / hours) * 100) / 100 : null;
  const netEarningsExcludingTips =
    netEarnings != null ? Math.round((netEarnings - tips) * 100) / 100 : null;
  const netPerHourExcludingTips =
    netEarningsExcludingTips != null && hours > 0
      ? Math.round((netEarningsExcludingTips / hours) * 100) / 100
      : null;

  return {
    hours: hours || null,
    workKm: workKm || null,
    deliveries: deliveries || null,
    tips: tips || null,
    fuelCost,
    netEarnings,
    netPerHour,
    netPerKm,
    grossPerHour,
    netPerHourExcludingTips,
  };
}

/**
 * One row per calendar month of `year`, computed from data already loaded
 * for the yearly summary — no extra queries. Empty months come back with
 * zero/null fields so the UI can render them as blanks.
 */
async function buildMonthlyBreakdown(userId, income, vehicleExpenses, year, vehicleId) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthStart = new Date(Date.UTC(year, m - 1, 1));
    const monthEnd = new Date(Date.UTC(year, m, 1));
    const monthIncome = income.filter((i) => {
      const d = new Date(i.date);
      return d >= monthStart && d < monthEnd;
    });
    const totalIncome = Math.round(monthIncome.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    const fuelCostInfo = computeFuelWindowStats(vehicleExpenses, monthStart, monthEnd);
    const costPerKm = fuelCostInfo ? fuelCostInfo.costPerKm : null;
    const costPerKmSamples = fuelCostInfo ? fuelCostInfo.samples : 0;
    const costPerKmFlags = fuelCostInfo ? fuelCostInfo.flags : [];
    const costPerKmFlagDetails = fuelCostInfo ? fuelCostInfo.flagDetails : [];
    const costPerKmSpanKm = fuelCostInfo ? fuelCostInfo.spanKm : null;

    const monthExpenseSummary = await expensesService.getSummary(userId, {
      year: String(year),
      month: String(m),
      vehicleId,
    });
    const fuelSpend = monthExpenseSummary.categories.Fuel;
    const workShareInfo = computeWorkShare(vehicleExpenses, monthIncome, monthStart, monthEnd);

    const shiftTotals = computeShiftTotals(
      monthIncome,
      totalIncome,
      fuelSpend,
      workShareInfo.workShare,
    );

    months.push({
      month: m,
      totalIncome,
      fuelSpend: fuelSpend || null,
      totalKm: workShareInfo.totalKm,
      personalKm: workShareInfo.personalKm,
      workShare: workShareInfo.workShare,
      workShareBasis: workShareInfo.basis,
      costPerKm,
      costPerKmSamples,
      costPerKmFlags,
      costPerKmFlagDetails,
      costPerKmSpanKm,
      ...shiftTotals,
    });
  }
  return months;
}

async function getProfitSummary(userId, query) {
  await assertProPlan(userId, 'income_feature_locked');
  const { year, month, breakdown } = parseSummaryPeriod(query);

  const expenseSummary = await expensesService.getSummary(userId, {
    year: query.year,
    month: query.month,
    vehicleId: query.vehicleId,
  });

  const income = await listIncome(userId, { year, month, vehicleId: query.vehicleId });
  const totalIncome = Math.round(income.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const totalExpenses = expenseSummary.total;
  const profit = Math.round((totalIncome - totalExpenses) * 100) / 100;

  const periodStart = new Date(Date.UTC(year, month ? month - 1 : 0, 1));
  const periodEnd = month ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));

  const allExpenses = await expenseModel.findByUserId(userId);
  const vehicleExpenses = query.vehicleId
    ? allExpenses.filter((e) => e.vehicleId?.toString() === query.vehicleId)
    : allExpenses;

  const fuelCostInfo = computeFuelWindowStats(vehicleExpenses, periodStart, periodEnd);
  const kmDriven = fuelCostInfo ? fuelCostInfo.kmDriven : null;
  const costPerKm = fuelCostInfo ? fuelCostInfo.costPerKm : null;
  const costPerKmSamples = fuelCostInfo ? fuelCostInfo.samples : 0;
  const costPerKmFlags = fuelCostInfo ? fuelCostInfo.flags : [];
  const costPerKmFlagDetails = fuelCostInfo ? fuelCostInfo.flagDetails : [];
  const costPerKmSpanKm = fuelCostInfo ? fuelCostInfo.spanKm : null;
  const profitPerKm = kmDriven ? Math.round((profit / kmDriven) * 100) / 100 : null;
  const profitPerDay = Math.round((profit / daysInPeriod(year, month)) * 100) / 100;

  const fuelSpend = expenseSummary.categories.Fuel;
  const workShareInfo = computeWorkShare(vehicleExpenses, income, periodStart, periodEnd);

  const shiftTotals = computeShiftTotals(income, totalIncome, fuelSpend, workShareInfo.workShare);

  const period = { year };
  if (month) period.month = month;

  const result = {
    period,
    totalIncome,
    totalExpenses,
    profit,
    profitPerKm,
    profitPerDay,
    kmDriven,
    fuelSpend: fuelSpend || null,
    totalKm: workShareInfo.totalKm,
    personalKm: workShareInfo.personalKm,
    workShare: workShareInfo.workShare,
    workShareBasis: workShareInfo.basis,
    costPerKm,
    costPerKmSamples,
    costPerKmFlags,
    costPerKmFlagDetails,
    costPerKmSpanKm,
    ...shiftTotals,
  };

  if (breakdown === 'monthly' && !month) {
    result.months = await buildMonthlyBreakdown(
      userId,
      income,
      vehicleExpenses,
      year,
      query.vehicleId,
    );
  }

  return result;
}

module.exports = {
  INCOME_SOURCES,
  createIncome,
  listIncome,
  getIncome,
  updateIncome,
  deleteIncome,
  deleteAllByUser,
  getProfitSummary,
};
