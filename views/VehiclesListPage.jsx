'use client';
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Car, Pencil, Trash2 } from 'lucide-react';
import { vehiclesApi } from '@/services/apiService.js';
import { useAutoClear } from '@/hooks/useAutoClear.js';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import Loading from '@/components/Loading.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import Modal from '@/components/Modal.jsx';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.jsx';
import NumericInput from '@/components/NumericInput.jsx';
import styles from './VehiclesListPage.module.css';

function VehicleFormModal({ open, initial, onSubmit, onCancel, error, loading }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || '');
  const [currentKm, setCurrentKm] = useState(initial?.currentKm ?? 0);
  const [prevOpen, setPrevOpen] = useState(open);

  // Derived-state reset: re-seed fields whenever the modal is (re)opened.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setName(initial?.name || '');
      setCurrentKm(initial?.currentKm ?? 0);
    }
  }

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ name, currentKm: Number(currentKm) });
  }

  return (
    <Modal open={open} labelledBy="vehicle-modal-title">
      <h3 id="vehicle-modal-title">{initial ? t('vehicles.editVehicle') : t('vehicles.addNew')}</h3>
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
          <label htmlFor="vehicle-current-km">{t('vehicles.fields.currentKm')}</label>
          <NumericInput
            id="vehicle-current-km"
            name="currentKm"
            integer
            min="0"
            value={currentKm}
            onChange={(e) => setCurrentKm(e.target.value)}
          />
          <small>{t('vehicles.fields.currentKmHint')}</small>
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
    </Modal>
  );
}

VehicleFormModal.propTypes = {
  open: PropTypes.bool.isRequired,
  initial: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  error: PropTypes.string,
  loading: PropTypes.bool,
};

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

  function renderVehicleList() {
    if (loading) return <Loading />;
    if (vehicles.length === 0) {
      return <p style={{ color: 'var(--muted)' }}>{t('vehicles.noVehicles')}</p>;
    }
    return (
      <ul className={styles.list}>
        {vehicles.map((v) => (
          <li key={v.id} className={styles.row}>
            <div className={styles.info}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Car size={16} aria-hidden="true" />
                <strong>{v.name}</strong>
              </span>
              <div className={styles.meta}>{t('vehicles.currentKm', { km: v.currentKm ?? 0 })}</div>
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
    );
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

      {renderVehicleList()}

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
