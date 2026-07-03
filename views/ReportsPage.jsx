'use client';
import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { reportsApi } from '@/services/apiService.js';
import { useAuth } from '@/context/AuthContext.jsx';
import ErrorBanner from '@/components/ErrorBanner.jsx';
import PageTitle from '@/components/PageTitle.jsx';
import { currentYear } from '@/utils/formatDate.js';
import styles from './ReportsPage.module.css';

function buildYearOptions() {
  const cy = currentYear();
  return [cy, cy - 1, cy - 2, cy - 3, cy - 4].filter((y) => y >= 2000);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function UpgradePrompt({ t }) {
  return (
    <div className={styles.upgradeCard}>
      <div className={styles.upgradeHeading}>{t('reports.upgrade.heading')}</div>
      <div className={styles.upgradeBody}>{t('reports.upgrade.body')}</div>
    </div>
  );
}

UpgradePrompt.propTypes = {
  t: PropTypes.func.isRequired,
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const { plan } = useAuth();
  const isPro = plan === 'pro';

  const [year, setYear] = useState(String(currentYear()));
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');

  async function handleDownload(format) {
    setError('');
    setDownloading(format);
    try {
      const { blob, filename } = await reportsApi.download({ year, format });
      triggerDownload(blob, filename);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(null);
    }
  }

  if (!isPro) {
    return (
      <div className="page">
        <PageTitle style={{ marginBottom: '1.5rem' }}>{t('reports.heading')}</PageTitle>
        <UpgradePrompt t={t} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <PageTitle>{t('reports.heading')}</PageTitle>
      </div>
      <p className={styles.description}>{t('reports.description')}</p>

      {error && <ErrorBanner message={error} />}

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="report-year">{t('reports.year')}</label>
          <select id="report-year" value={year} onChange={(e) => setYear(e.target.value)}>
            {buildYearOptions().map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleDownload('csv')}
          disabled={downloading !== null}
        >
          {downloading === 'csv' ? t('reports.downloading') : t('reports.downloadCsv')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => handleDownload('pdf')}
          disabled={downloading !== null}
        >
          {downloading === 'pdf' ? t('reports.downloading') : t('reports.downloadPdf')}
        </button>
      </div>
    </div>
  );
}
