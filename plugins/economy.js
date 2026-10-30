const U = require('../lib/utils');
const db = require('../lib/db');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'economy', run });

const HOUR = 3600000, MIN = 60000;
const level = (xp) => Math.floor(Math.sqrt(xp / 20)) + 1;
const coin = (n) => `🪙 ${Math.round(n).toLocaleString('es')}`;
const wait = (ms) => {
  const m = Math.ceil(ms / MIN);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
};
// Devuelve null si ya puede usarlo, o el texto de espera
const cooldown = (u, key, ms) => {
  const left = (u[key] || 0) + ms - Date.now();
  if (left > 0) return wait(left);
  u[key] = Date.now();
  return null;
};
const bet = (c, u) => {
  const raw = (c.args[0] || '').toLowerCase();
  const n = raw === 'all' || raw === 'todo' ? u.coins : parseInt(raw);
  if (!n || n < 1) { c.reply(`Indica cuánto apostar. Ej: ${c.prefix}${c.command} 100  (o "all")`); return null; }
  if (n > u.coins) { c.reply(`❌ No tienes tanto. Tu cartera: ${coin(u.coins)}`); return null; }
  return n;
};
const targetNum = (c) => (c.mentioned[0] || c.quoted?.sender || '').split('@')[0].split(':')[0];

// Trabajos con texto (nombre, mínimo, máximo) — sueldos aumentados
const JOBS = [
  ['programador', 800, 2500], ['repartidor', 600, 1500], ['cocinero', 700, 1800],
  ['mecánico', 800, 2000], ['streamer', 500, 4000], ['taxista', 600, 1400],
  ['diseñador', 900, 2800], ['jardinero', 500, 1200], ['médico', 2000, 5000],
  ['abogado', 1500, 4000], ['contador', 1200, 3000], ['influencer', 300, 8000],
  ['hacker', 800, 3500], ['músico', 400, 6000], ['chef', 1000, 2500],
  ['piloto', 3000, 7000], ['astronauta', 5000, 12000], ['trader', 200, 10000],
];

