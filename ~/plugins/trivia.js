// ═══════════════════════════════════════════════
//  TRIVIA & JUEGOS DE CONOCIMIENTO — SHARKNEX v4
// ═══════════════════════════════════════════════
const db = require('../lib/db');
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'juegos', ...extra, run });

// ── Banco de preguntas ──
const PREGUNTAS = [
  { q: '¿Cuál es el planeta más grande del sistema solar?', a: ['jupiter', 'júpiter'], o: ['Marte', 'Saturno', 'Júpiter', 'Urano'] },
  { q: '¿Cuántos lados tiene un hexágono?', a: ['6', 'seis'], o: ['5', '6', '7', '8'] },
  { q: '¿En qué año llegó el hombre a la luna?', a: ['1969'], o: ['1965', '1969', '1972', '1975'] },
  { q: '¿Cuál es el océano más grande del mundo?', a: ['pacifico', 'pacífico'], o: ['Atlántico', 'Índico', 'Pacífico', 'Ártico'] },
  { q: '¿Cuántos colores tiene el arcoíris?', a: ['7', 'siete'], o: ['5', '6', '7', '8'] },
  { q: '¿Cuál es la capital de Francia?', a: ['paris', 'parís'], o: ['Lyon', 'Marsella', 'París', 'Burdeos'] },
  { q: '¿Cuántos huesos tiene el cuerpo humano adulto?', a: ['206'], o: ['196', '206', '216', '226'] },
  { q: '¿Quién pintó la Mona Lisa?', a: ['leonardo da vinci', 'da vinci', 'leonardo'], o: ['Picasso', 'Leonardo da Vinci', 'Miguel Ángel', 'Rafael'] },
  { q: '¿Cuál es el elemento más abundante en el universo?', a: ['hidrogeno', 'hidrógeno'], o: ['Helio', 'Hidrógeno', 'Oxígeno', 'Carbono'] },
  { q: '¿En qué país nació el fútbol moderno?', a: ['inglaterra'], o: ['Brasil', 'España', 'Inglaterra', 'Francia'] },
  { q: '¿Cuántos continentes tiene la Tierra?', a: ['7', 'siete'], o: ['5', '6', '7', '8'] },
  { q: '¿Cuál es el animal terrestre más rápido?', a: ['guepardo', 'cheetah'], o: ['León', 'Guepardo', 'Caballo', 'Águila'] },
  { q: '¿Qué gases forman el aire principalmente?', a: ['nitrogeno y oxigeno', 'nitrógeno y oxígeno', 'nitrogeno'], o: ['Oxígeno y CO2', 'Nitrógeno y oxígeno', 'Hidrógeno y helio', 'Argón y neón'] },
  { q: '¿Cuántos planetas tiene el sistema solar?', a: ['8', 'ocho'], o: ['7', '8', '9', '10'] },
  { q: '¿Cuál es la montaña más alta del mundo?', a: ['everest', 'monte everest'], o: ['K2', 'Everest', 'Aconcagua', 'Kilimanjaro'] },
  { q: '¿De qué país es el anime?', a: ['japon', 'japón'], o: ['China', 'Corea', 'Japón', 'Tailandia'] },
  { q: '¿Cuántos años dura un siglo?', a: ['100', 'cien'], o: ['50', '100', '200', '1000'] },
  { q: '¿Cuál es la fórmula del agua?', a: ['h2o', 'h₂o'], o: ['CO2', 'H2O', 'NaCl', 'O2'] },
  { q: '¿Qué instrumento toca Hatsune Miku?', a: ['ninguno', 'ninguno (es cantante)'], o: ['Guitarra', 'Piano', 'Ninguno (es cantante)', 'Violín'] },
  { q: '¿Cuántas cuerdas tiene una guitarra estándar?', a: ['6', 'seis'], o: ['4', '5', '6', '7'] },
  { q: '¿En qué año se fundó WhatsApp?', a: ['2009'], o: ['2007', '2009', '2011', '2013'] },
  { q: '¿Cuál es la moneda de Japón?', a: ['yen'], o: ['Yuan', 'Won', 'Yen', 'Dólar'] },
  { q: '¿Cuántos jugadores hay en un equipo de fútbol?', a: ['11', 'once'], o: ['9', '10', '11', '12'] },
  { q: '¿Qué país tiene más población del mundo?', a: ['india'], o: ['China', 'India', 'EE.UU.', 'Rusia'] },
  { q: '¿Cuánto mide un metro?', a: ['100 centimetros', '100 cm', '100'], o: ['10 cm', '100 cm', '1000 cm', '50 cm'] },
  { q: '¿Cuál es el idioma más hablado del mundo?', a: ['ingles', 'inglés', 'mandarin', 'mandarín'], o: ['Español', 'Inglés', 'Mandarín', 'Hindi'] },
  { q: '¿Cuántos lados tiene un triángulo?', a: ['3', 'tres'], o: ['2', '3', '4', '5'] },
  { q: '¿Cuál es el río más largo del mundo?', a: ['nilo', 'nilo o amazonas', 'amazonas'], o: ['Amazonas', 'Nilo', 'Yangtsé', 'Misisipi'] },
  { q: '¿Qué vitamina produce la piel con el sol?', a: ['vitamina d', 'vitamina d3', 'd'], o: ['Vitamina A', 'Vitamina B', 'Vitamina C', 'Vitamina D'] },
  { q: '¿Cuántos segundos tiene un minuto?', a: ['60', 'sesenta'], o: ['30', '60', '100', '120'] },
];

