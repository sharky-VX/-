const U = require('../lib/utils');
const { sans, C } = require('../lib/deco');
const state = require('../lib/state');
const db = require('../lib/db');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'games', run });
const norm = (s) => U.strip(String(s || '').toLowerCase()).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const decode = (s) =>
  String(s).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&eacute;/g, 'é')
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&hellip;/g, '…').replace(/&[a-z]+;/g, '');

const CAPITALES = [['Venezuela', 'Caracas'], ['Colombia', 'Bogotá'], ['México', 'Ciudad de México'], ['Argentina', 'Buenos Aires'], ['Chile', 'Santiago'], ['Perú', 'Lima'], ['Brasil', 'Brasilia'], ['Uruguay', 'Montevideo'], ['Paraguay', 'Asunción'], ['Bolivia', 'Sucre'], ['Ecuador', 'Quito'], ['Cuba', 'La Habana'], ['España', 'Madrid'], ['Francia', 'París'], ['Italia', 'Roma'], ['Alemania', 'Berlín'], ['Portugal', 'Lisboa'], ['Reino Unido', 'Londres'], ['Japón', 'Tokio'], ['China', 'Pekín'], ['Rusia', 'Moscú'], ['Egipto', 'El Cairo'], ['Canadá', 'Ottawa'], ['Australia', 'Canberra'], ['Turquía', 'Ankara'], ['Grecia', 'Atenas'], ['Suecia', 'Estocolmo'], ['Noruega', 'Oslo'], ['Panamá', 'Ciudad de Panamá'], ['Costa Rica', 'San José']];
const EMOJIS = [['🦁👑', 'el rey leon'], ['🕷️🧑', 'spiderman'], ['🧙‍♂️💍', 'el señor de los anillos'], ['🚢🧊❤️', 'titanic'], ['🐠🔍', 'buscando a nemo'], ['🦇🧑', 'batman'], ['🧊👸', 'frozen'], ['🤖🚗', 'transformers'], ['🧞‍♂️🪔', 'aladdin'], ['🐀👨‍🍳', 'ratatouille'], ['🦈🌊', 'tiburon'], ['👻🚫', 'cazafantasmas'], ['⚡👓🧙', 'harry potter'], ['🏴‍☠️🌊', 'piratas del caribe'], ['🧸🤠', 'toy story']];
const PALABRAS = ['computadora', 'telefono', 'ventana', 'elefante', 'chocolate', 'mariposa', 'guitarra', 'biblioteca', 'aventura', 'tormenta', 'refrigerador', 'zapatilla', 'montaña', 'fantasma', 'universo', 'dinosaurio', 'cuaderno', 'bicicleta', 'pelicula', 'tiburon', 'galleta', 'camiseta', 'planeta', 'teclado', 'carretera', 'esqueleto', 'volcan', 'helado', 'cocodrilo', 'astronauta'];
const AHORCADO = ['programacion', 'whatsapp', 'servidor', 'internet', 'camarones', 'murcielago', 'pirata', 'calculadora', 'universidad', 'astronomia', 'mariposa', 'laberinto', 'diamante', 'tesoro', 'bandera'];
const HANG = ['😀', '😐', '😟', '😨', '😱', '💀'];

const startQA = (c, { question, answers, show, reward = 50, seconds = 30 }) => {
  state.games.set(c.from, { type: 'qa', answers: answers.map(norm), show, reward, expires: Date.now() + seconds * 1000 });
  return c.reply(`${question}\n\n💬 Responde con: *${c.prefix}resp <respuesta>*  (${seconds} s • 🪙 +${reward})`);
};

async function sendGameButtons(c, text, buttons) {
  const pfx = c.prefix || '.';
  const btns = buttons.slice(0, 3).map((b) => ({
    buttonId: b.id.startsWith(pfx) ? b.id : (pfx + b.id),
    buttonText: { displayText: String(b.text).slice(0, 20) },
    type: 1,
  }));
  try {
    await c.sock.sendMessage(c.from, {
      text,
      footer: 'SHARKNEX · Juegos',
      buttons: btns,
      headerType: 1,
    }, { quoted: c.m });
  } catch {
    const alt = buttons.map((b) => '• ' + (b.id.startsWith(pfx) ? b.id : pfx + b.id) + ' — ' + b.text).join('\n');
    await c.reply(text + '\n\n' + alt);
  }
}


/** Botones URL que abren pantalla real (navegador / WebView de WhatsApp) */

