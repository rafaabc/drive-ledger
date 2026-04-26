import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="page text-center">
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '6rem',
        fontWeight: 800,
        letterSpacing: '.1em',
        color: 'var(--border-strong)',
        marginBottom: '.25rem',
        lineHeight: 1,
      }}>404</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.75rem', fontSize: '.9rem', letterSpacing: '.05em' }}>
        Page not found.
      </p>
      <button className="btn-primary" onClick={() => navigate('/')}>Go home</button>
    </div>
  );
}