const ANIME_Q = [
  { q: '¿De qué anime es Naruto Uzumaki?', a: ['naruto'], o: ['Bleach', 'Naruto', 'One Piece', 'Dragon Ball'] },
  { q: '¿Cuál es el titan más poderoso en Attack on Titan?', a: ['titan fundador', 'eren', 'titan de ataque'], o: ['Titan Acorazado', 'Titan Fundador', 'Titan Bestia', 'Titan Coloso'] },
  { q: '¿En qué anime aparece el quirk "One For All"?', a: ['my hero academia', 'boku no hero academia', 'bnha', 'mha'], o: ['Naruto', 'My Hero Academia', 'Fairy Tail', 'Black Clover'] },
  { q: '¿Quién mató a todos en la familia Uchiha?', a: ['itachi', 'itachi uchiha'], o: ['Madara', 'Itachi', 'Sasuke', 'Obito'] },
  { q: '¿De qué color es el cabello de Goku en Super Saiyan Blue?', a: ['azul'], o: ['Dorado', 'Azul', 'Rojo', 'Morado'] },
  { q: '¿Cómo se llama la espada de Ichigo Kurosaki?', a: ['zangetsu'], o: ['Byakuya', 'Zangetsu', 'Tensa', 'Mugetsu'] },
  { q: '¿Qué fruta del diablo comió Luffy?', a: ['gomu gomu no mi', 'hito hito no mi', 'gomu gomu'], o: ['Mera Mera', 'Gomu Gomu', 'Yami Yami', 'Gura Gura'] },
  { q: '¿Cuántos miembros tiene la Akatsuki en Naruto?', a: ['10', 'diez'], o: ['7', '8', '10', '12'] },
  { q: '¿Quién es el villano principal de Demon Slayer?', a: ['muzan', 'muzan kibutsuji'], o: ['Doma', 'Kokushibo', 'Muzan Kibutsuji', 'Akaza'] },
  { q: '¿En qué ciudad se desarrolla Chainsaw Man?', a: ['japon', 'japón', 'tokyo', 'tokio'], o: ['Tokio', 'Osaka', 'Sapporo', 'Kyoto'] },
  { q: '¿Cuántas Musas tiene la serie Bocchi the Rock?', a: ['4', 'cuatro'], o: ['3', '4', '5', '6'] },
  { q: '¿De qué anime es el personaje Rem?', a: ['re:zero', 're zero', 'rezero'], o: ['Overlord', 'Re:Zero', 'Date A Live', 'DxD'] },
];

