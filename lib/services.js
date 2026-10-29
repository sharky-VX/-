// ═══════════════════════════════════════════════
//  Servicios compartidos: los usan los comandos del bot Y la API REST.
//  Todas son APIs públicas gratuitas (sin key). Si alguna se cae, solo falla su comando.
// ═══════════════════════════════════════════════
const U = require('./utils');
const ai = require('./ai');

const enc = encodeURIComponent;
const notFound = (what) => { throw new Error(`${what} no encontrado`); };

// ── Clima (Open-Meteo) ──
const WMO = {
  0: 'Despejado ☀️', 1: 'Mayormente despejado 🌤️', 2: 'Parcialmente nublado ⛅', 3: 'Nublado ☁️',
  45: 'Niebla 🌫️', 48: 'Niebla con escarcha 🌫️', 51: 'Llovizna ligera 🌦️', 53: 'Llovizna 🌦️', 55: 'Llovizna fuerte 🌧️',
  61: 'Lluvia ligera 🌧️', 63: 'Lluvia 🌧️', 65: 'Lluvia fuerte 🌧️', 71: 'Nieve ligera ❄️', 73: 'Nieve ❄️', 75: 'Nieve fuerte ❄️',
  80: 'Chubascos 🌦️', 81: 'Chubascos fuertes 🌧️', 82: 'Chubascos violentos ⛈️', 95: 'Tormenta ⛈️', 96: 'Tormenta con granizo ⛈️', 99: 'Tormenta fuerte con granizo ⛈️',
};
const wmo = (c) => WMO[c] || 'Variable 🌡️';

async function geocode(q) {
  const d = await U.getJson('https://geocoding-api.open-meteo.com/v1/search', { params: { name: q, count: 1, language: 'es' } });
  return d.results?.[0] || notFound('Ciudad');
}

async function weather(q) {
  const g = await geocode(q);
  const d = await U.getJson('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: g.latitude, longitude: g.longitude, timezone: 'auto', forecast_days: 5,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max',
    },
  });
  return { place: [g.name, g.admin1, g.country].filter(Boolean).join(', '), current: d.current || {}, daily: d.daily || {}, wmo };
}

async function airQuality(q) {
  const g = await geocode(q);
  const d = await U.getJson('https://air-quality-api.open-meteo.com/v1/air-quality', {
    params: { latitude: g.latitude, longitude: g.longitude, current: 'us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,carbon_monoxide' },
  });
  return { place: [g.name, g.country].filter(Boolean).join(', '), current: d.current || {} };
}

// ── Traducción (MyMemory; si falla usa la IA) ──
async function translate(text, to = 'es') {
  try {
    const d = await U.getJson('https://api.mymemory.translated.net/get', { params: { q: String(text).slice(0, 450), langpair: `Autodetect|${to}` } });
    const t = d.responseData?.translatedText;
    if (d.responseStatus == 200 && t && !/MYMEMORY WARNING|PLEASE SELECT/i.test(t)) return t;
  } catch {}
  return ai.ask(`Traduce el siguiente texto al idioma con código "${to}". Responde SOLO con la traducción:\n\n${text}`, 'Eres un traductor profesional.');
}

// ── Wikipedia ──
async function wiki(q, lang = 'es') {
  const sum = (t) => U.getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${enc(t)}`);
  try {
    return await sum(q);
  } catch {
    const s = await U.getJson(`https://${lang}.wikipedia.org/w/api.php`, { params: { action: 'opensearch', search: q, limit: 1, format: 'json' } });
    const title = s?.[1]?.[0];
    return title ? sum(title) : notFound('Tema');
  }
}

