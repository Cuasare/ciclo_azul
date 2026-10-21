/* Gráficos SVG estáticos (funções que devolvem HTML). Só azul, vermelho e cinza. */
import { raw, esc } from '../core/html.js';

const W = 360, H = 190, L = 40, R = 8, T = 12, B = 24;

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const frame = (maxV, fmt) => {
  const y = (v) => T + (H - T - B) * (1 - v / maxV);
  const grid = [0, 1, 2, 3, 4].map((k) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y((maxV / 4) * k)}" y2="${y((maxV / 4) * k)}"/><text class="ax" x="${L - 6}" y="${y((maxV / 4) * k) + 4}" text-anchor="end">${fmt((maxV / 4) * k)}</text>`).join('');
  return { y, grid };
};

const limitLine = (y, limit, text) => (limit == null ? '' : `<line class="limit" x1="${L}" x2="${W - R}" y1="${y(limit)}" y2="${y(limit)}"/><text class="lim-t" x="${W - R}" y="${y(limit) - 5}" text-anchor="end">${esc(text)}</text>`);

/** Barras por dia. data = [{ label, value, partial, title }]. Barras acima do limite ficam vermelhas. */
export function barChart(data, { limit = null, limitLabel = 'Limite', fmt = Math.round, label = '' } = {}) {
  const maxV = niceMax(Math.max(...data.map((d) => d.value), limit ?? 0) * 1.08);
  const { y, grid } = frame(maxV, fmt);
  const band = (W - L - R) / data.length;
  const bw = Math.min(30, band * 0.6);
  const bars = data.map((d, i) => {
    const x = L + band * i + (band - bw) / 2;
    const cls = d.partial ? 'bar-part' : limit != null && d.value > limit ? 'bar-over' : 'bar-ok';
    return `<rect class="${cls}" x="${x}" y="${y(d.value)}" width="${bw}" height="${y(0) - y(d.value)}"><title>${esc(d.title ?? d.label)}</title></rect><text class="ax" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
  }).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}${bars}${limitLine(y, limit, limitLabel)}</svg>`);
}

/** Linha contínua. points = [{ t, v }] */
export function lineChart(points, { fmt = Math.round, fmtX = String, label = '' } = {}) {
  if (points.length < 2) return raw('');
  const maxV = niceMax(Math.max(...points.map((p) => p.v)) * 1.1);
  const { y, grid } = frame(maxV, fmt);
  const x = (i) => L + (i / (points.length - 1)) * (W - L - R);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const ticks = [[0, 'start'], [Math.floor(points.length / 2), 'middle'], [points.length - 1, 'end']];
  const xl = ticks.map(([i, a]) => `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="${a}">${esc(fmtX(points[i].t))}</text>`).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}${xl}<path class="line" d="${path}"/></svg>`);
}
