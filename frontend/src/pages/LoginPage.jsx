import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { authApi } from '../services/apiService.js';
import { useAuth } from '../context/AuthContext.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login, expiredBanner, clearExpiredBanner } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showRegistered, setShowRegistered] = useState(!!location.state?.justRegistered);

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showRegistered) return;
    const t = setTimeout(() => setShowRegistered(false), 3000);
    return () => clearTimeout(t);
  }, [showRegistered]);

  useEffect(() => {
    if (!expiredBanner) return;
    const t = setTimeout(clearExpiredBanner, 3000);
    return () => clearTimeout(t);
  }, [expiredBanner, clearExpiredBanner]);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    clearExpiredBanner();
    setLoading(true);
    try {
      const { token } = await authApi.login(form);
      login(token);
      navigate('/expenses');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.screen}>
      {/* Brand panel */}
      <aside className={styles.brand}>
        <div className={styles.brandContent}>
          <Gauge size={64} strokeWidth={1.5} className={styles.brandIcon} />
          <span className={styles.wordmark}>DRIVELEDGER</span>
          <p className={styles.tagline}>Track every kilometer.</p>
        </div>
      </aside>

      {/* Form panel */}
      <main className={styles.formPanel}>
        <div className={styles.formCard}>
          <h1 className={styles.formHeading}>Sign in</h1>

          {expiredBanner && <ErrorBanner message="Your session expired. Please log in again." type="info" />}
          {showRegistered && <ErrorBanner message="Account created — please log in." type="success" />}
          {error && <ErrorBanner message={error} />}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input id="login-username" name="username" value={form.username} onChange={handleChange} required autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" name="password" value={form.password} onChange={handleChange} required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Don&apos;t have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
