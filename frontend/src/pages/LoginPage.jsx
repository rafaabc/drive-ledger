import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../services/apiService.js';
import { useAuth } from '../context/AuthContext.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import styles from './AuthPage.module.css';

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
    <div className={styles.wrapper}>
      <div className={`card ${styles.card}`}>
        <div className={styles.logoWrap}>
          <h1 className={styles.title}>DRIVE<span className={styles.titleAccent}>LEDGER</span></h1>
        </div>
        <p className={styles.subtitle}>Sign in to your account</p>

        {expiredBanner && <ErrorBanner message="Your session expired. Please log in again." type="info" />}
        {showRegistered && <ErrorBanner message="Account created — please log in." type="success" />}
        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input name="username" value={form.username} onChange={handleChange} required autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className={`text-center mt-1 ${styles.switchLink}`}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
