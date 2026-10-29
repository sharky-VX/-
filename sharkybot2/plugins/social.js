const { sans } = require('../lib/deco');
// ═══════════════════════════════════════════════
//  COMANDOS SOCIALES / EXTRA
//  Perfil, reputación, logros, estado del grupo, stickers, etc.
// ═══════════════════════════════════════════════
const db = require('../lib/db');
const U = require('../lib/utils');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'fun', ...extra, run });
const numOf = (j) => String(j || '').split('@')[0].split(':')[0];
const nameOf = (n) => db.data.names?.[n] || `+${n.slice(-4)}`;
const medal = (i) => ['🥇','🥈','🥉'][i] || `${i+1}.`;
const SIGNS = ['♈Aries','♉Tauro','♊Géminis','♋Cáncer','♌Leo','♍Virgo','♎Libra','♏Escorpio','♐Sagitario','♑Capricornio','♒Acuario','♓Piscis'];
const SIGNS_DATE = [[3,21],[4,20],[5,21],[6,21],[7,23],[8,23],[9,23],[10,23],[11,22],[12,22],[1,20],[2,19]];

function getSign(d, m) {
  for (let i = 0; i < SIGNS_DATE.length; i++) {
    const [sm, sd] = SIGNS_DATE[i];
    if (m === sm && d >= sd) return SIGNS[i];
    if (i < SIGNS_DATE.length - 1) {
      const [nm, nd] = SIGNS_DATE[i + 1];
      if (m === nm && d < nd) return SIGNS[i];
    }
  }
  return SIGNS[11];
}

