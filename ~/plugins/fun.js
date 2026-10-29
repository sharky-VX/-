const U = require('../lib/utils');
const db = require('../lib/db');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({
  name, aliases, desc, usage, category: 'fun', ...extra, run,
});

const num = (j) => j.split('@')[0].split(':')[0];
const nameOf = (n) => db.data.names?.[n] || `+${String(n).slice(-4)}`;
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (...args) => args[rnd(0, args.length - 1)];

// ── Preguntas ──
const BALL_YES = ['Si, definitivamente.', 'Todo apunta a que sí.', 'Sin duda alguna.', 'Muy probable.', 'Las señales dicen que sí.', '¡Claro que sí!'];
const BALL_MAYBE = ['Pregunta de nuevo más tarde.', 'No está claro aún.', 'Mejor no te digo.', 'Concéntrate y pregunta de nuevo.', 'El futuro es incierto.'];
const BALL_NO = ['No lo creo.', 'Las señales apuntan al no.', 'Muy dudoso.', 'No cuentes con ello.', 'Definitivamente no.', 'Ni lo pienses.'];

// ── Insults / piropos / frases ──
const PIROPOS = [
  'Eres tan bonit@ que hasta los errores de WhatsApp se disculpan contigo.',
  'Tu sonrisa podría apagar el WiFi de puro calor.',
  'Eres tan unique que hasta la IA te tiene envidia.',
  'Brillas más que un sticker animado a medianoche.',
  'Eres el tipo de persona que hace que el spam valga la pena.',
];
const INSULTOS = [
  'Eres tan aburrido que hasta el bot se duerme leyendo tus mensajes.',
  'Tu fama llegó hasta aquí: absolu-ta-men-te nula.',
  'Tienes la gracia de un captcha de 8 intentos.',
  'Eres tan lento que el reloj te pasa factura.',
  'Hasta los bots tienen más personalidad que tú.',
];
const CHISTES = [
  '¿Por qué el programador salió de la ducha? Porque el shampoo decía "aplica, enjuaga, repite".',
  '¿Qué le dijo un bit al otro? ¡Nos vemos en el bus!',
  '¿Cómo se llama el campeón de buceo japonés? Tokofondo. ¿Y el subcampeón? Kasitofondo.',
  '¿Qué hace una abeja en el gimnasio? ¡Zum-ba!',
  '¿Por qué los pájaros vuelan hacia el sur en invierno? Porque caminar tardaría demasiado.',
  'Intenté hacer una broma de química, pero sé que no iba a tener ninguna reacción.',
  '¿Cuál es el colmo de un electricista? Que su mujer le dé corriente.',
  'Mi perro se comió toda mi tarea de matemáticas. Ahora hago sus necesidades en fracciones.',
];

// ── Ship meter ──
function shipScore(a, b) {
  const s = [...(a + b)].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 101;
  let emoji, msg;
  if (s < 20) { emoji = '💔'; msg = 'No hay nada aquí...'; }
  else if (s < 40) { emoji = '😐'; msg = 'Poca chispa...'; }
  else if (s < 60) { emoji = '🙂'; msg = 'Hay algo, podría funcionar.'; }
  else if (s < 80) { emoji = '💕'; msg = '¡Hay feeling! '; }
  else { emoji = '💘'; msg = '¡Match perfecto! Están hechos el uno para el otro.'; }
  return { score: s, emoji, msg };
}

// ── Chatfake (simula un chat fake de WhatsApp en texto) ──
function fakeChatLines(participants, lines) {
  const out = ['┌─── CHAT FAKE ───┐'];
  for (const line of lines) {
    const [who, ...rest] = line.split(':');
    const text = rest.join(':').trim();
    if (!text) continue;
    const name = participants[who.trim()] || who.trim();
    out.push(`│ *${name}*: ${text}`);
  }
  out.push('└─────────────────┘');
  return out.join('\n');
}

