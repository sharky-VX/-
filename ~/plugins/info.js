const S = require('../lib/services');
const U = require('../lib/utils');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'info', run });
const need = (c, ex) => { if (!c.q) { c.reply(`Ejemplo: ${c.prefix}${c.command} ${ex}`); return false; } return true; };
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const cut = (s, n = 700) => (String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''));
const money = (n) => (n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(+Number(n).toPrecision(4)));
const sign = (n) => `${n >= 0 ? '📈 +' : '📉 '}${Number(n).toFixed(2)}%`;
const day = (d) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(d + 'T12:00:00').getDay()];

const list = [
  mk('clima', 'Clima actual de una ciudad', '<ciudad>', async (c) => {
    if (!need(c, 'Caracas')) return;
    const w = await S.weather(c.q);
    const x = w.current;
    c.reply(`🌍 *${w.place}*\n\n${w.wmo(x.weather_code)}\n🌡️ ${x.temperature_2m}°C (sensación ${x.apparent_temperature}°C)\n💧 Humedad: ${x.relative_humidity_2m}%\n💨 Viento: ${x.wind_speed_10m} km/h\n🌧️ Precipitación: ${x.precipitation} mm\n\n☀️ Hoy: ${w.daily.temperature_2m_min?.[0]}° / ${w.daily.temperature_2m_max?.[0]}° • UV máx ${w.daily.uv_index_max?.[0]}`);
  }, ['weather', 'clim']),

  mk('pronostico', 'Pronóstico de 5 días', '<ciudad>', async (c) => {
    if (!need(c, 'Madrid')) return;
    const w = await S.weather(c.q);
    const d = w.daily;
    const rows = (d.time || []).map((t, i) => `• *${day(t)} ${t.slice(5)}* ${w.wmo(d.weather_code[i])}\n   ${d.temperature_2m_min[i]}° / ${d.temperature_2m_max[i]}° • lluvia ${d.precipitation_probability_max[i]}%`);
    c.reply(`📅 *${w.place}*\n\n${rows.join('\n')}`);
  }, ['forecast']),

  mk('aire', 'Calidad del aire de una ciudad', '<ciudad>', async (c) => {
    if (!need(c, 'Bogotá')) return;
    const a = await S.airQuality(c.q);
    const x = a.current;
    const aqi = x.us_aqi;
    const lvl = aqi == null ? '?' : aqi <= 50 ? 'Buena 🟢' : aqi <= 100 ? 'Moderada 🟡' : aqi <= 150 ? 'Dañina para sensibles 🟠' : 'Mala 🔴';
    c.reply(`🌫️ *${a.place}*\nÍndice AQI: *${aqi ?? '?'}* — ${lvl}\nPM2.5: ${x.pm2_5} • PM10: ${x.pm10}\nOzono: ${x.ozone} • NO₂: ${x.nitrogen_dioxide}`);
  }, ['aqi']),

  mk('wiki', 'Resumen de Wikipedia (español)', '<tema>', async (c) => {
    if (!need(c, 'Venezuela')) return;
    const d = await S.wiki(c.q, 'es');
    const text = `📚 *${d.title}*\n\n${cut(d.extract || 'Sin resumen', 900)}\n\n🔗 ${d.content_urls?.desktop?.page || ''}`;
    d.thumbnail?.source ? await c.sendImage(d.thumbnail.source, text) : await c.reply(text);
  }, ['wikipedia']),

  mk('wikien', 'Resumen de Wikipedia (inglés)', '<tema>', async (c) => {
    if (!need(c, 'Moon')) return;
    const d = await S.wiki(c.q, 'en');
    c.reply(`📚 *${d.title}*\n\n${cut(d.extract, 900)}\n\n🔗 ${d.content_urls?.desktop?.page || ''}`);
  }),

  mk('define', 'Definición en inglés', '<palabra>', async (c) => {
    if (!need(c, 'love')) return;
    const e = await S.define(c.q);
    const defs = (e.meanings || []).slice(0, 3).map((m) => `• _${m.partOfSpeech}_: ${m.definitions?.[0]?.definition}`).join('\n');
    c.reply(`📖 *${e.word}* ${e.phonetic || ''}\n\n${defs}`);
  }),

  mk('pais', 'Datos de un país', '<país>', async (c) => {
    if (!need(c, 'Chile')) return;
    const p = await S.country(c.q);
    const cur = Object.values(p.currencies || {}).map((x) => `${x.name} (${x.symbol || ''})`).join(', ');
    const text = `${p.flags?.emoji || '🌎'} *${p.name?.common}* — ${p.name?.official}\n🏛️ Capital: ${(p.capital || []).join(', ') || '-'}\n🗺️ ${p.region} • ${p.subregion || ''}\n👥 Población: ${Number(p.population).toLocaleString('es')}\n📐 Área: ${Number(p.area).toLocaleString('es')} km²\n💰 Moneda: ${cur || '-'}\n🗣️ Idiomas: ${Object.values(p.languages || {}).join(', ') || '-'}\n🕒 ${(p.timezones || []).slice(0, 3).join(', ')}`;
    p.flags?.png ? await c.sendImage(p.flags.png, text) : await c.reply(text);
  }, ['country']),

  mk('bandera', 'Bandera de un país', '<país>', async (c) => {
    if (!need(c, 'Japón')) return;
    const p = await S.country(c.q);
    await c.sendImage(p.flags?.png, `${p.flags?.emoji || ''} ${p.name?.common}`);
  }),

  mk('capitalde', 'Capital de un país', '<país>', async (c) => {
    if (!need(c, 'Perú')) return;
    const p = await S.country(c.q);
    c.reply(`🏛️ La capital de *${p.name?.common}* es *${(p.capital || ['?']).join(', ')}*`);
  }),

  mk('pokemon', 'Ficha de un Pokémon', '<nombre o número>', async (c) => {
    if (!need(c, 'pikachu')) return;
    const p = await S.pokemon(c.q);
    const st = p.stats;
    const text = `⚡ *#${p.id} ${p.name.toUpperCase()}*\n🔖 Tipo: ${p.types.join(', ')}\n📏 ${p.height} m • ⚖️ ${p.weight} kg\n✨ Habilidades: ${p.abilities.join(', ')}\n\n❤️ HP ${st.hp} • ⚔️ Ataque ${st.attack} • 🛡️ Defensa ${st.defense}\n💥 Atq. esp. ${st['special-attack']} • 🔰 Def. esp. ${st['special-defense']} • 💨 Velocidad ${st.speed}`;
    p.image ? await c.sendImage(p.image, text) : await c.reply(text);
  }, ['pokedex']),

  mk('pokemonrandom', 'Un Pokémon al azar', '', async (c) => {
    const p = await S.pokemon(U.rand(1, 1025));
    await c.sendImage(p.image, `🎲 *#${p.id} ${p.name.toUpperCase()}* — ${p.types.join(', ')}`);
  }, ['pokerandom']),

  mk('anime', 'Busca un anime', '<nombre>', async (c) => {
    if (!need(c, 'naruto')) return;
    const a = await S.jikan('anime', c.q);
    const text = `🌸 *${a.title}* ${a.title_japanese ? `(${a.title_japanese})` : ''}\n⭐ ${a.score ?? '?'} • 🏆 #${a.rank ?? '?'}\n📺 ${a.type || '?'} • ${a.episodes ?? '?'} eps • ${a.status}\n📅 ${a.year ?? '?'}\n🎭 ${(a.genres || []).map((g) => g.name).join(', ')}\n\n${cut(a.synopsis, 600)}\n\n🔗 ${a.url}`;
    const img = a.images?.jpg?.large_image_url;
    img ? await c.sendImage(img, text) : await c.reply(text);
  }),

  mk('manga', 'Busca un manga', '<nombre>', async (c) => {
    if (!need(c, 'berserk')) return;
    const a = await S.jikan('manga', c.q);
    const text = `📖 *${a.title}*\n⭐ ${a.score ?? '?'} • 📚 ${a.chapters ?? '?'} caps • ${a.status}\n🎭 ${(a.genres || []).map((g) => g.name).join(', ')}\n\n${cut(a.synopsis, 600)}\n\n🔗 ${a.url}`;
    const img = a.images?.jpg?.large_image_url;
    img ? await c.sendImage(img, text) : await c.reply(text);
  }),

  mk('personaje', 'Busca un personaje de anime', '<nombre>', async (c) => {
    if (!need(c, 'Goku')) return;
    const a = await S.jikan('characters', c.q);
    const text = `🎭 *${a.name}* ${a.name_kanji || ''}\n❤️ Favoritos: ${a.favorites}\n\n${cut(a.about, 600)}\n\n🔗 ${a.url}`;
    const img = a.images?.jpg?.image_url;
    img ? await c.sendImage(img, text) : await c.reply(text);
  }, ['character']),

  mk('topanime', 'Top 10 animes mejor valorados', '', async (c) => {
    const l = await S.jikanList('top/anime', 10);
    c.reply('🏆 *TOP ANIME*\n\n' + l.map((a, i) => `${i + 1}. ${a.title} ⭐${a.score}`).join('\n'));
  }),

  mk('temporada', 'Animes de la temporada actual', '', async (c) => {
    const l = await S.jikanList('seasons/now', 12);
    c.reply('🌸 *TEMPORADA ACTUAL*\n\n' + l.map((a, i) => `${i + 1}. ${a.title} ${a.score ? '⭐' + a.score : ''}`).join('\n'));
  }),

  mk('animerandom', 'Un anime al azar', '', async (c) => {
    const d = await U.getJson('https://api.jikan.moe/v4/random/anime?sfw=true');
    const a = d.data;
    const text = `🎲 *${a.title}*\n⭐ ${a.score ?? '?'} • ${a.episodes ?? '?'} eps\n\n${cut(a.synopsis, 500)}\n🔗 ${a.url}`;
    a.images?.jpg?.large_image_url ? await c.sendImage(a.images.jpg.large_image_url, text) : await c.reply(text);
  }),

  mk('serie', 'Información de una serie de TV', '<nombre>', async (c) => {
    if (!need(c, 'breaking bad')) return;
    const s = await S.tvShow(c.q);
    const text = `📺 *${s.name}*\n⭐ ${s.rating?.average ?? '?'} • ${s.status}\n📅 Estreno: ${s.premiered || '?'} • 🗣️ ${s.language || '?'}\n🎭 ${(s.genres || []).join(', ')}\n\n${cut(strip(s.summary), 600)}\n\n🔗 ${s.officialSite || ''}`;
    s.image?.original ? await c.sendImage(s.image.original, text) : await c.reply(text);
  }, ['tv']),

  mk('libro', 'Busca un libro', '<título>', async (c) => {
    if (!need(c, 'cien años de soledad')) return;
    const b = await S.book(c.q);
    const text = `📚 *${b.title}*\n✍️ ${(b.author_name || ['?']).join(', ')}\n📅 Primera edición: ${b.first_publish_year || '?'}\n📄 Páginas: ${b.number_of_pages_median || '?'}\n🔗 https://openlibrary.org${b.key}`;
    b.cover_i ? await c.sendImage(`https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg`, text) : await c.reply(text);
  }),

  mk('cancion', 'Información de una canción', '<canción artista>', async (c) => {
    if (!need(c, 'monaco bad bunny')) return;
    const s = await S.song(c.q);
    const text = `🎵 *${s.trackName}*\n🎤 ${s.artistName}\n💿 ${s.collectionName}\n🎼 ${s.primaryGenreName} • ${String(s.releaseDate).slice(0, 4)}\n🔗 ${s.trackViewUrl}`;
    s.artworkUrl100 ? await c.sendImage(s.artworkUrl100.replace('100x100', '600x600'), text) : await c.reply(text);
  }, ['infocancion']),

  mk('comida', 'Receta de cocina (TheMealDB)', '[plato en inglés]', async (c) => {
    const m = await S.meal(c.q);
    const ing = [];
    for (let i = 1; i <= 20; i++) if (m[`strIngredient${i}`]) ing.push(`${m[`strMeasure${i}`] || ''} ${m[`strIngredient${i}`]}`.trim());
    const text = `🍽️ *${m.strMeal}*\n🌎 ${m.strArea} • ${m.strCategory}\n\n🧾 *Ingredientes*\n${ing.map((x) => '• ' + x).join('\n')}\n\n👨‍🍳 ${cut(m.strInstructions, 1200)}`;
    await c.sendImage(m.strMealThumb, text);
  }, ['meal']),

  mk('coctel', 'Receta de un cóctel', '[nombre]', async (c) => {
    const d = await S.cocktail(c.q);
    const ing = [];
    for (let i = 1; i <= 15; i++) if (d[`strIngredient${i}`]) ing.push(`${d[`strMeasure${i}`] || ''} ${d[`strIngredient${i}`]}`.trim());
    await c.sendImage(d.strDrinkThumb, `🍹 *${d.strDrink}* (${d.strAlcoholic})\n\n${ing.map((x) => '• ' + x).join('\n')}\n\n${cut(d.strInstructions, 600)}`);
  }, ['cocktail']),

  mk('rick', 'Personaje de Rick y Morty', '<nombre>', async (c) => {
    if (!need(c, 'morty')) return;
    const r = await S.rickMorty(c.q);
    await c.sendImage(r.image, `🛸 *${r.name}*\n${r.status} • ${r.species}\n📍 ${r.origin?.name}`);
  }),

  mk('catfact', 'Dato curioso de gatos (en inglés)', '', async (c) => c.reply(`🐱 ${(await S.catFact()).fact}`)),
  mk('chuck', 'Chiste de Chuck Norris (en inglés)', '', async (c) => c.reply(`💪 ${(await S.chuck()).value}`)),

  mk('apod', 'Foto astronómica del día (NASA)', '', async (c) => {
    const a = await S.apod();
    const text = `🔭 *${a.title}*\n\n${cut(a.explanation, 700)}`;
    a.media_type === 'image' ? await c.sendImage(a.url, text) : await c.reply(`${text}\n\n🎞️ ${a.url}`);
  }, ['nasa']),

  mk('noticias', 'Titulares de BBC Mundo', '', async (c) => {
    const n = await S.rss('https://feeds.bbci.co.uk/mundo/rss.xml', 8);
    c.reply('📰 *BBC Mundo*\n\n' + n.map((x, i) => `${i + 1}. ${x.title}\n${x.link}`).join('\n\n'));
  }, ['news']),

  mk('tecnologia', 'Titulares de tecnología (BBC, inglés)', '', async (c) => {
    const n = await S.rss('https://feeds.bbci.co.uk/news/technology/rss.xml', 8);
    c.reply('💻 *Tecnología*\n\n' + n.map((x, i) => `${i + 1}. ${x.title}\n${x.link}`).join('\n\n'));
  }, ['tech']),

  mk('sismos', 'Últimos terremotos del mundo (M4+)', '', async (c) => {
    const q = await S.quakes(4, 6);
    c.reply('🌋 *Últimos sismos*\n\n' + q.map((x) => `• *M${x.mag}* — ${x.place}\n  ${new Date(x.time).toLocaleString('es-VE')}`).join('\n'));
  }, ['terremotos']),

  mk('iss', 'Dónde está la Estación Espacial ahora', '', async (c) => {
    const d = await S.iss();
    c.reply(`🛰️ *ISS*\n📍 ${d.latitude?.toFixed(2)}, ${d.longitude?.toFixed(2)}\n🚀 Altitud: ${d.altitude?.toFixed(0)} km • Velocidad: ${d.velocity?.toFixed(0)} km/h\n🗺️ https://maps.google.com/?q=${d.latitude},${d.longitude}`);
  }),

  mk('hoy', 'Qué pasó un día como hoy', '', async (c) => {
    const ev = await S.onThisDay();
    const pick = ev.sort(() => Math.random() - 0.5).slice(0, 5).sort((a, b) => a.year - b.year);
    c.reply('📜 *Un día como hoy*\n\n' + pick.map((e) => `• *${e.year}*: ${cut(e.text, 220)}`).join('\n\n'));
  }),

  mk('feriados', 'Feriados del año de un país', '<código país>  (VE, ES, MX...)', async (c) => {
    const cc = (c.args[0] || 'VE').toUpperCase();
    const h = await S.holidays(new Date().getFullYear(), cc);
    c.reply(`🎉 *Feriados ${cc} ${new Date().getFullYear()}*\n\n` + h.map((x) => `• ${x.date.slice(5)} — ${x.localName}`).join('\n'));
  }, ['holidays']),

  mk('numero', 'Dato curioso sobre un número (inglés)', '[número]', async (c) => {
    c.reply(`🔢 ${String(await S.numberFact(c.args[0] || 'random')).trim()}`);
  }, ['numfact']),

  mk('edadnombre', 'Edad promedio que tiene un nombre', '<nombre>', async (c) => {
    if (!need(c, 'Carlos')) return;
    const d = await S.guessAge(c.q);
    c.reply(d.age ? `🧓 La edad promedio de quienes se llaman *${d.name}* es *${d.age}* años (muestra: ${d.count}).` : '❌ Sin datos para ese nombre.');
  }),

  mk('universidades', 'Universidades de un país', '<país en inglés>', async (c) => {
    if (!need(c, 'Venezuela')) return;
    const u = await S.universities('', c.q);
    c.reply(u?.length ? `🎓 *Universidades en ${c.q}* (${u.length})\n\n` + u.slice(0, 15).map((x) => `• ${x.name}`).join('\n') : '❌ Sin resultados');
  }),

  mk('zip', 'Ciudad de un código postal', '<país> <código>  (us 90210)', async (c) => {
    if (c.args.length < 2) return c.reply('Ejemplo: .zip us 90210');
    const z = await S.zip(c.args[0], c.args[1]);
    c.reply(`📮 ${z['post code']} — ${z.places?.[0]?.['place name']}, ${z.places?.[0]?.state} (${z.country})`);
  }, ['postal']),

  mk('crypto', 'Precio de una criptomoneda', '<btc|eth|sol...>', async (c) => {
    const d = await S.crypto(c.q || 'btc');
    c.reply(`💰 *${d.id}*\n💵 $${money(d.usd)} USD\n${sign(d.change24h)} (24h)\n🏦 Cap.: $${Number(d.marketCap).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
  }, ['cripto', 'precio']),

  mk('topcrypto', 'Top 10 criptomonedas', '', async (c) => {
    const t = await S.cryptoTop(10);
    c.reply('🪙 *TOP CRIPTO*\n\n' + t.map((x, i) => `${i + 1}. *${x.symbol.toUpperCase()}* $${money(x.price)} ${sign(x.change24h || 0)}`).join('\n'));
  }),

  mk('divisa', 'Convierte monedas', '<monto> <de> <a>  (100 usd eur)', async (c) => {
    const [amt, from, to] = c.args;
    if (!amt || !from || !to || isNaN(+amt)) return c.reply('Ejemplo: .divisa 100 usd eur');
    const r = await S.currency(+amt, from, to);
    c.reply(`💱 ${amt} ${r.from} = *${money(r.result)} ${r.to}*\n📊 1 ${r.from} = ${money(r.rate)} ${r.to}`);
  }, ['currency']),

  mk('dolar', 'Dólar en Venezuela (oficial y paralelo)', '', async (c) => {
    const d = await S.dolar();
    if (!d.length) return c.reply('❌ Sin datos ahora mismo.');
    c.reply('💵 *DÓLAR VENEZUELA*\n\n' + d.map((x) => `• ${x.name}: *Bs ${Number(x.price).toFixed(2)}*\n  🕒 ${x.updated ? new Date(x.updated).toLocaleString('es-VE') : '-'}`).join('\n\n'));
  }, ['bcv', 'dolarve']),

  mk('bs', 'Convierte dólares a bolívares (tasa oficial)', '<monto en USD>', async (c) => {
    const n = parseFloat(c.args[0]);
    if (isNaN(n)) return c.reply('Ejemplo: .bs 20');
    const d = await S.dolar();
    const of = d.find((x) => /oficial/i.test(x.name)) || d[0];
    if (!of?.price) return c.reply('❌ Sin tasa disponible.');
    c.reply(`💵 $${n} = *Bs ${(n * of.price).toLocaleString('es-VE', { maximumFractionDigits: 2 })}* (tasa ${of.name}: ${Number(of.price).toFixed(2)})`);
  }),
];

module.exports = list;
