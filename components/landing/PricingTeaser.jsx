'use client';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import styles from '@/views/LandingPage.module.css';

export default function PricingTeaser() {
  const { t } = useTranslation();

  if (process.env.NEXT_PUBLIC_STRIPE_ENABLED !== 'true') {
    return null;
  }

  return (
    <section className={styles.pricing}>
      <div className={styles.pricingInner}>
        <h2 className={styles.pricingHeading}>{t('landing.pricing.heading')}</h2>
        <p className={styles.pricingSubhead}>{t('landing.pricing.subhead')}</p>
        <div className={styles.pricingTiers}>
          <div className={styles.pricingTier}>
            <h3 className={styles.pricingTierName}>{t('landing.pricing.free.name')}</h3>
            <ul className={styles.pricingFeatureList}>
              <li>
                <Check size={16} className={styles.pricingCheck} />
                {t('landing.pricing.free.feature1')}
              </li>
              <li>
                <Check size={16} className={styles.pricingCheck} />
                {t('landing.pricing.free.feature2')}
              </li>
            </ul>
          </div>
          <div className={styles.pricingTier}>
            <h3 className={styles.pricingTierName}>{t('landing.pricing.pro.name')}</h3>
            <ul className={styles.pricingFeatureList}>
              <li>
                <Check size={16} className={styles.pricingCheck} />
                {t('landing.pricing.pro.feature1')}
              </li>
              <li>
                <Check size={16} className={styles.pricingCheck} />
                {t('landing.pricing.pro.feature2')}
              </li>
              <li>
                <Check size={16} className={styles.pricingCheck} />
                {t('landing.pricing.pro.feature3')}
              </li>
            </ul>
          </div>
        </div>
        <Link href="/register" className="btn-primary">
          {t('landing.pricing.cta')}
        </Link>
      </div>
    </section>
  );
}
