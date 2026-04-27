export default function ErrorBanner({ message, type = 'error' }) {
  if (!message) return null;
  return <div role="alert" className={`alert alert-${type}`}>{message}</div>;
}
