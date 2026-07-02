'use client';
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  LogOut,
  Gauge,
  KeyRound,
  Settings,
  Bell,
  RefreshCw,
  Car,
  DollarSign,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext.jsx';
import NavLink from './NavLink.jsx';
import styles from './Sidebar.module.css';

export default function Sidebar({ badgeCount = 0 }) {
  const { username, logout, plan } = useAuth();
  const { t } = useTranslation();

  const NAV_ITEMS = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), end: true },
    { to: '/expenses', icon: Receipt, label: t('nav.expenses') },
    { to: '/recurring', icon: RefreshCw, label: t('nav.recurring') },
    { to: '/reminders', icon: Bell, label: t('nav.reminders'), badge: badgeCount },
    { to: '/vehicles', icon: Car, label: t('nav.vehicles') },
    { to: '/income', icon: DollarSign, label: t('nav.income'), pro: plan !== 'pro' },
    { to: '/summary', icon: BarChart3, label: t('nav.summary') },
    { to: '/change-password', icon: KeyRound, label: t('nav.changePassword') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Gauge size={22} className={styles.brandIcon} />
        <span className={styles.brandName}>
          NORE<span>VIFY</span>
        </span>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, icon: Icon, label, end, badge, pro }) => (
          <NavLink
            key={to}
            href={to}
            end={end}
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
          >
            <Icon size={16} className={styles.navIcon} />
            {label}
            {badge > 0 && <span className={styles.navBadge}>{badge}</span>}
            {pro && <span className={styles.proBadge}>{t('common.pro')}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <span className={styles.username}>{username ?? '—'}</span>
        <button
          className={styles.logoutBtn}
          onClick={logout}
          aria-label={t('nav.logout')}
          type="button"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
