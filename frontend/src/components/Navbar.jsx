import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { isAuthed, username, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      <button className={styles.brand} onClick={() => navigate('/')} aria-label="Drive Ledger home">
        <svg className={styles.brandIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 5.5v4.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="10" cy="10" r="1" fill="currentColor"/>
        </svg>
        <span>DRIVE<span className={styles.brandAccent}>LEDGER</span></span>
      </button>

      {isAuthed ? (
        <div className={styles.links}>
          <NavLink to="/expenses" className={({ isActive }) => isActive ? styles.active : ''}>Expenses</NavLink>
          <NavLink to="/summary" className={({ isActive }) => isActive ? styles.active : ''}>Summary</NavLink>
          <span className={styles.divider} />
          <span className={styles.user}>{username}</span>
          <button className={`btn-secondary ${styles.logoutBtn}`} onClick={logout}>Logout</button>
        </div>
      ) : (
        <div className={styles.links}>
          <NavLink to="/login" className={({ isActive }) => isActive ? styles.active : ''}>Login</NavLink>
          <NavLink to="/register" className={({ isActive }) => isActive ? styles.active : ''}>Register</NavLink>
        </div>
      )}
    </nav>
  );
}