const activeTrivias = new Map(); // chatId -> { q, a, timer, host }
const scores = new Map(); // chatId+sender -> points this session

function getQ(type = 'mix') {
  const pool = type === 'anime' ? ANIME_Q : type === 'general' ? PREGUNTAS : [...PREGUNTAS, ...ANIME_Q];
  return pool[Math.floor(Math.random() * pool.length)];
}

function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }

module.exports = [
  mk('trivia', 'Inicia una pregunta de trivia en el grupo', '[anime|general]', async (c) => {
    if (activeTrivias.has(c.from)) return c.reply('Ya hay una trivia activa. Respóndela o espera que expire.');
    const type = (c.args[0] || 'mix').toLowerCase();
    const q = getQ(type);
    const opciones = [...q.o].sort(() => Math.random() - 0.5);
    const msg = [
      '🧠 *TRIVIA SHARKNEX*',
      '',
      `❓ ${q.q}`,
      '',
      ...opciones.map((o, i) => `${['A', 'B', 'C', 'D'][i]}) ${o}`),
      '',
      '⏳ Tienes 30 segundos para responder',
    ].join('\n');
    await c.reply(msg);
    const timer = setTimeout(async () => {
      activeTrivias.delete(c.from);
      await c.sock.sendMessage(c.from, { text: `⏰ Tiempo agotado. La respuesta era: *${q.o.find(o => q.a.some(a => norm(o).includes(a)))}*` });
    }, 30000);
    activeTrivias.set(c.from, { q, opciones, timer, host: c.senderNum, at: Date.now() });
  }, ['pregunta', 'quiz']),

  mk('responder', 'Responde la trivia activa', '<respuesta>', async (c) => {
    const t = activeTrivias.get(c.from);
    if (!t) return;
    const ans = norm(c.q);
    const correct = t.q.a.some(a => ans.includes(norm(a))) ||
      t.opciones.some((o, i) => {
        const letra = ['a','b','c','d'][i];
        return (ans === letra || ans === `${letra})`) && t.q.a.some(a => norm(o).includes(a));
      });
    clearTimeout(t.timer);
    activeTrivias.delete(c.from);
    const key = `${c.from}:${c.senderNum}`;
    if (correct) {
      scores.set(key, (scores.get(key) || 0) + 1);
      const pts = scores.get(key);
      // Dar coins si la economía está activa
      try {
        const econ = db.chat(c.from);
        if (econ.economyOn !== false) {
          const u = db.user(c.senderNum);
          u.coins = (u.coins || 0) + 50;
          db.save();
        }
      } catch {}
      await c.reply(`✅ *¡Correcto, ${c.pushName}!*\n+50 coins 🪙\nRacha en este chat: ${pts} respuestas correctas`);
    } else {
      await c.reply(`❌ Incorrecto. La respuesta era: *${t.q.o.find(o => t.q.a.some(a => norm(o).includes(a))) || t.q.a[0]}*`);
    }
  }, ['r', 'resp']),

  mk('triviaanime', 'Trivia solo de anime', '', (c) => {
    c.args = ['anime'];
    return module.exports.find(x => x.name === 'trivia').run(c);
  }, ['animequiz', 'quizanime']),

  mk('triviastop', 'Cancela la trivia activa', '', (c) => {
    const t = activeTrivias.get(c.from);
    if (!t) return c.reply('No hay trivia activa.');
    if (!c.isOwner && t.host !== c.senderNum) return c.reply('Solo quien inició la trivia o un admin puede cancelarla.');
    clearTimeout(t.timer);
    activeTrivias.delete(c.from);
    c.reply('Trivia cancelada.');
  }, ['canceltrivia']),

  mk('verdadoreto', 'Verdad o Reto para grupos', '', (c) => {
    const verdades = [
      '¿Cuál es tu mayor vergüenza?', '¿Alguna vez has mentido a un amigo?',
      '¿Cuál es tu crush secreto?', '¿Qué es lo más raro que has comido?',
      '¿Alguna vez robaste algo pequeño?', '¿De quién del grupo te enamorarías?',
      '¿Cuál fue tu peor nota en el colegio?', '¿Tienes una cuenta secreta en redes?',
      '¿Qué cosa nunca le contarías a tus padres?', '¿Cuál es tu mayor miedo?',
    ];
    const retos = [
      'Escribe el nombre de alguien del grupo con los ojos cerrados', 'Di el alfabeto al revés',
      'Imita a alguien del grupo', 'Escribe una canción de 3 versos ahora mismo',
      'Cuenta hasta 20 en otro idioma', 'Di 5 trabalenguas',
      'Escribe un poema de 4 líneas en 1 minuto', 'Habla por 30 segundos sin usar la letra "a"',
      'Escribe el nombre de 10 países sin equivocarte', 'Describe tu vida en 3 emojis',
    ];
    const esToe = c.args[0]?.toLowerCase() === 'v' || c.args[0]?.toLowerCase() === 'verdad';
    const esReto = c.args[0]?.toLowerCase() === 'r' || c.args[0]?.toLowerCase() === 'reto';
    if (esToe) return c.reply(`💬 *VERDAD:*\n\n${U.pick(verdades)}`);
    if (esReto) return c.reply(`🎯 *RETO:*\n\n${U.pick(retos)}`);
    const tipo = Math.random() < 0.5 ? 'verdad' : 'reto';
    const txt = tipo === 'verdad' ? U.pick(verdades) : U.pick(retos);
    c.reply(`${tipo === 'verdad' ? '💬 *VERDAD*' : '🎯 *RETO*'}\n\n${txt}\n\n_(usa .vot v para verdad o .vot r para reto)_`);
  }, ['vot', 'truthordare', 'tod']),

  mk('numsecreto', 'Adivina el número secreto (1-100)', '', async (c) => {
    const key = `numsec:${c.from}:${c.senderNum}`;
    const existing = db.data._numsecreto?.[key];
    if (c.q && existing) {
      const guess = parseInt(c.q);
      if (isNaN(guess)) return c.reply('Escribe un número del 1 al 100.');
      if (guess === existing.n) {
        const attempts = existing.tries + 1;
        delete db.data._numsecreto[key];
        db.save();
        return c.reply(`🎉 ¡Correcto! El número era *${existing.n}*.\nLo lograste en *${attempts} intentos*.\n+${Math.max(10, 100 - attempts * 10)} coins 🪙`);
      }
      existing.tries++;
      db.data._numsecreto[key] = existing;
      db.save();
      return c.reply(guess < existing.n ? `📉 El número es *mayor* que ${guess}. Intento #${existing.tries}` : `📈 El número es *menor* que ${guess}. Intento #${existing.tries}`);
    }
    db.data._numsecreto ||= {};
    const n = Math.floor(Math.random() * 100) + 1;
    db.data._numsecreto[key] = { n, tries: 0, at: Date.now() };
    db.save();
    c.reply('🔢 *NÚMERO SECRETO*\n\nPiensé un número del 1 al 100.\n¡Adivínalo! Usa .numsecreto <número>\n\nEjemplo: .numsecreto 50');
  }, ['numericogame', 'adivina', 'adivinanumero']),

  mk('8ball', 'La bola mágica del 8 responde tu pregunta', '<pregunta>', (c) => {
    if (!c.q) return c.reply('Hazme una pregunta. Ejemplo: .8ball ¿Voy a ser rico?');
    const respuestas = [
      '🎱 *Sí, definitivamente.*', '🎱 *Todo apunta a que sí.*', '🎱 *Sin duda.*',
      '🎱 *Puedes contar con ello.*', '🎱 *Las señales son favorables.*',
      '🎱 *No puedo predecirlo ahora.*', '🎱 *Concéntrate y pregunta de nuevo.*',
      '🎱 *Mejor no te digo.*', '🎱 *Es dudoso.*',
      '🎱 *No.*', '🎱 *Definitivamente no.*', '🎱 *Las perspectivas no son buenas.*',
      '🎱 *No cuentes con ello.*', '🎱 *Mis fuentes dicen que no.*',
      '🎱 *Muy probable.*', '🎱 *Es cierto.*',
    ];
    c.reply(`🎱 *BOLA MÁGICA*\n\n*Tu pregunta:* ${c.q}\n\n${U.pick(respuestas)}`);
  }, ['bola8', 'bolamagica', 'magic8']),

  mk('fortuna', 'Tu fortuna del día', '', (c) => {
    const fortunas = [
      'Hoy es un buen día para tomar decisiones importantes.',
      'Una sorpresa agradable te espera pronto.',
      'Tu esfuerzo dará frutos en poco tiempo.',
      'Un amigo del pasado volverá a tu vida.',
      'Evita tomar riesgos innecesarios hoy.',
      'El dinero que buscas llegará de donde menos esperas.',
      'Confía más en tu intuición hoy.',
      'Un cambio positivo se acerca a tu vida.',
      'La paciencia será tu mejor aliada hoy.',
      'Alguien especial piensa en ti en este momento.',
      'Es un buen momento para comenzar algo nuevo.',
      'Tu creatividad estará en su punto máximo hoy.',
    ];
    const colores = ['Rojo 🔴', 'Azul 💙', 'Verde 💚', 'Dorado ⭐', 'Morado 💜', 'Blanco ⚪'];
    const nums = [U.rand(1, 9), U.rand(10, 19), U.rand(20, 49)];
    c.reply([
      `🔮 *FORTUNA DE HOY — ${c.pushName}*`,
      '',
      U.pick(fortunas),
      '',
      `🎨 Color de la suerte: ${U.pick(colores)}`,
      `🔢 Números de la suerte: ${nums.join(' - ')}`,
    ].join('\n'));
  }, ['horoscopo', 'suerte', 'destino']),

  mk('waifu', 'Personaje de anime aleatorio', '', async (c) => {
    const g = require('../lib/gacha');
    await g.ensurePool().catch(() => {});
    const pool = g.pool();
    const f = pool.filter(x => x.g === 'F');
    if (!f.length) return c.reply('No hay waifus en el pool todavía.');
    const ch = f[Math.floor(Math.random() * f.length)];
    const v = g.view(ch);
    const cap = `🌸 *${ch.name}*\n📺 ${ch.series}\n${v.rarityStr} ${v.star}\n💎 Valor: ${ch.value?.toLocaleString('es') || '?'} coins`;
    try {
      if (ch.img) {
        const buf = await require('../lib/utils').getBuffer(ch.img, { timeout: 12000 }).catch(() => null);
        if (buf) return c.sock.sendMessage(c.from, { image: buf, caption: cap }, { quoted: c.m });
      }
    } catch {}
    c.reply(cap);
  }, ['randomwaifu', 'waifu2']),

  mk('husbando', 'Personaje masculino de anime aleatorio', '', async (c) => {
    const g = require('../lib/gacha');
    await g.ensurePool().catch(() => {});
    const pool = g.pool();
    const m = pool.filter(x => x.g === 'M');
    if (!m.length) return c.reply('No hay husbandos en el pool todavía.');
    const ch = m[Math.floor(Math.random() * m.length)];
    const v = g.view(ch);
    const cap = `⚔️ *${ch.name}*\n📺 ${ch.series}\n${v.rarityStr} ${v.star}\n💎 Valor: ${ch.value?.toLocaleString('es') || '?'} coins`;
    try {
      if (ch.img) {
        const buf = await require('../lib/utils').getBuffer(ch.img, { timeout: 12000 }).catch(() => null);
        if (buf) return c.sock.sendMessage(c.from, { image: buf, caption: cap }, { quoted: c.m });
      }
    } catch {}
    c.reply(cap);
  }, ['randomhusbando', 'husbo']),

  mk('dado', 'Tira uno o varios dados', '[cantidad] [caras]', (c) => {
    const cant = Math.min(parseInt(c.args[0]) || 1, 10);
    const caras = Math.min(parseInt(c.args[1]) || 6, 100);
    const resultados = Array.from({ length: cant }, () => U.rand(1, caras));
    const suma = resultados.reduce((a, b) => a + b, 0);
    if (cant === 1) return c.reply(`🎲 Tiraste un dado de ${caras} caras: *${resultados[0]}*`);
    c.reply(`🎲 Tiraste ${cant}d${caras}: [${resultados.join(', ')}]\nTotal: *${suma}*`);
  }, ['dice', 'roll', 'd6', 'd20']),

  mk('piedrapapeltijera', 'Juega piedra, papel o tijera contra el bot', '<piedra|papel|tijera>', (c) => {
    const ops = ['piedra', 'papel', 'tijera'];
    const player = (c.args[0] || '').toLowerCase().trim();
    if (!ops.includes(player)) return c.reply(`Elige: *piedra*, *papel* o *tijera*\nEjemplo: .ppt piedra`);
    const bot = U.pick(ops);
    const emoji = { piedra: '🪨', papel: '📄', tijera: '✂️' };
    let result;
    if (player === bot) result = '🤝 *¡Empate!*';
    else if ((player === 'piedra' && bot === 'tijera') || (player === 'papel' && bot === 'piedra') || (player === 'tijera' && bot === 'papel')) result = '🏆 *¡Ganaste!*';
    else result = '😈 *¡Gané yo!*';
    c.reply(`${emoji[player]} ${player.toUpperCase()} vs ${bot.toUpperCase()} ${emoji[bot]}\n\n${result}`);
  }, ['ppt', 'rps', 'papelpiedratijera']),

  mk('adivinafrase', 'Adivina la frase de anime', '', (c) => {
    const frases = [
      { f: 'Plus Ultra!', a: 'My Hero Academia' },
      { f: 'Dattebayo!', a: 'Naruto' },
      { f: 'Nani?!', a: 'Dragon Ball Z / anime en general' },
      { f: 'Omae wa mou shindeiru', a: 'Fist of the North Star / Hokuto no Ken' },
      { f: 'Believe it!', a: 'Naruto (versión en inglés)' },
      { f: 'Gears 5th!', a: 'One Piece (Gear Fifth, Luffy)' },
      { f: 'Thunder Breathing First Form!', a: 'Demon Slayer (Zenitsu)' },
      { f: 'I am the bone of my sword', a: 'Fate/stay night (Archer)' },
      { f: 'The power of friendship!', a: 'Muchos animes, meme general' },
      { f: 'Bankai!', a: 'Bleach' },
    ];
    const picked = U.pick(frases);
    c.reply(`💬 *¿De qué anime es esta frase?*\n\n_"${picked.f}"_\n\n_(Responde con .responder <anime>)_`);
    const key = `frase:${c.from}`;
    db.data._frases ||= {};
    db.data._frases[key] = { a: picked.a.toLowerCase(), at: Date.now() };
    db.save();
    setTimeout(() => { if (db.data._frases?.[key]) { delete db.data._frases[key]; db.save(); } }, 45000);
  }, ['fraseanime', 'adivfrase']),

  mk('memetest', 'Test de personalidad basado en memes', '', (c) => {
    const tests = [
      { q: '¿Qué haces los domingos?', res: [
        { k: 'duermo todo el día', r: 'Eres 100% personaje de slice of life' },
        { k: 'veo anime', r: 'Definitivamente eres el protagonista de un isekai' },
        { k: 'salgo con amigos', r: 'Eres el tsundere del grupo, admítelo' },
        { k: 'trabajo o estudio', r: 'Eres el personaje de fondo que trabaja en silencio' },
      ]},
    ];
    const t = U.pick(tests);
    const r = U.pick(t.res);
    c.reply(`🎭 *TEST DE PERSONALIDAD ANIME*\n\nPregunta: ${t.q}\n\nResultado aleatorio:\n_Si ${r.k}:_ *${r.r}*\n\n(Fun, no es científico 😂)`);
  }, ['animetest', 'testpersonalidad']),

  mk('shipeo', 'Shipea a dos personas del grupo', '@usuario1 @usuario2', (c) => {
    const mentions = c.mentioned;
    let p1, p2;
    if (mentions.length >= 2) {
      p1 = mentions[0].split('@')[0];
      p2 = mentions[1].split('@')[0];
    } else if (mentions.length === 1) {
      p1 = c.senderNum;
      p2 = mentions[0].split('@')[0];
    } else {
      p1 = c.senderNum;
      p2 = c.senderNum.split('').reverse().join('').slice(0, 10);
    }
    const seed = (parseInt(p1.slice(-4)) + parseInt(p2.slice(-4))) % 100 + 1;
    const pct = Math.min(seed, 99);
    const bar = '❤️'.repeat(Math.floor(pct / 10)) + '🖤'.repeat(10 - Math.floor(pct / 10));
    const msg = pct >= 80 ? '¡Son perfectos juntos! 😍' : pct >= 60 ? 'Bastante compatibles 💕' : pct >= 40 ? 'Puede funcionar... 🤔' : pct >= 20 ? 'Hmm, difícil... 😅' : 'No, definitivamente no 💀';
    c.reply(`💘 *SHIP*\n\n+${p1} ❤️ +${p2}\n\n${bar}\n*${pct}%* de compatibilidad\n\n${msg}`);
  }, ['ship', 'amor', 'compatibilidad2']),

  mk('rankjuegos', 'Ver tu ranking en los juegos del bot', '', (c) => {
    const prefix = `${c.from}:`;
    const entries = [...scores.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ num: k.replace(prefix, ''), pts: v }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 10);
    if (!entries.length) return c.reply('Nadie ha jugado trivia en este chat todavía.');
    const lines = entries.map((e, i) => `${i + 1}. +${e.num.slice(-4)} — ${e.pts} pts`);
    c.reply(`🏆 *RANKING TRIVIA* (sesión actual)\n\n${lines.join('\n')}`);
  }, ['topjuegos', 'leaderboard', 'ranking']),

  mk('palavra', 'Juego de la última letra: encadena palabras', '<palabra>', async (c) => {
    const key = `palavra:${c.from}`;
    db.data._palavra ||= {};
    const state = db.data._palavra[key];
    const word = (c.q || '').toLowerCase().trim().replace(/[^a-záéíóúüñ]/g, '');
    if (!word) {
      if (state) return c.reply(`Juego activo. Última letra: *${state.last}*\nEscribe una palabra que empiece con esa letra.`);
      // Iniciar juego
      const starters = ['anime', 'barco', 'cielo', 'dragon', 'estrella', 'fuego'];
      const starter = U.pick(starters);
      db.data._palavra[key] = { last: starter.slice(-1), used: [starter], chain: 1 };
      db.save();
      return c.reply(`🔤 *JUEGO DE PALAVRAS*\nComienzo con: *${starter}*\nAhora di una palabra que empiece con la letra *${starter.slice(-1).toUpperCase()}*`);
    }
    if (!state) return c.reply(`No hay juego activo. Escribe .palavra sin texto para iniciar.`);
    if (word[0] !== state.last) return c.reply(`❌ Debe empezar con la letra *${state.last.toUpperCase()}*. Intenta de nuevo.`);
    if (state.used.includes(word)) return c.reply(`❌ Ya se usó "*${word}*". Elige otra.`);
    state.used.push(word);
    state.last = word.slice(-1);
    state.chain++;
    db.data._palavra[key] = state;
    db.save();
    c.reply(`✅ *${word}* — cadena: ${state.chain} palabras\nSiguiente letra: *${state.last.toUpperCase()}*`);
  }, ['encadena', 'wordchain']),
];
