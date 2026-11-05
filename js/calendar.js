import { html, useEffect, useRef } from './lib.js';
import { useWidth, useNow, usePref } from './hooks.js';
import { startDrag, startResize, justDragged } from './drag.js';
import { FlaskIcon } from './widgets.js';
import {
  addDays, dateStr, parseDate, startOfWeek, todayStr, startStr, minutesOf,
  fmtTime, fmtDur, fmtDay, fmtShortDate, fmtWhen, isMissed, QUICK_MAX,
} from './util.js';

const START_H = 6, END_H = 23; // visible hours
const PPM = 1;                  // pixels per minute
const SNAP = 15;                // minutes
const clampMin = m => Math.max(START_H * 60, Math.min(END_H * 60 - SNAP, m));
const VIEWS = [['1', 'Day'], ['3', '3 days'], ['7', 'Week']];

// Side-by-side lanes for overlapping blocks within one day.
function layoutDay(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const b of cluster) {
      let li = lanes.findIndex(end => end <= b.s);
      if (li < 0) { li = lanes.length; lanes.push(0); }
      lanes[li] = b.e;
      b.lane = li;
    }
    for (const b of cluster) b.lanes = lanes.length;
    out.push(...cluster);
    cluster = [];
  };
  for (const b of items) {
    if (cluster.length && b.s >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.e);
  }
  if (cluster.length) flush();
  return out;
}

// High-priority tasks first, otherwise keep the plan's order.
const highFirst = list => [...list].sort((a, b) => (b.high ? 1 : 0) - (a.high ? 1 : 0));

