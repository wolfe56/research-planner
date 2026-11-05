import { html, useState } from './lib.js';
import { EditableText } from './widgets.js';
import { REAGENT_STATUS, REAGENT_KINDS, SAMPLE_STATUS } from './util.js';

// Reagents & equipment plus samples for one experiment item (taskId) or shared by a goal (taskId null).
export function MaterialsPanel({ projectId, goalId, taskId, reagents, samples, actions }) {
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [kind, setKind] = useState('reagent');
  const [sample, setSample] = useState('');
  const [sampleStatus, setSampleStatus] = useState('need_produce');

  const addReagent = e => {
    e.preventDefault();
    if (!name.trim()) return;
    actions.addReagent(projectId, goalId, taskId, name.trim(), vendor.trim(), kind);
    setName('');
    setVendor('');
  };
  const addSample = e => {
    e.preventDefault();
    if (!sample.trim()) return;
    actions.addSample(projectId, goalId, taskId, sample.trim(), sampleStatus);
    setSample('');
  };
  const setR = (r, k) => v => actions.updateReagent(r.id, { [k]: v });
  const options = map => Object.entries(map).map(([v, l]) => html`<option value=${v}>${l}</option>`);

  return html`<div class="materials">
    <div class="section-label">Reagents & equipment</div>
    ${reagents.map(r => html`<div class="reagent" key=${r.id}>
      <select class="kind-select" value=${r.kind || 'reagent'} onChange=${e => actions.updateReagent(r.id, { kind: e.target.value })} aria-label="Type">
        ${options(REAGENT_KINDS)}
      </select>
      <${EditableText} value=${r.name} onSave=${setR(r, 'name')} />
      <${EditableText} className="small" value=${r.vendor || ''} placeholder="Vendor" allowEmpty onSave=${setR(r, 'vendor')} />
      <${EditableText} className="small" value=${r.catalog || ''} placeholder="Cat. #" allowEmpty onSave=${setR(r, 'catalog')} />
      <select class=${'status s-' + r.status} value=${r.status} onChange=${e => actions.updateReagent(r.id, { status: e.target.value })} aria-label="Status">
        ${options(REAGENT_STATUS)}
      </select>
      <button class="icon-btn" aria-label="Remove" onClick=${() => actions.deleteReagent(r.id)}>×</button>
    </div>`)}
    <form class="add-row" onSubmit=${addReagent}>
      <select class="kind-select" value=${kind} onChange=${e => setKind(e.target.value)} aria-label="Type">${options(REAGENT_KINDS)}</select>
      <input placeholder="Reagent or equipment…" value=${name} onInput=${e => setName(e.target.value)} />
      <input placeholder="Vendor (optional)" value=${vendor} onInput=${e => setVendor(e.target.value)} />
      <button class="btn">Add</button>
    </form>

    <div class="section-label samples-label">Samples</div>
    ${samples.map(s => html`<div class="sample" key=${s.id}>
      <${EditableText} value=${s.name} onSave=${v => actions.updateSample(s.id, { name: v })} />
      <${EditableText} className="small" value=${s.notes || ''} placeholder="Notes" allowEmpty onSave=${v => actions.updateSample(s.id, { notes: v })} />
      <select class=${'status s-' + s.status} value=${s.status} onChange=${e => actions.updateSample(s.id, { status: e.target.value })} aria-label="Status">
        ${options(SAMPLE_STATUS)}
      </select>
      <button class="icon-btn" aria-label="Remove sample" onClick=${() => actions.deleteSample(s.id)}>×</button>
    </div>`)}
    <form class="add-row" onSubmit=${addSample}>
      <input placeholder="Sample (e.g. Protein 2 prep)…" value=${sample} onInput=${e => setSample(e.target.value)} />
      <select value=${sampleStatus} onChange=${e => setSampleStatus(e.target.value)} aria-label="Sample status">${options(SAMPLE_STATUS)}</select>
      <button class="btn">Add</button>
    </form>
  </div>`;
}
