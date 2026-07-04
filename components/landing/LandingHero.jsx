'use client';
import { Gauge } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import styles from '@/views/LandingPage.module.css';

export default function LandingHero() {
  const { t } = useTranslation();

  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <Gauge size={56} strokeWidth={1.5} className={styles.heroIcon} />
        <h1 className={styles.heroHeadline}>{t('landing.hero.headline')}</h1>
        <p className={styles.heroSubhead}>{t('landing.hero.subhead')}</p>
        <div className={styles.heroActions}>
          <Link href="/register" className="btn-primary">
            {t('landing.hero.ctaPrimary')}
          </Link>
          <Link href="/login" className={styles.heroSecondaryLink}>
            {t('landing.hero.ctaSecondary')}
          </Link>
        </div>
      </div>
    </section>
  );
}
