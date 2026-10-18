/* ============================================================
   DISPATCH — school (Canvas)

   Reads your Canvas calendar feed: the private .ics link every
   Canvas account has (Calendar → "Calendar Feed"). It lists every
   assignment and event with its due date, for all your courses.
   Read-only, and no login, Clever or password involved.

   Needs:  DISPATCH_CANVAS_FEED=https://<school>.instructure.com/feeds/calendars/user_….ics
   ============================================================ */
'use strict';

const FEED = (process.env.DISPATCH_CANVAS_FEED || '').trim();

/* Lines starting with a space continue the previous one (RFC 5545 folding). */
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeText(s) {
  return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
}

/* DTSTART;VALUE=DATE:20261020  or  DTSTART:20261020T055900Z  or  DTSTART;TZID=…:20261020T235900 */
function parseDate(params, value) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return { date: new Date(+y, +mo - 1, +d, 23, 59), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +s), allDay: false };   // TZID: close enough as local time
}

function parseIcs(text) {
  const events = [];
  let ev = null;
  for (const line of unfold(text).split('\n')) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev && ev.when) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const value = line.slice(i + 1);
    if (name === 'SUMMARY') ev.title = unescapeText(value);
    else if (name === 'DESCRIPTION') ev.description = unescapeText(value);
    else if (name === 'URL') ev.url = value.trim();
    else if (name === 'DTSTART') { const p = parseDate(params, value.trim()); if (p) { ev.when = p.date; ev.allDay = p.allDay; } }
  }
  return events;
}

function fmt(ev) {
  const day = ev.when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = ev.allDay ? '' : ' ' + ev.when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let out = day + time + ' — ' + ev.title;
  if (ev.description) out += '\n    ' + ev.description.replace(/\s+/g, ' ').slice(0, 300);
  return out;
}

async function schoolTool(input) {
  if (!FEED) return 'Canvas is not set up: DISPATCH_CANVAS_FEED is missing from .env. Tell the user how to get the feed link.';
  const days = Math.min(Math.max(Number(input.days) || 7, 1), 120);
  const back = Math.min(Math.max(Number(input.past_days) || 0, 0), 60);
  const q = String(input.search || '').toLowerCase().trim();

  let text;
  try {
    const res = await fetch(FEED.replace(/^webcal:/i, 'https:'), { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return 'Canvas returned HTTP ' + res.status + ' for the calendar feed — the link may have been reset. Nothing read.';
    text = await res.text();
  } catch (e) {
    return 'Could not reach Canvas: ' + e.message;
  }

  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - back);
  const to = new Date(); to.setHours(23, 59, 59, 999); to.setDate(to.getDate() + days);
  const all = parseIcs(text);
  let list = all.filter(e => e.when >= from && e.when <= to);
  if (q) list = list.filter(e => (e.title + ' ' + (e.description || '')).toLowerCase().includes(q));
  list.sort((a, b) => a.when - b.when);

  // Course names appear in [brackets] at the end of Canvas titles — list them so a
  // search for "math" can be matched against the real course name.
  const courses = [...new Set(all.map(e => (e.title.match(/\[([^\]]+)\]\s*$/) || [])[1]).filter(Boolean))];

  const head = list.length + ' item' + (list.length === 1 ? '' : 's') + ' from ' + from.toDateString() + ' to ' + to.toDateString() +
    (q ? ' matching "' + q + '"' : '') + ':';
  return head + '\n' + (list.map(fmt).join('\n') || '(nothing posted)') +
    (courses.length ? '\n\nCourses in the feed: ' + courses.join('; ') : '');
}

const SCHOOL_TOOL = {
  name: 'school_assignments',
  description:
    'The user\'s school assignments and due dates from Canvas (read-only, all courses). Returns items in a date window ' +
    'with their descriptions, plus the list of course names. Use "search" to narrow to one course (e.g. "math"); if ' +
    'nothing matches, look at the course list it returns and search again with the real course name. This is the way ' +
    'to answer "what do I have due", "what\'s my homework this week" and similar — do not try to open Canvas or Clever.',
  input_schema: {
    type: 'object',
    properties: {
      days: { type: 'integer', description: 'How many days ahead to include. Default 7.' },
      past_days: { type: 'integer', description: 'Also include this many days back (for overdue items). Default 0.' },
      search: { type: 'string', description: 'Only items whose title or description contains this, e.g. a course name.' }
    },
    additionalProperties: false
  }
};

module.exports = { schoolTool, SCHOOL_TOOL, FEED, parseIcs };
