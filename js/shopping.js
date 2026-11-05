import { html, useState } from './lib.js';
import { REAGENT_KINDS } from './util.js';

// [status, heading, button label, next status]
const REAGENT_SECTIONS = [
  ['need', 'Need to order', 'Mark ordered', 'ordered'],
  ['ordered', 'Ordered, waiting to arrive', 'Mark arrived', 'arrived'],
  ['arrived', 'Arrived', 'Put away', 'have'],
];
const SAMPLE_SECTIONS = [
  ['need_produce', 'Need to produce', 'Mark produced', 'available'],
  ['need_order', 'Need to order', 'Mark ordered', 'ordered'],
  ['ordered', 'Ordered, waiting to arrive', 'Mark arrived', 'available'],
];

export function ShoppingView({ data, idx, actions }) {
  const [copied, setCopied] = useState(false);
  const where = m => {
    const { project, goal, task } = idx.placeOf(m);
    return [project && project.name, goal && goal.name, task && task.title].filter(Boolean).join(' / ');
  };
  const by = (list, s) => list.filter(r => r.status === s).sort((a, b) => a.name.localeCompare(b.name));
  const toOrder = [...by(data.reagents, 'need'), ...by(data.samples, 'need_order')];

  const copy = async () => {
    const text = toOrder.map(r => `- ${r.name}${r.vendor ? ' (' + r.vendor + (r.catalog ? ' #' + r.catalog : '') + ')' : ''}, for ${where(r)}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { prompt('Copy the order list:', text); }
  };

  const section = (list, [status, title, actLabel, next], update, isReagent) => {
    const items = by(list, status);
    return html`<div class="card" key=${status}>
      <div class="card-head"><h3>${title}</h3><span class="chip">${items.length}</span></div>
      ${items.length
        ? html`<ul class="shop-list">${items.map(r => html`<li key=${r.id} style=${{ '--c': (idx.placeOf(r).project || {}).color }}>
            <span class="dot"></span>
            <div class="shop-main">
              <div class="shop-name">${r.name}
                ${isReagent && r.kind === 'equipment' && html` <span class="chip">${REAGENT_KINDS.equipment}</span>`}
                ${isReagent && (r.vendor || r.catalog) && html` <span class="muted small">${[r.vendor, r.catalog && '#' + r.catalog].filter(Boolean).join(' ')}</span>`}
                ${!isReagent && r.notes && html` <span class="muted small">${r.notes}</span>`}</div>
              <div class="muted small">${where(r)}</div>
            </div>
            <button class="btn small" onClick=${() => update(r.id, { status: next })}>${actLabel}</button>
          </li>`)}</ul>`
        : html`<p class="muted small">Nothing here.</p>`}
    </div>`;
  };

  return html`<div class="shopping">
    <div class="page-head">
      <div>
        <h1>Materials</h1>
        <p class="muted">Reagents, equipment and samples still to order or produce, across all projects. Experiments show as
          waiting until their materials are ready. Add materials on an experiment in the Plan tab.</p>
      </div>
      <button class="btn" onClick=${copy} disabled=${!toOrder.length}>${copied ? 'Copied' : 'Copy order list'}</button>
    </div>
    <h2 class="group-title">Reagents & equipment</h2>
    ${REAGENT_SECTIONS.map(s => section(data.reagents, s, actions.updateReagent, true))}
    <h2 class="group-title">Samples</h2>
    ${SAMPLE_SECTIONS.map(s => section(data.samples, s, actions.updateSample, false))}
  </div>`;
}
