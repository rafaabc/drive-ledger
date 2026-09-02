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
import { formatDate, currentYear, todayISO } from '@/utils/formatDate.js';
import { formatCurrency } from '@/utils/formatCurrency.js';
import styles from './IncomeListPage.module.css';

const SOURCES = ['Uber', '99', 'iFood', 'Wolt', 'Other'];
const SHIFT_MODE_KEY = 'income:shiftMode';

function sourceLabel(source, t) {
  return source === 'Other' ? t('income.sources.Other') : source;
}

function shiftHoursLabel(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let diffMin = eh * 60 + em - (sh * 60 + sm);
  if (diffMin < 0) diffMin += 24 * 60;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
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
    if (initial?.startTime || initial?.km) return true;
    if (initial) return false;
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SHIFT_MODE_KEY) === '1';
  });
  const [startTime, setStartTime] = useState(initial?.startTime || '');
  const [endTime, setEndTime] = useState(initial?.endTime || '');
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
      setStartTime(initial?.startTime || '');
      setEndTime(initial?.endTime || '');
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

  const durationLabel = shiftMode ? shiftHoursLabel(startTime, endTime) : null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      date,
      amount: Number(amount),
      source,
      note: note || undefined,
      vehicleId: vehicleId || undefined,
      startTime: shiftMode && startTime ? startTime : undefined,
      endTime: shiftMode && endTime ? endTime : undefined,
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
          <input
            id="income-amount"
            type="number"
            inputMode="decimal"
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
            <div className={styles.shiftRow}>
              <div className="form-group">
                <label htmlFor="income-start-time">{t('income.fields.startTime')}</label>
                <input
                  id="income-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="income-end-time">{t('income.fields.endTime')}</label>
                <input
                  id="income-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            {durationLabel && (
              <p className={styles.shiftReadout}>
                {durationLabel}
                {km !== '' ? ` · ${km} km` : ''}
              </p>
            )}
            <div className={styles.shiftRow}>
              <div className="form-group">
                <label htmlFor="income-km">{t('income.fields.km')}</label>
                <input
                  id="income-km"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="income-deliveries">{t('income.fields.deliveries')}</label>
                <input
                  id="income-deliveries"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
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

function netEarningsClass(netEarnings) {
  if (netEarnings == null) return '';
  return netEarnings >= 0 ? styles.profitPositive : styles.profitNegative;
}

function ProfitSummaryCard({ summary, currency, period, onPeriodChange, t }) {
  if (!summary) return null;
  const netClass = netEarningsClass(summary.netEarnings);

  return (
    <div className={`card ${styles.summaryCard}`}>
      <div className={styles.summaryHeader}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{t('income.summary.heading')}</h3>
        <div className={styles.periodSwitch}>
          <button
            type="button"
            className={period === 'month' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => onPeriodChange('month')}
          >
            {t('income.summary.thisMonth')}
          </button>
          <button
            type="button"
            className={period === 'year' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => onPeriodChange('year')}
          >
            {t('income.summary.thisYear')}
          </button>
        </div>
      </div>

      <div className={styles.headline}>
        <span className={styles.headlineLabel}>{t('income.summary.netPerHour')}</span>
        <span className={`${styles.headlineValue} ${netClass}`}>
          {summary.netPerHour == null
            ? t('income.summary.noHoursData')
            : `${formatCurrency(summary.netPerHour, currency)}/h`}
        </span>
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
    </div>
  );
}

ProfitSummaryCard.propTypes = {
  summary: PropTypes.object,
  currency: PropTypes.string,
  period: PropTypes.string.isRequired,
  onPeriodChange: PropTypes.func.isRequired,
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
  const { currency, plan } = useAuth();
  const isPro = plan === 'pro';
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [period, setPeriod] = useState('year');

  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useAutoClear(successMsg, setSuccessMsg);

  const year = currentYear();
  const month = period === 'month' ? new Date().getMonth() + 1 : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        incomeApi.list({ year, month }),
        incomeApi.summary({ year, month }),
      ]);
      setEntries(list.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (!isPro) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load is async, setState only after await
    load();
    vehiclesApi
      .list()
      .then((list) => setVehicles(list))
      .catch(() => {});
  }, [isPro, load]);

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
      load();
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
      load();
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

      {successMsg && <ErrorBanner type="success" message={successMsg} />}
      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading />
      ) : (
        <>
          <ProfitSummaryCard
            summary={summary}
            currency={currency}
            period={period}
            onPeriodChange={setPeriod}
            t={t}
          />

          {entries.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>{t('income.noIncome')}</p>
          ) : (
            <ul className={styles.list}>
              {entries.map((i) => {
                const duration = shiftHoursLabel(i.startTime, i.endTime);
                return (
                  <li key={i.id} className={styles.row}>
                    <div className={styles.info}>
                      <strong>{formatCurrency(i.amount, currency)}</strong>
                      <span> · {sourceLabel(i.source, t)}</span>
                      <div className={styles.meta}>
                        {formatDate(i.date)}
                        {duration && ` · ${duration}`}
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
