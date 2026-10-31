/**
 * tango.events' own iCalendar reader (2026-10-30): the community calendars are
 * RRULE-driven — a weekly milonga is one VEVENT repeating for years — and the
 * shared feeds.mjs reader keeps only each VEVENT's first date. This one expands
 * RRULE (DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, UNTIL, COUNT, BYDAY
 * incl. "2SA" / "-1TU", BYMONTHDAY), drops EXDATEs, applies RECURRENCE-ID
 * overrides (moved or cancelled single dates) and returns each occurrence on
 * the calendar's own wall clock (`tz`), inside [from, to].
 *
 * Wall-clock arithmetic is done on UTC Date objects standing for local dates,
 * so DST never moves a weekly 20:00 milonga.
 */
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** VEVENTs as { NAME: [{ value, params }] } — every property kept as a list (EXDATE repeats). */
export function parseIcsAll(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = [];
  let cur = null, depth = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; depth = 0; continue; }
    if (line === 'END:VEVENT') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; } // VALARM and the like
    if (line.startsWith('END:')) { depth--; continue; }
    if (depth > 0) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const value = line.slice(i + 1).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    (cur[name] = cur[name] || []).push({ value, params: Object.fromEntries(params.map((q) => { const j = q.indexOf('='); return [q.slice(0, j), q.slice(j + 1).replace(/^"|"$/g, '')]; })) });
  }
  return out;
}
const one = (v, k) => (v[k] && v[k][0]) || null;

const WALL = new Map();
function wallClock(ms, tz) {
  if (!WALL.has(tz)) WALL.set(tz, new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  return WALL.get(tz).format(new Date(ms)).replace(/‎/g, '').replace(',', '');
}
function zonedInstant(y, mo, d, h, mi, tz) {
  let ms = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const w = wallClock(ms, tz);
    ms -= Date.UTC(+w.slice(0, 4), +w.slice(5, 7) - 1, +w.slice(8, 10), +w.slice(11, 13), +w.slice(14, 16)) - Date.UTC(y, mo - 1, d, h, mi);
  }
  return ms;
}
/** A DATE/DATE-TIME property → { date: Date (UTC midnight standing for the local day), time: 'HH:MM' | '' } on `tz`'s clock. */
export function wallOf(p, tz) {
  const m = String(p && p.value || '').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(?:\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, z] = m;
  let Y = +y, M = +mo, D = +d, time = '';
  if (h && p.params.VALUE !== 'DATE') {
    let w = null;
    if (z) w = wallClock(Date.UTC(Y, M - 1, D, +h, +mi), tz);
    else if (p.params.TZID && p.params.TZID !== tz) { try { w = wallClock(zonedInstant(Y, M, D, +h, +mi, p.params.TZID), tz); } catch { w = null; } }
    if (w) { Y = +w.slice(0, 4); M = +w.slice(5, 7); D = +w.slice(8, 10); time = w.slice(11, 16); }
    else time = `${h}:${mi}`;
  }
  return { date: new Date(Date.UTC(Y, M - 1, D)), time };
}

function parseRule(s) {
  const r = {};
  for (const part of String(s).split(';')) { const [k, v] = part.split('='); if (k) r[k.toUpperCase()] = v; }
  return r;
}
// the n-th (or -n-th) given weekday of a month
function nthWeekday(y, m, wd, n) {
  if (n > 0) { const d = new Date(Date.UTC(y, m, 1)); d.setUTCDate(1 + ((wd - d.getUTCDay() + 7) % 7) + (n - 1) * 7); return d.getUTCMonth() === m ? d : null; }
  const d = new Date(Date.UTC(y, m + 1, 0)); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - wd + 7) % 7) + (n + 1) * 7); return d.getUTCMonth() === m ? d : null;
}

