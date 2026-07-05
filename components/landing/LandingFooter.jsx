'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import styles from '@/views/LandingPage.module.css';

export default function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <span className={styles.footerWordmark}>{t('landing.footer.wordmark')}</span>
        <nav className={styles.footerLinks}>
          <Link href="/privacy">{t('landing.footer.privacy')}</Link>
          <Link href="/terms">{t('landing.footer.terms')}</Link>
          <Link href="/login">{t('landing.footer.login')}</Link>
        </nav>
      </div>
    </footer>
  );
}