module.exports = [
  mk('ask', 'Pregunta al 8-ball mágico', '<pregunta>', (c) => {
    if (!c.q) return c.reply('Escribe tu pregunta. Ej: .ask ¿Tendré suerte hoy?');
    const r = Math.random();
    const ans = r < 0.45 ? pick(...BALL_YES) : r < 0.70 ? pick(...BALL_MAYBE) : pick(...BALL_NO);
    const emoji = r < 0.45 ? '🟢' : r < 0.70 ? '🟡' : '🔴';
    c.reply(`🎱 *8-Ball*\n❓ ${c.q}\n\n${emoji} ${ans}`);
  }, ['8ball', 'bola8', 'pregunta', 'magic']),

  mk('ship', 'Mide la compatibilidad entre dos personas', '@usuario1 @usuario2 (o dos nombres)', (c) => {
    const mentioned = c.mentioned;
    let a, b;
    if (mentioned.length >= 2) {
      a = nameOf(num(mentioned[0]));
      b = nameOf(num(mentioned[1]));
    } else {
      const parts = c.q.split(/\s+[yY&]\s+|,\s*|\s{2,}/);
      a = parts[0]?.trim() || c.pushName;
      b = parts[1]?.trim() || 'Miku';
    }
    const { score, emoji, msg } = shipScore(a.toLowerCase(), b.toLowerCase());
    const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
    c.reply(`💑 *Ship Meter*\n\n💗 ${a}  +  ${b}\n\n[${bar}] ${score}%\n\n${emoji} ${msg}`);
  }, ['compatibilidad', 'amor', 'crush', 'shiplove']),

  mk('rate', 'El bot te puntúa (o puntúa cualquier cosa)', '[lo que quieras]', (c) => {
    const thing = c.q || c.pushName;
    const score = ([...thing].reduce((a, c) => a + c.charCodeAt(0), 0) % 11);
    const stars = '⭐'.repeat(score) || '💔';
    c.reply(`📊 *Rating de "${thing}"*\n\n${stars}\n${score}/10`);
  }, ['calificar', 'puntuar', 'ratear']),

  mk('chiste', 'Un chiste random', '', (c) => {
    c.reply(`😂 ${pick(...CHISTES)}`);
  }, ['joke', 'chistes', 'risas']),

  mk('piropo', 'Un piropo aleatorio (menciona a alguien o te lo doy a ti)', '[@usuario]', (c) => {
    const t = c.mentioned[0];
    const name = t ? nameOf(num(t)) : c.pushName;
    c.reply(`💐 *Para ${name}*:\n\n${pick(...PIROPOS)}`);
  }, ['halago', 'cumplido', 'elogio']),

  mk('insulto', 'Un insulto de broma (menciona a alguien)', '[@usuario]', (c) => {
    const t = c.mentioned[0];
    const name = t ? nameOf(num(t)) : c.pushName;
    c.reply(`😤 *Para ${name}*:\n\n${pick(...INSULTOS)}`);
  }, ['ofensa', 'troll']),

  mk('chatfake', 'Crea un chat fake en texto\n(formato: Nombre1: texto↵Nombre2: texto)', '', (c) => {
    if (!c.q) return c.reply(
      `Uso: .chatfake\nNombre1: lo que dice\nNombre2: su respuesta\n\nEj:\n.chatfake\nAna: hola\nBob: que hay`
    );
    const lines = c.q.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return c.reply('Escribe al menos 2 líneas de diálogo. Separa con Enter.');
    c.reply(fakeChatLines({}, lines));
  }, ['fakechat', 'dialogofake', 'scenefake']),

  mk('pelea', 'Simula una pelea épica entre dos personas', '@usuario1 @usuario2', async (c) => {
    const mentioned = c.mentioned;
    let a, b;
    if (mentioned.length >= 2) {
      a = nameOf(num(mentioned[0]));
      b = nameOf(num(mentioned[1]));
    } else if (mentioned.length === 1) {
      a = c.pushName;
      b = nameOf(num(mentioned[0]));
    } else {
      const parts = c.q.split(/\s+vs\s+/i);
      a = parts[0]?.trim() || c.pushName;
      b = parts[1]?.trim() || 'el Bot';
    }
    const ganador = Math.random() < 0.5 ? a : b;
    const movimientos = [
      `${a} lanza un *uppercut* y ${b} esquiva por los pelos`,
      `${b} contraataca con un *combo doble* y sacude a ${a}`,
      `${a} saca su movimiento especial... ¡*ULTRA INSTINCT*!`,
      `${b} responde con un *giro de 360°*`,
      `El público enloquece 🔥`,
      `${ganador} da el *golpe final* y gana la pelea 🏆`,
    ];
    c.reply(`⚔️ *PELEA ÉPICA*\n\n🥊 ${a}  VS  ${b}\n\n${movimientos.join('\n')}`);
  }, ['vs', 'batalla', 'fight']),

  mk('would', '¿Prefieres A o B?', '<opcion1> o <opcion2>', (c) => {
    if (!c.q) return c.reply('Ej: .would pizza o hamburguesa');
    const parts = c.q.split(/\s+[oOuU]\s+/);
    if (parts.length < 2) return c.reply('Separa las opciones con " o ". Ej: .would dormir o estudiar');
    const chosen = pick(parts[0].trim(), parts[1].trim());
    c.reply(`🤔 *¿Preferiría...?*\n\nDespués de pensar mucho... elegiría:\n\n➡️ *${chosen}*`);
  }, ['prefiero', 'elegiria', 'wouldyou']),

  mk('verdadOreto', '¿Verdad o reto? (te asigna uno aleatorio)', '', (c) => {
    const verdades = [
      '¿Cuál fue el mensaje de WhatsApp más vergonzoso que enviaste?',
      '¿A quién del grupo tienes en secreto en tu lista de favoritos?',
      '¿Cuál es tu app más usada que no le contarías a nadie?',
      '¿Cuándo fue la última vez que lloraste y por qué?',
    ];
    const retos = [
      'Escribe un mensaje romántico a la última persona que escribiste.',
      'Pon tu canción favorita como estado por 1 hora.',
      'Manda un voice note cantando algo.',
      'Cambia tu foto de perfil por un meme por 30 minutos.',
    ];
    const isVerdad = Math.random() < 0.5;
    const item = isVerdad ? pick(...verdades) : pick(...retos);
    c.reply(`🎭 *${isVerdad ? 'VERDAD' : 'RETO'}* para ${c.pushName}:\n\n${item}`);
  }, ['vor', 'truthordare', 'verdadoreto']),

  mk('horoscopo', 'Tu horóscopo random de hoy', '[signo]', (c) => {
    const signos = ['Aries ♈', 'Tauro ♉', 'Géminis ♊', 'Cáncer ♋', 'Leo ♌', 'Virgo ♍', 'Libra ♎', 'Escorpio ♏', 'Sagitario ♐', 'Capricornio ♑', 'Acuario ♒', 'Piscis ♓'];
    const mensajes = [
      'Hoy es tu día. Todo lo que toques se convertirá en dinero... o en memes.',
      'Los astros dicen que deberías revisar tus notificaciones. Hay alguien pensando en ti.',
      'Mercurio retrógrado está afectando tu WiFi. Reinicia el router.',
      'Evita tomar decisiones importantes hoy. Especialmente las de gacha.',
      'Un desconocido te traerá buenas noticias. O spam. Con el cosmos nunca se sabe.',
      'El universo conspira a tu favor, pero el chat conspira contra ti. Cuidado.',
    ];
    const signo = c.q ? signos.find(s => s.toLowerCase().includes(c.q.toLowerCase())) || pick(...signos) : pick(...signos);
    c.reply(`🔮 *Horóscopo de hoy*\n\n${signo}\n\n${pick(...mensajes)}`);
  }, ['astros', 'signo', 'zodiac']),

  mk('dado', 'Tira un dado (puedes especificar los lados)', '[lados]', (c) => {
    const sides = Math.max(2, Math.min(100, parseInt(c.args[0]) || 6));
    const result = rnd(1, sides);
    const emoji = result === sides ? '🎯' : result === 1 ? '😬' : '🎲';
    c.reply(`${emoji} *Dado de ${sides} caras*\n\nResultado: *${result}*`);
  }, ['dice', 'tiradado', 'd6', 'd20']),

  mk('random', 'Elige un número aleatorio entre dos', '<mín> <máx>', (c) => {
    const a = parseInt(c.args[0]);
    const b = parseInt(c.args[1]);
    if (isNaN(a) || isNaN(b)) return c.reply('Ej: .random 1 100');
    const lo = Math.min(a, b), hi = Math.max(a, b);
    c.reply(`🔢 Número aleatorio entre *${lo}* y *${hi}*:\n\n➡️ *${rnd(lo, hi)}*`);
  }, ['aleatorio', 'nrandom', 'randnum']),

  mk('elige', 'Elige entre varias opciones separadas por coma', '<op1, op2, op3...>', (c) => {
    if (!c.q) return c.reply('Ej: .elige pizza, sushi, tacos');
    const opts = c.q.split(',').map(x => x.trim()).filter(Boolean);
    if (opts.length < 2) return c.reply('Escribe al menos 2 opciones separadas por coma.');
    c.reply(`🎯 *El bot elige:*\n\n➡️ *${pick(...opts)}*`);
  }, ['choose', 'escoger', 'decidir', 'elegir']),

  mk('pp', 'Mide el nivel de algo (troll)', '[lo que quieras]', (c) => {
    const thing = c.q || c.pushName;
    const val = ([...thing + Date.now().toString().slice(-3)].reduce((a, c) => a + c.charCodeAt(0), 0) % 26) + 1;
    const bar = '▓'.repeat(Math.round(val / 2.6)) + '░'.repeat(10 - Math.round(val / 2.6));
    c.reply(`📏 *Medidor de "${thing}"*\n\n[${bar}] ${val} cm\n\n${val < 10 ? '😂 Micrómetro detectado.' : val < 18 ? '😐 Promedio. Nada especial.' : val < 23 ? '😏 Respetable.' : '😱 ¡MONSTRUO!'}`);
  }, ['medir', 'medidor']),

  mk('completarfrase', 'Completa la frase (random absurdo)', '<inicio de frase>', (c) => {
    const completions = [
      '...y entonces el universo se rió.',
      '...pero el WiFi dijo que no.',
      '...como si nada hubiera pasado.',
      '...y así terminó la civilización.',
      '...aunque el bot ya lo sabía.',
      '...con tremenda caradurez.',
      '...y todos aplaudieron de pie.',
      '...al estilo de los 90s.',
    ];
    const inicio = c.q || 'La vida es';
    c.reply(`✍️ *"${inicio}${pick(...completions)}"*`);
  }, ['frase', 'completa', 'autocomplete']),

  mk('quien', 'Elige quién del grupo hace algo (random)', '<accion>', async (c) => {
    if (!c.q) return c.reply('Ej: .quien va a lavar los platos');
    try {
      const meta = await c.getMeta();
      const participants = meta.participants.filter(p => !p.admin);
      if (!participants.length) return c.reply('No hay miembros suficientes.');
      const chosen = participants[Math.floor(Math.random() * participants.length)];
      const jid = chosen.id;
      const n = num(jid);
      const name = db.data.names?.[n] || `+${n.slice(-4)}`;
      c.reply(`🎯 *¿Quién ${c.q}?*\n\n➡️ *${name}* tiene que ${c.q}!`, { mentions: [jid] });
    } catch {
      c.reply(`🎯 Tú, *${c.pushName}*, eres quien tiene que ${c.q}!`);
    }
  }, ['whohas', 'elegirmiembro', 'sortear']),

  mk('trivia', 'Pregunta de trivia random', '', (c) => {
    const preguntas = [
      { q: '¿Cuántos planetas tiene nuestro sistema solar?', a: '8', wrong: ['7', '9', '10'] },
      { q: '¿Cuál es el idioma más hablado del mundo?', a: 'Chino mandarín', wrong: ['Inglés', 'Español', 'Árabe'] },
      { q: '¿En qué año se fundó WhatsApp?', a: '2009', wrong: ['2007', '2010', '2012'] },
      { q: '¿Cuál es la capital de Japón?', a: 'Tokio', wrong: ['Osaka', 'Kioto', 'Hiroshima'] },
      { q: '¿Qué animal no puede saltar?', a: 'Elefante', wrong: ['Conejo', 'Canguro', 'Rana'] },
    ];
    const p = pick(...preguntas);
    const all = [p.a, ...p.wrong].sort(() => Math.random() - 0.5);
    c.reply(`🎓 *TRIVIA*\n\n❓ ${p.q}\n\n${all.map((o, i) => `${['A', 'B', 'C', 'D'][i]}) ${o}`).join('\n')}\n\n_(La respuesta es: ${p.a})_`);
  }, ['quiz', 'preguntita', 'sabias']),

  mk('meme', 'Un texto de meme random', '', (c) => {
    const memes = [
      'Cuando llegas tarde al grupo y hay 500 mensajes:\n\n*"Voy a leer todo"*\n.\n.\n.\n*[elimina la conversación]*',
      'Yo: voy a dormir temprano\nTikTok/WhatsApp a las 3am:',
      'Nadie:\nAbsolutamente nadie:\nYo a las 2am: 🤔 "¿los peces tienen sed?"',
      'Expectativa: productivo el fin de semana\nRealidad: 48 horas de reels',
      'Mis amigos: ¿por qué no contestas?\nMi cerebro: conoce la respuesta\nMi dedo: *visto*',
    ];
    c.reply(`😂 ${pick(...memes)}`);
  }, ['memes', 'shitpost']),
];
