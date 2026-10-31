# Tango Events

Event feed and calendar for Argentine tango across the US and southern
Canada: milongas, prácticas, classes and workshops from the local
communities' own calendars, festivals, marathons and encuentros, and the
US-led tours to Buenos Aires. English and Spanish (`?lang=es`).

Published at **https://tango.here.events/** (GitHub Pages, built by the
Actions workflow once a day at noon Pacific).

Built 2026-10-30 on the curling-events base — here the "city" is a dance.
Everything that makes this tango's is `site/city.js` (every row, type,
default, share-code registry and string), `site/clubs.json` + `site/clubs.js`
(Local Communities), `site/i18n.js` (Spanish), `site/index.html`,
`scripts/fetch-events.mjs` (its sources), `scripts/recur.mjs`,
`scripts/data/`, `site/embed.js`, the manifest and icons. Everything else —
`app.js`, `filter.js`, `styles.css`, the shared `scripts/*.mjs` and their
tests — is lqa-events' own, byte for byte, bar the lines marked
"tango.events".

## Sources

All public and keyless, read at build time; no Ticketmaster.

- **Community calendars** — each community's public Google Calendar
  (`site/clubs.json`), its recurring events expanded six weeks ahead by
  `scripts/recur.mjs` (weekly, monthly ordinal and last, INTERVAL, UNTIL,
  COUNT, EXDATE, RECURRENCE-ID) in the community's own local time.
- **New York** — newyorktango.com's three CSV listings, their rules turned
  into RRULEs.
- **Calgary** — its Events Calendar (Tribe) REST feed.
- **Festivals & Marathons** — `scripts/data/festivals.json` plus the Tango
  Marathon Directory's API for the US and Canada.
- **Buenos Aires Tours** — `scripts/data/tours.json`.

A multi-day festival or tour is one row per day, so the days read as one
series ("2 of 3"). Every community event keeps its own clock; the ICS feeds
write it with that zone's TZID.

## Build

```
ALLOW_NO_ARCHIVE=1 node scripts/fetch-events.mjs   # writes site/events.json and the .ics feeds
node scripts/seo.mjs && node scripts/seo-places.mjs
node --test scripts/*.test.mjs
python3 -m http.server 8000 --directory site
```

`ALLOW_NO_ARCHIVE=1` is only for the first build, before the `archive` branch
exists; in CI it is a repository variable until the first run has pushed the
archive, then it is deleted.

## Sister sites

lqa-events (Seattle Center) is the source of truth for the shared files. See
its README for the pipeline and the share codes.
