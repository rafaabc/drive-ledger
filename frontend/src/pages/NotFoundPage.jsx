import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className={styles.container}>
      <Compass size={64} className={styles.icon} aria-hidden="true" />
      <p className={styles.code}>404</p>
      <p className={styles.message}>Page not found.</p>
      <button className="btn-primary" onClick={() => navigate('/')}>Go home</button>
    </div>
  );
}
