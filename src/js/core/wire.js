/* Delegação de eventos por atributo, ligada uma única vez por container:
     data-action="x"  → handlers().actions.x(el, ctx, event)   (clique)
     data-form="x"    → handlers().forms.x(form, ctx, event)   (submit)
     data-change="x"  → handlers().changes.x(el, ctx, event)   (change)
   Assim a tela pode ser redesenhada à vontade sem acumular ouvintes. */
export function wire(root, handlers, ctx) {
  const run = (kind, attr, e) => {
    const el = e.target.closest(`[${attr}]`);
    if (!el || !root.contains(el)) return;
    const fn = handlers()?.[kind]?.[el.getAttribute(attr)];
    if (!fn) return;
    if (kind === 'forms') e.preventDefault();
    fn(el, ctx(), e);
  };
  root.addEventListener('click', (e) => run('actions', 'data-action', e));
  root.addEventListener('submit', (e) => run('forms', 'data-form', e));
  root.addEventListener('change', (e) => run('changes', 'data-change', e));
}
