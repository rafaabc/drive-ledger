export default function ErrorBanner({ message, type = 'error' }) {
  if (!message) return null;
  return <div className={`alert alert-${type}`}>{message}</div>;
}
