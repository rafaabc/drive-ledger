import PropTypes from 'prop-types';
import { getMonthName } from '@/utils/formatDate.js';
import styles from './MonthBreakdown.module.css';

/**
 * Collapsible 12-month list, one row per calendar month. Shared between
 * SummaryPage (expense category breakdown) and IncomeListPage (profit
 * breakdown) — presentational only, callers supply the per-row content.
 */
export default function MonthBreakdown({ rows, footer }) {
  return (
    <div className={styles.monthList}>
      {rows.map((row) =>
        row.empty ? (
          <div key={row.month} className={styles.monthEmpty}>
            <span>{getMonthName(row.month)}</span>
            <span className={styles.value}>—</span>
          </div>
        ) : (
          <details key={row.month} className={styles.monthRow}>
            <summary className={styles.monthSummary}>
              <span>{getMonthName(row.month)}</span>
              <span className={styles.value}>{row.headlineValue}</span>
            </summary>
            <div className={styles.monthDetail}>{row.details}</div>
          </details>
        ),
      )}
      {footer && <div className={styles.total}>{footer}</div>}
    </div>
  );
}

MonthBreakdown.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      month: PropTypes.number.isRequired,
      empty: PropTypes.bool,
      headlineValue: PropTypes.node,
      details: PropTypes.node,
    }),
  ).isRequired,
  footer: PropTypes.node,
};