export function CalendarView({ data, idx, actions, openTask, anchor, setAnchor }) {
  const width = useWidth();
  const [view, setView] = usePref('calView', 'auto');
  const days = view === 'auto' ? (width >= 1100 ? 7 : width >= 700 ? 3 : 1) : +view;
  const first = days === 7 ? startOfWeek(parseDate(anchor)) : parseDate(anchor);
  const dates = Array.from({ length: days }, (_, i) => dateStr(addDays(first, i)));
  const [trayOpen, setTrayOpen] = usePref('trayOpen', true);
  const [filter, setFilter] = usePref('trayFilter', 'all');
  const scrollRef = useRef(null);
  const now = useNow();
  const today = dateStr(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (8 - START_H) * 60 * PPM;
  }, []);

  const go = n => setAnchor(dateStr(addDays(parseDate(anchor), n * days)));
  const openDay = d => { setView('1'); setAnchor(d); };

  // Tray groups: missed first, then quick tasks, then each project's remaining unscheduled work.
  const fil = filter === 'high' || idx.projById[filter] ? filter : 'all';
  const keep = t => !t.done && (fil === 'all' || (fil === 'high' ? t.high : t.projectId === fil));
  const ordered = idx.projects.flatMap(p => idx.projectTasks(p.id)).filter(keep);
  const missed = highFirst(ordered.filter(t => isMissed(t, today)));
  const unscheduled = ordered.filter(t => !t.start);
  const quick = highFirst(unscheduled.filter(t => (t.durationMin || 60) <= QUICK_MAX));
  const groups = idx.projects
    .map(p => ({ p, tasks: highFirst(unscheduled.filter(t => t.projectId === p.id && (t.durationMin || 60) > QUICK_MAX)) }))
    .filter(g => g.tasks.length);
  const trayCount = data.tasks.filter(t => !t.done && (!t.start || isMissed(t, today))).length;

  const byDate = {}, msByDate = {}, dueByDate = {};
  for (const t of data.tasks) {
    if (t.start && dates.includes(t.start.slice(0, 10))) {
      const s = minutesOf(t.start);
      (byDate[t.start.slice(0, 10)] ||= []).push({ t, s, e: s + Math.max(SNAP, t.durationMin || 60) });
    }
    if (!t.done && t.dueDate && dates.includes(t.dueDate)) (dueByDate[t.dueDate] ||= []).push(t);
  }
  for (const m of data.milestones) if (dates.includes(m.date)) (msByDate[m.date] ||= []).push(m);

  // Turns the element under the pointer into a calendar drop for task t.
  const resolver = (t, grabMin) => (el, pt) => {
    if (el.dataset.drop === 'tray') return t.start ? { tray: true, label: 'Move back to unscheduled' } : null;
    if (el.dataset.drop !== 'day') return null;
    const r = el.getBoundingClientRect();
    const min = clampMin(Math.round((START_H * 60 + (pt.y - r.top) / PPM - grabMin) / SNAP) * SNAP);
    const date = el.dataset.date;
    return {
      date, min,
      label: `${fmtDay(parseDate(date))}, ${fmtTime(min)}–${fmtTime(min + (t.durationMin || 60))}`,
      box: { left: r.left + 2, top: r.top + (min - START_H * 60) * PPM, width: r.width - 4 },
    };
  };
  const drag = (e, t, grabY) => startDrag(e, {
    label: t.title,
    color: idx.colorOf(t),
    height: (t.durationMin || 60) * PPM,
    grabY,
    resolve: resolver(t, grabY / PPM),
    onDrop: d => (d.tray ? actions.unschedule(t.id) : actions.schedule(t.id, startStr(d.date, d.min))),
  });
  // With a mouse the whole item drags; on touch only the grip does, so the lists can still scroll.
  const canDrag = e => e.pointerType === 'mouse' || e.target.closest('.grip');
  const dragBlock = (e, t) => {
    if (e.target.closest('.resize') || !canDrag(e)) return;
    drag(e, t, e.clientY - e.currentTarget.getBoundingClientRect().top);
  };
  const dragTrayItem = (e, t) => {
    if (e.target.closest('input') || !canDrag(e)) return;
    drag(e, t, 10);
  };

  const renderBlock = b => {
    const { t } = b;
    const goal = idx.goalById[t.experimentId];
    const top = (Math.max(b.s, START_H * 60) - START_H * 60) * PPM;
    const height = Math.max(SNAP, Math.min(b.e, END_H * 60) - Math.max(b.s, START_H * 60)) * PPM;
    const waiting = idx.isWaiting(t);
    const missed = isMissed(t, today);
    const meta = [goal && goal.name, waiting && 'waiting on materials', missed && 'missed'].filter(Boolean).join(' · ');
    const cls = 'blk' + (t.done ? ' done' : '') + (height < 40 ? ' short' : '') + (b.lanes > 1 && days > 1 ? ' narrow' : '')
      + (waiting ? ' waiting' : '') + (missed ? ' missed' : '');
    return html`<div key=${t.id} class=${cls}
      style=${{ top: top + 'px', height: height + 'px', left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`, width: `calc(${100 / b.lanes}% - 4px)`, '--c': idx.colorOf(t) }}
      title=${`${t.title}\n${fmtTime(b.s)}–${fmtTime(b.e)}${meta ? '\n' + meta : ''}`}
      onPointerDown=${e => dragBlock(e, t)} onClick=${() => !justDragged() && openTask(t.id)}>
      <span class="grip" aria-hidden="true">⠿</span>
      <div class="blk-title">${t.high && html`<span class="prio-mark">!</span>`}${t.kind === 'experiment' && html`<${FlaskIcon} />`}${t.title}</div>
      <div class="blk-meta"><span class="blk-time">${fmtTime(b.s)}–${fmtTime(b.e)}</span>${meta && html`<span class="blk-extra"> · ${meta}</span>`}</div>
      <div class="resize" title="Drag to change duration"
        onPointerDown=${e => startResize(e, e.currentTarget.parentElement, {
          minutes: b.e - b.s, ppm: PPM, snap: SNAP,
          preview: dur => `${fmtTime(b.s)}–${fmtTime(b.s + dur)}`,
          onEnd: dur => actions.updateTask(t.id, { durationMin: dur }),
        })}></div>
    </div>`;
  };

  const trayItem = (t, { showProject = false, wasMissed = false } = {}) => {
    const p = idx.projById[t.projectId] || {};
    const goal = idx.goalById[t.experimentId];
    const sub = [
      wasMissed ? 'was ' + fmtWhen(t.start) : fmtDur(t.durationMin),
      showProject && p.name, goal && goal.name,
      idx.isWaiting(t) && 'waiting on materials',
      t.slipped > 0 && `slipped ${t.slipped}×`,
    ].filter(Boolean).join(' · ');
    return html`<div class="tray-item" key=${t.id} style=${{ '--c': p.color }}
      onPointerDown=${e => dragTrayItem(e, t)} onClick=${e => !justDragged() && !e.target.closest('input') && openTask(t.id)}>
      <span class="grip" aria-hidden="true">⠿</span>
      ${wasMissed && html`<input type="checkbox" title="I did it: mark done" aria-label="Mark done"
        onChange=${e => actions.updateTask(t.id, { done: e.target.checked })} />`}
      <div class="tray-text">
        <div class="tray-title">${t.high && html`<span class="prio-mark">!</span>`}${t.kind === 'experiment' && html`<${FlaskIcon} />`}${t.title}</div>
        <div class="muted small">${sub}</div>
      </div>
    </div>`;
  };

  const range = days === 1 ? fmtDay(first) : `${fmtShortDate(dates[0])} – ${fmtShortDate(dates[days - 1])}`;
  const hours = [];
  for (let h = START_H + 1; h < END_H; h++) hours.push(h);

  return html`<div class="cal" style=${{ '--days': days }}>
    <div class="cal-toolbar">
      <button class="btn ghost small" onClick=${() => setAnchor(todayStr())}>Today</button>
      <button class="icon-btn" aria-label="Previous" onClick=${() => go(-1)}>‹</button>
      <button class="icon-btn" aria-label="Next" onClick=${() => go(1)}>›</button>
      <div class="cal-range">${range}</div>
      <span class="spacer"></span>
      <div class="seg" role="group" aria-label="Calendar view">
        ${VIEWS.map(([v, l]) => html`<button class=${days === +v ? 'on' : ''} aria-pressed=${days === +v} onClick=${() => setView(v)}>${l}</button>`)}
      </div>
      <button class=${'btn small' + (trayOpen ? '' : ' ghost')} onClick=${() => setTrayOpen(!trayOpen)}>To schedule · ${trayCount}</button>
    </div>
    <div class="cal-body">
      ${trayOpen && html`<aside class="tray" data-drop="tray" data-autoscroll>
        <select class="tray-filter" value=${fil} onChange=${e => setFilter(e.target.value)} aria-label="Filter">
          <option value="all">All projects</option>
          <option value="high">High priority only</option>
          ${idx.projects.map(p => html`<option value=${p.id}>${p.name}</option>`)}
        </select>
        <p class="muted small tray-hint">Drag a task onto the calendar. Drag a block back here to unschedule it.</p>
        ${missed.length > 0 && html`<div class="tray-group missed-group">
          <div class="tray-proj">Missed: reschedule or tick off</div>
          ${missed.map(t => trayItem(t, { showProject: true, wasMissed: true }))}
        </div>`}
        ${quick.length > 0 && html`<div class="tray-group">
          <div class="tray-proj">Quick tasks (${QUICK_MAX} min or less)</div>
          ${quick.map(t => trayItem(t, { showProject: true }))}
        </div>`}
        ${groups.map(({ p, tasks }) => html`<div class="tray-group" key=${p.id} style=${{ '--c': p.color }}>
          <div class="tray-proj"><span class="dot"></span>${p.name}</div>
          ${tasks.map(t => trayItem(t))}
        </div>`)}
        ${!missed.length && !quick.length && !groups.length && html`<p class="muted small">Nothing left to schedule.</p>`}
      </aside>`}
      <div class="cal-grid">
        <div class="cal-head">
          <div class="gutter"></div>
          ${dates.map(d => {
            const dt = parseDate(d);
            return html`<div class=${'day-head' + (d === today ? ' today' : '')} key=${d}>
              <button class="day-link" title="Open this day" onClick=${() => openDay(d)}>
                <span class="day-name">${dt.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <span class="day-num">${dt.getDate()}</span>
              </button>
              <div class="allday">
                ${(msByDate[d] || []).map(m => html`<div class="ms-chip" style=${{ '--c': (idx.projById[m.projectId] || {}).color }} title=${m.title}>◆ ${m.title}</div>`)}
                ${(dueByDate[d] || []).map(t => html`<button class="due-chip" style=${{ '--c': idx.colorOf(t) }} title=${'Due: ' + t.title} onClick=${() => openTask(t.id)}>Due: ${t.title}</button>`)}
              </div>
            </div>`;
          })}
        </div>
        <div class="cal-scroll" ref=${scrollRef} data-autoscroll>
          <div class="cal-cols" style=${{ height: (END_H - START_H) * 60 * PPM + 'px' }}>
            <div class="gutter">
              ${hours.map(h => html`<div class="hour-label" style=${{ top: (h - START_H) * 60 * PPM + 'px' }}>${fmtTime(h * 60)}</div>`)}
            </div>
            ${dates.map(d => html`<div class=${'day-col' + (d === today ? ' today' : '')} key=${d} data-drop="day" data-date=${d}>
              ${layoutDay(byDate[d] || []).map(renderBlock)}
              ${d === today && nowMin >= START_H * 60 && nowMin <= END_H * 60 &&
                html`<div class="now-line" style=${{ top: (nowMin - START_H * 60) * PPM + 'px' }}></div>`}
            </div>`)}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