module.exports = [
  mk('perfil', 'Perfil completo con foto y stats', '[@usuario]', async (c) => {
    const key = c.mentioned[0] ? numOf(c.mentioned[0]) : c.senderNum;
    const jid = c.mentioned[0] || c.sender;
    const u = db.user(key);
    const g = (() => { try { return require('../lib/gacha').user(key); } catch { return null; } })();
    const poke = (u.pokemon && u.pokemon.list) ? u.pokemon.list.length : 0;
    const pokeCatch = (u.pokemon && u.pokemon.catches) || 0;
    const lvl = Math.floor(Math.sqrt((u.xp || 0) / 100)) + 1;
    const nextXp = Math.pow(lvl, 2) * 100;
    const prevXp = Math.pow(Math.max(lvl - 1, 0), 2) * 100;
    const span = Math.max(1, nextXp - prevXp);
    const pct = Math.min(10, Math.max(0, Math.round(((u.xp || 0) - prevXp) / span * 10)));
    const bar = '█'.repeat(pct) + '░'.repeat(10 - pct);
    const waifus = g ? Object.values(g.h || {}).reduce((a, b) => a + b, 0) : 0;
    const married = u.married ? nameOf(u.married) : 'Soltero/a';
    const lines = [
      '   ❀ 𓆩 ' + (typeof sans === 'function' ? sans('perfil') : 'perfil') + ' 𓆪 ❀',
      '',
      '  ✦ Usuario   ── ' + nameOf(key),
      '  ✦ Nivel     ── ' + lvl,
      '  ✦ XP        ── ' + (u.xp || 0) + ' / ' + nextXp,
      '  [' + bar + ']',
      '',
      '  ✦ Coins     ── ' + Number(u.coins || 0).toLocaleString('es'),
      '  ✦ Banco     ── ' + Number(u.bank || 0).toLocaleString('es'),
      '  ✦ Waifus    ── ' + waifus,
      '  ✦ Pokemon   ── ' + poke + ' (capturas: ' + pokeCatch + ')',
      '  ✦ Pareja    ── ' + married,
      '  ✦ Reputacion── +' + (u.rep || 0),
      '  ✦ Comandos  ── ' + (u.commands || 0),
      '',
      '   ❀',
    ];
    let pp;
    try { pp = await c.sock.profilePictureUrl(jid, 'image'); } catch {}
    if (pp) {
      try {
        const buf = await U.getBuffer(pp, { timeout: 15000 });
        return c.sock.sendMessage(c.from, { image: buf, caption: lines.join('\n'), mentions: [jid] }, { quoted: c.m });
      } catch {}
    }
    return c.reply(lines.join('\n'), { mentions: [jid] });
  }, ['stats', 'miperfil', 'profile', 'myprofile']),

  mk('rep', 'Da +1 de reputación a alguien (una vez por día)', '@usuario', (c) => {
    const t = c.mentioned[0] || c.quoted?.sender;
    if (!t) return c.reply(`Menciona o responde a alguien. Ej: ${c.prefix}rep @usuario`);
    const tn = numOf(t);
    if (tn === c.senderNum) return c.reply('No puedes darte rep a ti mismo 😅');
    const today = new Date().toDateString();
    const repKey = `rep:${c.senderNum}:${today}`;
    if ((db.data._repLog ||= {})[repKey]) return c.reply(`Ya diste rep hoy. Vuelve mañana ♻️`);
    db.data._repLog[repKey] = 1;
    const u = db.user(tn);
    u.rep = (u.rep || 0) + 1;
    db.save();
    c.reply(`⭐ Le diste +1 rep a *${nameOf(tn)}*\nAhora tiene ${u.rep} de reputación.`);
  }, ['reputacion', 'kudos', 'karma']),

  mk('reptop', 'Ranking de reputación del bot', '', (c) => {
    const rows = Object.entries(db.data.users)
      .filter(([, u]) => u.rep > 0)
      .sort((a, b) => (b[1].rep || 0) - (a[1].rep || 0))
      .slice(0, 10);
    if (!rows.length) return c.reply('Nadie tiene reputación aún. Usa .rep @alguien');
    c.reply('⭐ *TOP REPUTACIÓN*\n\n' + rows.map(([n, u], i) => `${medal(i)} ${nameOf(n)} — ${u.rep} rep`).join('\n'));
  }, ['toprep', 'reprank']),

  mk('topcmd', 'Quién ha usado más comandos', '', (c) => {
    const rows = Object.entries(db.data.users)
      .filter(([, u]) => u.commands > 0)
      .sort((a, b) => (b[1].commands||0) - (a[1].commands||0))
      .slice(0, 10);
    if (!rows.length) return c.reply('Nadie ha usado comandos todavía.');
    c.reply('📦 *TOP USUARIOS*\n\n' + rows.map(([n, u], i) => `${medal(i)} ${nameOf(n)} — ${u.commands} comandos`).join('\n'));
  }, ['topusuarios', 'topusers', 'cmdtop']),

  mk('nivel', 'Tu nivel actual basado en XP', '[@usuario]', (c) => {
    const key = c.mentioned[0] ? numOf(c.mentioned[0]) : c.senderNum;
    const u = db.user(key);
    const lvl = Math.floor(Math.sqrt(u.xp / 100)) + 1;
    const nextXp = Math.pow(lvl, 2) * 100;
    c.reply(`⭐ *${nameOf(key)}*\nNivel: *${lvl}*\nXP: ${u.xp} / ${nextXp}\n\nSigue usando comandos para subir de nivel 🚀`);
  }, ['level', 'xp', 'mylevel']),

  mk('toplevel', 'Ranking por nivel/XP', '', (c) => {
    const rows = Object.entries(db.data.users)
      .sort((a, b) => (b[1].xp||0) - (a[1].xp||0))
      .slice(0, 10);
    if (!rows.length) return c.reply('Nadie tiene XP aún.');
    const lvl = (xp) => Math.floor(Math.sqrt((xp||0) / 100)) + 1;
    c.reply('🏆 *TOP NIVELES*\n\n' + rows.map(([n, u], i) => `${medal(i)} ${nameOf(n)} — Nivel ${lvl(u.xp)} (${u.xp||0} XP)`).join('\n'));
  }, ['topxp', 'rankinglevel', 'leaderboard']),

  // ── Interacciones sociales (texto) ──
  // NOTA: hug/kiss/pat/slap/poke/cuddle viven en plugins/anime.js (GIF anime).
  // Aquí solo quedan alias en español que NO choquen con anime.
  mk('abrazotxt', 'Abrazo en texto (sin GIF). Para GIF usa .hug', '@usuario', (c) => {
    const t = c.mentioned[0] || c.quoted?.sender;
    const from = c.pushName || nameOf(c.senderNum);
    const to = t ? nameOf(numOf(t)) : c.args.join(' ') || 'todos';
    c.reply('*' + from + '* abraza a *' + to + '* con fuerza');
  }, ['abrazartexto']),



  mk('beso2', 'Peleas de besos (o no) entre dos personas 💋❌', '@user1 @user2', (c) => {
    const users = c.mentioned.slice(0, 2);
    const a = users[0] ? nameOf(numOf(users[0])) : (c.pushName || 'Tú');
    const b = users[1] ? nameOf(numOf(users[1])) : c.args.join(' ') || 'alguien';
    const decides = U.pick(['le manda un beso a', 'rechaza el beso de', 'se escapa del beso de', 'acepta el beso de', 'le manda un mwah a']);
    c.reply(`💋 *${a}* ${decides} *${b}*`);
  }, ['kissbattle', 'besobatalla']),

  mk('casamiento', 'Te "casas" con alguien (por diversión 💍)', '@usuario', (c) => {
    const t = c.mentioned[0] || c.quoted?.sender;
    if (!t) return c.reply(`Menciona a alguien: ${c.prefix}casamiento @usuario`);
    const from = c.pushName || nameOf(c.senderNum);
    const to = nameOf(numOf(t));
    const acept = Math.random() > 0.3;
    if (acept) c.reply(`💍 *${from}* le propone matrimonio a *${to}*\n\n💒 ¡Y ${to} dijo SÍ! 🎊\n_Feliz vida juntos_ 🥂`, { mentions: [t] });
    else c.reply(`💍 *${from}* le propone matrimonio a *${to}*\n\n😬 Pero... *${to}* dijo NO. 💔\n_Tranquilo/a, hay más peces en el mar 🐟_`, { mentions: [t] });
  }, ['propuesta', 'marry', 'wedding']),

  mk('divorcio', 'Te "divorcías" de alguien 💔', '@usuario', (c) => {
    const t = c.mentioned[0] || c.quoted?.sender;
    const from = c.pushName || nameOf(c.senderNum);
    const to = t ? nameOf(numOf(t)) : 'alguien';
    c.reply(`📄 *${from}* presenta los papeles de divorcio de *${to}*\n⚖️ El juez los firma.\n💔 Oficialmente divorciados. Lo sentimos (o no 😏)`);
  }, ['divorce', 'separacion']),

  // ── Zodiaco / personalidad ──
  mk('signo', 'Tu signo zodiacal según tu fecha de nacimiento', '<dd/mm>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}signo <dd/mm>\nEjemplo: ${c.prefix}signo 15/05`);
    const [d, m] = c.q.split(/[\/\-]/).map(Number);
    if (!d || !m || m > 12 || d > 31) return c.reply('Formato: dd/mm. Ejemplo: 15/05');
    const sign = getSign(d, m);
    c.reply(`✨ *Tu signo:* ${sign}\nFecha: ${d}/${m}`);
  }, ['zodiaco', 'zodiac', 'horoscopo2']),

  mk('compatibilidad', 'Compatibilidad zodiacal entre dos signos', '<signo1> <signo2>', (c) => {
    const s1 = (c.args[0] || '').toLowerCase();
    const s2 = (c.args[1] || '').toLowerCase();
    if (!s1 || !s2) return c.reply(`Uso: ${c.prefix}compatibilidad aries leo\nSignos: aries tauro geminis cancer leo virgo libra escorpio sagitario capricornio acuario piscis`);
    const pct = ((s1.charCodeAt(0) + s2.charCodeAt(0)) * 7 + (s1.length * s2.length)) % 101;
    const bar = '❤️'.repeat(Math.round(pct/20)) + '🤍'.repeat(5 - Math.round(pct/20));
    const msgs = ['No es para tanto 😅', 'Algo de chispa hay 🌟', 'Buena vibra juntos ✨', 'Muy compatibles 💕', 'Almas gemelas 🔥💫'];
    const msg = msgs[Math.floor(pct/21)];
    c.reply(`💫 *${s1.charAt(0).toUpperCase()+s1.slice(1)}* & *${s2.charAt(0).toUpperCase()+s2.slice(1)}*\n\n${bar}\n*${pct}%* de compatibilidad\n${msg}`);
  }, ['compatzod', 'zodcompat']),

  mk('personalidad', 'Tu tipo de personalidad MBTI al azar (para pasarla bien)', '', (c) => {
    const types = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
    const descs = {
      INTJ:'El Arquitecto: estratégico, independiente y exigente 🧠',
      INTP:'El Pensador: lógico, curioso y algo distraído 💭',
      ENTJ:'El Comandante: líder nato, decisivo y ambicioso 👑',
      ENTP:'El Debatidor: innovador, directo y un poco provocador 🔥',
      INFJ:'El Defensor: empático, idealista y determinado 💜',
      INFP:'El Mediador: soñador, apasionado y auténtico 🌙',
      ENFJ:'El Protagonista: carismático, inspirador y generoso ✨',
      ENFP:'El Activista: creativo, entusiasta y libre 🌈',
      ISTJ:'El Logístico: responsable, confiable y metódico 📋',
      ISFJ:'El Defensor: leal, paciente y muy atento 🛡️',
      ESTJ:'El Ejecutivo: organizado, directo y práctico 💼',
      ESFJ:'El Cónsul: sociable, cálido y atento a los demás 💛',
      ISTP:'El Virtuoso: práctico, analítico y reservado 🔧',
      ISFP:'El Aventurero: artístico, espontáneo y sensible 🎨',
      ESTP:'El Emprendedor: energético, observador y audaz ⚡',
      ESFP:'El Animador: espontáneo, divertido y vivaz 🎉',
    };
    const t = types[Math.floor(Math.random() * types.length)];
    c.reply(`🧠 *Tu tipo MBTI (random):*\n\n*${t}*\n${descs[t]}\n\n_Esto es solo por diversión 😄_`);
  }, ['mbti', 'tipopersonalidad']),

  // ── Retos / Dinámicas ──


  mk('ahorcado', 'Juega al ahorcado (una palabra aleatoria en español)', '', async (c) => {
    const words = ['CODIGO','MUSICA','PLAYA','SABADO','FLECHA','QUESO','MADERA','JARDIN','CIUDAD','TIERRA','DRAGON','NOCHE','ESTRELLA','LLUVIA','PUERTA','CAMINO','BLANCO','FUEGO','VIENTO','PIEDRA'];
    const word = U.pick(words);
    const chat = db.chat(c.from);
    chat._ahorcado = { word, guesses: [], errors: 0, by: c.senderNum };
    db.save();
    const display = word.split('').map(() => '_ ').join('').trim();
    c.reply(`🎮 *AHORCADO iniciado!*\n\n${display}\n\nLetras: ${word.length}\nErrores: 0/6\n\nEscribe una letra para adivinar.`);
  }, ['hangman', 'juegopalahra']),

  mk('letra', 'Adivina una letra en el ahorcado', '<letra>', (c) => {
    const chat = db.chat(c.from);
    const game = chat._ahorcado;
    if (!game) return c.reply(`No hay juego de ahorcado activo. Inicia uno con ${c.prefix}ahorcado`);
    const letter = (c.args[0] || c.q.trim()).toUpperCase().charAt(0);
    if (!letter || !/[A-Z]/.test(letter)) return c.reply('Escribe una sola letra.');
    if (game.guesses.includes(letter)) return c.reply(`Ya intentaste la *${letter}*. Prueba otra.`);
    game.guesses.push(letter);
    const inWord = game.word.includes(letter);
    if (!inWord) game.errors++;
    const HANG = ['','😮','😐','😟','😨','😱','💀'];
    const display = game.word.split('').map(ch => game.guesses.includes(ch) ? ch : '_').join(' ');
    const won = !display.includes('_');
    const lost = game.errors >= 6;
    const lines = [
      inWord ? `✅ ¡Hay *${letter}*!` : `❌ No hay *${letter}*`,
      `\n${display}`,
      `\nErrores: ${game.errors}/6 ${HANG[game.errors] || ''}`,
      `Letras usadas: ${game.guesses.join(' ')}`,
    ];
    if (won) { delete chat._ahorcado; db.save(); return c.reply(lines.join('\n') + `\n\n🎉 ¡Ganaste! La palabra era *${game.word}*`); }
    if (lost) { delete chat._ahorcado; db.save(); return c.reply(lines.join('\n') + `\n\n💀 Perdiste. La palabra era *${game.word}*`); }
    db.save();
    c.reply(lines.join('\n'));
  }, ['guess', 'adivinar']),

  mk('encuesta', 'Crea una mini-encuesta en el grupo (responder 1/2/3)', '<pregunta> | <opción1> | <opción2> [| <opción3>]', (c) => {
    if (!c.isGroup) return c.reply('Las encuestas son solo en grupos.');
    const parts = c.q.split('|').map(p => p.trim());
    if (parts.length < 3) return c.reply(`Uso: ${c.prefix}encuesta <pregunta> | <op1> | <op2>\nEjemplo: ${c.prefix}encuesta ¿Perro o gato? | Perro 🐶 | Gato 🐱`);
    const [question, ...opts] = parts.filter(Boolean);
    const chat = db.chat(c.from);
    chat._poll = { q: question, opts: opts.slice(0, 4), votes: {}, by: c.senderNum, t: Date.now() };
    db.save();
    const lines = [`📊 *${question}*\n`].concat(opts.slice(0,4).map((o, i) => `${i+1}. ${o}`));
    lines.push(`\nResponde con ${c.prefix}votar 1, ${c.prefix}votar 2, etc.`);
    c.reply(lines.join('\n'));
  }, ['poll', 'votacion', 'sondeo']),

  mk('votar', 'Vota en la encuesta activa del grupo', '<número>', (c) => {
    if (!c.isGroup) return c.reply('Solo en grupos.');
    const chat = db.chat(c.from);
    const poll = chat._poll;
    if (!poll) return c.reply(`No hay encuesta activa. Crea una con ${c.prefix}encuesta`);
    const idx = parseInt(c.args[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= poll.opts.length) return c.reply(`Elige del 1 al ${poll.opts.length}`);
    poll.votes[c.senderNum] = idx;
    db.save();
    const counts = poll.opts.map((_, i) => Object.values(poll.votes).filter(v => v === i).length);
    const total = Object.keys(poll.votes).length;
    const bars = counts.map((n, i) => {
      const bar = '█'.repeat(total ? Math.round(n / total * 10) : 0) + '░'.repeat(total ? 10 - Math.round(n / total * 10) : 10);
      return `${i+1}. ${poll.opts[i]}\n   ${bar} ${n} votos`;
    });
    c.reply(`✅ Voto registrado!\n\n📊 *${poll.q}*\n\n${bars.join('\n\n')}\n\nTotal: ${total} votos`);
  }, ['vote', 'voto']),

  mk('cerrarpoll', 'Cierra la encuesta activa y muestra resultados finales', '', (c) => {
    if (!c.isGroup) return c.reply('Solo en grupos.');
    const chat = db.chat(c.from);
    const poll = chat._poll;
    if (!poll) return c.reply('No hay encuesta activa.');
    const counts = poll.opts.map((_, i) => Object.values(poll.votes).filter(v => v === i).length);
    const total = Object.keys(poll.votes).length;
    const winner = counts.indexOf(Math.max(...counts));
    delete chat._poll;
    db.save();
    const lines = [`🏁 *Encuesta cerrada!*\n📊 *${poll.q}*\n`];
    counts.forEach((n, i) => lines.push(`${i+1}. ${poll.opts[i]} — ${n} votos (${total ? Math.round(n/total*100) : 0}%)`));
    lines.push(`\n🏆 Ganador: *${poll.opts[winner]}* con ${counts[winner]} votos`);
    c.reply(lines.join('\n'));
  }, ['endpoll', 'closepoll', 'resultados']),

  mk('ruleta', 'Ruleta rusa: ¿te salvas o explota? 🔫', '', (c) => {
    const CHAMBERS = 6;
    const loaded = Math.floor(Math.random() * CHAMBERS);
    if (loaded === 0) {
      c.reply(`🔫 *BANG!* 💀\n*${c.pushName}* jaló el gatillo y... ¡LE DIO!\n_(En la vida real, nunca hagas esto)_`);
    } else {
      c.reply(`🔫 *click...*\n*${c.pushName}* jaló el gatillo y se salvó 😅\nQuedaron ${loaded}/6 cámaras vacías.`);
    }
  }, ['russianroulette', 'ruletagun']),

  mk('moneda', 'Cara o cruz 🪙', '', (c) => {
    const result = Math.random() < 0.5 ? 'CARA 👴' : 'CRUZ ✝️';
    c.reply(`🪙 *${c.pushName}* lanza la moneda...\n\n¡Salió *${result}*!`);
  }, ['flipcoin', 'caracruz', 'coin']),

  mk('cuantos', 'Cuántos miembros hay en el grupo con X condición (por diversión)', '<condición>', async (c) => {
    const conds = [
      'están dormidos ahorita',
      'son fans secretos de anime',
      'han trolleado este grupo',
      'tienen hambre ahora mismo',
      'están usando el celular en clase/trabajo',
      'nunca limpian su cuarto',
      'tienen un crush aquí',
      'mandan audios de 10 minutos',
    ];
    if (!c.isGroup) return c.reply('Solo en grupos 👥');
    const md = await c.getMeta();
    const total = md.participants.length;
    const cond = c.q || U.pick(conds);
    const pct = Math.floor(Math.random() * 91) + 5;
    const n = Math.round(total * pct / 100);
    c.reply(`📊 *¿Cuántos ${cond}?*\n\n*${n} de ${total}* miembros (${pct}%)\n\n_Estadísticas inventadas con precisión científica 🧪_`);
  }, ['cuantossonlos', 'howmany']),
];
