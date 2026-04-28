import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { expensesApi } from '../services/apiService.js';
import KpiCard from '../components/KpiCard.jsx';
import MonthlyTrendChart from '../components/charts/MonthlyTrendChart.jsx';
import CategoryDonut from '../components/charts/CategoryDonut.jsx';
import Loading from '../components/Loading.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import {
  aggregateByMonth,
  aggregateByCategory,
  computeMtd,
  computeYtd,
  computeFuelShare,
  computeAvgMonthly,
  computePrevMonthTotal,
} from '../utils/aggregations.js';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(!!location.state?.justLoggedIn);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!showWelcome) return;
    const t = setTimeout(() => setShowWelcome(false), 3000);
    return () => clearTimeout(t);
  }, [showWelcome]);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        // Fetch current year. Also fetch last year to get prev-month data
        // when the current month is January (prev month is in last year).
        const now = new Date();
        const isJanuary = now.getMonth() === 0;

        const requests = [expensesApi.list({ year: currentYear })];
        if (isJanuary) {
          requests.push(expensesApi.list({ year: currentYear - 1 }));
        }

        const results = await Promise.all(requests);
        if (cancelled) return;

        const curYearData = results[0];
        const prevYearData = isJanuary ? results[1] : [];
        const allExpenses = [...prevYearData, ...curYearData];

        setExpenses(allExpenses.map((e) => ({ ...e, _curYear: e.date.startsWith(String(currentYear)) })));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [currentYear]);

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

  const curYearExpenses = expenses.filter((e) => e._curYear);

  // KPI computations
  const mtd = computeMtd(curYearExpenses);
  const prevMonthTotal = computePrevMonthTotal(expenses); // uses all (incl prev year if Jan)
  const mtdDelta = prevMonthTotal > 0
    ? Math.round(((mtd - prevMonthTotal) / prevMonthTotal) * 1000) / 10
    : null;

  const ytd = computeYtd(curYearExpenses);
  const fuelShare = computeFuelShare(curYearExpenses);

  const monthlyData = aggregateByMonth(curYearExpenses);
  const avgMonthly = computeAvgMonthly(monthlyData);

  const categoryData = aggregateByCategory(curYearExpenses);

  // Spark data: last 6 months for MTD card
  const last6Months = monthlyData.slice(-6);

  // Recent 5 expenses sorted date descending
  const recentExpenses = [...curYearExpenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

      {showWelcome && <ErrorBanner message="Logged in successfully. Welcome back!" type="success" />}

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="This Month"
          value={mtd.toFixed(2)}
          delta={mtdDelta}
          sparkData={last6Months}
          invertColors
        />
        <KpiCard
          label="This Year"
          value={ytd.toFixed(2)}
          delta={null}
          sparkData={monthlyData}
        />
        <KpiCard
          label="Monthly Avg"
          value={avgMonthly.toFixed(2)}
          delta={null}
          sparkData={monthlyData}
        />
        <KpiCard
          label="Fuel Share"
          value={`${fuelShare}%`}
          delta={null}
          sparkData={null}
        />
      </div>

      {/* Charts row */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <h2 className={styles.sectionTitle}>Monthly Spend {currentYear}</h2>
          <MonthlyTrendChart data={monthlyData} />
        </div>
        <div className={styles.chartCard}>
          <h2 className={styles.sectionTitle}>By Category</h2>
          <CategoryDonut data={categoryData} />
        </div>
      </div>

      {/* Recent expenses */}
      <div className={styles.recentCard}>
        <div className={styles.recentHeader}>
          <h2 className={styles.sectionTitle}>Recent Expenses</h2>
          <Link to="/expenses" className={styles.viewAll}>View all →</Link>
        </div>

        {recentExpenses.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: '2rem 0' }}>
            No expenses yet for {currentYear}.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Category</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className={styles.dateCell}>
                      {exp.date}
                    </td>
                    <td>
                      <span className="badge" data-cat={exp.category}>{exp.category}</span>
                    </td>
                    <td className={styles.descCell}>
                      {exp.description || <span className={styles.muted}>—</span>}
                    </td>
                    <td className={`num ${styles.amountCell}`}>{exp.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
