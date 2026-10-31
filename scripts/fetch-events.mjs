#!/usr/bin/env node
/**
 * Aggregates Argentine tango across the US and southern Canada into
 * site/events.json and site/events.ics (tango.events, 2026-10-30; built on
 * curling-events' build). Runs in CI (see .github/workflows/events.yml) and
 * locally for preview. The pipeline is lqa-events' (scripts/*.mjs are its
 * files, byte for byte, bar ics.mjs's zones); only the sources below,
 * scripts/recur.mjs and site/city.js are tango's.
 *
 * Each source returns [{ venue, title, date, time, url, type, tz }]. Kinds:
 *   - the communities' own calendars (site/clubs.json `feeds`): public Google
 *     Calendars, RRULE-driven — scripts/recur.mjs expands each repeating
 *     milonga over the next HORIZON_DAYS, drops its exceptions and applies
 *     its moved dates; Calgary's The Events Calendar (shared feeds.mjs);
 *     New York's three CSVs (newyorktango.com: recurring rules, one-off
 *     additions / cancellations / changes, venues)
 *   - festivals, marathons and encuentros: hand-kept scripts/data/festivals.json
 *     plus whatever the Tango Marathon Directory's API adds
 *   - Buenos Aires tours by US organisers: hand-kept scripts/data/tours.json
 * Every community event keeps its own wall clock and carries its zone (`tz`):
 * a Montréal milonga at 21:00 reads 9 PM, and the ICS writes it with
 * TZID=America/Toronto. A multi-day festival or tour is one all-day row per day.
 */
import './failures.mjs'; // first: every outside call retried, the ones still failing written to failures.json (Steve, 2026-10-29)
import { writeFileSync, readFileSync } from 'node:fs';
import { buildIcs } from './ics.mjs';
import { mergeWithArchive, unionArchives, eventKey } from './merge.mjs';
import { calmTitle, isNotice } from './titles.mjs';
import { applySchedules } from './schedules.mjs';
import { slugify, BADGE_FEEDS, TEAMS, CITY } from './badges.mjs';
import { emptyListGate, feedSources } from './feeds.mjs';
import { placeEvents } from './places.mjs';
import { expandIcs, expandRule } from './recur.mjs';

