import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Navbar from './components/Navbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ExpensesListPage from './pages/ExpensesListPage.jsx';
import ExpenseFormPage from './pages/ExpenseFormPage.jsx';
import ExpenseDetailPage from './pages/ExpenseDetailPage.jsx';
import SummaryPage from './pages/SummaryPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function RootRedirect() {
  const { isAuthed } = useAuth();
  return <Navigate to={isAuthed ? '/expenses' : '/login'} replace />;
}

function Layout() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/expenses" element={<ProtectedRoute><ExpensesListPage /></ProtectedRoute>} />
        <Route path="/expenses/new" element={<ProtectedRoute><ExpenseFormPage /></ProtectedRoute>} />
        <Route path="/expenses/:id" element={<ProtectedRoute><ExpenseDetailPage /></ProtectedRoute>} />
        <Route path="/expenses/:id/edit" element={<ProtectedRoute><ExpenseFormPage /></ProtectedRoute>} />
        <Route path="/summary" element={<ProtectedRoute><SummaryPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
