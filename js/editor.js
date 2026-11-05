import { html, useState, useEffect } from './lib.js';
import { googleLink, outlookLink, downloadIcs } from './export.js';
import { MaterialsPanel } from './materials.js';
import { fmtWhen, fmtShortDate } from './util.js';

export function TaskEditor({ task, idx, actions, onClose }) {
  const [f, setF] = useState(() => ({
    title: task.title,
    kind: task.kind || 'task',
    high: !!task.high,
    projectId: task.projectId,
    goalId: task.experimentId || '',
    milestoneId: task.milestoneId || '',
    durationMin: task.durationMin || 60,
    dueDate: task.dueDate || '',
    date: task.start ? task.start.slice(0, 10) : '',
    time: task.start ? task.start.slice(11, 16) : '09:00',
    notes: task.notes || '',
    done: !!task.done,
  }));
  const set = k => e => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    // A different project has different goals and milestones.
    setF(p => ({ ...p, [k]: v, ...(k === 'projectId' ? { goalId: '', milestoneId: '' } : {}) }));
  };
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const start = f.date ? `${f.date}T${f.time || '09:00'}` : null;
  const patch = () => ({
    title: f.title.trim() || task.title,
    kind: f.kind,
    high: f.high,
    projectId: f.projectId,
    experimentId: f.goalId || null,
    milestoneId: f.milestoneId || null,
    durationMin: Math.max(5, Math.round(+f.durationMin || 60)),
    dueDate: f.dueDate || null,
    start,
    notes: f.notes,
    done: f.done,
  });
  const save = e => { e.preventDefault(); actions.updateTask(task.id, patch()); onClose(); };
  // Exporting also saves the form, and remembers which time was exported.
  const markExported = () => actions.updateTask(task.id, { ...patch(), exportedStart: start });
  const del = () => { if (confirm('Delete this item and its materials?')) { actions.deleteTask(task.id); onClose(); } };

  const ev = start && {
    ...patch(), id: task.id,
    projectName: (idx.projById[f.projectId] || {}).name,
    experimentName: (idx.goalById[f.goalId] || {}).name,
  };
  const moved = task.exportedStart && task.exportedStart !== start;
  const milestones = idx.milestonesOf(f.projectId);
  const ms = idx.msById[f.milestoneId];
  const lateForMs = ms && f.date && f.date > ms.date;

  return html`<div class="modal-backdrop" onPointerDown=${e => e.target === e.currentTarget && onClose()}>
    <form class="modal" onSubmit=${save}>
      <div class="modal-head">
        <h2>Edit ${f.kind === 'experiment' ? 'experiment' : 'task'}</h2>
        <button type="button" class="icon-btn" onClick=${onClose} aria-label="Close">×</button>
      </div>
      <label class="field"><span>Title</span><input value=${f.title} onInput=${set('title')} required /></label>
      <div class="field-row">
        <label class="field"><span>Type</span>
          <select value=${f.kind} onChange=${set('kind')}>
            <option value="experiment">Experiment</option>
            <option value="task">Task (non-experimental)</option>
          </select></label>
        <label class="check prio-check"><input type="checkbox" checked=${f.high} onChange=${set('high')} /> High priority</label>
      </div>
      <div class="field-row">
        <label class="field"><span>Project</span>
          <select value=${f.projectId} onChange=${set('projectId')}>
            ${idx.projects.map(p => html`<option value=${p.id}>${p.name}</option>`)}
          </select></label>
        <label class="field"><span>Goal</span>
          <select value=${f.goalId} onChange=${set('goalId')}>
            <option value="">None (project task)</option>
            ${(idx.goalsByProject[f.projectId] || []).map(e => html`<option value=${e.id}>${e.name}</option>`)}
          </select></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Duration (minutes)</span><input type="number" min="5" step="5" value=${f.durationMin} onInput=${set('durationMin')} /></label>
        <label class="field"><span>Due date</span><input type="date" value=${f.dueDate} onInput=${set('dueDate')} /></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Scheduled day</span><input type="date" value=${f.date} onInput=${set('date')} /></label>
        <label class="field"><span>Start time</span><input type="time" value=${f.time} onInput=${set('time')} disabled=${!f.date} /></label>
      </div>
      ${f.date && html`<button type="button" class="link small align-start" onClick=${() => setF(p => ({ ...p, date: '' }))}>Remove from calendar</button>`}
      <label class="field"><span>Counts toward milestone</span>
        <select value=${f.milestoneId} onChange=${set('milestoneId')}>
          <option value="">None</option>
          ${milestones.map(m => html`<option value=${m.id}>${fmtShortDate(m.date)}: ${m.title}</option>`)}
        </select></label>
      ${lateForMs && html`<p class="small warn-text">Scheduled after this milestone’s date (${fmtShortDate(ms.date)}).</p>`}
      ${ms && !f.date && !f.done && html`<p class="small muted">Not scheduled yet. The milestone will flag it until it is.</p>`}
      <label class="field"><span>Notes</span><textarea rows="3" value=${f.notes} onInput=${set('notes')}></textarea></label>
      <label class="check"><input type="checkbox" checked=${f.done} onChange=${set('done')} /> Done</label>

      ${f.kind === 'experiment' && html`<div class="export">
        <div class="section-label">Materials for this experiment</div>
        <${MaterialsPanel} projectId=${task.projectId} goalId=${task.experimentId || null} taskId=${task.id}
          reagents=${idx.reagentsByTask[task.id] || []} samples=${idx.samplesByTask[task.id] || []} actions=${actions} />
      </div>`}

      <div class="export">
        <div class="section-label">Add to a real calendar</div>
        ${ev
          ? html`<div class="export-btns">
              <a class="btn ghost" href=${googleLink(ev)} target="_blank" rel="noopener" onClick=${markExported}>Google Calendar</a>
              <a class="btn ghost" href=${outlookLink(ev)} target="_blank" rel="noopener" onClick=${markExported}>Outlook</a>
              <button type="button" class="btn ghost" onClick=${() => { downloadIcs(ev); markExported(); }}>Download .ics</button>
            </div>`
          : html`<p class="muted small">Schedule it first: drag it onto the calendar or pick a day above.</p>`}
        ${task.exportedStart && html`<p class=${'small ' + (moved ? 'warn-text' : 'muted')}>
          ${moved
            ? `Moved since you exported it for ${fmtWhen(task.exportedStart)}. Export again and delete the old calendar event.`
            : `Exported for ${fmtWhen(task.exportedStart)}.`}</p>`}
      </div>

      <div class="modal-foot">
        <button type="button" class="btn ghost danger" onClick=${del}>Delete</button>
        <span class="spacer"></span>
        <button type="button" class="btn ghost" onClick=${onClose}>Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>
  </div>`;
}
