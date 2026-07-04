'use client';
import LandingHero from '@/components/landing/LandingHero.jsx';
import FeatureGrid from '@/components/landing/FeatureGrid.jsx';
import PricingTeaser from '@/components/landing/PricingTeaser.jsx';
import LandingFooter from '@/components/landing/LandingFooter.jsx';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <LandingHero />
      <FeatureGrid />
      <PricingTeaser />
      <LandingFooter />
    </div>
  );
}
