import { parseStart } from './util.js';

// Export a single scheduled task to an outside calendar. `ev` is a task plus projectName / experimentName.

const utc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function times(ev) {
  const s = parseStart(ev.start);
  return [s, new Date(s.getTime() + (ev.durationMin || 60) * 60000)];
}

function details(ev) {
  return [ev.projectName && `Project: ${ev.projectName}`, ev.experimentName && `Experiment: ${ev.experimentName}`, ev.notes]
    .filter(Boolean).join('\n');
}

export function googleLink(ev) {
  const [s, e] = times(ev);
  return 'https://calendar.google.com/calendar/render?' +
    new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates: `${utc(s)}/${utc(e)}`, details: details(ev) });
}

// Outlook on the web for work/school (Microsoft 365) accounts.
export function outlookLink(ev) {
  const [s, e] = times(ev);
  return 'https://outlook.office.com/calendar/0/deeplink/compose?' + new URLSearchParams({
    path: '/calendar/action/compose', rru: 'addevent', subject: ev.title,
    startdt: s.toISOString(), enddt: e.toISOString(), body: details(ev),
  });
}

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function fold(line) {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  out.push(line);
  return out.join('\r\n');
}

export function downloadIcs(ev) {
  const [s, e] = times(ev);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Research Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.id}-${utc(s)}@research-planner`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(s)}`,
    `DTEND:${utc(e)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(details(ev))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const blob = new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (ev.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 40) || 'task') + '.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
