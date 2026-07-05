'use client';
import { Car, Fuel, TrendingUp, FileText, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from '@/views/LandingPage.module.css';

const FEATURES = [
  { key: 'multiVehicle', Icon: Car },
  { key: 'expenseTracking', Icon: Fuel },
  { key: 'incomeProfit', Icon: TrendingUp },
  { key: 'taxReports', Icon: FileText },
  { key: 'reminders', Icon: Bell },
];

export default function FeatureGrid() {
  const { t } = useTranslation();

  return (
    <section className={styles.features}>
      <div className={styles.featuresGrid}>
        {FEATURES.map(({ key, Icon }) => (
          <div key={key} className={styles.featureCard}>
            <Icon size={28} strokeWidth={1.5} className={styles.featureIcon} />
            <h3 className={styles.featureTitle}>{t(`landing.features.${key}.title`)}</h3>
            <p className={styles.featureBlurb}>{t(`landing.features.${key}.blurb`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
