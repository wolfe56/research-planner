import { html, useState } from './lib.js';

const SECTIONS = [
  ['need', 'Need to order', 'Mark ordered', 'ordered'],
  ['ordered', 'Ordered, waiting to arrive', 'Mark arrived', 'arrived'],
  ['arrived', 'Arrived', 'Put away', 'have'],
];

export function ShoppingView({ data, idx, actions }) {
  const [copied, setCopied] = useState(false);
  const where = r => [(idx.projById[r.projectId] || {}).name, (idx.expById[r.experimentId] || {}).name].filter(Boolean).join(' / ');
  const by = s => data.reagents.filter(r => r.status === s).sort((a, b) => a.name.localeCompare(b.name));
  const need = by('need');

  const copy = async () => {
    const text = need.map(r => `- ${r.name}${r.vendor ? ' (' + r.vendor + (r.catalog ? ' #' + r.catalog : '') + ')' : ''}, for ${where(r)}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { prompt('Copy the order list:', text); }
  };

  return html`<div class="shopping">
    <div class="page-head">
      <div>
        <h1>Reagents</h1>
        <p class="muted">Everything still to order across all projects. Experiments show as waiting until their reagents arrive.
          Add reagents inside an experiment on the Plan tab.</p>
      </div>
      <button class="btn" onClick=${copy} disabled=${!need.length}>${copied ? 'Copied' : 'Copy order list'}</button>
    </div>
    ${SECTIONS.map(([status, title, actLabel, next]) => {
      const list = by(status);
      return html`<div class="card" key=${status}>
        <div class="card-head"><h3>${title}</h3><span class="chip">${list.length}</span></div>
        ${list.length
          ? html`<ul class="shop-list">${list.map(r => html`<li key=${r.id} style=${{ '--c': (idx.projById[r.projectId] || {}).color }}>
              <span class="dot"></span>
              <div class="shop-main">
                <div class="shop-name">${r.name}
                  ${(r.vendor || r.catalog) && html` <span class="muted small">${[r.vendor, r.catalog && '#' + r.catalog].filter(Boolean).join(' ')}</span>`}</div>
                <div class="muted small">${where(r)}</div>
              </div>
              <button class="btn small" onClick=${() => actions.updateReagent(r.id, { status: next })}>${actLabel}</button>
            </li>`)}</ul>`
          : html`<p class="muted small">Nothing here.</p>`}
      </div>`;
    })}
  </div>`;
}
