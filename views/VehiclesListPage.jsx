'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Pencil, Trash2 } from 'lucide-react';
import { vehiclesApi } from '@/services/apiService.js';
import { useAutoClear } from '@/hooks/useAutoClear.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.jsx';
import styles from './VehiclesListPage.module.css';

function VehicleFormModal({ open, initial, onSubmit, onCancel, error, loading }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || '');
  const [make, setMake] = useState(initial?.make || '');
  const [model, setModel] = useState(initial?.model || '');
  const [prevOpen, setPrevOpen] = useState(open);

  // Derived-state reset: re-seed fields whenever the modal is (re)opened.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName(initial?.name || '');
      setMake(initial?.make || '');
      setModel(initial?.model || '');
    }
  }

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ name, make: make || undefined, model: model || undefined });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3>{initial ? t('vehicles.editVehicle') : t('vehicles.addNew')}</h3>
        {error && <ErrorBanner message={error} />}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="vehicle-name">{t('vehicles.fields.name')}</label>
            <input
              id="vehicle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('vehicles.fields.namePlaceholder')}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="vehicle-make">{t('vehicles.fields.make')}</label>
            <input id="vehicle-make" value={make} onChange={(e) => setMake(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="vehicle-model">{t('vehicles.fields.model')}</label>
            <input id="vehicle-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VehiclesListPage() {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [upgradePrompt, setUpgradePrompt] = useState(false);

  const [editing, setEditing] = useState(null); // vehicle being edited, or 'new'
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useAutoClear(successMsg, setSuccessMsg);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVehicles(await vehiclesApi.list());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load is async, setState only after await
    load();
  }, [load]);

  async function handleFormSubmit(data) {
    setFormError('');
    setFormLoading(true);
    try {
      if (editing === 'new') {
        await vehiclesApi.create(data);
        setSuccessMsg(t('vehicles.actions.createSuccess'));
      } else {
        await vehiclesApi.update(editing.id, data);
        setSuccessMsg(t('vehicles.actions.updateSuccess'));
      }
      setEditing(null);
      load();
    } catch (e) {
      if (e.status === 402) {
        setEditing(null);
        setUpgradePrompt(true);
      } else {
        setFormError(e.message);
      }
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    try {
      await vehiclesApi.remove(deleting.id);
      setDeleting(null);
      setSuccessMsg(t('vehicles.actions.deleteSuccess'));
      load();
    } catch (e) {
      setError(e.message);
      setDeleting(null);
    }
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <PageTitle>{t('vehicles.heading')}</PageTitle>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setUpgradePrompt(false);
            setEditing('new');
          }}
        >
          + {t('common.new')}
        </button>
      </div>

      {upgradePrompt && (
        <div className={styles.upgradeCard}>
          <div className={styles.upgradeHeading}>{t('vehicles.upgrade.heading')}</div>
          <div className={styles.upgradeBody}>{t('vehicles.upgrade.body')}</div>
        </div>
      )}

      {successMsg && <ErrorBanner type="success" message={successMsg} />}
      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading />
      ) : vehicles.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>{t('vehicles.noVehicles')}</p>
      ) : (
        <ul className={styles.list}>
          {vehicles.map((v) => (
            <li key={v.id} className={styles.row}>
              <div className={styles.info}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Car size={16} aria-hidden="true" />
                  <strong>{v.name}</strong>
                </span>
                {(v.make || v.model) && (
                  <div className={styles.subtitle}>
                    {[v.make, v.model].filter(Boolean).join(' ')}
                  </div>
                )}
                <div className={styles.meta}>
                  {t('vehicles.currentKm', { km: v.currentKm ?? 0 })}
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFormError('');
                    setEditing(v);
                  }}
                  aria-label={t('common.edit')}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => setDeleting(v)}
                  aria-label={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VehicleFormModal
        open={!!editing}
        initial={editing === 'new' ? null : editing}
        onSubmit={handleFormSubmit}
        onCancel={() => setEditing(null)}
        error={formError}
        loading={formLoading}
      />

      <DeleteConfirmDialog
        open={!!deleting}
        message={t('vehicles.actions.confirmDelete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
