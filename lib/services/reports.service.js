const incomeService = require('./income.service');
const expensesService = require('./expenses.service');
const vehiclesService = require('./vehicles.service');
const userModel = require('../models/user.model');
const { DEFAULT_CURRENCY } = require('../constants/currencies');
const { assertProPlan } = require('../planGate');
// Turbopack's CJS/ESM interop can wrap pdfkit's export in { default }
// instead of returning the constructor directly — unwrap defensively.
const pdfkit = require('pdfkit');
const PDFDocument = pdfkit.default || pdfkit;

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function periodLabel(period) {
  return period.month
    ? `${period.year}-${String(period.month).padStart(2, '0')}`
    : String(period.year);
}

function money(amount, currency) {
  return `${amount.toFixed(2)} ${currency}`;
}

async function buildReportData(userId, query) {
  await assertProPlan(userId, 'reports_feature_locked');

  const user = await userModel.findById(userId);
  const currency = user?.currency || DEFAULT_CURRENCY;

  const profit = await incomeService.getProfitSummary(userId, query);
  const expenseSummary = await expensesService.getSummary(userId, {
    year: query.year,
    month: query.month,
    vehicleId: query.vehicleId,
  });

  let vehicleName = null;
  if (query.vehicleId) {
    const vehicle = await vehiclesService.getVehicle(userId, query.vehicleId);
    vehicleName = vehicle.name;
  }

  return {
    period: profit.period,
    vehicleName,
    currency,
    categories: expenseSummary.categories,
    totalExpenses: profit.totalExpenses,
    totalIncome: profit.totalIncome,
    profit: profit.profit,
    profitPerDay: profit.profitPerDay,
    profitPerKm: profit.profitPerKm,
  };
}

function buildCsv(report) {
  const { currency } = report;
  const lines = [
    'Norevify Tax Report',
    `Period,${periodLabel(report.period)}`,
    ...(report.vehicleName ? [`Vehicle,${report.vehicleName}`] : []),
    `Currency,${currency}`,
    '',
    'Category,Amount',
    ...Object.entries(report.categories).map(
      ([cat, amount]) => `${cat},${money(amount, currency)}`,
    ),
    `Total Expenses,${money(report.totalExpenses, currency)}`,
    '',
    `Total Income,${money(report.totalIncome, currency)}`,
    `Net Profit,${money(report.profit, currency)}`,
    `Profit per Day,${money(report.profitPerDay, currency)}`,
    `Profit per Km,${report.profitPerKm != null ? money(report.profitPerKm, currency) : 'N/A'}`,
  ];
  return lines.join('\n') + '\n';
}

function buildPdf(report) {
  const { currency } = report;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Norevify — Tax Report');
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Period: ${periodLabel(report.period)}`);
    if (report.vehicleName) doc.text(`Vehicle: ${report.vehicleName}`);
    doc.text(`Currency: ${currency}`);
    doc.moveDown();

    doc.fontSize(13).text('Expenses by category');
    doc.fontSize(11);
    for (const [cat, amount] of Object.entries(report.categories)) {
      doc.text(`${cat}: ${money(amount, currency)}`);
    }
    doc.moveDown(0.5);
    doc.text(`Total Expenses: ${money(report.totalExpenses, currency)}`);
    doc.moveDown();

    doc.fontSize(13).text('Income & profit');
    doc.fontSize(11);
    doc.text(`Total Income: ${money(report.totalIncome, currency)}`);
    doc.text(`Net Profit: ${money(report.profit, currency)}`);
    doc.text(`Profit per Day: ${money(report.profitPerDay, currency)}`);
    doc.text(
      `Profit per Km: ${report.profitPerKm != null ? money(report.profitPerKm, currency) : 'N/A'}`,
    );

    doc.end();
  });
}

async function generateReport(userId, query, format) {
  if (!['csv', 'pdf'].includes(format)) throw makeError(400, 'format must be csv or pdf');

  const report = await buildReportData(userId, query);
  const filenameBase = `norevify-report-${periodLabel(report.period)}`;

  if (format === 'csv') {
    return { contentType: 'text/csv', filename: `${filenameBase}.csv`, body: buildCsv(report) };
  }
  const pdfBuffer = await buildPdf(report);
  return { contentType: 'application/pdf', filename: `${filenameBase}.pdf`, body: pdfBuffer };
}

module.exports = { generateReport };
