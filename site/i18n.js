// English / Spanish for the site's own words (Steve, 2026-10-30: "go with 1" — the
// English/Spanish option). Tango's own file, not a shared one: the shared app.js,
// filter.js, clubs.js and local-map.js stay lqa's byte for byte, and this file puts
// their words into Spanish after they are written — a dictionary of whole strings,
// a few patterns for the composite ones, the en-US dates and clocks re-asked in
// es-US. Event titles, stages and addresses stay as the organisers wrote them (every
// title ends " — Town, ST", which no entry here matches). The feeds (events.json,
// events.ics) stay English.
//
// The language: ?lang=es|en, else the last choice (localStorage 'tango-lang'), else
// the browser's own. The chip in the masthead names the other language and reloads
// the page in it — a page is translated once, never switched back in place.
// Loaded after city.js (index.html defers both, sources.html and advertise.html load
// both in their heads) so the type names are swapped before app.js reads them.
(function () {
  var q = new URLSearchParams(location.search);
  var lang = q.get('lang');
  if (lang !== 'es' && lang !== 'en') {
    try { lang = localStorage.getItem('tango-lang'); } catch (e) { lang = null; }
  } else {
    try { localStorage.setItem('tango-lang', lang); } catch (e) { /* no storage */ }
  }
  if (lang !== 'es' && lang !== 'en') lang = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
  document.documentElement.lang = lang;
  globalThis.TangoLang = lang;

  // the chip: "Español" on the English page, "English" on the Spanish one
  function addSwitch() {
    var host = document.querySelector('.masthead-tools') || document.querySelector('.masthead');
    if (!host || document.getElementById('langSwitch')) return;
    var other = lang === 'es' ? 'en' : 'es';
    function target() { var u = new URL(location.href); u.searchParams.set('lang', other); return u.pathname + u.search + u.hash; }
    var a = document.createElement('a');
    a.id = 'langSwitch';
    a.className = 'chip lang-switch';
    a.href = target();
    a.hreflang = other;
    a.lang = other;
    a.title = other === 'es' ? 'Ver esta página en español' : 'See this page in English';
    a.textContent = other === 'es' ? 'Español' : 'English';
    a.addEventListener('click', function () { // the address as it is now (app.js keeps ?f= in step with the filters)
      a.href = target();
      try { localStorage.setItem('tango-lang', other); } catch (e) { /* no storage */ }
    });
    host.insertBefore(a, host.firstChild);
  }
  var css = document.createElement('style');
  css.textContent = '.lang-switch{text-decoration:none}' +
    '.masthead > .lang-switch{position:absolute;top:1rem;right:1rem}' +
    'html[lang=es] [data-lang=en],html:not([lang=es]) [data-lang=es]{display:none !important}';
  document.head.appendChild(css);
  function whenReady(f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); }
  whenReady(addSwitch);
  if (lang !== 'es') return;

  // ---- the words ----
  var ES = {
    // the masthead and the bar
    'Tango Events — Milongas, Prácticas, Festivals & Buenos Aires Tours': 'Tango Events — milongas, prácticas, festivales y viajes a Buenos Aires',
    'Subscribe in your calendar app': 'Suscríbete desde tu app de calendario',
    'Add To My Calendar': 'Añadir a mi calendario',
    'Every city on here.events': 'Todas las ciudades de here.events',
    'More Cities': 'Más ciudades',
    'Color theme': 'Tema de color', 'Light': 'Claro', 'Dark': 'Oscuro', 'System': 'Sistema',
    'Filters': 'Filtros', 'Filter': 'Filtrar', 'Search…': 'Buscar…',
    'Apply': 'Aplicar', // the filter panel's foot (here-core, 2026-11-05)
    'Your calendar keeps the filters set now. To change them later, add it again.': 'Tu calendario conserva los filtros que tengas ahora. Para cambiarlos más tarde, vuelve a añadirlo.',
    'Search events by venue, team, or type': 'Buscar eventos por región, lugar o tipo',
    'View': 'Vista', 'Events': 'Eventos', 'List': 'Lista', 'Month': 'Mes', 'Map': 'Mapa', 'Communities': 'Comunidades',
    'Month — the month\'s events on a calendar': 'Mes — los eventos del mes en un calendario',
    'Local Communities — the tango communities nearest you, with their next milongas': 'Comunidades locales — las comunidades de tango más cercanas, con sus próximas milongas',
    'Map — where the events are': 'Mapa — dónde son los eventos',
    'Include my filter choices': 'Incluir mis filtros',
    'macOS / iOS Calendar (or whichever calendar app handles webcal links)': 'Calendario de macOS / iOS (o la app que abra los enlaces webcal)',
    'QR code for your phone': 'Código QR para tu teléfono', 'QR Code': 'Código QR',
    'Copy the feed link': 'Copiar el enlace del calendario', 'Copy Link': 'Copiar enlace', 'Copied': 'Copiado', 'Copied!': '¡Copiado!',
    'QR code for the calendar feed': 'Código QR del calendario',
    'Scan with your phone to subscribe there.': 'Escanéalo con tu teléfono para suscribirte ahí.',
    'Refreshed once a day. Your calendar picks up changes on its own schedule.': 'Se actualiza una vez al día. Tu calendario recoge los cambios a su propio ritmo.',
    'Show calendar': 'Mostrar calendario', 'Hide calendar': 'Ocultar calendario',
    'Season calendar — download it as a PDF': 'Calendario de temporada — descárgalo en PDF',
    'Season Calendar': 'Calendario de temporada', 'Season calendar': 'Calendario de temporada',
    'Teams': 'Equipos', 'Team schedules': 'Calendarios de equipos',
    // the filter panel
    'Default': 'Predeterminado', 'Everything': 'Todo', 'None': 'Nada', 'Nothing': 'Nada',
    'Every festival, every tour and every community — the US and southern Canada': 'Todos los festivales, los viajes y las comunidades — EE. UU. y el sur de Canadá',
    'Every venue, type and team, holidays too': 'Todas las regiones y los tipos, con los feriados',
    'Everything off — build your own view from scratch': 'Todo apagado — arma tu vista desde cero',
    'The festivals and the Buenos Aires tours only': 'Solo los festivales y los viajes a Buenos Aires',
    'The festivals and marathons only': 'Solo los festivales y las maratones',
    'Neighborhood': 'Barrio', 'Capacity > 2K': 'Aforo > 2K',
    'Only Sold Out': 'Solo agotados', 'Include Holidays': 'Incluir feriados',
    'Festivals & Tours': 'Festivales y viajes', 'Event Type': 'Tipo de evento', 'Home Teams': 'Equipos locales', 'Festivals': 'Festivales',
    'Show All': 'Mostrar todo', 'Hide All': 'Ocultar todo', 'Show': 'Mostrar', 'Hide': 'Ocultar',
    // the rows (city.js keys them by these names, so they are put into Spanish on the page only)
    'Festivals & Marathons': 'Festivales y maratones',
    'Buenos Aires Tours': 'Viajes a Buenos Aires',
    'Pacific Northwest': 'Noroeste del Pacífico',
    'California': 'California',
    'Mountain West': 'Oeste montañoso',
    'Texas, the South & Midwest': 'Texas, el Sur y el Medio Oeste',
    'Mid-Atlantic & Carolinas': 'Atlántico Medio y las Carolinas',
    'New York & New England': 'Nueva York y Nueva Inglaterra',
    'Canada': 'Canadá',
    // the list and the calendars
    'Upcoming events': 'Próximos eventos', 'Usual View': 'Vista habitual', 'Loading events…': 'Cargando eventos…',
    'Month calendar': 'Calendario del mes', 'Change months': 'Cambiar de mes',
    'Previous month': 'Mes anterior', 'Next month': 'Mes siguiente', 'Pick a month and year': 'Elige mes y año',
    'Back to today: the current month, past days put away': 'Volver a hoy: el mes actual, sin los días pasados',
    'Today': 'Hoy', 'Tomorrow': 'Mañana', 'Yesterday': 'Ayer', 'Tonight': 'Esta noche', 'This Week': 'Esta semana', 'Next Week': 'La semana que viene',
    'all day': 'todo el día', 'All day': 'Todo el día', 'All Day': 'Todo el día',
    'AM': 'a.m.', 'PM': 'p.m.',
    'Undo': 'Deshacer', 'Back to top': 'Volver arriba', 'Top': 'Arriba', 'Close': 'Cerrar', 'Tickets': 'Entradas',
    'No events match these filters.': 'Ningún evento coincide con estos filtros.',
    'No events match.': 'Ningún evento coincide.',
    // the Map view
    'Map of the events': 'Mapa de los eventos',
    'The world with the places the events are held marked': 'El mundo con los lugares de los eventos marcados',
    'Zoom in': 'Acercar', 'Zoom out': 'Alejar', 'The whole map': 'Todo el mapa', 'Find my location': 'Buscar mi ubicación',
    'United States': 'Estados Unidos', 'Pacific Ocean': 'Océano Pacífico', 'Atlantic Ocean': 'Océano Atlántico',
    // Local Communities
    'Local communities': 'Comunidades locales', 'Local Communities': 'Comunidades locales',
    'Town, state, province or ZIP': 'Ciudad, estado, provincia o código postal',
    'Find tango communities by town, state, province or ZIP code': 'Buscar comunidades de tango por ciudad, estado, provincia o código postal',
    'Use my location': 'Usar mi ubicación',
    // the footer
    'Advertise on this calendar': 'Anunciarse en este calendario', 'Advertise': 'Anunciarse',
    'Where the listings come from': 'De dónde vienen los eventos', 'Sources': 'Fuentes',
    'Embed': 'Insertar', 'Events widget': 'Widget de eventos', 'Data feeds': 'Datos', 'Filter links': 'Enlaces con filtro',
    'Drop these two lines into any page and the next events render in place. Style it with the': 'Pega estas dos líneas en cualquier página y los próximos eventos aparecen ahí. Dale estilo con las clases CSS',
    'CSS classes.': '.',
    'The raw data behind this page, fetchable from anywhere (CORS is open):': 'Los datos de esta página, accesibles desde cualquier sitio (CORS abierto):',
    'JSON feed': 'feed JSON', 'iCalendar feed': 'feed iCalendar',
    'Google and Outlook don\'t have feed formats of their own — they subscribe to the iCalendar feed. The': 'Google y Outlook no tienen un formato propio: se suscriben al feed iCalendar. El botón',
    'button up top has one-click links for both.': 'de arriba tiene enlaces de un clic para los dos.',
    'A link that opens this page with the filters you have set right now (': 'Un enlace que abre esta página con los filtros que tienes ahora (',
    ') — for a widget\'s "see all" link, or to share one view.': ') — para el enlace «ver todo» de un widget o para compartir una vista.',
    'Copy a link that opens with this exact filter': 'Copiar un enlace que abre con este mismo filtro',
    'Copy Filter Link': 'Copiar enlace del filtro',
    'Sun': 'Dom', 'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mié', 'Thu': 'Jue', 'Fri': 'Vie', 'Sat': 'Sáb',
    'Hide this club\'s home games': 'Ocultar los partidos en casa de este club', 'This club\'s whole season in the Teams view': 'La temporada entera de este club en la vista Equipos',
    'Nothing listed': 'Nada en la lista', 'Nothing listed under these filters': 'Nada con estos filtros',
    'The event feed did not load (': 'Los eventos no se cargaron (', 'On Google Maps': 'En Google Maps', 'This site': 'Este sitio',
    'Venue ↗': 'Lugar ↗', 'Their site ↗': 'Su sitio ↗', 'Coming soon': 'Muy pronto', 'Dates TBA': 'Fechas por anunciar', 'date tbd': 'fecha por confirmar', 'time tbd': 'hora por confirmar',
    'You are here': 'Estás aquí', 'You are outside this map': 'Estás fuera de este mapa', 'This browser gives no location': 'Este navegador no da la ubicación',
    'Festival list': 'Lista del festival', 'Venue list': 'Lista del lugar', 'Festival site ↗': 'Sitio del festival ↗', 'Venue site ↗': 'Sitio del lugar ↗',
    'Finding the tango communities near you…': 'Buscando las comunidades de tango cerca de ti…',
    'Location is off for this site — search by town, state, province or ZIP, or allow it and tap Use my location.': 'La ubicación está desactivada para este sitio: busca por ciudad, estado, provincia o código postal, o permítela y toca Usar mi ubicación.',
    'No calendar we can read yet — the community’s own site has its listings.': 'Aún no hay un calendario que podamos leer: el sitio de la comunidad tiene sus eventos.',
    'No community matches that — try a town, a state or province, or a ZIP code.': 'Ninguna comunidad coincide: prueba con una ciudad, un estado o provincia, o un código postal.',
    'This browser gives no location — search by town, state, province or ZIP.': 'Este navegador no da la ubicación: busca por ciudad, estado, provincia o código postal.',
    'Your location could not be read — search by town, state, province or ZIP.': 'No se pudo leer tu ubicación: busca por ciudad, estado, provincia o código postal.',
    'sold out': 'agotado', 'Sold out': 'Agotado', 'Sold Out': 'Agotado',
    // the holidays (Include Holidays)
    'New Year\'s Day': 'Año Nuevo', 'Martin Luther King Jr. Day': 'Día de Martin Luther King Jr.', 'Presidents\' Day': 'Día de los Presidentes',
    'Memorial Day': 'Día de los Caídos', 'Juneteenth': 'Juneteenth', 'Independence Day': 'Día de la Independencia', 'Labor Day': 'Día del Trabajo',
    'Columbus Day': 'Día de la Raza', 'Veterans Day': 'Día de los Veteranos', 'Thanksgiving': 'Acción de Gracias', 'Christmas Day': 'Navidad',
    'USA & the World': 'EE. UU. y el mundo', '← Back to the calendar': '← Volver al calendario'
  };
  // the event types (city.js keys them; the labels are only words)
  var TYPE_ES = {
    milonga: ['Milongas', 'Milongas — los bailes sociales'],
    practica: ['Prácticas', 'Prácticas y practilongas — práctica guiada o libre'],
    'class': ['Clases y talleres', 'Clases, series, talleres y seminarios'],
    festival: ['Festivales y encuentros', 'Festivales, maratones, encuentros y fines de semana de talleres'],
    tour: ['Viajes', 'Viajes a Buenos Aires con organizadores de EE. UU.']
  };
  var CITY = globalThis.LQACity;
  if (CITY && CITY.types) CITY.types.forEach(function (t) {
    var s = TYPE_ES[t.key]; if (!s) return;
    ES[t.label] = s[0]; ES[t.title] = s[1];
    t.label = s[0]; t.title = s[1];
  });

  if (CITY && CITY.words && CITY.words.phrases) {
    var PH = { all: 'Se muestra todo.', none: 'Aún no se muestra nada: abre Filtrar y elige algunas filas.', neighborhood: 'Solo los festivales y los viajes.', big: 'Solo los festivales y las maratones.' };
    Object.keys(PH).forEach(function (k) { if (CITY.words.phrases[k]) CITY.words.phrases[k] = PH[k]; });
  }
  var SPANISH = {}; Object.keys(ES).forEach(function (k) { SPANISH[ES[k]] = 1; }); // the names already put into Spanish (the type labels, swapped in city.js's data)
  // the composite strings: [pattern, replacement(match) → string]
  var PATTERNS = [
    // the sheet's date line, "Viernes, 30 de octubre · 12:00 PM · Hall, until 4:00 PM" (the date already in Spanish)
    [/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo), .+$/, function (m) {
      var r = m[0].replace(/(\d{1,2}:\d\d) (AM|PM)\b/g, function (x, t, ap) { return t + ' ' + (ap === 'AM' ? 'a.m.' : 'p.m.'); });
      r = r.replace(/(, |· )until (1:)?/, function (x, sep, one) { return sep + 'hasta ' + (one ? 'la 1:' : 'las '); });
      return r.replace(/(, |· )to close$/, '$1hasta el cierre');
    }],
    [/^(.*?)(· |, |)until (\d{1,2}):(\d\d) (AM|PM|a\.m\.|p\.m\.)(.*)$/, function (m) { return m[1] + m[2] + 'hasta ' + (m[3] === '1' ? 'la ' : 'las ') + m[3] + ':' + m[4] + ' ' + (/^(AM|a)/.test(m[5]) ? 'a.m.' : 'p.m.') + m[6]; }],
    [/^(\d{1,2}:\d\d) (AM|PM|a\.m\.|p\.m\.)( \S+)? · (.+)$/, function (m) { return m[1] + ' ' + (/^(AM|a)/.test(m[2]) ? 'a.m.' : 'p.m.') + (m[3] || '') + ' · ' + (ES[m[4]] || m[4]); }],
    [/^all day · (.+)$/, function (m) { return 'todo el día · ' + (ES[m[1]] || m[1]); }],
    [/^(.*) · to close$/, function (m) { return m[1] + ' · hasta el cierre'; }],
    [/^(\d+) of (\d+)$/, function (m) { return m[1] + ' de ' + m[2]; }],
    [/^(.*) — (\d+) nights · (.*)$/, function (m) { return m[1] + ' — ' + m[2] + ' noches · ' + m[3]; }],
    [/^(\d+) nights$/, function (m) { return m[1] + ' noches'; }],
    [/^See (.*)’s own events list$/, function (m) { return 'Ver la lista propia de ' + (ES[m[1]] || m[1]); }],
    [/^(Show|Hide) (.+)$/, function (m) { var x = ES[m[2]] || (SPANISH[m[2]] && m[2]); return x ? (m[1] === 'Show' ? 'Mostrar ' : 'Ocultar ') + x : null; }],
    [/^\+(\d+) more$/, function (m) { return '+' + m[1] + ' más'; }],
    [/^(\d+) more$/, function (m) { return m[1] + ' más'; }],
    [/^\+ (\d+) more$/, function (m) { return '+ ' + m[1] + ' más'; }],
    [/^\+ (\d+) more on$/, function (m) { return '+ ' + m[1] + ' más en'; }],
    [/^(.+) & (\d+) more$/, function (m) { return m[1] + ' y ' + m[2] + ' más'; }],
    [/^(.+), (.+) and (\d+) more$/, function (m) { return m[1] + ', ' + m[2] + ' y ' + m[3] + ' más'; }],
    [/^(\d+) upcoming at (\d+) of (\d+) places$/, function (m) { return m[1] + ' próximos en ' + m[2] + ' de ' + m[3] + ' lugares'; }],
    [/^You are near (.+) — opening its calendar…$/, function (m) { return 'Estás cerca de ' + m[1] + ': abriendo su calendario…'; }],
    [/^All (\d+) in the list$/, function (m) { return 'Los ' + m[1] + ' en la lista'; }],
    [/^The (\d+) communities nearest you$/, function (m) { return 'Las ' + m[1] + ' comunidades más cercanas'; }],
    [/^The (\d+) communities nearest ZIP (.+)$/, function (m) { return 'Las ' + m[1] + ' comunidades más cercanas al código postal ' + m[2]; }],
    [/^(\d+) communit(?:y|ies) in (.+)$/, function (m) { return m[1] + (m[1] === '1' ? ' comunidad en ' : ' comunidades en ') + m[2]; }],
    [/^(\d+) communit(?:y|ies) matching “(.+)”$/, function (m) { return m[1] + (m[1] === '1' ? ' comunidad que coincide con «' : ' comunidades que coinciden con «') + m[2] + '»'; }],
    [/^Location is off for this site — search by town, state, province or ZIP \((\d+) communities in (\d+) states\)\.$/, function (m) { return 'La ubicación está desactivada para este sitio: busca por ciudad, estado, provincia o código postal (' + m[1] + ' comunidades en ' + m[2] + ' estados y provincias).'; }],
    [/^(.+), (\d+) events?$/, function (m) { return m[1] + ', ' + m[2] + (m[2] === '1' ? ' evento' : ' eventos'); }],
    [/^(?:(?:Only|Just|Hiding|Also hiding|Also showing|Showing) .+?\.|Sold out and nearly sold out only\.|Matching “.*?”\.)(?: (?:(?:Only|Just|Hiding|Also hiding|Also showing|Showing) .+?\.|Sold out and nearly sold out only\.|Matching “.*?”\.))*$/, function (m) { return viewNote(m[0]); }],
    [/^(.+) only$/, function (m) { return ES[m[1]] ? 'Solo ' + ES[m[1]] : null; }],
    [/^(.+) games hidden$/, function (m) { return 'Partidos de ' + m[1] + ' ocultos'; }],
    [/^(.+) — (\d+) venues?, (\d+) upcoming$/, function (m) { return TangoT(m[1]) + ' — ' + m[2] + ' lugares, ' + m[3] + ' próximos'; }],
    [/^(.+) — (\d+) upcoming$/, function (m) { return m[1] + ' — ' + m[2] + ' próximos'; }],
    [/^(\d+) upcoming · (\d+) venues?$/, function (m) { return m[1] + ' próximos · ' + m[2] + ' lugares'; }],
    [/^Holds about ([\d,.]+)$/, function (m) { return 'Capacidad aprox. ' + m[1]; }],
    [/^(\d[\d,]*) events?$/, function (m) { return m[1] + (m[1] === '1' ? ' evento' : ' eventos'); }],
    [/^(\d[\d,]*) upcoming$/, function (m) { return m[1] + ' próximos'; }],
    [/^Updated (.+)$/, function (m) { return 'Actualizado ' + m[1]; }]
  ];
  // the line over the list naming what the view hides or adds (app.js describeView): sentence by sentence
  var NOTE_HEAD = { 'Only': 'Solo', 'Just': 'Solo', 'Hiding': 'Se ocultan', 'Also hiding': 'También se ocultan', 'Also showing': 'También se muestran', 'Showing': 'Se muestra' };
  var LOWER = {}; Object.keys(ES).forEach(function (k) { LOWER[k.toLowerCase()] = ES[k].toLowerCase(); }); // the kinds come lower-cased
  function word(x) { return ES[x] || LOWER[x] || x; }
  function items(t) {
    var more = / and (\d+) more$/.exec(t), tail = '';
    if (more) { t = t.slice(0, more.index); tail = ' y ' + more[1] + ' más'; }
    else { var i = t.lastIndexOf(' and '); if (i > 0) { tail = ' y ' + word(t.slice(i + 5)); t = t.slice(0, i); } }
    return t.split(', ').map(word).join(', ') + tail;
  }
  function viewNote(s) {
    return s.replace(/(Also hiding|Also showing|Hiding|Showing|Only|Just) (.+?)\.(?= [A-Z]|$)|Sold out and nearly sold out only\.|Matching “(.*?)”\./g, function (all, head, list, q) {
      if (head) return NOTE_HEAD[head] + ' ' + items(list) + '.';
      if (q != null) return 'Coincide con «' + q + '».';
      return 'Solo agotados o casi agotados.';
    });
  }
  function tr(s) {
    var k = s.replace(/\s+/g, ' ').trim();
    if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(ES, k)) return ES[k];
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = PATTERNS[i][0].exec(k);
      if (m) { var r = PATTERNS[i][1](m); if (r != null) return r; }
    }
    return null;
  }
  globalThis.TangoT = function (s) { var r = tr(s); return r == null ? s : r; };

  // ---- dates and clocks: what app.js asks of en-US, asked of es-US ----
  // (Intl.DateTimeFormat is left alone — app.js does its zone arithmetic with it — and
  // so is en-CA, the ISO day keys)
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var dDate = Date.prototype.toLocaleDateString, dTime = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleDateString = function (loc, opt) {
    return loc === 'en-US' || loc === undefined ? cap(dDate.call(this, 'es-US', opt)) : dDate.call(this, loc, opt);
  };
  Date.prototype.toLocaleTimeString = function (loc, opt) {
    if (loc !== 'en-US' && loc !== undefined) return dTime.call(this, loc, opt);
    return dTime.call(this, 'es-US', opt).replace(/[\u00a0\u202f]/g, ' '); // plain spaces: app.js splits "7:00 p.m. GMT-3" on them
  };

  // ---- the page: every text node and three attributes, now and as app.js writes ----
  var ATTRS = ['title', 'aria-label', 'placeholder'];
  var SKIP = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1 };
  function text(n) {
    var p = n.parentNode;
    if (!p || SKIP[p.nodeName]) return;
    var r = tr(n.data);
    if (r == null || r === n.data) return;
    var lead = /^\s/.test(n.data) ? ' ' : '', tail = /\s$/.test(n.data) ? ' ' : '';
    n.data = lead + r + tail;
  }
  function attrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v) { var r = tr(v); if (r != null && r !== v) el.setAttribute(ATTRS[i], r); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    attrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (var n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) text(n); else attrs(n); }
  }
  var mo = new MutationObserver(function (list) {
    mo.disconnect(); // our own writes are not news
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'childList') for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      else if (m.type === 'characterData') text(m.target);
      else if (m.type === 'attributes') attrs(m.target);
    }
    watch();
  });
  function watch() { mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }
  whenReady(function () {
    walk(document.body);
    var t = tr(document.title); if (t) document.title = t;
    watch();
  });
})();
