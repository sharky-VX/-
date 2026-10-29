// ═══════════════════════════════════════════════
//  SOCIAL PLUS — Reputación, interacciones, rank
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const db = require('../lib/db');
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'social', ...extra, run });

const nameOf = (n) => db.data.names?.[n] ? `*${db.data.names[n]}*` : `+${n.slice(-4)}`;
function userOf(c) {
  const j = c.mentioned[0] || c.quoted?.sender;
  if (j) return j.split('@')[0].split(':')[0].replace(/\D/g, '');
  const n = (c.args[0] || '').replace(/\D/g, '');
  return n || c.senderNum;
}

// ── Cooldown genérico ──
const cooldowns = new Map();
function cd(key, ms) {
  const last = cooldowns.get(key) || 0;
  if (Date.now() - last < ms) return Math.ceil((ms - (Date.now() - last)) / 1000);
  cooldowns.set(key, Date.now());
  return 0;
}

// ── Interacciones de anime ──
const ACTS = {
  abrazo: { emoji: '🤗', frases: ['%s le da un abrazo a %t 🤗', '%s abraza a %t con todas sus fuerzas', '%s envuelve a %t en un abrazo calientito'] },
  beso: { emoji: '💋', frases: ['%s le da un besito a %t 💋', '%s besa a %t en la mejilla ~', '%s sorprende a %t con un beso'] },
  pat: { emoji: '👋', frases: ['%s le da palmaditas en la cabeza a %t', '%s acaricia la cabeza de %t', '%s hace *pat pat* a %t'] },
  bofetada: { emoji: '👋', frases: ['%s le da una bofetada a %t 💥', '%s abofetea a %t sin piedad', '%s le planta la mano a %t'] },
  poke: { emoji: '👉', frases: ['%s le hace poke a %t 👉', '%s pincha a %t con el dedo', '%s molesta a %t (poke)'] },
  abrazar: { emoji: '🤗', frases: ['%s aprieta fuerte a %t en un abrazo', '%s no suelta a %t', '%s abraza a %t desde atrás'] },
  cargara: { emoji: '🏋️', frases: ['%s carga a %t en sus brazos', '%s levanta a %t en el aire', '%s carga a %t como una princesa'] },
  morder: { emoji: '🦷', frases: ['%s muerde a %t', '%s le da un mordisco a %t', '%s ¡nomnom! muerde a %t'] },
  patear: { emoji: '🦶', frases: ['%s le da una patada a %t 🦶', '%s patea a %t (jugando)', '%s hace un tiro libre directo a %t'] },
  pellizcar: { emoji: '🤏', frases: ['%s pellizca a %t', '%s le da un pellizco a %t', '%s toma la mejilla de %t y pellizca'] },
  guino: { emoji: '😉', frases: ['%s le guiña el ojo a %t 😉', '%s mira a %t y hace un guiño', '%s: *wink wink* a %t'] },
  asustar: { emoji: '👻', frases: ['%s asusta a %t 👻 ¡BOO!', '%s sale de la nada y asusta a %t', '%s hace que %t salte del susto'] },
  saludar: { emoji: '👋', frases: ['%s saluda a %t con entusiasmo 👋', '%s le hace un saludo a %t', '%s: "¡Hola!" a %t'] },
  ignorar: { emoji: '🙄', frases: ['%s ignora completamente a %t 🙄', '%s mira hacia otro lado cuando pasa %t', '%s no le hace ni caso a %t'] },
};

Object.entries(ACTS).forEach(([name, act]) => {
  module.exports = module.exports || [];
});

const fmtAct = (act, from, to) => {
  const f = U.pick(act.frases);
  return f.replace('%s', from).replace('%t', to);
};

// ── Actividad diaria ──
function dailyCooldown(num) {
  const key = `daily:${num}`;
  const last = db.data._daily?.[key] || 0;
  const ms = 20 * 3600 * 1000; // 20h
  if (Date.now() - last < ms) return Math.ceil((ms - (Date.now() - last)) / 3600000);
  db.data._daily ||= {};
  db.data._daily[key] = Date.now();
  db.save();
  return 0;
}

