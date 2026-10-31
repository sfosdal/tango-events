// tango.events' RRULE expander (scripts/recur.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandIcs, expandRule } from './recur.mjs';

const d = (s) => new Date(`${s}T00:00:00Z`);
const iso = (xs) => xs.map((x) => x.toISOString().slice(0, 10));
const cal = (...events) => ['BEGIN:VCALENDAR', ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

test('weekly, every other week, and a COUNT', () => {
  assert.deepEqual(iso(expandRule(d('2026-11-03'), 'FREQ=WEEKLY', d('2026-11-24'))), ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  assert.deepEqual(iso(expandRule(d('2026-11-03'), 'FREQ=WEEKLY;INTERVAL=2', d('2026-12-01'))), ['2026-11-03', '2026-11-17', '2026-12-01']);
  assert.deepEqual(iso(expandRule(d('2026-11-03'), 'FREQ=WEEKLY;COUNT=2', d('2027-01-01'))), ['2026-11-03', '2026-11-10']);
});

test('monthly by ordinal weekday: the 1st and 3rd Sunday, the last Tuesday', () => {
  assert.deepEqual(iso(expandRule(d('2026-11-01'), 'FREQ=MONTHLY;BYDAY=1SU,3SU', d('2026-12-31'))), ['2026-11-01', '2026-11-15', '2026-12-06', '2026-12-20']);
  assert.deepEqual(iso(expandRule(d('2026-11-01'), 'FREQ=MONTHLY;BYDAY=-1TU', d('2026-12-31'))), ['2026-11-24', '2026-12-29']);
  assert.deepEqual(iso(expandRule(d('2026-11-01'), 'FREQ=MONTHLY;BYMONTHDAY=4', d('2026-12-31'))), ['2026-11-04', '2026-12-04']);
});

test('UNTIL stops the series', () => {
  assert.deepEqual(iso(expandRule(d('2026-11-02'), 'FREQ=WEEKLY;UNTIL=20261110T235959Z', d('2026-12-31'))), ['2026-11-02', '2026-11-09']);
});

test('EXDATE drops a night, a RECURRENCE-ID moves one, a weekly 20:00 survives the DST change', () => {
  const text = cal(
    ['UID:m1', 'SUMMARY:Milonga', 'DTSTART;TZID=America/Los_Angeles:20261030T200000', 'DTEND;TZID=America/Los_Angeles:20261030T233000', 'RRULE:FREQ=WEEKLY', 'EXDATE;TZID=America/Los_Angeles:20261106T200000'],
    ['UID:m1', 'SUMMARY:Milonga (moved)', 'RECURRENCE-ID;TZID=America/Los_Angeles:20261113T200000', 'DTSTART;TZID=America/Los_Angeles:20261114T210000'],
  );
  const got = expandIcs(text, { tz: 'America/Los_Angeles', from: '2026-10-30', to: '2026-11-20' }).map((e) => `${e.date} ${e.time} ${e.title}`).sort();
  assert.deepEqual(got, ['2026-10-30 20:00 Milonga', '2026-11-14 21:00 Milonga (moved)', '2026-11-20 20:00 Milonga']);
});

test('a UTC time is read on the calendar’s own clock', () => {
  const text = cal(['UID:u', 'SUMMARY:Práctica', 'DTSTART:20261104T010000Z']); // 20:00 on the 3rd in Montréal (EST, after the 1 November change)
  const [e] = expandIcs(text, { tz: 'America/Toronto', from: '2026-11-01', to: '2026-11-30' });
  assert.equal(`${e.date} ${e.time}`, '2026-11-03 20:00');
});