const JSON_OUT = new URL('../site/events.json', import.meta.url);
const ICS_OUT = new URL('../site/events.ics', import.meta.url);
// A full year each way for festivals and tours (announced a season ahead);
// past events are kept for a year (carried forward from the previously
// published feed — see mergeWithArchive).
const WINDOW_DAYS = 365;
// The weekly milongas are written out this far ahead only, so they don't bury the festivals.
const HORIZON_DAYS = 42;
const FEED_URL = process.env.FEED_URL || `${CITY.site}events.json`;
const ARCHIVE_URL = process.env.ARCHIVE_URL || 'https://raw.githubusercontent.com/sfosdal/tango-events/archive/events-archive.json';
const ARCHIVE_OUT = new URL('../events-archive.json', import.meta.url); // repo root, ignored; the workflow commits it to the branch
const MAX_EVENTS = 6000; // sanity cap, not a display cap

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'; // allseattletango.com and austintango.org 406 a bare "Mozilla/5.0"
const MAX_DAYS = 14; // a "multi-day" event longer than this is a season or a series, not an event

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => d.toISOString().slice(0, 10);
const today = isoDay(new Date());
const horizon = isoDay(new Date(Date.now() + WINDOW_DAYS * 86400e3));
const nearHorizon = isoDay(new Date(Date.now() + HORIZON_DAYS * 86400e3));
const expandFrom = isoDay(new Date(Date.now() - 86400e3)); // UTC runs a day ahead of the Americas' evening: tonight's milongas are yesterday in UTC terms
const cutoff = isoDay(new Date(Date.now() - WINDOW_DAYS * 86400e3));
// every day from start to end, inclusive (ISO dates)
function daysOf(start, end) {
  const out = [];
  const d = new Date(`${start}T12:00:00Z`), last = new Date(`${(end && end >= start) ? end : start}T12:00:00Z`);
  while (d <= last && out.length <= MAX_DAYS) { out.push(isoDay(d)); d.setUTCDate(d.getUTCDate() + 1); }
  return out.length > MAX_DAYS ? [] : out;
}
const perDay = (start, end, row) => daysOf(start, end).map((date) => ({ ...row, date, time: '' }));
async function get(url, label, init = {}) {
  const r = await fetch(url, { ...init, headers: { 'User-Agent': BROWSER_UA, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}`);
  return r;
}

// ---- the communities ----
const COMMUNITIES = JSON.parse(readFileSync(new URL('../site/clubs.json', import.meta.url), 'utf8')).clubs;
const REGION_OF = {};
for (const [row, v] of Object.entries(CITY.venues)) for (const st of v.states || []) REGION_OF[st] = row;
const placeOfCommunity = (c) => `${c.town}, ${c.state}`;

// the type a title names; the calendar's own (a Classes calendar) when it names none. A class
// beats the dance it is named for ("Milonga Zandunga Class", "Pre-Milonga Class") unless a
// milonga follows it ("… Pre-milonga class and milonga").
const CLASS = /\bclass(es)?\b|workshop|seminar|lesson|intensive|series|bootcamp|beginn|\bbeg\b|fundamentals|technique|\blab\b|clase|cours\b|atelier|taller|\bintro\b/i;
const MILONGA = /\bmilonga\b|\bsoir[ée]e\b|\bbaile\b|tango night|social dance|\bdance\b/i;
function tangoType(title, fallback) {
  if (/\b(festival|marathon|marat[oó]n|encuentro|tango weekend)\b/i.test(title)) return 'festival';
  if (/\bpr[aá]cti(c|qu)[ae]s?\b|practilonga|pratique/i.test(title)) return 'practica';
  if (CLASS.test(title) && !/\b(and|&|\+|then|followed by)\s+(a\s+)?milonga\b/i.test(title)) return 'class';
  if (MILONGA.test(title)) return 'milonga';
  return fallback || 'milonga';
}
// a cancellation, a board meeting, a placeholder — information, not an event
const DROP = /cancel+ed|cancel+ation|annul|\bno (milonga|practica|class|tango)\b|^no\b|postponed|\bclosed\b|private|planning|board meeting|\bmeeting\b|deadline|radio show|^tbd$|^hold\b/i;
const firstLink = (text) => { const m = /https?:\/\/[^\s<>"')\]]+/.exec(text || ''); return m ? m[0].replace(/[.,;]+$/, '') : ''; };
const hallOf = (location) => String(location || '').split(',')[0].trim();

async function googleCalendar(c, f) {
  const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(f.id)}/public/basic.ics`;
  const text = await (await get(url, `${c.name} calendar`)).text();
  return expandIcs(text, { tz: c.tz, from: expandFrom, to: nearHorizon }).map((e) => ({
    title: e.title, date: e.date, time: e.time, ...(e.end ? { end: e.end } : {}), ...(hallOf(e.location) ? { stage: hallOf(e.location) } : {}),
    url: e.url || firstLink(e.description) || c.url, type: tangoType(e.title, f.type),
  }));
}

// New York: newyorktango.com's own data — recurring rules ("weekly", "biweekly",
// "monthly:1,3:sunday", "monthly:last:tuesday", "monthly:4" the 4th of the month),
// the one-off rows (add / update a date / cancel a date) and the venues
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [hdr, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(hdr.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}
const clock = (s) => { const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])/i.exec(s || ''); if (!m) return ''; let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return `${pad(h)}:${m[2] || '00'}`; };
const WD = { sunday: 'SU', monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH', friday: 'FR', saturday: 'SA' };
function nycRule(rule) {
  if (rule === 'weekly') return 'FREQ=WEEKLY';
  if (rule === 'biweekly') return 'FREQ=WEEKLY;INTERVAL=2';
  const m = /^monthly:([\d,last]+)(?::(\w+))?$/.exec(rule);
  if (!m) return null;
  const ns = m[1].split(',').map((n) => (n === 'last' ? '-1' : n));
  return m[2] ? `FREQ=MONTHLY;BYDAY=${ns.map((n) => n + WD[m[2].toLowerCase()]).join(',')}` : `FREQ=MONTHLY;BYMONTHDAY=${ns.join(',')}`;
}
async function newYork(c) {
  const base = 'https://www.newyorktango.com/data/';
  const [rec, man, ven] = await Promise.all(['events-recurring', 'events-manual', 'venues'].map(async (f) => parseCsv(await (await get(`${base}${f}.csv`, `New York ${f}`)).text())));
  const venue = Object.fromEntries(ven.map((v) => [v.venueId, v]));
  const row = (x, date) => {
    const v = venue[x.venueId] || {};
    const end = clock(x.endTime);
    return { title: x.title, date, time: clock(x.startTime), ...(end ? { end: `${end}:00` } : {}), ...((v.name || x.venueName) ? { stage: v.name || x.venueName } : {}),
      url: x.website || c.url, type: tangoType(x.title, x.type === 'Practica' ? 'practica' : 'milonga') };
  };
  const key = (title, date) => `${title.toLowerCase()}|${date}`;
  const off = new Set(), changed = new Map(), out = [];
  for (const x of man) {
    if (x.mode === 'cancel') off.add(key(x.title, x.date));
    else if (x.mode === 'update') changed.set(key(x.title, x.date), x);
  }
  const from = new Date(`${expandFrom}T00:00:00Z`), to = new Date(`${nearHorizon}T00:00:00Z`);
  for (const x of rec) {
    if (x.isActive === 'false' || !x.recurrenceStartDate) continue;
    const start = new Date(`${x.recurrenceStartDate}T00:00:00Z`);
    const rule = nycRule(x.recurrenceRule);
    const last = x.recurrenceEndDate ? new Date(`${x.recurrenceEndDate}T00:00:00Z`) : to;
    for (const d of rule ? expandRule(start, rule, last < to ? last : to) : [start]) {
      if (d < from || d > to) continue;
      const date = isoDay(d), k = key(x.title, date);
      if (off.has(k)) continue;
      out.push(row(changed.get(k) || x, date));
    }
  }
  for (const x of man) if (x.mode === 'add' && x.date >= expandFrom && x.date <= nearHorizon && !off.has(key(x.title, x.date))) out.push(row(x, x.date));
  return out;
}

async function tribe(c, f) {
  const [thunk] = feedSources({ venues: CITY.venues, feeds: [{ ...f, label: c.name }], types: CITY.types, tz: c.tz }, BROWSER_UA);
  return (await thunk()).map((e) => ({ ...e, type: tangoType(e.title, 'milonga'), url: e.url || c.url }));
}

const READERS = { gcal: googleCalendar, nyc: newYork, tribe };
async function communities() {
  const jobs = [];
  for (const c of COMMUNITIES) for (const f of c.feeds || []) jobs.push([c, f]);
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < jobs.length) {
      const [c, f] = jobs[i++];
      try {
        const rows = (await READERS[f.kind](c, f)).filter((e) => e.title && !DROP.test(e.title));
        const venue = REGION_OF[c.state];
        for (const e of rows) out.push({ ...e, venue, tz: c.tz, title: `${e.title.replace(/\s+/g, ' ').trim()} — ${placeOfCommunity(c)}` });
        console.log(`${c.name} (${f.kind}${f.type ? ' ' + f.type : ''}): ${rows.length}`);
      } catch (err) { console.error(`${c.name}: ${err.message}`); }
    }
  }));
  return out;
}

