const DAY = 86400000;

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

export const fmtInt = (n) => nf0.format(n);
export const fmtDec = (n) => nf1.format(n);
export const fmtPct = (n) => `${nf0.format(n)}%`;
export const fmtM3 = (n) => `${n >= 100 ? nf0.format(n) : nf1.format(n)} m³`;
export const fmtDate = (ts) => date.format(ts);
export const fmtDateTime = (ts) => dateTime.format(ts);
export const fmtTime = (ts) => time.format(ts);
export const fmtWeekday = (ts) => weekday.format(ts).replace('.', '');

export const startOfDay = (ts = Date.now()) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const daysFromNow = (n) => Date.now() + n * DAY;
export const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY);
export const toInputDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fromInputDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
export const initials = (name) => name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function bytes(n) {
  if (n < 1024) return `${n} B`;
  return n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export function download(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