const list = [
  mk('balance', 'Tu dinero', '[@usuario]', (c) => {
    const n = targetNum(c) || c.senderNum;
    const u = db.user(n);
    const displayName = n === c.senderNum ? c.pushName : (db.data.names?.[n] || `+${n.slice(-4)}`);
    c.reply(`💰 *Cartera de ${displayName}*\n👛 Cartera: ${coin(u.coins)}\n🏦 Banco: ${coin(u.bank)}${u.loan > 0 ? `\n📉 Préstamo: ${coin(u.loan)}` : ''}${u.taxDue > 0 ? `\n🧾 Impuestos: ${coin(u.taxDue)}` : ''}\n💎 Total: ${coin(u.coins + u.bank - (u.loan || 0) - (u.taxDue || 0))}`);
  }, ['bal', 'cartera', 'dinero']),

  mk('daily', 'Recompensa diaria', '', (c) => {
    const u = db.user(c.senderNum);
    const w = cooldown(u, 'lastDaily', 24 * HOUR);
    if (w) return c.reply(`Cooldown: vuelve en *${w}*.`);
    const r = U.rand(2000, 6000);
    u.coins += r;
    db.save();
    c.reply(`Recompensa diaria: *${coin(r)} Coins*\nCartera: ${coin(u.coins)}`);
  }, ['diario', 'reclamar']),

  mk('work', 'Trabaja y gana monedas (cada 30 min)', '', (c) => {
    const u = db.user(c.senderNum);
    const w = cooldown(u, 'lastWork', 30 * MIN);
    if (w) return c.reply(`⏳ Estás cansado. Descansa *${w}* más.`);
    const [job, a, b] = U.pick(JOBS);
    const r = U.rand(a, b);
    u.coins += r;
    db.save();
    c.reply(`💼 Trabajaste como *${job}* y ganaste ${coin(r)}`);
  }, ['trabajar', 'chambear']),

  mk('mine', 'Mina recursos (cada 20 min)', '', (c) => {
    const u = db.user(c.senderNum);
    const w = cooldown(u, 'lastMine', 20 * MIN);
    if (w) return c.reply(`Cooldown: espera *${w}*.`);
    const [n, v] = U.pick([['carbon', 400], ['hierro', 900], ['oro', 2000], ['diamante', 4500], ['piedra', 150], ['esmeralda', 6000], ['rubi', 8000]]);
    const q = U.rand(1, 4);
    u.coins += v * q;
    db.save();
    c.reply(`Minaste ${q}x *${n}* -> ${coin(v * q)} Coins`);
  }, ['minar']),

  mk('crime', 'Arriesga para ganar (cada 45 min)', '', (c) => {
    const u = db.user(c.senderNum);
    const w = cooldown(u, 'lastCrime', 45 * MIN);
    if (w) return c.reply(`Cooldown: espera *${w}*.`);
    if (Math.random() < 0.5) {
      const r = U.rand(1500, 8000);
      u.coins += r;
      db.save();
      return c.reply(`Te salio bien: +${coin(r)} Coins`);
    }
    const l = Math.min(u.coins, U.rand(1000, 4000));
    u.coins -= l;
    db.save();
    c.reply(`Te atraparon: -${coin(l)} Coins en multa`);
  }, ['crimen']),

  mk('deposit', 'Guarda monedas en el banco', '<cantidad|all>', (c) => {
    const u = db.user(c.senderNum);
    const n = bet(c, u);
    if (!n) return;
    u.coins -= n;
    u.bank += n;
    db.save();
    c.reply(`🏦 Depositaste ${coin(n)}. Banco: ${coin(u.bank)}`);
  }, ['dep', 'depositar']),

  mk('withdraw', 'Saca monedas del banco', '<cantidad|all>', (c) => {
    const u = db.user(c.senderNum);
    const raw = (c.args[0] || '').toLowerCase();
    const n = raw === 'all' || raw === 'todo' ? u.bank : parseInt(raw);
    if (!n || n < 1 || n > u.bank) return c.reply(`❌ Indica una cantidad válida. Banco: ${coin(u.bank)}`);
    const fee = Math.max(1, Math.round(n * require('../lib/bank').CFG.withdrawFee)); // el banco cobra comisión
    u.bank -= n;
    u.coins += n - fee;
    db.save();
    c.reply(`🏦 Retiraste ${coin(n)} (comisión del banco ${coin(fee)}). Cartera: ${coin(u.coins)}`);
  }, ['retirar', 'with']),

  mk('give', 'Regala monedas a alguien', '@usuario <cantidad>', (c) => {
    const to = targetNum(c);
    const n = parseInt(c.args.find((x) => /^\d+$/.test(x)));
    if (!to || !n || n < 1) return c.reply('Ejemplo: .give @usuario 100');
    if (to === c.senderNum) return c.reply('❌ No puedes enviarte a ti mismo.');
    const u = db.user(c.senderNum);
    if (n > u.coins) return c.reply(`❌ No tienes tanto. Cartera: ${coin(u.coins)}`);
    u.coins -= n;
    db.user(to).coins += n;
    db.save();
    c.reply(`✅ Enviaste ${coin(n)} a @${to}`, { mentions: [`${to}@s.whatsapp.net`] });
  }, ['pay', 'dar', 'transferir']),

  mk('rob', 'Intenta robar a alguien (cada 30 min)', '@usuario', (c) => {
    const to = targetNum(c);
    if (!to || to === c.senderNum) return c.reply('Menciona a quién robar. Ej: .rob @usuario');
    const me = db.user(c.senderNum), v = db.user(to);
    const w = cooldown(me, 'lastRob', 30 * MIN);
    if (w) return c.reply(`⏳ Espera *${w}* para volver a robar.`);
    if (v.coins < 100) { db.save(); return c.reply('😅 Esa persona casi no tiene dinero en la cartera.'); }
    if (Math.random() < 0.4) {
      const s = Math.floor(v.coins * (U.rand(10, 30) / 100));
      v.coins -= s;
      me.coins += s;
      db.save();
      return c.reply(`🦹 Le robaste ${coin(s)} a @${to}`, { mentions: [`${to}@s.whatsapp.net`] });
    }
    const l = Math.min(me.coins, U.rand(100, 300));
    me.coins -= l;
    db.save();
    c.reply(`🚨 Te descubrieron y pagas ${coin(l)} de multa.`);
  }, ['robar']),

  mk('slots', 'Tragamonedas con apuesta', '<apuesta|all>', (c) => {
    const u = db.user(c.senderNum);
    const n = bet(c, u);
    if (!n) return;
    const e = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];
    const r = [U.pick(e), U.pick(e), U.pick(e)];
    let mult = -1;
    if (r[0] === r[1] && r[1] === r[2]) mult = r[0] === '💎' || r[0] === '7️⃣' ? 9 : 4;
    else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) mult = 1;
    u.coins += n * mult;
    db.save();
    c.reply(`🎰 ${r.join(' | ')}\n\n${mult > 0 ? `🎉 ¡Ganaste ${coin(n * mult)}!` : `😢 Perdiste ${coin(n)}`}\n👛 ${coin(u.coins)}`);
  }, ['slot', 'tragamonedas']),

  mk('coinflip', 'Cara o cruz con apuesta', '<cara|cruz> <apuesta>', (c) => {
    const side = (c.args[0] || '').toLowerCase();
    if (!['cara', 'cruz'].includes(side)) return c.reply('Ejemplo: .coinflip cara 100');
    c.args.shift();
    const u = db.user(c.senderNum);
    const n = bet(c, u);
    if (!n) return;
    const res = Math.random() < 0.5 ? 'cara' : 'cruz';
    u.coins += res === side ? n : -n;
    db.save();
    c.reply(`🪙 Salió *${res}*\n${res === side ? `🎉 Ganaste ${coin(n)}` : `😢 Perdiste ${coin(n)}`}\n👛 ${coin(u.coins)}`);
  }, ['cf', 'apostar']),

  mk('roulette', 'Ruleta: apuesta a rojo o negro', '<red|black> <apuesta>', (c) => {
    const col = U.strip((c.args[0] || '').toLowerCase());
    const map = { rojo: 'rojo', red: 'rojo', negro: 'negro', black: 'negro' };
    if (!map[col]) return c.reply('Ejemplo: .roulette rojo 100');
    c.args.shift();
    const u = db.user(c.senderNum);
    const n = bet(c, u);
    if (!n) return;
    const num = U.rand(0, 36);
    const res = num === 0 ? 'verde' : num % 2 ? 'rojo' : 'negro';
    const win = res === map[col];
    u.coins += win ? n : -n;
    db.save();
    c.reply(`🎡 Salió *${num} ${res === 'rojo' ? '🔴' : res === 'negro' ? '⚫' : '🟢'}*\n${win ? `🎉 Ganaste ${coin(n)}` : `😢 Perdiste ${coin(n)}`}\n👛 ${coin(u.coins)}`);
  }, ['ruleta']),

  mk('dice', 'Duelo de dados contra el bot', '<apuesta|all>', (c) => {
    const u = db.user(c.senderNum);
    const n = bet(c, u);
    if (!n) return;
    const a = U.rand(1, 6) + U.rand(1, 6), b = U.rand(1, 6) + U.rand(1, 6);
    const r = a > b ? n : a < b ? -n : 0;
    u.coins += r;
    db.save();
    c.reply(`🎲 Tú: *${a}*  •  Bot: *${b}*\n${r > 0 ? `🎉 Ganaste ${coin(r)}` : r < 0 ? `😢 Perdiste ${coin(n)}` : '🤝 Empate'}\n👛 ${coin(u.coins)}`);
  }, ['dados']),

  mk('top', 'Ranking de los más ricos', '', async (c) => {
    const rows = Object.entries(db.data.users).map(([n, u]) => [n, u.coins + u.bank - (u.loan || 0) - (u.taxDue || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!rows.length) return c.reply('Aun no hay datos.');
    const medals = ['♛', '✦', '✧'];
    const nameOf = (n) => db.data.names?.[n] || `+${n.slice(-4)}`;
    c.reply('*TOP RICOS* ♛\n\n' + rows.map(([n, v], i) => `${medals[i] || `${i + 1}.`} ${nameOf(n)}  ${coin(v)} Coins`).join('\n'));
  }, ['ranking', 'toprico', 'baltop', 'topcoins', 'topmonedas']),

  mk('rank', 'Tu nivel y experiencia', '[@usuario]', (c) => {
    const n = targetNum(c) || c.senderNum;
    const u = db.user(n);
    const lv = level(u.xp), next = 20 * lv * lv;
    c.reply(`⭐ *Perfil de ${n === c.senderNum ? c.pushName : '@' + n}*\n🏅 Nivel: *${lv}*\n✨ XP: ${u.xp}/${next}\n📨 Comandos usados: ${u.commands}\n💎 Patrimonio: ${coin(u.coins + u.bank)}`, { mentions: n === c.senderNum ? [] : [`${n}@s.whatsapp.net`] });
  }, ['nivel', 'perfil', 'level']),

  mk('ruleta', 'Ruleta de la fortuna (apuesta)', '<cantidad>', (c) => {
    const u = db.user(c.senderNum);
    const n = bet(c, u); if (n == null) return;
    const mult = [0, 0, 0.5, 1, 1.5, 2, 3][U.rand(0, 6)];
    const win = Math.floor(n * mult);
    u.coins = (u.coins || 0) - n + win;
    db.save();
    if (win > n) return c.reply('🎰 Ruleta x' + mult + '! Ganaste ' + coin(win - n) + '. Cartera: ' + coin(u.coins));
    if (win === n) return c.reply('🎰 Empate. Recuperaste ' + coin(n));
    return c.reply('🎰 Perdiste ' + coin(n - win) + '. Cartera: ' + coin(u.coins));
  }, ['ruletafortuna']),

  mk('cofre', 'Abre un cofre diario', '', (c) => {
    const u = db.user(c.senderNum);
    const w = cooldown(u, 'lastChest', 24 * HOUR);
    if (w) return c.reply('Cofre disponible en ' + w);
    const prize = U.rand(500, 5000);
    u.coins = (u.coins || 0) + prize;
    db.save();
    return c.reply('📦 Cofre abierto: +' + coin(prize) + '\nTotal: ' + coin(u.coins));
  }, ['chest', 'dailychest']),

  mk('invertir', 'Invierte monedas (riesgo)', '<cantidad>', (c) => {
    const u = db.user(c.senderNum);
    const n = bet(c, u); if (n == null) return;
    const ok = Math.random() < 0.55;
    if (ok) {
      const gain = Math.floor(n * (1 + Math.random()));
      u.coins = (u.coins || 0) - n + gain;
      db.save();
      return c.reply('📈 Inversion exitosa +' + coin(gain - n) + '. Total: ' + coin(u.coins));
    }
    u.coins = (u.coins || 0) - n;
    db.save();
    return c.reply('📉 Inversion fallida. Perdiste ' + coin(n));
  }, ['invest']),

];
module.exports = list;