module.exports = [
  // Interacciones de anime con GIF viven en plugins/anime.js

  // ── Reputación ──
  mk('rep', 'Da reputación a alguien (+1 punto)', '@usuario', async (c) => {
    const t = userOf(c);
    if (t === c.senderNum) return c.reply('No puedes darte rep a ti mismo 😅');
    const wait = cd(`rep:${c.senderNum}:${t}`, 6 * 3600 * 1000);
    if (wait) return c.reply(`Espera ${Math.floor(wait / 3600)}h ${Math.floor((wait % 3600) / 60)}m para dar rep de nuevo.`);
    const u = db.user(t);
    u.rep = (u.rep || 0) + 1;
    db.save();
    await c.sock.sendMessage(c.from, {
      text: `⭐ ${nameOf(c.senderNum)} le dio +1 rep a ${nameOf(t)}\nTotal: *${u.rep} rep*`,
      mentions: [`${t}@s.whatsapp.net`],
    }, { quoted: c.m });
  }, ['reputacion', '+rep']),

  mk('reptop', 'Top de reputación del bot', '', (c) => {
    const entries = Object.entries(db.data.users || {})
      .filter(([, u]) => u.rep > 0)
      .sort(([, a], [, b]) => (b.rep || 0) - (a.rep || 0))
      .slice(0, 10);
    if (!entries.length) return c.reply('Nadie tiene rep todavía. Da rep con .rep @usuario');
    const lines = entries.map(([n, u], i) => `${i + 1}. ${nameOf(n)} — ${u.rep} ⭐`);
    c.reply(`⭐ *TOP REPUTACIÓN*\n\n${lines.join('\n')}`);
  }, ['topreputation', 'leaderboardrep']),



  mk('diario', 'Recompensa diaria de coins y XP', '', async (c) => {
    const wait = dailyCooldown(c.senderNum);
    if (wait > 0) return c.reply(`Ya reclamaste tu recompensa diaria.\nVuelve en *${wait}h* ⏳`);
    const coins = U.rand(200, 800);
    const xp = U.rand(50, 150);
    const u = db.user(c.senderNum);
    u.coins = (u.coins || 0) + coins;
    u.xp = (u.xp || 0) + xp;
    u.streak = (u.streak || 0) + 1;
    db.save();
    const bonus = u.streak >= 7 ? '\n🔥 *¡Racha de 7 días! Bonus x2 mañana*' : '';
    c.reply([
      `🎁 *RECOMPENSA DIARIA*`,
      ``,
      `+${coins} 🪙 Coins`,
      `+${xp} ✨ XP`,
      `🔥 Racha: ${u.streak} día(s)`,
      bonus,
    ].join('\n'));
  }, ['daily', 'dailyreward', 'recompensa']),

  mk('nivel', 'Ver tu nivel y XP', '[@usuario]', (c) => {
    const t = userOf(c);
    const u = db.user(t);
    const lvl = Math.floor(Math.sqrt((u.xp || 0) / 100)) + 1;
    const xpCurr = (u.xp || 0) - ((lvl - 1) * (lvl - 1) * 100);
    const xpNext = lvl * lvl * 100 - (lvl - 1) * (lvl - 1) * 100;
    const pct = Math.floor(xpCurr / xpNext * 100);
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    c.reply([
      `🎮 *NIVEL — ${nameOf(t)}*`,
      ``,
      `Nivel: *${lvl}*`,
      `XP: ${(u.xp || 0).toLocaleString('es')} total`,
      `Progreso: [${bar}] ${pct}%`,
      `Siguiente nivel en: ${xpNext - xpCurr} XP más`,
    ].join('\n'));
  }, ['level', 'exp', 'experiencia']),

  mk('toplevel', 'Top de niveles del bot', '', (c) => {
    const entries = Object.entries(db.data.users || {})
      .filter(([, u]) => u.xp > 0)
      .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 10);
    if (!entries.length) return c.reply('Nadie tiene XP todavía.');
    const lines = entries.map(([n, u], i) => {
      const lvl = Math.floor(Math.sqrt((u.xp || 0) / 100)) + 1;
      return `${i + 1}. ${nameOf(n)} — Lv.${lvl} (${(u.xp || 0).toLocaleString('es')} XP)`;
    });
    c.reply(`🎮 *TOP NIVELES*\n\n${lines.join('\n')}`);
  }, ['topnivel', 'topxp']),

  mk('bio', 'Pon una bio en tu perfil', '<texto>', (c) => {
    if (!c.q) {
      const u = db.user(c.senderNum);
      return c.reply(u.bio ? `Tu bio: "${u.bio}"` : `No tienes bio. Pon una con: .bio <texto>`);
    }
    if (c.q.length > 120) return c.reply('La bio no puede tener más de 120 caracteres.');
    const u = db.user(c.senderNum);
    u.bio = c.q;
    db.save();
    c.reply(`✅ Bio actualizada: "${c.q}"`);
  }, ['setbio2', 'mibio']),

  mk('casamiento', 'Pídele matrimonio a alguien del bot', '@usuario', async (c) => {
    const t = userOf(c);
    if (t === c.senderNum) return c.reply('No puedes casarte contigo mismo 😅');
    const uMe = db.user(c.senderNum);
    const uThem = db.user(t);
    if (uMe.married) return c.reply(`Ya estás casado/a con +${uMe.married}. Usa .divorcio primero.`);
    if (uThem.married) return c.reply(`Esa persona ya está casada con +${uThem.married}.`);
    // Pedir confirmación
    db.data._proposals ||= {};
    db.data._proposals[t] = { from: c.senderNum, at: Date.now() };
    db.save();
    await c.sock.sendMessage(c.from, {
      text: `💍 ${nameOf(c.senderNum)} le pidió matrimonio a ${nameOf(t)}\n\n${nameOf(t)}: responde *.aceptar* para decir que sí, o *.rechazar* para negarte.`,
      mentions: [`${t}@s.whatsapp.net`],
    }, { quoted: c.m });
  }, ['propuesta', 'marry']),

  mk('aceptar', 'Acepta una propuesta de matrimonio', '', async (c) => {
    const prop = db.data._proposals?.[c.senderNum];
    if (!prop || Date.now() - prop.at > 120000) return c.reply('No tienes propuestas pendientes.');
    const uMe = db.user(c.senderNum);
    const uThem = db.user(prop.from);
    uMe.married = prop.from;
    uThem.married = c.senderNum;
    delete db.data._proposals[c.senderNum];
    db.save();
    await c.sock.sendMessage(c.from, {
      text: `💒 *¡Se casaron!*\n${nameOf(prop.from)} 💍 ${nameOf(c.senderNum)}\n\n¡Felicidades! 🎉`,
      mentions: [`${prop.from}@s.whatsapp.net`, `${c.senderNum}@s.whatsapp.net`],
    }, { quoted: c.m });
  }, ['accept', 'acepto']),

  mk('rechazar', 'Rechaza una propuesta de matrimonio', '', async (c) => {
    const prop = db.data._proposals?.[c.senderNum];
    if (!prop) return c.reply('No tienes propuestas pendientes.');
    delete db.data._proposals[c.senderNum];
    db.save();
    await c.sock.sendMessage(c.from, {
      text: `💔 ${nameOf(c.senderNum)} rechazó la propuesta de ${nameOf(prop.from)} 😢`,
      mentions: [`${prop.from}@s.whatsapp.net`],
    }, { quoted: c.m });
  }, ['reject', 'noacepto']),

  mk('divorcio', 'Divorciarse de tu pareja virtual', '', (c) => {
    const u = db.user(c.senderNum);
    if (!u.married) return c.reply('No estás casado/a con nadie.');
    const ex = u.married;
    const uEx = db.user(ex);
    u.married = null;
    uEx.married = null;
    db.save();
    c.reply(`💔 Te divorciaste de +${ex}. Es mejor así...`);
  }, ['divorce', 'separar']),

  mk('pareja', 'Ver con quién estás casado/a', '', (c) => {
    const u = db.user(c.senderNum);
    if (!u.married) return c.reply('No estás casado/a con nadie. Usa .casamiento @usuario para pedirle matrimonio a alguien.');
    c.reply(`💑 Estás casado/a con ${nameOf(u.married)} (+${u.married})`);
  }, ['married', 'mipareja', 'esposo', 'esposa']),

  mk('topcmd', 'Top usuarios con más comandos usados', '', (c) => {
    const entries = Object.entries(db.data.users || {})
      .filter(([, u]) => u.cmds > 0)
      .sort(([, a], [, b]) => (b.cmds || 0) - (a.cmds || 0))
      .slice(0, 10);
    if (!entries.length) return c.reply('Nadie ha usado comandos todavía.');
    const lines = entries.map(([n, u], i) => `${i + 1}. ${nameOf(n)} — ${u.cmds} cmds`);
    c.reply(`📊 *TOP COMANDOS*\n\n${lines.join('\n')}`);
  }, ['topusuarios', 'topcommands']),

  mk('reto2', 'Reta a otro usuario a una apuesta de coins', '@usuario <cantidad>', async (c) => {
    const t = userOf(c);
    if (t === c.senderNum) return c.reply('No puedes retarte a ti mismo.');
    const coins = parseInt(c.args[c.mentioned.length ? 1 : 1]) || 100;
    const uMe = db.user(c.senderNum);
    const uThem = db.user(t);
    if ((uMe.coins || 0) < coins) return c.reply(`No tienes suficientes coins. Tienes ${uMe.coins || 0}.`);
    if ((uThem.coins || 0) < coins) return c.reply(`${nameOf(t)} no tiene suficientes coins.`);
    // Resultado aleatorio
    const winner = Math.random() < 0.5 ? c.senderNum : t;
    const loser = winner === c.senderNum ? t : c.senderNum;
    const uW = db.user(winner);
    const uL = db.user(loser);
    uW.coins = (uW.coins || 0) + coins;
    uL.coins = (uL.coins || 0) - coins;
    db.save();
    await c.sock.sendMessage(c.from, {
      text: `⚔️ *RETO DE COINS*\n${nameOf(c.senderNum)} vs ${nameOf(t)}\nApuesta: ${coins} coins\n\n🏆 Ganador: ${nameOf(winner)}\n+${coins} 🪙 coins`,
      mentions: [`${t}@s.whatsapp.net`, `${c.senderNum}@s.whatsapp.net`],
    }, { quoted: c.m });
  }, ['bet', 'apostar', 'duelo']),

  mk('transferir', 'Transfiere coins a otro usuario', '@usuario <cantidad>', (c) => {
    const t = userOf(c);
    if (t === c.senderNum) return c.reply('No puedes transferirte a ti mismo.');
    const amount = parseInt(c.args[c.mentioned.length ? 1 : 1]) || 0;
    if (!amount || amount < 1) return c.reply('Escribe la cantidad. Ejemplo: .transferir @usuario 500');
    const uMe = db.user(c.senderNum);
    if ((uMe.coins || 0) < amount) return c.reply(`No tienes suficientes coins (tienes ${uMe.coins || 0}).`);
    const uThem = db.user(t);
    uMe.coins -= amount;
    uThem.coins = (uThem.coins || 0) + amount;
    db.save();
    c.sock.sendMessage(c.from, {
      text: `💸 ${nameOf(c.senderNum)} le transfirió *${amount} coins* a ${nameOf(t)}`,
      mentions: [`${t}@s.whatsapp.net`],
    }, { quoted: c.m });
  }, ['send', 'enviar', 'dar', 'coins2']),

  mk('regalo', 'Regala un ítem o coins a alguien', '@usuario <cantidad>', (c) => {
    const t = userOf(c);
    if (t === c.senderNum) return c.reply('No puedes regalarte a ti mismo.');
    const amount = parseInt(c.args[c.mentioned.length ? 1 : 1]) || 50;
    const uMe = db.user(c.senderNum);
    if ((uMe.coins || 0) < amount) return c.reply(`No tienes suficientes coins.`);
    const uThem = db.user(t);
    uMe.coins -= amount;
    uThem.coins = (uThem.coins || 0) + amount;
    db.save();
    c.sock.sendMessage(c.from, {
      text: `🎁 ${nameOf(c.senderNum)} le regaló *${amount} coins* a ${nameOf(t)} 🎁`,
      mentions: [`${t}@s.whatsapp.net`],
    }, { quoted: c.m });
  }, ['gift', 'giftar', 'present']),

  mk('saldo', 'Ver tu saldo de coins', '[@usuario]', (c) => {
    const t = userOf(c);
    const u = db.user(t);
    const isMe = t === c.senderNum;
    c.reply(`💰 ${isMe ? 'Tu saldo' : `Saldo de ${nameOf(t)}`}: *${(u.coins || 0).toLocaleString('es')} coins*`);
  }, ['coins3', 'balance', 'dinero', 'plata']),

  mk('topcoins', 'Top de usuarios con más coins', '', (c) => {
    const entries = Object.entries(db.data.users || {})
      .filter(([, u]) => u.coins > 0)
      .sort(([, a], [, b]) => (b.coins || 0) - (a.coins || 0))
      .slice(0, 10);
    if (!entries.length) return c.reply('Nadie tiene coins todavía.');
    const lines = entries.map(([n, u], i) => `${i + 1}. ${nameOf(n)} — ${(u.coins || 0).toLocaleString('es')} 🪙`);
    c.reply(`💰 *TOP COINS*\n\n${lines.join('\n')}`);
  }, ['ricoslista', 'topdinero', 'topmoney']),

  mk('cumple', 'Registra o ve el cumpleaños de alguien', '[DD/MM]', (c) => {
    const arg = c.args[0] || '';
    if (/^\d{1,2}\/\d{1,2}$/.test(arg)) {
      const [d, m] = arg.split('/').map(Number);
      if (d < 1 || d > 31 || m < 1 || m > 12) return c.reply('Fecha inválida. Usa DD/MM. Ejemplo: .cumple 15/03');
      const u = db.user(c.senderNum);
      u.birthday = arg;
      db.save();
      return c.reply(`🎂 Cumpleaños guardado: *${arg}*`);
    }
    const t = userOf(c);
    const u = db.user(t);
    if (!u.birthday) return c.reply(t === c.senderNum ? 'No has registrado tu cumpleaños. Usa .cumple DD/MM' : `${nameOf(t)} no ha registrado su cumpleaños.`);
    c.reply(`🎂 Cumpleaños de ${nameOf(t)}: *${u.birthday}*`);
  }, ['birthday', 'nacimiento']),

  mk('mipresencia', 'Cuántos mensajes has enviado en este chat', '', (c) => {
    const u = db.user(c.senderNum);
    const lvl = Math.floor(Math.sqrt((u.xp || 0) / 100)) + 1;
    c.reply([
      `📊 *TU ACTIVIDAD*`,
      `👤 ${c.pushName}`,
      `💬 Mensajes registrados: ${u.msgs || 0}`,
      `🎮 Comandos usados: ${u.cmds || 0}`,
      `🎮 Nivel: ${lvl}`,
      `💰 Coins: ${(u.coins || 0).toLocaleString('es')}`,
      `⭐ Rep: ${u.rep || 0}`,
    ].join('\n'));
  }, ['actividad', 'mystats', 'misestadisticas']),
];