// ---- festivals, marathons, encuentros ----
const FESTIVALS = JSON.parse(readFileSync(new URL('./data/festivals.json', import.meta.url), 'utf8')).festivals;
const festRow = (f) => ({ venue: 'Festivals & Marathons', title: `${f.title} — ${f.place}`, url: f.url, type: f.kind || 'festival' });
async function festivals() {
  const out = FESTIVALS.flatMap((f) => perDay(f.start, f.end, festRow(f)));
  // the Tango Marathon Directory's API adds what the hand-kept list lacks (same start date and town = the same event)
  const have = new Set(FESTIVALS.map((f) => `${f.start}|${f.place.split(',')[0].toLowerCase()}`));
  for (const country of ['US', 'CA']) {
    try {
      const list = await (await get(`https://www.tangomarathons.com/wp-json/tmd/v4/events?country=${country}&start_date_after=${today}&per_page=100`, `TMD ${country}`)).json();
      for (const e of Array.isArray(list) ? list : []) {
        const m = e.meta || {}, start = String(m.start_date || '').slice(0, 10), end = String(m.end_date || '').slice(0, 10), town = String(m.city || '').split(',')[0].trim();
        if (!start || !town || have.has(`${start}|${town.toLowerCase()}`)) continue;
        have.add(`${start}|${town.toLowerCase()}`);
        const title = String((e.title && e.title.rendered) || e.title || '').replace(/<[^>]+>/g, '').replace(/&#8211;/g, '–').replace(/&amp;/g, '&').trim();
        const place = /,/.test(m.city) ? m.city.trim() : town;
        out.push(...perDay(start, end, festRow({ title, place, url: m.website || e.link })));
      }
    } catch (err) { console.error(`Tango Marathon Directory ${country}: ${err.message}`); }
  }
  console.log(`Festivals: ${out.length} rows`);
  return out;
}

// ---- Buenos Aires tours ----
const TOURS = JSON.parse(readFileSync(new URL('./data/tours.json', import.meta.url), 'utf8')).tours;
async function tours() {
  return TOURS.flatMap((t) => perDay(t.start, t.end, {
    venue: 'Buenos Aires Tours', type: 'tour', url: t.url,
    title: `${t.title} · ${t.by}${t.home ? ` (${t.home})` : ''} — Buenos Aires, Argentina`,
  }));
}

const sources = [communities, festivals, tours];
let all = [];
for (const src of sources) {
  try { all = all.concat(await src()); }
  catch (err) { console.error(`Source failed (${src.name}):`, err.message); }
}
const normalizeVenue = (e) => e;

// window, de-dupe, sort; calmTitle on the title alone (the " — Town, ST" place after it keeps its codes)
const calmPlace = (title) => {
  const i = title.lastIndexOf(' — ');
  return i > 0 ? calmTitle(title.slice(0, i)) + title.slice(i) : calmTitle(title);
};
const seen = new Set();
const fresh = all
  .filter((e) => e.venue && e.date && e.date >= cutoff && e.date <= horizon)
  .filter((e) => !isNotice(e.title))
  .map((e) => ({ ...e, title: calmPlace(e.title) }))
  .filter((e) => { const k = eventKey(e); if (seen.has(k)) return false; seen.add(k); return true; }); // venue|title|date|clock (merge.mjs)

// the empty-list gate (feeds.mjs): nothing upcoming in this build's own pull means a room was
// missed in scouting or every source is down — not a fact about the town. ALLOW_EMPTY_LIST=1 overrides.
if (!emptyListGate(fresh, today, sources.length)) process.exit(1);

// carry past events forward. Two copies of the archive: the live feed and
// the `archive` branch's file (every past event ever published; the workflow
// rewrites it after each build). Each is fetched with three tries; the build
// goes on with the union of whatever it got and stops only when it got
// neither. Since the union can only grow, a publish that lost history can no
// longer shrink the record.
const cleanArchive = (d) => (Array.isArray(d) ? d : (d.events || []))
  .map(normalizeVenue) // past events published under other spellings fold onto the one name
  .filter((e) => !isNotice(e.title)).map((e) => ({ ...e, title: calmTitle(e.title) })); // the same title hygiene as fresh events, so the merge keys agree
async function fetchArchive(url, what) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return cleanArchive(await r.json());
    } catch (err) {
      console.error(`${what} fetch (try ${attempt} of 3) failed: ${err.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 20000));
    }
  }
  return null;
}
const [liveArchive, branchArchive] = await Promise.all([
  fetchArchive(FEED_URL, 'Live feed'),
  fetchArchive(ARCHIVE_URL, 'Archive branch'),
]);
if (liveArchive === null && branchArchive === null && !process.env.ALLOW_NO_ARCHIVE) {
  console.error('No archive from either copy — not publishing (ALLOW_NO_ARCHIVE=1 to override for a first build)');
  process.exit(1);
}
if (liveArchive === null) console.error('Live feed unreadable — building on the archive branch copy');
if (branchArchive === null) console.error('Archive branch unreadable — building on the live feed alone');
const archived = unionArchives(liveArchive || [], branchArchive || []);
console.log(`Archive: ${(liveArchive || []).length} events in the live feed, ${(branchArchive || []).length} on the archive branch, ${archived.length} in the union`);

const merged = mergeWithArchive(fresh, archived, today, cutoff).slice(-MAX_EVENTS);

// No clubs (city.js teams is empty): the schedules step writes nothing
let seasons = {}, form = {};
if (CITY.teams.length) { try { ({ teams: seasons, form } = await applySchedules(merged)); } catch (err) { console.error('Schedules step failed:', err.message); } }
merged.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
if (Object.keys(seasons).length) {
  const postseason = JSON.parse(readFileSync(new URL('./data/postseason.json', import.meta.url), 'utf8')); // each league's playoff rounds (hand-kept), shown until the real games land
  delete postseason._;
  writeFileSync(new URL('../site/teams.json', import.meta.url), JSON.stringify({ generated: new Date().toISOString(), teams: seasons, form, postseason }, null, 1) + '\n');
}

// the Map view: each event's place and spot (scripts/places.mjs, from the committed gazetteer)
const unplaced = placeEvents(merged, CITY.venues);
console.log(`places: ${merged.filter((e) => e.geo).length} of ${merged.length} events pinned` + (unplaced.size ? `; not in the gazetteer: ${[...unplaced].map(([p, n]) => `${p} (${n})`).join(', ')}` : ''));
writeFileSync(JSON_OUT, JSON.stringify({ generated: new Date().toISOString(), events: merged }, null, 2) + '\n');
// the archive record: this build's past events on top of everything already
// recorded, never pruned (the feed keeps a year; the branch keeps it all)
const record = unionArchives(merged.filter((e) => e.date < today), archived.filter((e) => e.date < today));
writeFileSync(ARCHIVE_OUT, JSON.stringify({ events: record }, null, 1) + '\n'); // no timestamp: the branch commits only when the events change
console.log(`Archive record: ${record.length} past events`);
writeFileSync(ICS_OUT, buildIcs(merged));

// Filtered subscribe feeds, one per venue and one per badge, so the site's
// filter chips can offer a matching calendar subscription.
const siteDir = new URL('../site/', import.meta.url);
let nFeeds = 0;
for (const venue of new Set(merged.map((e) => e.venue))) {
  const evs = merged.filter((e) => e.venue === venue);
  writeFileSync(new URL(`events-venue-${slugify(venue)}.ics`, siteDir),
    buildIcs(evs, new Date(), { calname: `${CITY.ics.short} — ${venue}` }));
  nFeeds++;
}
for (const [slug, [label, pred]] of Object.entries(BADGE_FEEDS)) {
  writeFileSync(new URL(`events-${slug}.ics`, siteDir),
    buildIcs(merged.filter(pred), new Date(), { calname: `${CITY.ics.short} — ${label}` }));
  nFeeds++;
}
// Exclusion feeds, one per local team: everything except that team's games.
for (const t of TEAMS) {
  writeFileSync(new URL(`events-no-${t.slug}.ics`, siteDir),
    buildIcs(merged.filter((e) => !t.re.test(e.title || '')), new Date(), { calname: `${CITY.ics.short} — no ${t.label}` }));
  nFeeds++;
}
// Season feeds for the Teams view: each club's whole season, home and away
// (team-<slug>.ics), and every club's in one (teams.ics). Each game links to
// the club's page on the site.
const seasonEvents = (slug, label, games) => games.map((g) => ({
  title: `${label} ${g.home ? 'vs' : 'at'} ${g.opp.name}${g.pre ? ' (preseason)' : g.playoff ? ' (playoff)' : ''}`,
  venue: g.venue || (g.home ? '' : g.opp.name), date: g.date, time: g.tbd ? null : g.time, ...(g.tbd ? { dateTbd: true } : {}),
  url: `${CITY.site}?team=${slug}`,
}));
const allSeasons = [];
for (const t of TEAMS) {
  if (!seasons[t.slug]) continue;
  const evs = seasonEvents(t.slug, t.label, seasons[t.slug]);
  allSeasons.push(...evs);
  writeFileSync(new URL(`team-${t.slug}.ics`, siteDir), buildIcs(evs, new Date(), { calname: `${t.label} season` }));
  nFeeds++;
}
writeFileSync(new URL('teams.ics', siteDir), buildIcs(allSeasons, new Date(), { calname: CITY.ics.teams }));
nFeeds++;

const nPast = merged.filter((e) => e.date < today).length;
console.log(`Wrote ${merged.length} events (${nPast} past, ${merged.length - nPast} upcoming) + ${nFeeds} filtered feeds`);
