import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { authApi } from '../services/apiService.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(form);
      navigate('/login', { state: { justRegistered: true } });
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
          <h1 className={styles.formHeading}>Create account</h1>

          {error && <ErrorBanner message={error} />}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reg-username">Username</label>
              <input id="reg-username" name="username" value={form.username} onChange={handleChange} required autoFocus
                minLength={3} maxLength={50} pattern="[a-zA-Z0-9_]+"
                title="3–50 characters: letters, numbers, underscore" />
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input id="reg-password" type="password" name="password" value={form.password} onChange={handleChange} required
                minLength={8} maxLength={20} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
