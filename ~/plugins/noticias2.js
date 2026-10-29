// ═══════════════════════════════════════════════
//  NOTICIAS2 + CULTURA GENERAL — Datos del mundo,
//  curiosidades, fechas históricas, personalidades
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const axios = require('axios');
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'cultura', ...extra, run });

module.exports = [
  mk('efeméride', 'Qué pasó hoy en la historia', '', async (c) => {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();
    const eventos = {
      '1-1': 'Año nuevo gregoriano. 1801: Italia se une a Francia. 1959: La Revolución Cubana triunfa.',
      '4-4': '1968: Asesinato de Martin Luther King Jr. en Memphis, Tennessee.',
      '5-5': '1862: Batalla de Puebla (México). Origen del Cinco de Mayo.',
      '7-7': '1930: Nace Ringo Starr, baterista de The Beatles.',
      '7-20': '1969: Apollo 11 aterriza en la Luna. "Un pequeño paso para el hombre..."',
      '7-5': '1811: Venezuela declara la Independencia. ¡Día Nacional!',
      '8-6': '1945: EEUU lanza bomba atómica sobre Hiroshima, Japón.',
      '9-11': '2001: Ataques terroristas en Nueva York y Washington D.C.',
      '10-12': '1492: Cristóbal Colón llega a América (isla de Guanahaní).',
      '11-9': '1989: Cae el Muro de Berlín, símbolo del fin de la Guerra Fría.',
      '12-25': 'Navidad cristiana. Celebración del nacimiento de Jesucristo.',
    };
    const key = `${mes}-${dia}`;
    const evento = eventos[key] || `_No tengo un evento registrado para hoy (${dia}/${mes}). Cada día de la historia tiene algo interesante — ¡busca "hoy en la historia"!_`;
    c.reply(`📅 *HOY EN LA HISTORIA (${dia}/${mes})*\n\n${evento}`);
  }, ['historytoday', 'hoyhistoria', 'efemeride']),

  mk('pais', 'Información general de un país', '<país>', async (c) => {
    if (!c.q) return c.reply('Escribe un país. Ejemplo: .pais Venezuela');
    try {
      const r = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(c.q)}?fields=name,capital,population,area,languages,currencies,flags,continents`, { timeout: 12000 });
      const p = r.data?.[0];
      if (!p) return c.reply('No encontré ese país. Intenta con el nombre en inglés o español.');
      const idiomas = p.languages ? Object.values(p.languages).join(', ') : 'N/A';
      const moneda = p.currencies ? Object.values(p.currencies).map(m => `${m.name} (${m.symbol || '?'})`).join(', ') : 'N/A';
      c.reply([
        `🌍 *${p.name?.common || c.q}*`,
        `_(${p.name?.official || ''})_`,
        '',
        `🏛️ Capital: ${p.capital?.[0] || 'N/A'}`,
        `👥 Población: ${(p.population || 0).toLocaleString('es')}`,
        `📐 Área: ${(p.area || 0).toLocaleString('es')} km²`,
        `🌎 Continente: ${p.continents?.[0] || 'N/A'}`,
        `🗣️ Idiomas: ${idiomas}`,
        `💰 Moneda: ${moneda}`,
      ].filter(Boolean).join('\n'));
    } catch {
      c.reply('No pude obtener info de ese país ahora. Intenta más tarde.');
    }
  }, ['country', 'infopaís', 'pais_info']),

  mk('capital', 'Capital de un país', '<país>', async (c) => {
    if (!c.q) return c.reply('Escribe un país. Ejemplo: .capital Francia');
    try {
      const r = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(c.q)}?fields=name,capital`, { timeout: 10000 });
      const p = r.data?.[0];
      if (!p?.capital) return c.reply(`No encontré la capital de "${c.q}".`);
      c.reply(`🏛️ La capital de *${p.name?.common}* es *${p.capital[0]}*`);
    } catch {
      // fallback para países comunes
      const caps = { venezuela: 'Caracas', colombia: 'Bogotá', mexico: 'Ciudad de México', argentina: 'Buenos Aires', peru: 'Lima', chile: 'Santiago', brasil: 'Brasilia', españa: 'Madrid', francia: 'París', alemania: 'Berlín', japon: 'Tokio', china: 'Pekín', eeuu: 'Washington D.C.' };
      const key = c.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const cap = caps[key];
      if (cap) return c.reply(`🏛️ La capital de *${c.q}* es *${cap}*`);
      c.reply('No pude obtener esa info ahora mismo.');
    }
  }, ['capitalciudad', 'capital_pais']),

  mk('idioma', 'Datos sobre idiomas del mundo', '[idioma]', (c) => {
    const idiomas = [
      { n: 'Español', h: '~500 millones hablantes nativos. 2do idioma más hablado como lengua materna. Oficial en 21 países.' },
      { n: 'Mandarin Chino', h: '~920 millones hablantes nativos. El más hablado del mundo.' },
      { n: 'Inglés', h: '~380 millones nativos, pero ~1,500M totales. La lengua franca del mundo moderno.' },
      { n: 'Árabe', h: '~300 millones. 6to idioma oficial de la ONU. Se escribe de derecha a izquierda.' },
      { n: 'Hindi', h: '~550 millones. Principal idioma de India. Comparte raíces con el español (indoeuropeo).' },
      { n: 'Portugués', h: '~250 millones. Brasil es el país más grande lusohablante del mundo.' },
      { n: 'Japonés', h: '~125 millones. 3 sistemas de escritura: hiragana, katakana y kanji.' },
    ];
    const i = c.q ? idiomas.find(x => x.n.toLowerCase().includes(c.q.toLowerCase())) || U.pick(idiomas) : U.pick(idiomas);
    c.reply(`🗣️ *${i.n}*\n\n${i.h}`);
  }, ['idiomas_mundo', 'lenguaje', 'language_info']),

  mk('religion', 'Datos sobre religiones del mundo', '[religión]', (c) => {
    const religiones = [
      { n: 'Cristianismo', h: '~2,300 millones. La más extendida. Basada en la vida y enseñanzas de Jesús de Nazaret.' },
      { n: 'Islam', h: '~1,900 millones. Segunda religión más grande. Fundada por Mahoma en Arabia (s. VII d.C.).' },
      { n: 'Hinduismo', h: '~1,200 millones. La más antigua del mundo (~4,000 años). Varios dioses, un Absoluto.' },
      { n: 'Budismo', h: '~500 millones. Fundado por Siddhartha Gautama. Busca el nirvana y el fin del sufrimiento.' },
      { n: 'Judaísmo', h: '~15 millones. La más antigua de las religiones abrahámicas. Torah como texto sagrado.' },
    ];
    const r = c.q ? religiones.find(x => x.n.toLowerCase().includes(c.q.toLowerCase())) || U.pick(religiones) : U.pick(religiones);
    c.reply(`🙏 *${r.n}*\n\n${r.h}`);
  }, ['religion_info', 'fe', 'creencias']),

  mk('civilizacion', 'Datos de civilizaciones antiguas', '[nombre]', (c) => {
    const civs = [
      { n: 'Egipto Antiguo', d: 'Duró ~3,000 años. Construyeron las pirámides, inventaron la escritura jeroglífica y desarrollaron medicina avanzada.' },
      { n: 'Roma Antigua', d: 'En su apogeo gobernó desde Gran Bretaña hasta Mesopotamia. Base del derecho moderno y el latín, raíz del español.' },
      { n: 'Grecia Antigua', d: 'Cuna de la democracia, la filosofía occidental, los Juegos Olímpicos y las matemáticas.' },
      { n: 'Imperio Azteca', d: 'Centro en Tenochtitlán (hoy México D.F.). Avanzados en astronomía y agricultura.' },
      { n: 'Imperio Inca', d: 'El más grande de América precolombina. Sistema de caminos de 40,000 km sin rueda ni caballos.' },
      { n: 'China Imperial', d: 'Más de 2,000 años de historia imperial. Inventaron el papel, la pólvora, la brújula y la imprenta.' },
    ];
    const cv = c.q ? civs.find(x => x.n.toLowerCase().includes(c.q.toLowerCase())) || U.pick(civs) : U.pick(civs);
    c.reply(`🏛️ *${cv.n}*\n\n${cv.d}`);
  }, ['civilizacion_antigua', 'historia_antigua', 'imperio']),

  mk('guerra', 'Dato histórico sobre guerras importantes', '', (c) => {
    const guerras = [
      { n: 'Primera Guerra Mundial', d: '1914-1918. ~20 millones de muertos. Derrumbó 4 imperios: otomano, austro-húngaro, ruso y alemán.' },
      { n: 'Segunda Guerra Mundial', d: '1939-1945. ~70-85 millones de muertos. La más destructiva de la historia humana.' },
      { n: 'Guerra Fría', d: '1947-1991. Tensión entre EEUU y URSS. Nunca fue guerra directa pero sí proxies, carreras armamentistas y espaciales.' },
      { n: 'Guerra de Vietnam', d: '1955-1975. EEUU no logró contener el comunismo. ~3 millones de muertos, incluyendo civiles.' },
      { n: 'Guerras Napoleónicas', d: '1803-1815. Napoleón redibujó el mapa de Europa. Su derrota estableció el orden moderno europeo.' },
    ];
    const g = U.pick(guerras);
    c.reply(`⚔️ *${g.n}*\n\n${g.d}`);
  }, ['guerrahistoria', 'historia_guerra', 'conflict']),

  mk('personaje_historico', 'Dato sobre un personaje histórico', '[nombre]', (c) => {
    const personajes = [
      { n: 'Cleopatra', d: 'No era egipcia sino macedónica. Hablaba 9 idiomas. Fue aliada de César y Marco Antonio.' },
      { n: 'Napoleón Bonaparte', d: 'No era bajo — medía ~1.70m (normal para la época). Reformó los códigos legales de Europa.' },
      { n: 'Ada Lovelace', d: 'Matemática inglesa del s. XIX. Se la considera la primera programadora de la historia.' },
      { n: 'Nikola Tesla', d: 'Inventó la corriente alterna. Murió pobre pese a sus contribuciones. Edison fue su rival directo.' },
      { n: 'Marie Curie', d: 'Primera mujer en ganar el Nobel y la única en ganarlo en dos ciencias distintas (Física y Química).' },
      { n: 'Genghis Khan', d: 'Unificó Mongolia y creó el mayor imperio continental de la historia. ~16 millones de km².' },
    ];
    const p = c.q ? personajes.find(x => x.n.toLowerCase().includes(c.q.toLowerCase())) || U.pick(personajes) : U.pick(personajes);
    c.reply(`🏅 *${p.n}*\n\n${p.d}`);
  }, ['figura_historica', 'personaje_mundial', 'historical_person']),

  mk('tecnologia', 'Dato sobre tecnología e inventos', '', (c) => {
    const datos = [
      '💻 El primer "bug" de computadora fue un insecto real — una polilla atascada en el Harvard Mark II en 1947.',
      '📱 El primer teléfono inteligente reconocible fue el IBM Simon (1994), antes que el iPhone en 2007.',
      '🌐 La World Wide Web fue inventada por Tim Berners-Lee en 1989 en el CERN (Suiza), gratis para el mundo.',
      '🤖 El término "robot" viene del checo "robota" (trabajo forzado). Lo acuñó Karel Čapek en 1920.',
      '🎮 El primer videojuego comercial fue Pong (Atari, 1972). Pero Spacewar! (1962) fue el primero en computadoras.',
      '📺 La televisión en color se masificó en los 60s, aunque las primeras demos fueron en los años 40.',
    ];
    c.reply(`💡 *TECNOLOGÍA — DATO CURIOSO*\n\n${U.pick(datos)}`);
  }, ['invento', 'tech_dato', 'dato_tecnologia']),

  mk('arte', 'Dato sobre arte o pintores famosos', '', (c) => {
    const datos = [
      '🎨 La Mona Lisa de Da Vinci fue robada del Louvre en 1911 y no fue encontrada hasta 1913.',
      '🌻 Van Gogh solo vendió un cuadro durante su vida. Ahora sus obras valen cientos de millones.',
      '🖼️ Picasso es el artista más robado del mundo — más de 1,000 obras suyas han sido hurtadas.',
      '🗿 Miguel Ángel pintó la Capilla Sixtina de pie y con el cuello arqueado, no tumbado como el mito dice.',
      '🏛️ El Louvre de París es el museo más visitado del mundo: ~9-10 millones de visitantes/año.',
    ];
    c.reply(`🎨 *ARTE — DATO CURIOSO*\n\n${U.pick(datos)}`);
  }, ['arte_dato', 'pintura_info', 'museo']),

  mk('deporte', 'Dato sobre deportes en el mundo', '', (c) => {
    const datos = [
      '⚽ El fútbol es el deporte más popular del mundo: ~4 mil millones de fanáticos.',
      '🏏 El críquet es el 2do deporte más popular (India y Commonwealth) con ~2,500 millones de seguidores.',
      '🏀 La NBA tiene los salarios promedio más altos de cualquier liga deportiva del mundo (~$8.9M/año).',
      '🎾 Wimbledon es el torneo de tenis más antiguo del mundo, jugado desde 1877.',
      '🏊 El récord de velocidad a nado (50m libre) lo tiene César Cielo (Brasil): 20.91 segundos.',
      '🏃 El maratón más rápido fue Eliud Kipchoge (Kenia): 2h00m35s en Berlin 2023.',
    ];
    c.reply(`🏆 *DEPORTE — DATO CURIOSO*\n\n${U.pick(datos)}`);
  }, ['deporte_dato', 'sports_dato', 'record_deporte']),

  mk('economia', 'Datos sobre economía mundial', '', (c) => {
    const datos = [
      '💵 El PIB de EEUU es de ~$28 billones, el más grande del mundo. China está en segundo con ~$18 billones.',
      '🇺🇸 El dólar es la moneda de reserva mundial: más del 58% de las reservas globales están en USD.',
      '💰 El banco más antiguo del mundo en operación es el Monte dei Paschi di Siena (Italia), fundado en 1472.',
      '📈 La bolsa de valores más grande del mundo es NYSE (Nueva York) con capitalización de ~$28 billones.',
      '🌾 La agricultura ocupa el 70% del agua dulce disponible en el planeta.',
    ];
    c.reply(`📊 *ECONOMÍA — DATO*\n\n${U.pick(datos)}`);
  }, ['economia_dato', 'finanzas_dato', 'mundo_economia']),

  mk('medio_ambiente', 'Dato sobre el medioambiente', '', (c) => {
    const datos = [
      '🌳 Se estima que hay ~3 billones de árboles en la Tierra. Se talan ~15,000 millones al año.',
      '🌊 El plástico en los océanos podría superar en peso a los peces para 2050.',
      '🐝 Las abejas son responsables del 70% de la polinización de alimentos que consumimos.',
      '🌱 Los bosques tropicales (como el Amazonas) generan hasta el 20% del oxígeno del planeta.',
      '🐘 Se extingue una especie animal cada 20 minutos, según estimaciones de biólogos conservacionistas.',
    ];
    c.reply(`🌿 *MEDIOAMBIENTE — DATO*\n\n${U.pick(datos)}`);
  }, ['naturaleza_dato', 'ecologia', 'planeta_dato']),

  mk('libro', 'Recomendación de un libro famoso', '[género]', (c) => {
    const libros = {
      clasicos: [
        { t: 'Don Quijote de la Mancha', a: 'Miguel de Cervantes', d: 'Primera novela moderna. Un hidalgo que confunde la realidad con las novelas de caballería.' },
        { t: '1984', a: 'George Orwell', d: 'Distopía sobre un estado totalitario que controla hasta los pensamientos. El "Gran Hermano" nació aquí.' },
        { t: 'Cien años de soledad', a: 'Gabriel García Márquez', d: 'La obra cumbre del realismo mágico. Una familia en el pueblo de Macondo a través de generaciones.' },
      ],
      fantasia: [
        { t: 'El Señor de los Anillos', a: 'J.R.R. Tolkien', d: 'La obra que definió la fantasía épica moderna.' },
        { t: 'Harry Potter', a: 'J.K. Rowling', d: 'La serie más vendida de la historia. Un niño que descubre que es mago.' },
      ],
      ciencia: [
        { t: 'Una breve historia del tiempo', a: 'Stephen Hawking', d: 'Física del universo explicada para todos. Los agujeros negros, el Big Bang y el tiempo.' },
        { t: 'El gen egoísta', a: 'Richard Dawkins', d: 'La evolución desde la perspectiva del gen, no del organismo.' },
      ],
    };
    const g = c.args[0]?.toLowerCase();
    const pool = libros[g] || [...libros.clasicos, ...libros.fantasia];
    const l = U.pick(pool);
    c.reply(`📚 *LIBRO RECOMENDADO*\n\n*"${l.t}"* — ${l.a}\n\n${l.d}`);
  }, ['libro_recomendado', 'read_book', 'libreria']),

  mk('cine', 'Dato o película de cine recomendada', '', (c) => {
    const datos = [
      { t: 'Avengers: Endgame (2019)', d: 'La película más taquillera de la historia con ~$2,800 millones recaudados.' },
      { t: 'El Padrino (1972)', d: 'Considerada por muchos la mejor película de todos los tiempos en IMDb.' },
      { t: 'Titanic (1997)', d: 'Fue la primera película en superar el billón de dólares en taquilla.' },
      { t: 'Parásitos (2019)', d: 'Primera película no en inglés en ganar el Oscar a Mejor Película.' },
      { t: 'Star Wars: Ep. IV (1977)', d: 'Revolucionó los efectos especiales y el merchandising en el cine.' },
    ];
    const d = U.pick(datos);
    c.reply(`🎬 *CINE*\n\n*${d.t}*\n${d.d}`);
  }, ['pelicula_dato', 'cine_info', 'film_recommendation']),

  mk('filosofia', 'Una idea filosófica para pensar', '', (c) => {
    const ideas = [
      { t: 'Cogito, ergo sum', f: 'Descartes', d: '"Pienso, luego existo." La única certeza absoluta: si dudas, eres.' },
      { t: 'La cueva de Platón', f: 'Platón', d: 'Los humanos vivimos viendo sombras en una cueva, creyendo que es la realidad. La filosofía nos saca.' },
      { t: 'El imperativo categórico', f: 'Kant', d: '"Actúa solo según la máxima que puedas querer que sea ley universal." La ética sin excepciones.' },
      { t: 'El eterno retorno', f: 'Nietzsche', d: '¿Y si tuvieras que vivir tu vida exactamente igual para siempre? ¿Vivirías diferente?' },
      { t: 'Ser y tiempo', f: 'Heidegger', d: 'La existencia nos fue "lanzada". Somos libres de elegir quién ser, pero no podemos no elegir.' },
    ];
    const i = U.pick(ideas);
    c.reply(`🤔 *FILOSOFÍA: ${i.t}*\n— ${i.f}\n\n${i.d}`);
  }, ['pensamiento', 'filosofia_dato', 'idea_filosofica']),
];