// ── Cripto / divisas ──
const COINS = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bnb: 'binancecoin', doge: 'dogecoin', xrp: 'ripple', ada: 'cardano', usdt: 'tether', ltc: 'litecoin', trx: 'tron', ton: 'the-open-network', dot: 'polkadot', matic: 'matic-network', shib: 'shiba-inu' };
async function crypto(q = 'btc') {
  const id = COINS[String(q).toLowerCase()] || String(q).toLowerCase();
  const d = await U.getJson('https://api.coingecko.com/api/v3/simple/price', { params: { ids: id, vs_currencies: 'usd', include_24hr_change: true, include_market_cap: true } });
  return d[id] ? { id, usd: d[id].usd, change24h: d[id].usd_24h_change, marketCap: d[id].usd_market_cap } : notFound('Moneda');
}
async function cryptoTop(n = 10) {
  const d = await U.getJson('https://api.coingecko.com/api/v3/coins/markets', { params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: n, page: 1 } });
  return (d || []).map((c) => ({ name: c.name, symbol: c.symbol, price: c.current_price, change24h: c.price_change_percentage_24h }));
}
async function currency(amount, from, to) {
  const d = await U.getJson(`https://open.er-api.com/v6/latest/${String(from).toUpperCase()}`);
  const rate = d.rates?.[String(to).toUpperCase()];
  return rate ? { amount: +amount, from: from.toUpperCase(), to: to.toUpperCase(), rate, result: amount * rate } : notFound('Moneda');
}
async function dolar() {
  const d = await U.getJson('https://ve.dolarapi.com/v1/dolares');
  return (Array.isArray(d) ? d : []).map((x) => ({ name: x.nombre || x.fuente, price: x.promedio ?? x.venta ?? x.compra, updated: x.fechaActualizacion }));
}

// ── Países, pokémon, anime, series, libros, música, comida ──
async function country(q) {
  const fields = 'name,capital,population,region,subregion,flags,currencies,languages,area,timezones';
  let d;
  try { d = await U.getJson(`https://restcountries.com/v3.1/name/${enc(q)}`, { params: { fields } }); }
  catch { d = await U.getJson(`https://restcountries.com/v3.1/translation/${enc(q)}`, { params: { fields } }); }
  return d?.[0] || notFound('País');
}
async function pokemon(q) {
  const d = await U.getJson(`https://pokeapi.co/api/v2/pokemon/${enc(String(q).toLowerCase().trim())}`).catch(() => notFound('Pokémon'));
  return {
    id: d.id, name: d.name, height: d.height / 10, weight: d.weight / 10,
    types: (d.types || []).map((t) => t.type.name), abilities: (d.abilities || []).map((a) => a.ability.name),
    stats: Object.fromEntries((d.stats || []).map((s) => [s.stat.name, s.base_stat])),
    image: d.sprites?.other?.['official-artwork']?.front_default || d.sprites?.front_default,
  };
}
async function jikan(kind, q) {
  const d = await U.getJson(`https://api.jikan.moe/v4/${kind}`, { params: { q, limit: 1, sfw: true } });
  return d.data?.[0] || notFound('Resultado');
}
async function jikanList(path, n = 10) {
  const d = await U.getJson(`https://api.jikan.moe/v4/${path}`, { params: { limit: n, sfw: true } });
  return d.data || [];
}
async function tvShow(q) {
  return U.getJson('https://api.tvmaze.com/singlesearch/shows', { params: { q } }).catch(() => notFound('Serie'));
}
async function book(q) {
  const d = await U.getJson('https://openlibrary.org/search.json', { params: { q, limit: 1, fields: 'title,author_name,first_publish_year,number_of_pages_median,cover_i,key' } });
  return d.docs?.[0] || notFound('Libro');
}
async function song(q) {
  const d = await U.getJson('https://itunes.apple.com/search', { params: { term: q, entity: 'song', limit: 1 } });
  return d.results?.[0] || notFound('Canción');
}
async function meal(q) {
  const d = await U.getJson(`https://www.themealdb.com/api/json/v1/1/${q ? 'search.php' : 'random.php'}`, { params: q ? { s: q } : {} });
  return d.meals?.[0] || notFound('Receta');
}
async function cocktail(q) {
  const d = await U.getJson(`https://www.thecocktaildb.com/api/json/v1/1/${q ? 'search.php' : 'random.php'}`, { params: q ? { s: q } : {} });
  return d.drinks?.[0] || notFound('Cóctel');
}
async function rickMorty(q) {
  const d = await U.getJson('https://rickandmortyapi.com/api/character/', { params: { name: q } }).catch(() => notFound('Personaje'));
  return d.results?.[0] || notFound('Personaje');
}

