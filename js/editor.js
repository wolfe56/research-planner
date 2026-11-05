import { html, useState, useEffect } from './lib.js';
import { googleLink, outlookLink, downloadIcs } from './export.js';
import { fmtWhen } from './util.js';

export function TaskEditor({ task, idx, actions, onClose }) {
  const [f, setF] = useState(() => ({
    title: task.title,
    projectId: task.projectId,
    experimentId: task.experimentId || '',
    durationMin: task.durationMin || 60,
    dueDate: task.dueDate || '',
    date: task.start ? task.start.slice(0, 10) : '',
    time: task.start ? task.start.slice(11, 16) : '09:00',
    notes: task.notes || '',
    done: !!task.done,
  }));
  const set = k => e => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF(p => ({ ...p, [k]: v, ...(k === 'projectId' ? { experimentId: '' } : {}) }));
  };
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const start = f.date ? `${f.date}T${f.time || '09:00'}` : null;
  const patch = () => ({
    title: f.title.trim() || task.title,
    projectId: f.projectId,
    experimentId: f.experimentId || null,
    durationMin: Math.max(5, Math.round(+f.durationMin || 60)),
    dueDate: f.dueDate || null,
    start,
    notes: f.notes,
    done: f.done,
  });
  const save = e => { e.preventDefault(); actions.updateTask(task.id, patch()); onClose(); };
  // Exporting also saves the form, and remembers which time was exported.
  const markExported = () => actions.updateTask(task.id, { ...patch(), exportedStart: start });
  const del = () => { if (confirm('Delete this task?')) { actions.deleteTask(task.id); onClose(); } };

  const ev = start && {
    ...patch(), id: task.id,
    projectName: (idx.projById[f.projectId] || {}).name,
    experimentName: (idx.expById[f.experimentId] || {}).name,
  };
  const moved = task.exportedStart && task.exportedStart !== start;

  return html`<div class="modal-backdrop" onPointerDown=${e => e.target === e.currentTarget && onClose()}>
    <form class="modal" onSubmit=${save}>
      <div class="modal-head">
        <h2>Edit task</h2>
        <button type="button" class="icon-btn" onClick=${onClose} aria-label="Close">×</button>
      </div>
      <label class="field"><span>Title</span><input value=${f.title} onInput=${set('title')} required /></label>
      <div class="field-row">
        <label class="field"><span>Project</span>
          <select value=${f.projectId} onChange=${set('projectId')}>
            ${idx.projects.map(p => html`<option value=${p.id}>${p.name}</option>`)}
          </select></label>
        <label class="field"><span>Experiment</span>
          <select value=${f.experimentId} onChange=${set('experimentId')}>
            <option value="">None (project task)</option>
            ${(idx.expsByProject[f.projectId] || []).map(e => html`<option value=${e.id}>${e.name}</option>`)}
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
      <label class="field"><span>Notes</span><textarea rows="4" value=${f.notes} onInput=${set('notes')}></textarea></label>
      <label class="check"><input type="checkbox" checked=${f.done} onChange=${set('done')} /> Done</label>

      <div class="export">
        <div class="section-label">Add to a real calendar</div>
        ${ev
          ? html`<div class="export-btns">
              <a class="btn ghost" href=${googleLink(ev)} target="_blank" rel="noopener" onClick=${markExported}>Google Calendar</a>
              <a class="btn ghost" href=${outlookLink(ev)} target="_blank" rel="noopener" onClick=${markExported}>Outlook</a>
              <button type="button" class="btn ghost" onClick=${() => { downloadIcs(ev); markExported(); }}>Download .ics</button>
            </div>`
          : html`<p class="muted small">Schedule the task first: drag it onto the calendar or pick a day above.</p>`}
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