const list = [
  mk('mate', 'Reto de matemáticas fácil', '', (c) => {
    const a = U.rand(2, 50), b = U.rand(2, 20), op = U.pick(['+', '-', '*']);
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return startQA(c, { question: `🧮 ¿Cuánto es *${a} ${op} ${b}*?`, answers: [ans], show: ans, reward: 40 });
  }, ['math']),

  mk('matedificil', 'Reto de matemáticas difícil', '', (c) => {
    const a = U.rand(11, 99), b = U.rand(11, 99), k = U.rand(2, 9);
    return startQA(c, { question: `🧠 ¿Cuánto es *(${a} × ${k}) + ${b}*?`, answers: [a * k + b], show: a * k + b, reward: 120, seconds: 45 });
  }),

  mk('trivia', 'Pregunta de trivia (en inglés)', '', async (c) => {
    const d = await U.getJson('https://opentdb.com/api.php?amount=1&type=multiple');
    const t = d.results?.[0];
    if (!t) return c.reply('⚠️ No pude cargar la trivia, intenta otra vez.');
    const opts = [...t.incorrect_answers, t.correct_answer].map(decode).sort(() => Math.random() - 0.5);
    const idx = opts.indexOf(decode(t.correct_answer)) + 1;
    return startQA(c, {
      question: `❓ *${decode(t.question)}*\n📂 ${decode(t.category)}\n\n${opts.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
      answers: [idx, decode(t.correct_answer)], show: `${idx}. ${decode(t.correct_answer)}`, reward: 80,
    });
  }),

  mk('quizcapital', 'Adivina la capital', '', (c) => {
    const [pais, cap] = U.pick(CAPITALES);
    return startQA(c, { question: `🌎 ¿Cuál es la capital de *${pais}*?`, answers: [cap], show: cap, reward: 60 });
  }, ['capitales']),

  mk('emojiquiz', 'Adivina la película por emojis', '', (c) => {
    const [e, a] = U.pick(EMOJIS);
    return startQA(c, { question: `🎬 ¿Qué película/personaje es?\n\n${e}`, answers: [a], show: a, reward: 70, seconds: 40 });
  }, ['adivinapeli']),

  mk('palabra', 'Ordena las letras de la palabra', '', (c) => {
    const w = U.pick(PALABRAS);
    let s = w;
    while (s === w) s = [...w].sort(() => Math.random() - 0.5).join('');
    return startQA(c, { question: `🔤 Ordena las letras:\n\n*${s.toUpperCase()}*`, answers: [w], show: w, reward: 60 });
  }),

  mk('resp', 'Responde al reto activo', '<respuesta>', (c) => {
    const g = state.games.get(c.from);
    if (!g || g.type !== 'qa') return c.reply('No hay reto activo. Usa .mate, .trivia, .quizcapital, .emojiquiz o .palabra');
    if (Date.now() > g.expires) {
      state.games.delete(c.from);
      return c.reply(`⌛ Se acabó el tiempo. Era: *${g.show}*`);
    }
    if (g.answers.includes(norm(c.q))) {
      state.games.delete(c.from);
      db.user(c.senderNum).coins += g.reward;
      db.save();
      return c.reply(`🎉 ¡Correcto, *${c.pushName}*! Ganas 🪙 *${g.reward}* monedas.`);
    }
    return c.reply('❌ Incorrecto, intenta de nuevo.');
  }, ['respuesta', 'r']),

  mk('adivina', 'Adivina el número del 1 al 100', '', (c) => {
    state.games.set(c.from, { type: 'num', answer: U.rand(1, 100), tries: 0 });
    c.reply('🔢 Pensé un número del *1 al 100*.\nUsa: .num <número>');
  }),

  mk('num', 'Intenta adivinar el número', '<número>', (c) => {
    const g = state.games.get(c.from);
    if (!g || g.type !== 'num') return c.reply('No hay partida. Usa .adivina');
    const n = parseInt(c.args[0]);
    if (isNaN(n)) return c.reply('Escribe un número. Ej: .num 50');
    g.tries++;
    if (n === g.answer) {
      state.games.delete(c.from);
      const reward = Math.max(10, 100 - g.tries * 10);
      db.user(c.senderNum).coins += reward;
      db.save();
      return c.reply(`🎉 ¡Era *${g.answer}*! Lo logró *${c.pushName}* en ${g.tries} intentos. 🪙 +${reward}`);
    }
    c.reply(n < g.answer ? '⬆️ Más alto' : '⬇️ Más bajo');
  }),

  mk('ahorcado', 'Juego del ahorcado', '', (c) => {
    const w = U.pick(AHORCADO);
    state.games.set(c.from, { type: 'hang', word: w, guessed: new Set(), lives: 6 });
    c.reply(`${HANG[0]} *AHORCADO*\n\n${'_ '.repeat(w.length)}\n\nVidas: ❤️×6\nUsa: .letra <letra>`);
  }),

  mk('letra', 'Adivina una letra del ahorcado', '<letra>', (c) => {
    const g = state.games.get(c.from);
    if (!g || g.type !== 'hang') return c.reply('No hay partida. Usa .ahorcado');
    const l = norm(c.args[0]).charAt(0);
    if (!/[a-z]/.test(l)) return c.reply('Escribe una letra. Ej: .letra a');
    if (g.guessed.has(l)) return c.reply('Esa letra ya la dijeron.');
    g.guessed.add(l);
    if (!g.word.includes(l)) g.lives--;
    const shown = [...g.word].map((x) => (g.guessed.has(x) ? x : '_')).join(' ');
    if (!shown.includes('_')) {
      state.games.delete(c.from);
      db.user(c.senderNum).coins += 100;
      db.save();
      return c.reply(`🎉 ¡Ganaron! La palabra era *${g.word}*. 🪙 +100 para ${c.pushName}`);
    }
    if (g.lives <= 0) {
      state.games.delete(c.from);
      return c.reply(`${HANG[5]} Perdieron. La palabra era *${g.word}*`);
    }
    c.reply(`${HANG[6 - g.lives]} ${shown}\n\nLetras: ${[...g.guessed].join(', ')}\nVidas: ${'❤️'.repeat(g.lives)}`);
  }),









  mk('rendirse', 'Termina el juego activo del chat', '', (c) => {
    const g = state.games.get(c.from);
    if (!g) return c.reply('No hay juego activo.');
    state.games.delete(c.from);
    c.reply(`🏳️ Juego terminado.${g.show ? ` Era: *${g.show}*` : g.word ? ` Era: *${g.word}*` : g.answer ? ` Era: *${g.answer}*` : ''}`);
  }, ['giveup']),
];

module.exports = list;
