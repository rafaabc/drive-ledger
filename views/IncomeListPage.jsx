'use client';
import { useState, useEffect, useCallback } from 'react';
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

const SOURCES = ['Uber', '99', 'iFood', 'Other'];

function sourceLabel(source, t) {
  return source === 'Other' ? t('income.sources.Other') : source;
}

function IncomeFormModal({ open, initial, vehicles = [], onSubmit, onCancel, error, loading }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(initial?.date?.slice(0, 10) || todayISO());
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [source, setSource] = useState(initial?.source || SOURCES[0]);
  const [note, setNote] = useState(initial?.note || '');
  const [vehicleId, setVehicleId] = useState(
    initial?.vehicleId || (vehicles.length > 0 ? vehicles[0].id : ''),
  );
  const [prevOpen, setPrevOpen] = useState(open);

  // Derived-state reset: re-seed fields whenever the modal is (re)opened.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setDate(initial?.date?.slice(0, 10) || todayISO());
      setAmount(initial?.amount ?? '');
      setSource(initial?.source || SOURCES[0]);
      setNote(initial?.note || '');
      setVehicleId(initial?.vehicleId || (vehicles.length > 0 ? vehicles[0].id : ''));
    }
  }

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      date,
      amount: Number(amount),
      source,
      note: note || undefined,
      vehicleId: vehicleId || undefined,
    });
  }

  return (
    <Modal open={open} labelledBy="income-modal-title">
      <h3 id="income-modal-title">{initial ? t('income.editIncome') : t('income.addNew')}</h3>
      {error && <ErrorBanner message={error} />}
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
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  error: PropTypes.string,
  loading: PropTypes.bool,
};

function ProfitSummaryCard({ summary, currency, t }) {
  if (!summary) return null;
  const profitClass = summary.profit >= 0 ? styles.profitPositive : styles.profitNegative;
  return (
    <div className={`card ${styles.summaryCard}`}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{t('income.summary.heading')}</h3>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.totalIncome')}</span>
          <span className={styles.summaryValue}>
            {formatCurrency(summary.totalIncome, currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.totalExpenses')}</span>
          <span className={styles.summaryValue}>
            {formatCurrency(summary.totalExpenses, currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.profit')}</span>
          <span className={`${styles.summaryValue} ${profitClass}`}>
            {formatCurrency(summary.profit, currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.profitPerDay')}</span>
          <span className={styles.summaryValue}>
            {formatCurrency(summary.profitPerDay, currency)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('income.summary.profitPerKm')}</span>
          <span className={styles.summaryValue}>
            {summary.profitPerKm == null
              ? t('income.summary.noKmData')
              : formatCurrency(summary.profitPerKm, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

ProfitSummaryCard.propTypes = {
  summary: PropTypes.object,
  currency: PropTypes.string,
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

export default function IncomeListPage() {
  const { t } = useTranslation();
  const { currency, plan } = useAuth();
  const isPro = plan === 'pro';

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [vehicles, setVehicles] = useState([]);

  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useAutoClear(successMsg, setSuccessMsg);

  const year = currentYear();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        incomeApi.list({ year }),
        incomeApi.summary({ year }),
      ]);
      setEntries(list.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (!isPro) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load is async, setState only after await
    load();
    vehiclesApi
      .list()
      .then((list) => setVehicles(list))
      .catch(() => {});
  }, [isPro, load]);

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
          <ProfitSummaryCard summary={summary} currency={currency} t={t} />

          {entries.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>{t('income.noIncome')}</p>
          ) : (
            <ul className={styles.list}>
              {entries.map((i) => (
                <li key={i.id} className={styles.row}>
                  <div className={styles.info}>
                    <strong>{formatCurrency(i.amount, currency)}</strong>
                    <span> · {sourceLabel(i.source, t)}</span>
                    <div className={styles.meta}>
                      {formatDate(i.date)}
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
              ))}
            </ul>
          )}
        </>
      )}

      <IncomeFormModal
        open={!!editing}
        initial={editing === 'new' ? null : editing}
        vehicles={vehicles}
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