// ── Mundo y ciencia ──
async function quakes(minMag = 4, n = 5) {
  const d = await U.getJson('https://earthquake.usgs.gov/fdsnws/event/1/query', { params: { format: 'geojson', limit: n, orderby: 'time', minmagnitude: minMag } });
  return (d.features || []).map((f) => ({ mag: f.properties.mag, place: f.properties.place, time: f.properties.time, url: f.properties.url }));
}
const iss = () => U.getJson('https://api.wheretheiss.at/v1/satellites/25544');
async function onThisDay(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0'), dd = String(date.getDate()).padStart(2, '0');
  const d = await U.getJson(`https://es.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`);
  return d.events || [];
}
const holidays = (year, cc) => U.getJson(`https://date.nager.at/api/v3/PublicHolidays/${year}/${String(cc).toUpperCase()}`);
const numberFact = (n, type = 'trivia') => U.getJson(`http://numbersapi.com/${enc(n)}/${type}`, { responseType: 'text', transformResponse: (x) => x });
const guessAge = (name) => U.getJson('https://api.agify.io/', { params: { name } });
const universities = (name, country) => U.getJson('http://universities.hipolabs.com/search', { params: { name, country } });
async function zip(cc, code) {
  return U.getJson(`https://api.zippopotam.us/${enc(String(cc).toLowerCase())}/${enc(code)}`).catch(() => notFound('Código postal'));
}
const catFact = () => U.getJson('https://catfact.ninja/fact');
const chuck = () => U.getJson('https://api.chucknorris.io/jokes/random');
const apod = () => U.getJson('https://api.nasa.gov/planetary/apod', { params: { api_key: 'DEMO_KEY' } });

async function rss(url, n = 8) {
  const xml = await U.getJson(url, { responseType: 'text', transformResponse: (x) => x });
  return String(xml).split('<item>').slice(1, n + 1).map((it) => ({
    title: (it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim(),
    link: (it.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim(),
  })).filter((x) => x.title);
}

// ── Utilidades web ──
const ipInfo = (q) => U.getJson(`http://ip-api.com/json/${enc(q)}`, { params: { lang: 'es' } });
async function dns(name, type = 'A') {
  const d = await U.getJson('https://cloudflare-dns.com/dns-query', { params: { name, type }, headers: { Accept: 'application/dns-json' } });
  return (d.Answer || []).map((a) => a.data);
}
const github = (user) => U.getJson(`https://api.github.com/users/${enc(user)}`);
const npmInfo = (pkg) => U.getJson(`https://registry.npmjs.org/${enc(pkg)}/latest`);
async function shorten(url) {
  try {
    return String(await U.getJson('https://is.gd/create.php', { params: { format: 'simple', url }, responseType: 'text', transformResponse: (x) => x })).trim();
  } catch {
    return String(await U.getJson('https://tinyurl.com/api-create.php', { params: { url }, responseType: 'text', transformResponse: (x) => x })).trim();
  }
}
const define = (word) => U.getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(word)}`).then((d) => d[0]).catch(() => notFound('Palabra'));

// ── Generadores de URL de imagen (no necesitan descarga previa) ──
const qrUrl = (text, size = 500) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc(text)}`;
const barcodeUrl = (text) => `https://bwipjs-api.metafloor.com/?bcid=code128&text=${enc(text)}&scale=3&includetext`;
const avatarUrl = (style, seed) => `https://api.dicebear.com/9.x/${enc(style)}/png?seed=${enc(seed)}&size=512`;
const robohashUrl = (seed) => `https://robohash.org/${enc(seed)}.png?size=512x512`;
const memeText = (s) =>
  enc(String(s || '_').replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_').replace(/\?/g, '~q').replace(/%/g, '~p').replace(/#/g, '~h').replace(/\//g, '~s').replace(/"/g, "''"));
const memeUrl = (tpl, top, bottom) => `https://api.memegen.link/images/${enc(tpl)}/${memeText(top)}/${memeText(bottom)}.png`;

module.exports = {
  wmo, weather, airQuality, translate, wiki, crypto, cryptoTop, currency, dolar,
  country, pokemon, jikan, jikanList, tvShow, book, song, meal, cocktail, rickMorty,
  quakes, iss, onThisDay, holidays, numberFact, guessAge, universities, zip, catFact, chuck, apod, rss,
  ipInfo, dns, github, npmInfo, shorten, define,
  qrUrl, barcodeUrl, avatarUrl, robohashUrl, memeUrl,
};
