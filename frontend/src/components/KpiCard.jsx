import Sparkline from './charts/Sparkline.jsx';
import styles from './KpiCard.module.css';

export default function KpiCard({ label, value, delta, sparkData }) {
  const hasDelta = typeof delta === 'number' && delta !== 0;
  const hasSpark = Array.isArray(sparkData) && sparkData.length > 0;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {hasDelta && (
          <span className={delta > 0 ? styles.deltaPos : styles.deltaNeg}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className={styles.value}>{value}</div>
      {hasSpark && (
        <div className={styles.spark}>
          <Sparkline data={sparkData} />
        </div>
      )}
    </div>
  );
}
