'use client';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { incomeApi, vehiclesApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useAutoClear } from '@/hooks/useAutoClear.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import Modal from '@/components/Modal.jsx';
import VehicleSelect from '@/components/VehicleSelect.jsx';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.jsx';
import NumericInput from '@/components/NumericInput.jsx';
import MonthBreakdown from '@/components/MonthBreakdown.jsx';
import breakdownStyles from '@/components/MonthBreakdown.module.css';
import { formatDate, currentYear, getMonthName, todayISO } from '@/utils/formatDate.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import styles from './IncomeListPage.module.css';

const SOURCES = ['Uber', '99', 'iFood', 'Wolt', 'Other'];
const SHIFT_MODE_KEY = 'income:shiftMode';

function sourceLabel(source, t) {
  return source === 'Other' ? t('income.sources.Other') : source;
}

function shiftMinutes(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let diffMin = eh * 60 + em - (sh * 60 + sm);
  if (diffMin < 0) diffMin += 24 * 60;
  return diffMin;
}

function minutesLabel(totalMin) {
  if (totalMin == null) return null;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function shiftHoursLabel(startTime, endTime) {
  return minutesLabel(shiftMinutes(startTime, endTime));
}

// A row's segments if present, else its legacy startTime/endTime lifted into one.
function entrySegments(entry) {
  if (entry?.segments?.length) return entry.segments;
  if (entry?.startTime && entry?.endTime)
    return [{ startTime: entry.startTime, endTime: entry.endTime }];
  return [];
}

function totalShiftMinutes(segments) {
  const mins = segments.map((s) => shiftMinutes(s.startTime, s.endTime)).filter((m) => m != null);
  if (mins.length === 0) return null;
  return mins.reduce((a, b) => a + b, 0);
}

function IncomeFormModal({
  open,
  initial,
  vehicles = [],
  defaultSource,
  onSubmit,
  onCancel,
  error,
  loading,
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(initial?.date?.slice(0, 10) || todayISO());
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [source, setSource] = useState(initial?.source || defaultSource || SOURCES[0]);
  const [note, setNote] = useState(initial?.note || '');
  const [vehicleId, setVehicleId] = useState(
    initial?.vehicleId || (vehicles.length > 0 ? vehicles[0].id : ''),
  );
  const [shiftMode, setShiftMode] = useState(() => {
    if (initial?.startTime || initial?.segments?.length || initial?.km) return true;
    if (initial) return false;
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SHIFT_MODE_KEY) === '1';
  });
  const emptySegments = () => [{ startTime: '', endTime: '' }];
  const [segments, setSegments] = useState(() => {
    const existing = entrySegments(initial);
    return existing.length > 0 ? existing : emptySegments();
  });
  const [km, setKm] = useState(initial?.km ?? '');
  const [deliveries, setDeliveries] = useState(initial?.deliveries ?? '');
  const [prevOpen, setPrevOpen] = useState(open);

  // Derived-state reset: re-seed fields whenever the modal is (re)opened.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setDate(initial?.date?.slice(0, 10) || todayISO());
      setAmount(initial?.amount ?? '');
      setSource(initial?.source || defaultSource || SOURCES[0]);
      setNote(initial?.note || '');
      setVehicleId(initial?.vehicleId || (vehicles.length > 0 ? vehicles[0].id : ''));
      const existing = entrySegments(initial);
      setSegments(existing.length > 0 ? existing : emptySegments());
      setKm(initial?.km ?? '');
      setDeliveries(initial?.deliveries ?? '');
    }
  }

  function toggleShiftMode() {
    const next = !shiftMode;
    setShiftMode(next);
    try {
      window.localStorage.setItem(SHIFT_MODE_KEY, next ? '1' : '0');
    } catch {
      // localStorage unavailable (private window etc.) — non-fatal, mode just won't persist.
    }
  }

  if (!open) return null;

  const filledSegments = segments.filter((s) => s.startTime && s.endTime);
  const totalLabel = shiftMode ? minutesLabel(totalShiftMinutes(filledSegments)) : null;

  function updateSegment(index, field, value) {
    setSegments(segments.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addSegment() {
    setSegments([...segments, { startTime: '', endTime: '' }]);
  }

  function removeSegment(index) {
    setSegments(segments.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      date,
      amount: Number(amount),
      source,
      note: note || undefined,
      vehicleId: vehicleId || undefined,
      segments: shiftMode && filledSegments.length > 0 ? filledSegments : undefined,
      km: shiftMode && km !== '' ? Number(km) : undefined,
      deliveries: shiftMode && deliveries !== '' ? Number(deliveries) : undefined,
    });
  }

  return (
    <Modal open={open} labelledBy="income-modal-title">
      <h3 id="income-modal-title">{initial ? t('income.editIncome') : t('income.addNew')}</h3>
      {error && <ErrorBanner message={error} />}
      <label className={styles.shiftToggle}>
        <input type="checkbox" checked={shiftMode} onChange={toggleShiftMode} />
        {t('income.fields.shiftMode')}
      </label>
      <form onSubmit={handleSubmit}>
        {vehicles.length > 1 && (
          <VehicleSelect
            vehicles={vehicles}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          />
        )}
        <div className="form-group">
          <label htmlFor="income-date">{t('income.fields.date')}</label>
          <input
            id="income-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="income-amount">{t('income.fields.amount')}</label>
          <NumericInput
            id="income-amount"
            name="amount"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="income-source">{t('income.fields.source')}</label>
          <select id="income-source" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceLabel(s, t)}
              </option>
            ))}
          </select>
        </div>
        {shiftMode && (
          <>
            <div className="form-group">
              <label>{t('income.fields.timeBlocks')}</label>
              <div className={styles.blocks}>
                {segments.map((seg, i) => (
                  <div className={styles.blockRow} key={i}>
                    <input
                      type="time"
                      aria-label={t('income.fields.startTime')}
                      value={seg.startTime}
                      onChange={(e) => updateSegment(i, 'startTime', e.target.value)}
                    />
                    <span className={styles.blockDash}>–</span>
                    <input
                      type="time"
                      aria-label={t('income.fields.endTime')}
                      value={seg.endTime}
                      onChange={(e) => updateSegment(i, 'endTime', e.target.value)}
                    />
                    <span className={styles.blockDuration}>
                      {shiftHoursLabel(seg.startTime, seg.endTime) || ''}
                    </span>
                    {segments.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeBlock}
                        onClick={() => removeSegment(i)}
                        aria-label={t('income.fields.removeBlock')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.addBlock} onClick={addSegment}>
                  + {t('income.fields.addBlock')}
                </button>
                {totalLabel && (
                  <div className={styles.blockTotal}>
                    <span>{t('income.fields.totalWorked')}</span>
                    <span>{totalLabel}</span>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.shiftRow}>
              <div className="form-group">
                <label htmlFor="income-km">{t('income.fields.km')}</label>
                <NumericInput
                  id="income-km"
                  name="km"
                  min="0"
                  step="0.1"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="income-deliveries">{t('income.fields.deliveries')}</label>
                <NumericInput
                  id="income-deliveries"
                  name="deliveries"
                  integer
                  min="0"
                  value={deliveries}
                  onChange={(e) => setDeliveries(e.target.value)}
                />
              </div>
            </div>
          </>
        )}
        <div className="form-group">
          <label htmlFor="income-note">{t('income.fields.note')}</label>
          <input id="income-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !amount}>
            {loading ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

IncomeFormModal.propTypes = {
  open: PropTypes.bool.isRequired,
  initial: PropTypes.object,
  vehicles: PropTypes.array,
  defaultSource: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  error: PropTypes.string,
  loading: PropTypes.bool,
};

/**
 * Turns the raw net numbers into a plain "does it pay?" verdict.
 * - null netEarnings: no verdict yet (not enough data — the caveat hints
 *   rendered below already explain why).
 * - negative netEarnings: always a "no", regardless of any target.
 * - a target set and netPerHour below it: "barely" — positive, but not worth it.
 * - otherwise: "yes", optionally phrased against the target.
 */
function profitVerdict(summary, target, currency, t) {
  if (summary.netEarnings == null) return null;
  if (summary.netEarnings < 0) return { level: 'bad', text: t('income.summary.verdict.no') };

  const targetLabel = target != null ? `${formatCurrency(target, currency)}` : null;
  if (target != null && summary.netPerHour != null && summary.netPerHour < target) {
    return { level: 'warn', text: t('income.summary.verdict.barely', { target: targetLabel }) };
  }
  if (target != null) {
    return {
      level: 'good',
      text: t('income.summary.verdict.yesVsTarget', { target: targetLabel }),
    };
  }
  return { level: 'good', text: t('income.summary.verdict.yes') };
}

const VERDICT_CLASS = {
  bad: 'profitNegative',
  warn: 'profitWarn',
  good: 'profitPositive',
};

function ProfitSummaryCard({ summary, currency, targetHourlyRate, t }) {
  if (!summary) return null;
  const verdict = profitVerdict(summary, targetHourlyRate, currency, t);
  const netClass = verdict ? styles[VERDICT_CLASS[verdict.level]] : '';

  return (
    <div className={`card ${styles.summaryCard}`}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{t('income.summary.heading')}</h3>

      <div className={styles.headline}>
        <span className={styles.headlineLabel}>{t('income.summary.netPerHour')}</span>
        <span className={`${styles.headlineValue} ${netClass}`}>
          {summary.netPerHour == null
            ? t('income.summary.noHoursData')
            : `${formatCurrency(summary.netPerHour, currency)}/h`}
        </span>
        {verdict && <p className={`${styles.verdict} ${netClass}`}>{verdict.text}</p>}
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.totalIncome')}</span>
          <span className={styles.summaryValue}>
            {formatCurrency(summary.totalIncome, currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.fuelCost')}</span>
          <span className={styles.summaryValue}>
            {summary.fuelCost == null
              ? t('income.summary.noCostData')
              : formatCurrency(summary.fuelCost, currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.netEarnings')}</span>
          <span className={`${styles.summaryValue} ${netClass}`}>
            {summary.netEarnings == null
              ? t('income.summary.noCostData')
              : formatCurrency(summary.netEarnings, currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.hours')}</span>
          <span className={styles.summaryValue}>{summary.hours ?? '—'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.workKm')}</span>
          <span className={styles.summaryValue}>{summary.workKm ?? '—'}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.costPerKm')}</span>
          <span className={styles.summaryValue}>
            {summary.costPerKm == null
              ? t('income.summary.noCostData')
              : `${formatCurrency(summary.costPerKm, currency)}/km`}
          </span>
        </div>
      </div>

      {summary.costPerKm != null && summary.costPerKmSamples < 3 && (
        <p className={styles.unstableHint}>
          {t('income.summary.unstable', { count: summary.costPerKmSamples })}
        </p>
      )}
      {summary.costPerKm == null && (
        <p className={styles.unstableHint}>{t('income.summary.needsTwoFills')}</p>
      )}
      <p className={styles.unstableHint}>{t('income.summary.fuelOnlyNote')}</p>
    </div>
  );
}

ProfitSummaryCard.propTypes = {
  summary: PropTypes.object,
  currency: PropTypes.string,
  targetHourlyRate: PropTypes.number,
  t: PropTypes.func.isRequired,
};

function UpgradePrompt({ t }) {
  return (
    <div className={styles.upgradeCard}>
      <div className={styles.upgradeHeading}>{t('income.upgrade.heading')}</div>
      <div className={styles.upgradeBody}>{t('income.upgrade.body')}</div>
    </div>
  );
}

UpgradePrompt.propTypes = {
  t: PropTypes.func.isRequired,
};

function IncomeListPageInner() {
  const { t } = useTranslation();
  const { currency, plan, targetHourlyRate } = useAuth();
  const isPro = plan === 'pro';
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState({ year: String(currentYear()), month: '' });

  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useAutoClear(successMsg, setSuccessMsg);

  const load = useCallback(async (f, signal) => {
    if (!f.year || f.year.length < 4 || Number(f.year) > currentYear()) return;
    setLoading(true);
    try {
      const year = f.year;
      const month = f.month || undefined;
      const [list, sum] = await Promise.all([
        incomeApi.list({ year, month }, signal),
        incomeApi.summary({ year, month, breakdown: month ? undefined : 'monthly' }, signal),
      ]);
      setEntries(list.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setSummary(sum);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPro) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load is async, setState only after await
    load(filters, controller.signal);
    return () => controller.abort();
  }, [isPro, filters, load]);

  useEffect(() => {
    if (!isPro) return;
    vehiclesApi
      .list()
      .then((list) => setVehicles(list))
      .catch(() => {});
  }, [isPro]);

  function handleFilterChange(e) {
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function viewMonth(m) {
    setFilters((f) => ({ ...f, month: String(m) }));
  }

  useEffect(() => {
    if (isPro && searchParams.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a one-shot query param
      setEditing('new');
    }
  }, [isPro, searchParams]);

  const defaultSource = entries.length > 0 ? entries[0].source : undefined;

  async function handleFormSubmit(data) {
    setFormError('');
    setFormLoading(true);
    try {
      if (editing === 'new') {
        await incomeApi.create(data);
        setSuccessMsg(t('income.actions.createSuccess'));
      } else {
        await incomeApi.update(editing.id, data);
        setSuccessMsg(t('income.actions.updateSuccess'));
      }
      setEditing(null);
      load(filters);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await incomeApi.remove(deleting.id);
      setDeleting(null);
      setSuccessMsg(t('income.actions.deleteSuccess'));
      load(filters);
    } catch (e) {
      setError(e.message);
      setDeleting(null);
    }
  }

  if (!isPro) {
    return (
      <div className="page">
        <PageTitle style={{ marginBottom: '1.5rem' }}>{t('income.heading')}</PageTitle>
        <UpgradePrompt t={t} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <PageTitle>{t('income.heading')}</PageTitle>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
          + {t('common.new')}
        </button>
      </div>

      <div className={`card ${styles.filterCard}`}>
        <div className={styles.filterForm}>
          <div className={styles.filterField}>
            <label htmlFor="income-year">{t('income.filters.year')}</label>
            <NumericInput
              id="income-year"
              name="year"
              integer
              value={filters.year}
              onChange={handleFilterChange}
              min="2000"
              max={currentYear()}
            />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="income-month">{t('income.filters.month')}</label>
            <select
              id="income-month"
              name="month"
              value={filters.month}
              onChange={handleFilterChange}
            >
              <option value="">{t('summary.allMonths')}</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {getMonthName(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {successMsg && <ErrorBanner type="success" message={successMsg} />}
      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading />
      ) : (
        <>
          <ProfitSummaryCard
            summary={summary}
            currency={currency}
            targetHourlyRate={targetHourlyRate}
            t={t}
          />

          {!filters.month && summary?.months && (
            <div className={`card ${styles.breakdownCard}`} data-testid="income-month-breakdown">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                {filters.year} {t('income.summary.breakdown')}
              </h3>
              <MonthBreakdown
                rows={summary.months.map((row) => {
                  if (!row.totalIncome) return { month: row.month, empty: true };
                  const verdict = profitVerdict(row, targetHourlyRate, currency, t);
                  const rowClass = verdict ? styles[VERDICT_CLASS[verdict.level]] : '';
                  return {
                    month: row.month,
                    headlineValue: (
                      <span className={rowClass}>
                        {row.netEarnings == null
                          ? t('income.summary.noCostData')
                          : formatCurrency(row.netEarnings, currency)}
                      </span>
                    ),
                    details: (
                      <>
                        <div className={breakdownStyles.monthDetailRow}>
                          <span>{t('income.summary.totalIncome')}</span>
                          <span className={breakdownStyles.value}>
                            {formatCurrency(row.totalIncome, currency)}
                          </span>
                        </div>
                        <div className={breakdownStyles.monthDetailRow}>
                          <span>{t('income.summary.fuelCost')}</span>
                          <span className={breakdownStyles.value}>
                            {row.fuelCost == null
                              ? t('income.summary.noCostData')
                              : formatCurrency(row.fuelCost, currency)}
                          </span>
                        </div>
                        <div className={breakdownStyles.monthDetailRow}>
                          <span>{t('income.summary.netPerHour')}</span>
                          <span className={breakdownStyles.value}>
                            {row.netPerHour == null
                              ? t('income.summary.noHoursData')
                              : `${formatCurrency(row.netPerHour, currency)}/h`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => viewMonth(row.month)}
                        >
                          {t('income.summary.viewMonth')}
                        </button>
                      </>
                    ),
                  };
                })}
              />
            </div>
          )}

          {entries.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>{t('income.noIncome')}</p>
          ) : (
            <ul className={styles.list}>
              {entries.map((i) => {
                const segs = entrySegments(i);
                const duration = minutesLabel(totalShiftMinutes(segs));
                return (
                  <li key={i.id} className={styles.row}>
                    <div className={styles.info}>
                      <strong>{formatCurrency(i.amount, currency)}</strong>
                      <span> · {sourceLabel(i.source, t)}</span>
                      <div className={styles.meta}>
                        {formatDate(i.date)}
                        {duration && ` · ${duration}`}
                        {segs.length > 1 &&
                          ` (${t('income.fields.blockCount', { count: segs.length })})`}
                        {i.km != null && ` · ${i.km} km`}
                        {i.note && ` · ${i.note}`}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setFormError('');
                          setEditing(i);
                        }}
                        aria-label={t('common.edit')}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => setDeleting(i)}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <IncomeFormModal
        open={!!editing}
        initial={editing === 'new' ? null : editing}
        vehicles={vehicles}
        defaultSource={defaultSource}
        onSubmit={handleFormSubmit}
        onCancel={() => setEditing(null)}
        error={formError}
        loading={formLoading}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        message={t('income.actions.confirmDelete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export default function IncomeListPage() {
  return (
    <Suspense fallback={<Loading />}>
      <IncomeListPageInner />
    </Suspense>
  );
}
