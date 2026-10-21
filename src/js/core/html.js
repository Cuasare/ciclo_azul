/* Template tag que escapa tudo por padrão. Use raw() só para HTML confiável. */
class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => new Raw(s);

const part = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : v === false || v == null ? '' : esc(v));

export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => {
    // Em valor de atributo (="…"), false vira "false" (ex.: aria-selected), não vazio
    const inAttr = v === false && /="$/.test(strings[i]);
    out += (inAttr ? 'false' : part(v)) + strings[i + 1];
  });
  return new Raw(out);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
