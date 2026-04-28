import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, BarChart3, LogOut, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/summary', icon: BarChart3, label: 'Summary' },
];

export default function Sidebar() {
  const { username, logout } = useAuth();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Gauge size={22} className={styles.brandIcon} />
        <span className={styles.brandName}>
          DRIVE<span>LEDGER</span>
        </span>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
          >
            <Icon size={16} className={styles.navIcon} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <span className={styles.username}>{username ?? '—'}</span>
        <button
          className={styles.logoutBtn}
          onClick={logout}
          aria-label="Log out"
          type="button"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
