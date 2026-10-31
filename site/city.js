// The "city" — here a dance rather than a town: every fact that makes this
// calendar tango.events rather than a city's (2026-10-30, Steve: "go with US,
// southern canada search to produce tango.events", "I want tango.events like I
// have curling.events"). Built on curling-events' city.js. The browser
// (filter.js, app.js) and the build (scripts/*.mjs) both read it; nothing else
// names a row. Shared files are lqa-events' own, byte for byte, bar the lines
// marked "tango.events" (filter.js TYPE_KEYS_OK, app.js typeColor, ics.mjs zones,
// styles.css --v-* hues).
//
// The "venues" are the panel's rows: the festivals and the Buenos Aires tours,
// then the communities by region. A multi-day festival or tour is one row per
// day, so the days read as one series ("2 of 3").
//
// Loaded before filter.js (a plain script, so the tests can share it): it
// sets globalThis.LQACity (the name is the shared code's, not the city's).
(function (global) {
  'use strict';

  // No clubs: the Teams stop opens Local Communities (clubs.js) instead.
  var TEAMS = [];

  // The rows, one record each. Per row:
  //   capacity  a rough house size — only the "big" preset reads it
  //   area      absent = the Festivals & Tours column; 'town' = Communities
  //   type      the event type when the title decides nothing
  //   cssVar    the hue styles.css sets for it (dark block --v-*); color the
  //             same hue as a value, for the series graph
  //   url       the row's own listing
  //   icon      the row's mark (site/marks/rows/, local — no third-party images)
  //   states    (regions) the state and province codes whose communities fall
  //             in the row — read by fetch-events.mjs
  var REGION_ICON = 'marks/rows/region.svg';
  var VENUES = {
    // --- Festivals & Tours ---
    'Festivals & Marathons': { // festivals, marathons, encuentros and workshop weekends across the US and Canada
      capacity: 400,
      type: 'festival',
      cssVar: '--v-fest',
      color: '#ea86b8',
      url: 'https://www.tangomarathons.com/',
      icon: 'marks/rows/festival.svg',
    },
    'Buenos Aires Tours': { // trips to Buenos Aires led by US organisers — hand-kept (scripts/data/tours.json)
      capacity: 30,
      type: 'tour',
      cssVar: '--v-tours',
      color: '#eadb86',
      url: 'https://cita.dance/',
      icon: 'marks/rows/tour.svg',
      geo: [-34.6037, -58.3816], town: 'Buenos Aires, Argentina',
    },
    // --- Communities ---
    'Pacific Northwest': { capacity: 100, type: 'milonga', area: 'town', cssVar: '--v-pnw', color: '#86dcea', url: 'https://www.allseattletango.com/', icon: REGION_ICON, states: ['WA', 'OR', 'ID', 'MT', 'AK'] },
    'California': { capacity: 100, type: 'milonga', area: 'town', cssVar: '--v-cal', color: '#eab886', url: 'https://www.tangomango.org/', icon: REGION_ICON, states: ['CA', 'HI'] },
    'Mountain West': { capacity: 100, type: 'milonga', area: 'town', cssVar: '--v-mountain', color: '#d0ea86', url: 'https://tangocolorado.org/', icon: REGION_ICON, states: ['CO', 'UT', 'AZ', 'NM', 'NV', 'WY'] },
    'Texas, the South & Midwest': { capacity: 100, type: 'milonga', area: 'town', cssVar: '--v-south', color: '#ea9a86', url: 'https://austintango.org/', icon: REGION_ICON, states: ['TX', 'OK', 'LA', 'AR', 'MS', 'AL', 'GA', 'FL', 'TN', 'KY', 'SC', 'IL', 'WI', 'MN', 'MI', 'OH', 'IN', 'IA', 'MO', 'KS', 'NE', 'ND', 'SD'] },
    'Mid-Atlantic & Carolinas': { capacity: 100, type: 'milonga', area: 'town', cssVar: '--v-midatl', color: '#86b4ea', url: 'https://calendar.google.com/calendar/embed?src=4vt5bq8tisa5vka79l0f6v5av4%40group.calendar.google.com', icon: REGION_ICON, states: ['DC', 'MD', 'VA', 'WV', 'DE', 'PA', 'NC'] },
    'New York & New England': { capacity: 100, type: 'milonga', area: 'town', cssVar: '--v-ne', color: '#c286ea', url: 'https://www.newyorktango.com/', icon: REGION_ICON, states: ['NY', 'NJ', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME'] },
    'Canada': { capacity: 100, type: 'milonga', area: 'town', cssVar: '--v-canada', color: '#ea8686', url: 'https://tangocalmontreal.ca/', icon: REGION_ICON, states: ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL'] },
  };

  // No feeds.mjs feeds here: the communities' calendars are listed per community
  // in clubs.json (`feeds`) and read by fetch-events.mjs (scripts/recur.mjs
  // expands their repeating milongas).
  var FEEDS = [];

  // The usual view: every row on
  var DEFAULT_ON = Object.keys(VENUES);
  var DEFAULT_OFF = [];
  var PREFS_KNOWN_FROM = null;

  // Event types (the city's own keys — filter.js trusts them, app.js colours
  // them from `color`): fetch-events.mjs tags each event by its title and its
  // calendar.
  var TYPES = [
    { key: 'milonga', label: 'Milongas', title: 'Milongas — the social dances', color: '#e0457b' },
    { key: 'practica', label: 'Prácticas', title: 'Prácticas and practilongas — guided or open practice', color: '#9c6ade' },
    { key: 'class', label: 'Classes & Workshops', title: 'Classes, series, workshops and seminars', color: '#3d8fd8' },
    { key: 'festival', label: 'Festivals & Encuentros', title: 'Festivals, marathons, encuentros and workshop weekends', color: '#f08a33' },
    { key: 'tour', label: 'Tours', title: 'Trips to Buenos Aires led by US organisers', color: '#43a36b' },
  ];
  var MOVIE_VENUE = null;

  // Share codes (?f=CODE): REGISTRY is every filterable key in a fixed
  // order and a code is a bitmask over it, so the list is APPEND-ONLY once
  // published. 20 slots: 4 base-36 digits hold exactly 20 bits — the 21st
  // entry needs CODE_LENGTH 5.
  var CODE_LENGTH = 4;
  var REGISTRY = [
    ['venue', 'Festivals & Marathons'], ['venue', 'Buenos Aires Tours'],
    ['venue', 'Pacific Northwest'], ['venue', 'California'], ['venue', 'Mountain West'], ['venue', 'Texas, the South & Midwest'],
    ['venue', 'Mid-Atlantic & Carolinas'], ['venue', 'New York & New England'], ['venue', 'Canada'],
    ['badge', 'milonga'], ['badge', 'practica'], ['badge', 'class'], ['badge', 'festival'], ['badge', 'tour'],
    ['cap', 'stadium'], ['cap', 'arena'], ['cap', 'hall'], ['cap', 'room'],
  ];

  var WORDS = {
    teamCity: '',
    presetDefault: 'Every festival, every tour and every community — the US and southern Canada',
    presetNeighborhood: 'The festivals and the Buenos Aires tours only',
    presetBig: 'The festivals and marathons only',
    phrases: { all: 'Showing everything.', none: 'Showing nothing yet — open Filter and pick some rows.', neighborhood: 'Showing the festivals and tours only.', big: 'Showing the festivals and marathons only.' },
  };

  // The US federal holidays
  function nthWeekday(y, month, weekday, n) { var d = new Date(y, month, 1); while (d.getDay() !== weekday) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + (n - 1) * 7); return d; }
  function lastMonday(y, month) { var d = new Date(y, month + 1, 0); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); return d; }
  var HOLIDAYS = function (y) {
    return [
      [new Date(y, 0, 1), "New Year's Day"],
      [nthWeekday(y, 0, 1, 3), 'Martin Luther King Jr. Day'],
      [nthWeekday(y, 1, 1, 3), "Presidents' Day"],
      [lastMonday(y, 4), 'Memorial Day'],
      [new Date(y, 5, 19), 'Juneteenth'],
      [new Date(y, 6, 4), 'Independence Day'],
      [nthWeekday(y, 8, 1, 1), 'Labor Day'],
      [nthWeekday(y, 9, 1, 2), 'Columbus Day'],
      [new Date(y, 10, 11), 'Veterans Day'],
      [nthWeekday(y, 10, 4, 4), 'Thanksgiving'],
      [new Date(y, 11, 25), 'Christmas Day'],
    ];
  };

  global.LQACity = {
    key: 'tango',
    name: 'Tango',
    site: 'https://tango.here.events/', // the address is Steve's open decision (tango.events belongs to the Belgian telecom)
    userAgent: 'Mozilla/5.0 (compatible; tango-events/0.1; +https://tango.here.events/)',
    tz: 'America/Los_Angeles', tzName: 'Pacific', // only a fallback: every community event carries its own `tz` and keeps its own clock
    state: 'USA', stateOutline: null,
    // the calendar feed's header; the UID domain never changes
    ics: { name: 'Tango Events', short: 'Tango Events', teams: 'Tango', prodid: '-//here.events//tango-events//EN', uidDomain: 'fosdal.net',
      desc: 'Argentine tango across the US and southern Canada — milongas\, prácticas and classes from the community calendars\, festivals\, marathons and encuentros\, and US-led tours to Buenos Aires' },
    teams: TEAMS,
    venues: VENUES,
    feeds: FEEDS,
    // the Map view: the world on a Miller projection, opening on North America;
    // the pins are the places the events name — the " — Town, ST" tail of each
    // title (scripts/places.mjs, from the committed gazetteer)
    map: {
      kind: 'world',
      pins: 'places',
      bbox: [-48, -170, 72, 180],
      home: [24, -130, 60, -52], // the US and southern Canada
      states: ['USA', 'CAN'],
      labels: [
        { name: 'Canada', lat: 56, lon: -103, anchor: 'middle', dy: 0 },
        { name: 'United States', lat: 39.5, lon: -99, anchor: 'middle', dy: 0 },
        { name: 'Argentina', lat: -36, lon: -65, anchor: 'end' },
        { name: 'Pacific Ocean', lat: 20, lon: -150, kind: 'water', anchor: 'middle' },
        { name: 'Atlantic Ocean', lat: 30, lon: -45, kind: 'water', anchor: 'middle' },
      ],
    },
    defaultOn: DEFAULT_ON,
    defaultOff: DEFAULT_OFF,
    prefsKnownFrom: PREFS_KNOWN_FROM,
    types: TYPES,
    movieVenue: MOVIE_VENUE,
    groundsVenue: null,
    codeLength: CODE_LENGTH,
    registry: REGISTRY,
    words: WORDS,
    holidays: HOLIDAYS,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
