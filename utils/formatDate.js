import i18n from '@/i18n/index.js';

export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const lang = i18n?.language;
  const locale = !lang || lang === 'en' ? 'en-US' : lang;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function currentYear() {
  return new Date().getFullYear();
}

/** Full localized month name for a 1-12 month index (e.g. 3 -> "March" / "março"). */
export function getMonthName(monthIndex) {
  const lang = i18n?.language;
  const locale = !lang || lang === 'en' ? 'en-US' : lang;
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, monthIndex - 1, 1)),
  );
}
