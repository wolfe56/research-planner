// Pointer-based drag and drop, so dragging works the same with a mouse and on a touchscreen.
// Drop targets are elements with a data-drop attribute. `resolve(target, point)` turns the target
// under the pointer into a drop ({ label, cls?, box?, el? }), or null where dropping isn't allowed.
// A `box` snaps the ghost to that viewport rectangle (used for calendar slots).

let lastEnd = 0;
// True right after a drag or resize, so the click that follows pointerup doesn't open the task.
export const justDragged = () => Date.now() - lastEnd < 300;

const EDGE = 48, STEP = 14;

function autoScroll(pt) {
  let moved = false;
  for (const el of document.querySelectorAll('[data-autoscroll]')) {
    const r = el.getBoundingClientRect();
    if (pt.x < r.left || pt.x > r.right) continue;
    const before = el.scrollTop;
    if (pt.y < r.top + EDGE && pt.y > r.top - EDGE) el.scrollTop -= STEP;
    else if (pt.y > r.bottom - EDGE && pt.y < r.bottom + EDGE) el.scrollTop += STEP;
    moved ||= el.scrollTop !== before;
  }
  const y = scrollY;
  if (pt.y < EDGE) scrollBy(0, -STEP);
  else if (pt.y > innerHeight - EDGE) scrollBy(0, STEP);
  return moved || scrollY !== y;
}

export function startDrag(e, { label, color, height = 0, grabY = 12, resolve, onDrop }) {
  if (e.button > 0) return;
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY };
  let pt = start, ghost = null, target = null, cls = '', drop = null, timer = 0;

  const begin = () => {
    ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.setProperty('--c', color);
    if (height) ghost.style.height = height + 'px';
    ghost.innerHTML = '<div class="ghost-title"></div><div class="ghost-sub"></div>';
    ghost.firstChild.textContent = label;
    document.body.append(ghost);
    document.body.classList.add('dragging');
    timer = setInterval(() => { if (autoScroll(pt)) update(); }, 30);
  };
  const update = () => {
    const el = document.elementFromPoint(pt.x, pt.y);
    const t = el ? el.closest('[data-drop]') : null;
    drop = t ? resolve(t, pt) : null;
    // A drop may highlight a different element than the one under the pointer (e.g. a whole goal card).
    const hl = (drop && drop.el) || t;
    const nextCls = drop ? drop.cls || 'drop-over' : '';
    if (target && cls) target.classList.remove(cls);
    if (hl && nextCls) hl.classList.add(nextCls);
    target = hl;
    cls = nextCls;
    const b = drop && drop.box;
    ghost.classList.toggle('snapped', !!b);
    ghost.style.left = (b ? b.left : pt.x + 8) + 'px';
    ghost.style.top = (b ? b.top : pt.y - grabY) + 'px';
    ghost.style.width = b ? b.width + 'px' : '';
    ghost.lastChild.textContent = drop ? drop.label || '' : '';
  };
  const move = ev => {
    pt = { x: ev.clientX, y: ev.clientY };
    if (!ghost) {
      if (Math.hypot(pt.x - start.x, pt.y - start.y) < 5) return;
      begin();
    }
    update();
  };
  const end = commit => () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', cancel);
    if (!ghost) return;
    clearInterval(timer);
    ghost.remove();
    document.body.classList.remove('dragging');
    if (target && cls) target.classList.remove(cls);
    lastEnd = Date.now();
    if (commit && drop) onDrop(drop);
  };
  const up = end(true), cancel = end(false);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', cancel);
}

// Drag the bottom edge of a calendar block to change its duration. The live time label is shown
// through a data attribute (CSS ::after) so this never edits text that Preact renders.
export function startResize(e, el, { minutes, ppm, snap, preview, onEnd }) {
  if (e.button > 0) return;
  e.preventDefault();
  e.stopPropagation();
  const top = el.getBoundingClientRect().top;
  let dur = minutes;
  const move = ev => {
    dur = Math.max(snap, Math.round((ev.clientY - top) / ppm / snap) * snap);
    el.style.height = dur * ppm + 'px';
    if (preview) el.dataset.preview = preview(dur);
  };
  const finish = () => {
    lastEnd = Date.now();
    delete el.dataset.preview;
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', cancel);
    document.body.classList.remove('resizing');
  };
  const up = () => { finish(); if (dur !== minutes) onEnd(dur); };
  const cancel = () => { finish(); el.style.height = minutes * ppm + 'px'; };
  document.body.classList.add('resizing');
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', cancel);
}
