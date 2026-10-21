/* Roteador por hash. Cada tela exporta { title, render(ctx), actions, forms, changes, start, stop }.
   O container é redesenhado inteiro a cada ctx.refresh(); os eventos são delegados (ver wire.js). */
import { wire } from './wire.js';

export const go = (path) => { location.hash = `#${path}`; };
export const here = () => location.hash.slice(1) || '/';

export function startRouter({ root, routes, guard, onDraw }) {
  let view = null;
  let path = null;
  let token = 0;
  const ctx = { refresh: () => draw(), go, get path() { return path; } };

  function draw() {
    if (!view) return;
    const top = root.scrollTop;
    root.innerHTML = String(view.render(ctx));
    root.scrollTop = top;
    onDraw?.(view, path);
  }

  async function resolve() {
    const next = here();
    const redirect = guard(next);
    if (redirect && redirect !== next) { go(redirect); return; }
    if (!routes[next]) { go('/painel'); return; }

    const mine = ++token;
    const mod = await routes[next]();
    if (mine !== token) return; // outra navegação começou
    view?.stop?.();
    view = mod.default;
    path = next;
    draw();
    root.scrollTop = 0;
    view.start?.(ctx);
  }

  wire(root, () => view, () => ctx);
  window.addEventListener('hashchange', resolve);
  return { start: resolve, refresh: draw };
}