/** The dates (UTC-midnight Dates) a rule yields from `start`, up to `to` (a Date), in order. */
export function expandRule(start, ruleText, to, cap = 2000) {
  const r = parseRule(ruleText);
  const freq = r.FREQ, interval = Math.max(1, +(r.INTERVAL || 1));
  const until = r.UNTIL ? (() => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(r.UNTIL); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; })() : null;
  const count = r.COUNT ? +r.COUNT : Infinity;
  const end = until && until < to ? until : to;
  const byday = r.BYDAY ? r.BYDAY.split(',').map((x) => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, wd: DAYS.indexOf(m[2]) } : null; }).filter(Boolean) : null;
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  const out = [];
  let n = 0;
  const push = (d) => { if (d < start) return true; if (d > end || n >= count) return false; out.push(d); n++; return out.length < cap; };
  if (freq === 'DAILY') {
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + interval * 864e5)) {
      if (byday && !byday.some((b) => b.wd === d.getUTCDay())) continue;
      if (!push(d)) break;
    }
  } else if (freq === 'WEEKLY') {
    const days = byday ? byday.map((b) => b.wd).sort((a, b) => a - b) : [start.getUTCDay()];
    const week0 = new Date(start.getTime() - start.getUTCDay() * 864e5); // the Sunday of the first week
    outer: for (let w = week0; w <= end; w = new Date(w.getTime() + interval * 7 * 864e5)) {
      for (const wd of days) { const d = new Date(w.getTime() + wd * 864e5); if (!push(d)) break outer; }
    }
  } else if (freq === 'MONTHLY') {
    outer: for (let y = start.getUTCFullYear(), m = start.getUTCMonth(); new Date(Date.UTC(y, m, 1)) <= end; m += interval) {
      if (m > 11) { y += Math.floor(m / 12); m %= 12; }
      let ds = [];
      if (byday) for (const b of byday) {
        if (b.n) { const d = nthWeekday(y, m, b.wd, b.n); if (d) ds.push(d); }
        else for (let d = nthWeekday(y, m, b.wd, 1); d && d.getUTCMonth() === m; d = new Date(d.getTime() + 7 * 864e5)) ds.push(d);
      }
      else if (bymd) for (const md of bymd) { const d = md > 0 ? new Date(Date.UTC(y, m, md)) : new Date(Date.UTC(y, m + 1, md + 1)); if (d.getUTCMonth() === m) ds.push(d); }
      else { const d = new Date(Date.UTC(y, m, start.getUTCDate())); if (d.getUTCMonth() === m) ds.push(d); }
      if (r.BYSETPOS && ds.length) { ds.sort((a, b) => a - b); const p = +r.BYSETPOS; ds = [ds[p > 0 ? p - 1 : ds.length + p]].filter(Boolean); }
      for (const d of ds.sort((a, b) => a - b)) if (!push(d)) break outer;
    }
  } else if (freq === 'YEARLY') {
    for (let y = start.getUTCFullYear(); new Date(Date.UTC(y, 0, 1)) <= end; y += interval) {
      const d = new Date(Date.UTC(y, start.getUTCMonth(), start.getUTCDate()));
      if (!push(d)) break;
    }
  } else out.push(start);
  return out;
}

/**
 * The occurrences of every VEVENT in [from, to] (ISO dates), on `tz`'s clock:
 * [{ title, date, time, end, url, location, description, uid }]. Cancelled VEVENTs and
 * overridden dates drop out; an override shows on its own (new) date and time.
 */
export function expandIcs(text, { tz = 'UTC', from, to } = {}) {
  const fromD = new Date(`${from}T00:00:00Z`), toD = new Date(`${to}T00:00:00Z`);
  const evs = parseIcsAll(text);
  const overridden = new Set(); // uid|YYYY-MM-DD of the original occurrence
  for (const v of evs) {
    const rid = one(v, 'RECURRENCE-ID'), uid = one(v, 'UID');
    if (rid && uid) { const w = wallOf(rid, tz); if (w) overridden.add(`${uid.value}|${ymd(w.date)}`); }
  }
  const out = [];
  for (const v of evs) {
    const sum = one(v, 'SUMMARY'), dt = one(v, 'DTSTART');
    if (!sum || !dt) continue;
    if (/CANCELLED/i.test((one(v, 'STATUS') || {}).value || '')) continue;
    const start = wallOf(dt, tz);
    if (!start) continue;
    const uid = (one(v, 'UID') || {}).value || '';
    const rule = one(v, 'RRULE');
    const ex = new Set();
    for (const e of v.EXDATE || []) for (const part of e.value.split(',')) { const w = wallOf({ value: part, params: e.params }, tz); if (w) ex.add(ymd(w.date)); }
    const dates = rule && !one(v, 'RECURRENCE-ID') ? expandRule(start.date, rule.value, toD) : [start.date];
    const fin = wallOf(one(v, 'DTEND'), tz);
    const end = start.time && fin && fin.time ? `${fin.time}:00` : ''; // the clock it ends (past midnight reads as the next morning's clock)
    const base = { title: sum.value.trim(), time: start.time, end, url: ((one(v, 'URL') || {}).value || '').trim(), location: ((one(v, 'LOCATION') || {}).value || '').trim(), description: (one(v, 'DESCRIPTION') || {}).value || '', uid };
    for (const d of dates) {
      if (d < fromD || d > toD) continue;
      const iso = ymd(d);
      if (ex.has(iso)) continue;
      if (rule && overridden.has(`${uid}|${iso}`)) continue; // the override VEVENT stands in for it
      out.push({ ...base, date: iso });
    }
  }
  return out;
}
