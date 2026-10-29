const db = require('../lib/db');
const U = require('../lib/utils');
const g = require('../lib/gacha');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'gacha', ...extra, run });
const coin = (n) => `${Math.round(n).toLocaleString('es')} Coins`;
const RW_CD = 7 * 60 * 1000; // 7 minutos cooldown para .rw
const ROB_CD = 20 * 60 * 1000; // 20 minutos cooldown para .robwaifu
const rwCooldown = new Map(); // senderNum -> lastRwTime
const robCooldown = new Map(); // senderNum -> lastRobTime
const numOf = (j) => String(j || '').split('@')[0].split(':')[0];
const nameOf = (n) => db.data.names?.[n] || `+${n}`;
const mins = (ms) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; };

// Persona a la que se refiere el comando (mencion o respuesta) → clave en la base de datos
function who(c) {
  const j = c.mentioned[0] || c.quoted?.sender;
  if (!j) return '';
  const n = numOf(j);
  if (g.G().users[n] || db.data.users[n]) return n;
  for (const [lid, real] of Object.entries(db.data.lidMap || {})) {
    if (real === n && (g.G().users[lid] || db.data.users[lid])) return lid;
    if (lid === n && (g.G().users[real] || db.data.users[real])) return real;
  }
  return n;
}
const wallet = (n) => db.user(n);
const SELL_RATE = 0.6;

// Pendientes de reclamar: id del mensaje → tirada; y la última de cada chat
const pend = new Map();
const lastRoll = new Map();
const trades = new Map();
const guesses = new Map();
const prune = () => {
  const old = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pend) if (v.t < old) pend.delete(k);
  for (const [k, v] of trades) if (v.t < 3 * 60 * 1000 + old) trades.delete(k);
};

async function needPool(c) {
  const n = await g.ensurePool();
  if (!n) { await c.reply('No pude cargar los personajes ahora. Intenta en un minuto.'); return false; }
  return true;
}

async function doRoll(c, gender) {
  if (!(await needPool(c))) return;
  // Cooldown de 7 minutos para .rw
  const now = Date.now();
  const lastRw = rwCooldown.get(c.senderNum) || 0;
  const wait7 = lastRw + RW_CD - now;
  if (wait7 > 0) return c.reply(`Cooldown: espera *${mins(wait7)}* para volver a tirar.`);
  rwCooldown.set(c.senderNum, now);

  const u = g.user(c.senderNum);
  g.refill(u);
  if (u.rolls <= 0 && u.bonus <= 0) {
    return c.reply(`No te quedan tiradas. Se renuevan en ${mins(u.reset - now)}.\nCompra mas con ${c.prefix}buyrolls o reclama con ${c.prefix}gdaily`);
  }
  if (u.rolls > 0) u.rolls--; else u.bonus--;
  const ch = g.pick(gender);
  if (!ch) return c.reply('No hay personajes disponibles todavia.');
  const v = g.view(ch);
  const currentOwner = g.ownChar(ch.id);
  const ownerLine = currentOwner
    ? `RECLAMADA por *${nameOf(currentOwner)}*` : `Libre - usa ${c.prefix}claim para reclamarla`;
  const entry = { char: ch, by: c.senderNum, t: Date.now(), chat: c.from, done: false };
  lastRoll.set(c.from, entry);
  const left = u.rolls + u.bonus;
  const cap = g.card(v, [
    '',
    ownerLine,
    currentOwner ? '' : `(${c.pushName} tiene 20s de prioridad)`,
    `Tiradas restantes: ${left}`,
    `Votos: ${g.getVotes(ch.id)}`,
  ].filter(x => x !== ''));
  g.G().rolled = (g.G().rolled || 0) + 1;
  db.save();
  let sent;
  const mentions = currentOwner ? [`${currentOwner}@s.whatsapp.net`] : [];
  try {
    if (ch.img) {
      let imgBuf = null;
      try { imgBuf = await U.getBuffer(ch.img, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsApp/2.0)' } }); } catch {}
      if (imgBuf && imgBuf.length > 500) {
        sent = await c.sock.sendMessage(c.from, { image: imgBuf, caption: cap, mentions }, { quoted: c.m });
      } else {
        // Buffer falló, intentar URL directa como fallback
        sent = await c.sock.sendMessage(c.from, { image: { url: ch.img }, caption: cap, mentions }, { quoted: c.m });
      }
    } else {
      sent = await c.reply(cap);
    }
  } catch { sent = await c.reply(cap); }
  if (sent?.key?.id) pend.set(sent.key.id, entry);
  prune();
}

async function showChar(c, ch) {
  const v = g.view(ch);
  const owners = Object.entries(g.G().users).filter(([, u]) => u.h[ch.id]).map(([n, u]) => `${nameOf(n)}${u.h[ch.id] > 1 ? ' x' + u.h[ch.id] : ''}`);
  const cap = g.card(v, [`Quien la tiene: ${owners.slice(0, 6).join(', ') || 'nadie todavia'}${owners.length > 6 ? ` (+${owners.length - 6})` : ''}`]);
  if (ch.img) { try { return await c.sock.sendMessage(c.from, { image: { url: ch.img }, caption: cap }, { quoted: c.m }); } catch {} }
  return c.reply(cap);
}

// Busca un personaje: primero local, si no en AniList
async function lookup(c, q) {
  await g.ensurePool();
  let hit = g.findByName(q)[0];
  if (!hit) {
    try { const r = await g.search(q); if (r.length) { g.addToPool(r); hit = r.find((x) => g.norm(x.name).includes(g.norm(q))) || r[0]; } } catch {}
  }
  return hit || null;
}

module.exports = [
  mk('roll', 'Tira el gacha: te sale una waifu con foto, rareza y valor', '', (c) => doRoll(c, 'F'), ['rw', 'tirar', 'rollwaifu', 'gacha', 'wroll']),
  mk('rollh', 'Tira el gacha pero de husbandos (chicos)', '', (c) => doRoll(c, 'M'), ['rollhusbando', 'hroll', 'husbandoroll']),
  mk('rollany', 'Tira el gacha de cualquier personaje (chica o chico)', '', (c) => doRoll(c, null), ['rollall', 'rollrandom']),

  mk('claim', 'Reclama la waifu que acaba de salir (responde a su mensaje)', '', async (c) => {
    prune();
    const e = (c.quoted?.id && pend.get(c.quoted.id)) || lastRoll.get(c.from);
    if (!e || e.done || Date.now() - e.t > 10 * 60 * 1000) return c.reply(`No hay nada para reclamar. Tira con ${c.prefix}roll`);
    const wait = 20000 - (Date.now() - e.t);
    if (e.by !== c.senderNum && wait > 0) return c.reply(`Esa tirada es de *${nameOf(e.by)}*: tiene prioridad ${Math.ceil(wait / 1000)}s mas.`);
    // Verificar si ya tiene dueño (sistema unico)
    const currentOwner = g.ownChar(e.char.id);
    if (currentOwner && currentOwner !== c.senderNum) {
      const ownerName = nameOf(currentOwner);
      return c.reply(`Esta waifu ya fue reclamada por @${currentOwner}.\nPuedes robarsela con ${c.prefix}robwaifu @usuario o comprarla en el mercado.`, { mentions: [`${currentOwner}@s.whatsapp.net`] });
    }
    e.done = true;
    const u = g.user(c.senderNum);
    g.give(u, e.char.id);
    g.claimOwnership(e.char.id, c.senderNum);
    db.save();
    const v = g.view(e.char);
    c.reply(`${c.pushName} reclamo a *${v.name}* (${v.rar.name} ${v.rar.star})\nValor: ${coin(v.value)}\nAhora eres el unico dueno de esta waifu.\nTotal en tu harem: ${g.total(u)}`);
  }, ['c', 'atrapar', 'capturar']),

  mk('harem', 'Tu coleccion de waifus (o la de otra persona)', '[pagina] [@usuario]', (c) => {
    const key = who(c) || c.senderNum;
    const u = g.user(key);
    const list = g.ownedList(u);
    if (!list.length) return c.reply(key === c.senderNum ? `Tu harem esta vacio. Tira con ${c.prefix}roll y reclama con ${c.prefix}claim` : `${nameOf(key)} no tiene personajes.`);
    const per = 10;
    const pages = Math.ceil(list.length / per);
    const p = Math.min(Math.max(parseInt(c.args.find((x) => /^\d+$/.test(x))) || 1, 1), pages);
    const sum = list.reduce((a, b) => a + b.value * b.n, 0);
    const rows = list.slice((p - 1) * per, p * per).map((x, i) => `#${(p - 1) * per + i + 1} ${x.rar.star} ${x.name}${x.n > 1 ? ' x' + x.n : ''} (${x.value.toLocaleString('es')})`);
    c.reply([`Harem de ${key === c.senderNum ? c.pushName : nameOf(key)}`, `Personajes: ${g.total(u)} (${list.length} unicos) | Valor total: ${sum.toLocaleString('es')}`, u.fav ? `Favorita: ${g.find(u.fav)?.name || '-'}` : '', '', ...rows, '', `Pagina ${p}/${pages}  |  ${c.prefix}harem ${Math.min(p + 1, pages)}`].filter((x) => x !== '').join('\n'));
  }, ['waifus', 'mywaifus', 'coleccion', 'mih']),

  mk('winfo', 'Informacion y foto de un personaje', '<nombre | #numero>', async (c) => {
    if (!c.q) return c.reply(`Escribe el nombre. Ej: ${c.prefix}winfo Zero Two`);
    const u = g.user(c.senderNum);
    const own = g.findOwned(u, c.q);
    const ch = own ? g.find(own.id) : await lookup(c, c.q);
    if (!ch) return c.reply('No encontre ese personaje.');
    await showChar(c, ch);
  }, ['waifuinfo', 'charinfo', 'wimage', 'wimg', 'wpic']),

  mk('searchwaifu', 'Busca personajes por nombre (en AniList)', '<nombre>', async (c) => {
    if (!c.q) return c.reply(`Ej: ${c.prefix}searchwaifu rem`);
    await g.ensurePool();
    let res = [];
    try { res = await g.search(c.q); g.addToPool(res); } catch { res = g.findByName(c.q).slice(0, 8); }
    if (!res.length) return c.reply('No encontre nada con ese nombre.');
    c.reply('Resultados:\n\n' + res.map((x, i) => { const v = g.view(x); return `${i + 1}. ${v.rar.star} ${v.name} - ${v.series || '-'} (${v.value.toLocaleString('es')})`; }).join('\n') + `\n\nVe uno con ${c.prefix}winfo <nombre>`);
  }, ['buscarwaifu', 'wsearch', 'wbuscar']),

  mk('sell', 'Vende un personaje de tu harem al bot (60% de su valor)', '<nombre | #numero>', (c) => {
    const u = g.user(c.senderNum);
    const it = g.findOwned(u, c.q);
    if (!it) return c.reply(`No tienes ese personaje. Mira tu lista con ${c.prefix}harem y usa el nombre o #numero.`);
    const price = Math.round(it.value * SELL_RATE);
    g.take(u, it.id);
    wallet(c.senderNum).coins += price;
    u.sold = (u.sold || 0) + 1;
    db.save();
    c.reply(`Vendiste a ${it.name} por ${coin(price)}.\nCartera: ${coin(wallet(c.senderNum).coins)}`);
  }, ['vender', 'wsell', 'sellwaifu']),

  mk('sellall', 'Vende de golpe las copias repetidas o todo lo de una rareza', 'dup | comun | rara | epica', (c) => {
    const u = g.user(c.senderNum);
    const mode = (c.args[0] || '').toLowerCase();
    const idx = ['comun', 'rara', 'epica'].indexOf(mode);
    if (mode !== 'dup' && idx < 0) return c.reply(`Uso:\n${c.prefix}sellall dup -> vende solo las copias repetidas\n${c.prefix}sellall comun|rara|epica -> vende todo de esa rareza (menos tu favorita)`);
    let money = 0, n = 0;
    for (const it of g.ownedList(u)) {
      if (it.id === u.fav) continue;
      if (mode === 'dup' && it.n > 1) { const k = it.n - 1; money += Math.round(it.value * SELL_RATE) * k; n += k; u.h[it.id] = 1; }
      else if (it.r === idx) { money += Math.round(it.value * SELL_RATE) * it.n; n += it.n; g.take(u, it.id, it.n); }
    }
    if (!n) return c.reply('No hay nada para vender con ese criterio.');
    wallet(c.senderNum).coins += money;
    u.sold = (u.sold || 0) + n;
    db.save();
    c.reply(`Vendiste ${n} personajes por ${coin(money)}.\nCartera: ${coin(wallet(c.senderNum).coins)}`);
  }, ['vendertodo', 'wsellall']),

  mk('release', 'Libera un personaje y recibe el 25% de su valor', '<nombre | #numero>', (c) => {
    const u = g.user(c.senderNum);
    const it = g.findOwned(u, c.q);
    if (!it) return c.reply('No tienes ese personaje.');
    const price = Math.round(it.value * 0.25);
    g.take(u, it.id);
    wallet(c.senderNum).coins += price;
    db.save();
    c.reply(`Dejaste ir a ${it.name}. Recibiste ${coin(price)}.`);
  }, ['liberar', 'divorce', 'divorcio']),

  mk('giftwaifu', 'Regala un personaje a otra persona', '@usuario <nombre | #numero>', (c) => {
    const to = who(c);
    if (!to || to === c.senderNum) return c.reply(`Menciona (o responde) a quien se lo das. Ej: ${c.prefix}giftwaifu @usuario Rem`);
    const q = c.args.filter((a) => !a.startsWith('@')).join(' ');
    const u = g.user(c.senderNum);
    const it = g.findOwned(u, q);
    if (!it) return c.reply('No tienes ese personaje.');
    g.take(u, it.id);
    g.give(g.user(to), it.id);
    db.save();
    c.reply(`Le regalaste a ${it.name} a ${nameOf(to)}.`);
  }, ['regalarwaifu', 'wgift', 'darwaifu']),

  mk('trade', 'Propone un intercambio: tu personaje por el suyo', '@usuario <el tuyo> | <el suyo>', (c) => {
    const other = who(c);
    if (!other || other === c.senderNum) return c.reply(`Uso: ${c.prefix}trade @usuario Rem | Zero Two\n(el tuyo primero, luego el suyo)`);
    const parts = c.args.filter((a) => !a.startsWith('@')).join(' ').split('|').map((x) => x.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) return c.reply(`Separa con | asi: ${c.prefix}trade @usuario <el tuyo> | <el suyo>`);
    const mine = g.findOwned(g.user(c.senderNum), parts[0]);
    const theirs = g.findOwned(g.user(other), parts[1]);
    if (!mine) return c.reply('No tienes el personaje que ofreces.');
    if (!theirs) return c.reply(`${nameOf(other)} no tiene ese personaje.`);
    trades.set(`${c.from}|${other}`, { a: c.senderNum, b: other, aId: mine.id, bId: theirs.id, t: Date.now() });
    c.reply(`Oferta para ${nameOf(other)}:\nTu das: ${mine.name} (${mine.value.toLocaleString('es')})\nTu recibes: ${theirs.name} (${theirs.value.toLocaleString('es')})\n\n${nameOf(other)}, responde con ${c.prefix}accepttrade o ${c.prefix}rejecttrade (3 min).`);
  }, ['intercambiar', 'wtrade', 'cambiarwaifu']),

  mk('accepttrade', 'Acepta el intercambio que te propusieron', '', (c) => {
    const k = `${c.from}|${c.senderNum}`;
    const t = trades.get(k);
    if (!t || Date.now() - t.t > 3 * 60 * 1000) { trades.delete(k); return c.reply('No tienes ninguna oferta pendiente.'); }
    const ua = g.user(t.a), ub = g.user(t.b);
    if (!ua.h[t.aId] || !ub.h[t.bId]) { trades.delete(k); return c.reply('Alguno ya no tiene el personaje. Oferta cancelada.'); }
    g.take(ua, t.aId); g.take(ub, t.bId);
    g.give(ua, t.bId); g.give(ub, t.aId);
    trades.delete(k);
    db.save();
    c.reply(`Intercambio hecho entre ${nameOf(t.a)} y ${nameOf(t.b)}.`);
  }, ['aceptartrade', 'wacept']),

  mk('rejecttrade', 'Rechaza el intercambio que te propusieron', '', (c) => {
    const k = `${c.from}|${c.senderNum}`;
    if (!trades.has(k)) return c.reply('No tienes ninguna oferta pendiente.');
    trades.delete(k);
    c.reply('Oferta rechazada.');
  }, ['rechazartrade', 'wreject']),

  mk('favwaifu', 'Marca tu personaje favorito (sale en tu perfil)', '<nombre | #numero>', (c) => {
    const u = g.user(c.senderNum);
    const it = g.findOwned(u, c.q);
    if (!it) return c.reply('No tienes ese personaje.');
    u.fav = it.id;
    db.save();
    c.reply(`${it.name} es ahora tu favorita. No se vende con ${c.prefix}sellall.`);
  }, ['fav', 'wfav', 'favorita']),

  mk('unfavwaifu', 'Quita tu favorita', '', (c) => { const u = g.user(c.senderNum); u.fav = null; db.save(); c.reply('Listo, ya no tienes favorita.'); }, ['unfav']),

  mk('team', 'Tu equipo de 3 para los duelos (por defecto, tus 3 mas valiosas)', 'add <nombre> | del <nombre> | clear', (c) => {
    const u = g.user(c.senderNum);
    const a = (c.args[0] || '').toLowerCase();
    const rest = c.args.slice(1).join(' ');
    if (a === 'add') {
      const it = g.findOwned(u, rest);
      if (!it) return c.reply('No tienes ese personaje.');
      if (u.team.includes(it.id)) return c.reply('Ya esta en tu equipo.');
      if (u.team.length >= 3) return c.reply('Tu equipo ya tiene 3. Quita uno con del.');
      u.team.push(it.id); db.save(); return c.reply(`${it.name} entro al equipo.`);
    }
    if (a === 'del' || a === 'quitar') { const it = g.findOwned(u, rest); if (!it) return c.reply('No tienes ese personaje.'); u.team = u.team.filter((x) => x !== it.id); db.save(); return c.reply(`${it.name} salio del equipo.`); }
    if (a === 'clear') { u.team = []; db.save(); return c.reply('Equipo reiniciado (se usan tus 3 mas valiosas).'); }
    const t = g.teamOf(u);
    if (!t.length) return c.reply('Aun no tienes personajes.');
    c.reply('Tu equipo de duelo:\n' + t.map((x, i) => `${i + 1}. ${x.rar.star} ${x.name} - poder ${Math.round(g.power(x))}`).join('\n') + `\n\nPoder total: ${Math.round(t.reduce((s, x) => s + g.power(x), 0))}\nCambialo con ${c.prefix}team add <nombre>`);
  }, ['equipo', 'wteam']),

  mk('duelwaifu', 'Duelo de equipos de waifus contra otra persona (con apuesta opcional)', '@usuario [apuesta]', (c) => {
    const other = who(c);
    if (!other || other === c.senderNum) return c.reply(`Menciona a alguien. Ej: ${c.prefix}duelwaifu @usuario 500`);
    const me = g.user(c.senderNum), op = g.user(other);
    const left = (me.duelAt || 0) + 2 * 60000 - Date.now();
    if (left > 0) return c.reply(`Descansa ${mins(left)} antes de otro duelo.`);
    const A = g.teamOf(me), B = g.teamOf(op);
    if (!A.length) return c.reply('No tienes personajes para pelear.');
    if (!B.length) return c.reply(`${nameOf(other)} no tiene personajes.`);
    const bet = Math.max(0, parseInt(c.args.find((x) => /^\d+$/.test(x))) || 0);
    if (bet > wallet(c.senderNum).coins) return c.reply('No tienes tantas monedas para apostar.');
    me.duelAt = Date.now();
    const roll = (t) => t.reduce((s, x) => s + g.power(x) * (U.rand(75, 125) / 100), 0);
    const pa = roll(A), pb = roll(B);
    const win = pa >= pb;
    const wn = win ? c.senderNum : other, ln = win ? other : c.senderNum;
    let prize = 0;
    if (bet) { const lw = wallet(ln); prize = Math.min(bet, lw.coins); lw.coins -= prize; wallet(wn).coins += prize; }
    else { prize = 120; wallet(wn).coins += prize; }
    (win ? me : op).wins = ((win ? me : op).wins || 0) + 1;
    (win ? op : me).losses = ((win ? op : me).losses || 0) + 1;
    db.save();
    c.reply(`DUELO\n\n${c.pushName}: ${A.map((x) => x.name).join(', ')} (${Math.round(pa)})\n${nameOf(other)}: ${B.map((x) => x.name).join(', ')} (${Math.round(pb)})\n\nGana ${win ? c.pushName : nameOf(other)} y se lleva ${coin(prize)}.`);
  }, ['wduel', 'waifubattle', 'pelear']),

  mk('wpower', 'Poder de combate de tu equipo (o de otra persona)', '[@usuario]', (c) => {
    const key = who(c) || c.senderNum;
    const t = g.teamOf(g.user(key));
    if (!t.length) return c.reply('Sin personajes todavia.');
    c.reply(`Poder de ${key === c.senderNum ? c.pushName : nameOf(key)}: ${Math.round(t.reduce((s, x) => s + g.power(x), 0))}\n` + t.map((x) => `- ${x.name} (${Math.round(g.power(x))})`).join('\n'));
  }, ['poder', 'wpoder']),

  mk('rolls', 'Cuantas tiradas te quedan y cuando se renuevan', '', (c) => {
    const u = g.user(c.senderNum);
    g.refill(u);
    c.reply(`Tiradas: ${u.rolls}/${g.ROLLS_PER_HOUR} (+${u.bonus} extra)\nSe renuevan en ${mins(u.reset - Date.now())}\nCompra mas: ${c.prefix}buyrolls <n>  |  Regalo diario: ${c.prefix}gdaily`);
  }, ['tiradas', 'wrolls']),

  mk('buyrolls', 'Compra tiradas extra (400 monedas cada una, maximo 10)', '<cantidad>', (c) => {
    const n = Math.min(10, Math.max(1, parseInt(c.args[0]) || 1));
    const w = wallet(c.senderNum);
    const cost = n * 400;
    if (w.coins < cost) return c.reply(`Necesitas ${coin(cost)}. Tienes ${coin(w.coins)}.`);
    w.coins -= cost;
    g.user(c.senderNum).bonus += n;
    db.save();
    c.reply(`Compraste ${n} tiradas por ${coin(cost)}.\nExtra disponibles: ${g.user(c.senderNum).bonus}`);
  }, ['comprartiradas', 'wbuyrolls']),

  mk('gdaily', 'Regalo diario del gacha: 3 tiradas extra y monedas', '', (c) => {
    const u = g.user(c.senderNum);
    const left = (u.gd || 0) + 20 * 3600000 - Date.now();
    if (left > 0) return c.reply(`Ya lo reclamaste. Vuelve en ${mins(left)}.`);
    u.gd = Date.now();
    u.bonus += 3;
    const coins = U.rand(150, 400);
    wallet(c.senderNum).coins += coins;
    db.save();
    c.reply(`Regalo diario: +3 tiradas y ${coin(coins)}.\nExtra disponibles: ${u.bonus}`);
  }, ['gachadaily', 'wdaily', 'regalogacha']),

  mk('gachatop', 'Ranking: quien tiene MAS waifus', '', (c) => {
    const rows = Object.entries(g.G().users).map(([n, u]) => [n, g.total(u), g.uniq(u)]).filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 10);
    if (!rows.length) return c.reply(`Todavia nadie tiene personajes. Empieza con ${c.prefix}roll`);
    const medal = ['①', '②', '③'];
    c.reply('TOP COLECCIONISTAS (mas waifus)\n\n' + rows.map(([n, t, u], i) => `${medal[i] || (i + 1) + '.'} ${nameOf(n)} - ${t} personajes (${u} unicos)`).join('\n'));
  }, ['topwaifus', 'topgacha', 'wtop', 'topcoleccion']),

  mk('gachavalue', 'Ranking: coleccion mas valiosa', '', (c) => {
    const rows = Object.entries(g.G().users).map(([n, u]) => [n, g.ownedList(u).reduce((s, x) => s + x.value * x.n, 0)]).filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!rows.length) return c.reply('Todavia nadie tiene personajes.');
    c.reply('TOP VALOR DE COLECCION\n\n' + rows.map(([n, v], i) => `${i + 1}. ${nameOf(n)} - ${coin(v)}`).join('\n'));
  }, ['topvalor', 'wvalue']),

  mk('topcharacters', 'Los personajes mas valiosos del gacha', '', async (c) => {
    if (!(await needPool(c))) return;
    const list = g.G().pool.slice().sort((a, b) => b.fav - a.fav).slice(0, 12).map(g.view);
    c.reply('PERSONAJES MAS VALIOSOS\n\n' + list.map((x, i) => `${i + 1}. ${x.rar.star} ${x.name} - ${x.series || '-'} (${x.value.toLocaleString('es')})`).join('\n'));
  }, ['topchars', 'masvaliosos']),

  mk('gperfil', 'Tu perfil del gacha: coleccion, rarezas, duelos', '[@usuario]', (c) => {
    const key = who(c) || c.senderNum;
    const u = g.user(key);
    const list = g.ownedList(u);
    const by = [0, 0, 0, 0, 0];
    for (const x of list) by[x.r] += x.n;
    const best = list[0];
    const fav = u.fav ? g.find(u.fav) : null;
    c.reply([
      `Perfil gacha de ${key === c.senderNum ? c.pushName : nameOf(key)}`,
      `Personajes: ${g.total(u)} (${list.length} unicos)`,
      `Valor total: ${coin(list.reduce((s, x) => s + x.value * x.n, 0))}`,
      `Mitica ${by[4]} | Legendaria ${by[3]} | Epica ${by[2]} | Rara ${by[1]} | Comun ${by[0]}`,
      best ? `Mejor: ${best.rar.star} ${best.name} (${best.value.toLocaleString('es')})` : '',
      fav ? `Favorita: ${fav.name}` : '',
      `Duelos: ${u.wins || 0} ganados / ${u.losses || 0} perdidos`,
      `Vendidos: ${u.sold || 0}`,
    ].filter(Boolean).join('\n'));
  }, ['gachaperfil', 'wperfil', 'gprofile']),

  mk('rarities', 'Explica las rarezas, probabilidades y valores', '', (c) => {
    c.reply('RAREZAS DEL GACHA\n\n' + g.RAR.slice().reverse().map((r) => `${r.star} ${r.name}: ${r.w}% de salir | valen ${r.min.toLocaleString('es')} a ${r.max.toLocaleString('es')}`).join('\n') + '\n\nLa rareza depende de los favoritos del personaje en AniList: mientras mas querido, mas raro y mas caro.');
  }, ['rarezas', 'wrarezas']),

  mk('waifulist', 'Lista de personajes del gacha por rareza', '[mitica|legendaria|epica|rara|comun] [pagina]', async (c) => {
    if (!(await needPool(c))) return;
    const k = (c.args[0] || '').toLowerCase();
    const idx = g.RAR.findIndex((r) => r.k === k.replace('é', 'e').replace('í', 'i'));
    const list = g.G().pool.map(g.view).filter((x) => idx < 0 || x.r === idx).sort((a, b) => b.value - a.value);
    const per = 15, pages = Math.max(1, Math.ceil(list.length / per));
    const p = Math.min(Math.max(parseInt(c.args.find((x) => /^\d+$/.test(x))) || 1, 1), pages);
    c.reply(`PERSONAJES ${idx >= 0 ? g.RAR[idx].name.toUpperCase() + 'S' : '(todos)'} - ${list.length}\n\n` + list.slice((p - 1) * per, p * per).map((x) => `${x.rar.star} ${x.name} (${x.value.toLocaleString('es')})`).join('\n') + `\n\nPagina ${p}/${pages}`);
  }, ['wlist', 'personajes', 'listawaifus']),

  mk('wshop', 'Tienda del gacha: 6 personajes que cambian cada hora', '', async (c) => {
    if (!(await needPool(c))) return;
    const items = shopItems();
    const left = 3600000 - (Date.now() % 3600000);
    c.reply('TIENDA DEL GACHA\n\n' + items.map((x, i) => `${i + 1}. ${x.rar.star} ${x.name} - ${x.series || '-'}\n   Precio: ${coin(Math.round(x.value * 1.8))}`).join('\n') + `\n\nCompra con ${c.prefix}buywaifu <numero>\nSe renueva en ${mins(left)}`);
  }, ['tienda', 'waifushop', 'gshop']),

  mk('buywaifu', 'Compra un personaje de la tienda', '<numero>', async (c) => {
    if (!(await needPool(c))) return;
    const n = parseInt(c.args[0]);
    const items = shopItems();
    if (!n || !items[n - 1]) return c.reply(`Elige un numero del 1 al ${items.length}. Mira la tienda con ${c.prefix}wshop`);
    const it = items[n - 1];
    const u = g.user(c.senderNum);
    const hour = Math.floor(Date.now() / 3600000);
    const key = `${hour}-${it.id}`;
    if (u.bought[key]) return c.reply('Ya compraste ese personaje en esta tanda de la tienda.');
    const price = Math.round(it.value * 1.8);
    const w = wallet(c.senderNum);
    if (w.coins < price) return c.reply(`Cuesta ${coin(price)} y tienes ${coin(w.coins)}.`);
    w.coins -= price;
    g.give(u, it.id);
    u.bought = Object.fromEntries(Object.entries(u.bought).filter(([k]) => k.startsWith(hour + '-')));
    u.bought[key] = 1;
    db.save();
    c.reply(`Compraste a ${it.name} (${it.rar.name}) por ${coin(price)}.`);
  }, ['comprarwaifu', 'wbuy']),

  mk('sellmarket', 'Pone un personaje a la venta en el mercado entre usuarios', '<nombre | #numero> <precio>', (c) => {
    const price = parseInt([...c.args].reverse().find((x) => /^\d+$/.test(x)));
    const q = c.args.slice(0, c.args.lastIndexOf(String(price))).join(' ');
    if (!price || price < 10) return c.reply(`Uso: ${c.prefix}sellmarket Rem 5000`);
    const u = g.user(c.senderNum);
    const it = g.findOwned(u, q);
    if (!it) return c.reply('No tienes ese personaje.');
    g.take(u, it.id);
    const G = g.G();
    const id = G.mid++;
    G.market.push({ id, seller: c.senderNum, char: it.id, price, t: Date.now() });
    db.save();
    c.reply(`${it.name} esta en el mercado por ${coin(price)} (oferta #${id}).`);
  }, ['listar', 'wlistar', 'ponerenventa']),

  mk('market', 'Mercado de personajes entre usuarios', '[pagina]', (c) => {
    const G = g.G();
    if (!G.market.length) return c.reply(`El mercado esta vacio. Vende con ${c.prefix}sellmarket <nombre> <precio>`);
    const per = 10, pages = Math.ceil(G.market.length / per);
    const p = Math.min(Math.max(parseInt(c.args[0]) || 1, 1), pages);
    c.reply('MERCADO\n\n' + G.market.slice((p - 1) * per, p * per).map((o) => { const x = g.find(o.char); const v = x ? g.view(x) : null; return `#${o.id} ${v ? v.rar.star + ' ' + v.name : o.char} - ${coin(o.price)} (${nameOf(o.seller)})`; }).join('\n') + `\n\nPagina ${p}/${pages} | Compra: ${c.prefix}buymarket <#>`);
  }, ['mercado', 'wmarket']),

  mk('buymarket', 'Compra una oferta del mercado', '<numero de oferta>', (c) => {
    const id = parseInt(String(c.args[0] || '').replace('#', ''));
    const G = g.G();
    const o = G.market.find((x) => x.id === id);
    if (!o) return c.reply('Esa oferta no existe.');
    if (o.seller === c.senderNum) return c.reply('Es tuya. Usa unlist para retirarla.');
    const w = wallet(c.senderNum);
    if (w.coins < o.price) return c.reply(`Cuesta ${coin(o.price)} y tienes ${coin(w.coins)}.`);
    w.coins -= o.price;
    wallet(o.seller).coins += Math.round(o.price * 0.95); // 5% de comision
    G.market = G.market.filter((x) => x !== o);
    g.give(g.user(c.senderNum), o.char);
    db.save();
    c.reply(`Compraste a ${g.find(o.char)?.name || o.char} por ${coin(o.price)}.\nEl vendedor recibio ${coin(Math.round(o.price * 0.95))} (5% de comision).`);
  }, ['comprarmercado', 'wbuymarket']),

  mk('unlist', 'Retira tu oferta del mercado', '<numero de oferta>', (c) => {
    const id = parseInt(String(c.args[0] || '').replace('#', ''));
    const G = g.G();
    const o = G.market.find((x) => x.id === id && x.seller === c.senderNum);
    if (!o) return c.reply('No encontre una oferta tuya con ese numero.');
    G.market = G.market.filter((x) => x !== o);
    g.give(g.user(c.senderNum), o.char);
    db.save();
    c.reply(`Retiraste la oferta #${id}. ${g.find(o.char)?.name || ''} volvio a tu harem.`);
  }, ['wunlist', 'retirarventa']),

  mk('guesswaifu', 'Adivina el personaje por su foto y gana monedas', '', async (c) => {
    if (!(await needPool(c))) return;
    const withImg = g.G().pool.filter((x) => x.img);
    if (!withImg.length) return c.reply('Ahora mismo no hay fotos disponibles para jugar.');
    const ch = withImg[Math.floor(Math.random() * withImg.length)];
    const v = g.view(ch);
    guesses.set(c.from, { ch, v, t: Date.now() });
    const first = ch.name.split(' ')[0];
    const cap = `ADIVINA EL PERSONAJE\n\nSerie: ${ch.series || '?'}\nPista: empieza con "${ch.name[0]}" y tiene ${ch.name.replace(/\s/g, '').length} letras\nResponde con ${c.prefix}gw <nombre> (60 s)\nPremio: ${coin(80 * (v.r + 1) + 40)}`;
    try { await c.sock.sendMessage(c.from, { image: { url: ch.img }, caption: cap }, { quoted: c.m }); } catch { await c.reply(cap + `\n(la foto no cargo; su nombre empieza con ${first[0]})`); }
    setTimeout(() => { const g0 = guesses.get(c.from); if (g0 && g0.ch === ch) { guesses.delete(c.from); c.sock.sendMessage(c.from, { text: `Se acabo el tiempo. Era ${ch.name}.` }).catch(() => {}); } }, 60000).unref?.();
  }, ['adivinawaifu', 'wquiz', 'whoisthis']),

  mk('gw', 'Responde al juego guesswaifu', '<nombre>', (c) => {
    const s = guesses.get(c.from);
    if (!s || Date.now() - s.t > 60000) return c.reply(`No hay juego activo. Empieza con ${c.prefix}guesswaifu`);
    if (!c.q) return c.reply('Escribe tu respuesta.');
    const a = g.norm(c.q), real = g.norm(s.ch.name);
    const toks = real.split(' ').filter((t) => t.length > 2);
    if (a === real || (a.length >= 3 && toks.includes(a)) || (a.length >= 4 && real.includes(a))) {
      guesses.delete(c.from);
      const prize = 80 * (s.v.r + 1) + 40;
      wallet(c.senderNum).coins += prize;
      db.save();
      return c.reply(`Correcto, era ${s.ch.name}.\n${c.pushName} gana ${coin(prize)}.`);
    }
    c.reply('No es ese. Sigue intentando.');
  }, ['gwaifu', 'respwaifu']),

  mk('wrandom', 'Te muestra un personaje al azar (sin gastar tirada)', '', async (c) => {
    if (!(await needPool(c))) return;
    const ch = g.pick(null);
    if (!ch) return c.reply('Sin personajes por ahora.');
    await showChar(c, ch);
  }, ['personajerandom', 'wrand']),

  mk('gachahelp', 'Guia rapida del gacha', '', (c) => {
    const p = c.prefix;
    c.reply([
      'GUIA DEL GACHA',
      `${p}roll -> sale una waifu (5 tiradas por hora; ${p}rollh = chicos)`,
      `${p}claim -> te la quedas (responde al mensaje; el que tira tiene 20 s de prioridad)`,
      `${p}harem -> tu coleccion | ${p}winfo <nombre> -> foto y datos`,
      `${p}sell / ${p}sellall -> vender por monedas`,
      `${p}giftwaifu / ${p}trade -> regalar o intercambiar`,
      `${p}wshop / ${p}market -> comprar personajes`,
      `${p}duelwaifu @user -> pelea de equipos | ${p}team -> tu equipo`,
      `${p}guesswaifu -> adivina por la foto y gana monedas`,
      `${p}gachatop -> quien tiene mas waifus`,
      `${p}gdaily -> regalo diario | ${p}rarities -> probabilidades`,
    ].join('\n'));
  }, ['wayuda', 'gachaayuda']),

  // ── Owner ──
  mk('gachapool', 'Recarga la lista de personajes desde AniList', '', async (c) => {
    await c.reply('Recargando personajes desde AniList...');
    let n;
    try { n = await g.buildPool(); } catch (e) { return c.reply(`AniList no respondio (${U.friendlyError(e).slice(0, 100)}). Sigue la lista actual: ${g.G().pool.length}.`); }
    c.reply(`Listo: ${n} personajes cargados.`);
  }, ['wpool', 'gachareload'], { owner: true }),

  mk('givewaifu', 'Da un personaje a alguien (owner)', '@usuario <nombre>', async (c) => {
    const to = who(c) || c.senderNum;
    const q = c.args.filter((a) => !a.startsWith('@') && !/^\d{6,}$/.test(a)).join(' ');
    const ch = q ? await lookup(c, q) : null;
    if (!ch) return c.reply('No encontre ese personaje.');
    g.give(g.user(to), ch.id);
    db.save();
    c.reply(`${ch.name} entregado a ${nameOf(to)}.`);
  }, ['wgive'], { owner: true, hidden: true }),

  mk('gachareset', 'Borra el gacha de un usuario (owner)', '@usuario', (c) => {
    const to = who(c);
    if (!to) return c.reply('Menciona a quien reiniciar.');
    delete g.G().users[to];
    db.save();
    c.reply(`Gacha de ${nameOf(to)} reiniciado.`);
  }, ['wreset'], { owner: true }),

  // ── ROBWAIFU: robar una waifu a otro usuario (20 min CD) ──
  mk('robwaifu', 'Intenta robar una waifu a otro usuario', '@usuario [nombre|#numero]', async (c) => {
    const target = who(c);
    if (!target || target === c.senderNum) return c.reply(`Menciona a quien robar. Ej: ${c.prefix}robwaifu @usuario`);
    const now = Date.now();
    const lastRob = robCooldown.get(c.senderNum) || 0;
    const waitRob = lastRob + ROB_CD - now;
    if (waitRob > 0) return c.reply(`Cooldown: espera *${mins(waitRob)}* para volver a robar.`);
    const tu = g.user(c.senderNum);
    const tgt = g.user(target);
    const tgtList = g.ownedList(tgt);
    if (!tgtList.length) return c.reply(`${nameOf(target)} no tiene waifus para robar.`);
    // Elige una waifu al azar del objetivo
    const picked = tgtList[Math.floor(Math.random() * Math.min(tgtList.length, 10))];
    // Probabilidad de robo: 50% base, -10% por cada diferencia de rareza a favor del objetivo
    const rarDiff = picked.r - (g.ownedList(tu)[0]?.r ?? 0);
    const prob = Math.max(0.15, 0.5 - rarDiff * 0.1);
    robCooldown.set(c.senderNum, now);
    if (Math.random() > prob) {
      // Fallo: pierde una waifu propia aleatoria como penalizacion
      const myList = g.ownedList(tu);
      if (myList.length > 0 && Math.random() < 0.4) {
        const lost = myList[Math.floor(Math.random() * Math.min(myList.length, 5))];
        g.take(tu, lost.id);
        g.releaseOwnership(lost.id);
        db.save();
        return c.reply(`El robo fallo y te atraparon. Perdiste a *${lost.name}* como penalizacion.`);
      }
      return c.reply(`El robo fallo. ${nameOf(target)} te cachó en el intento (cooldown: 20 min).`);
    }
    // Exito
    g.take(tgt, picked.id);
    g.give(tu, picked.id);
    g.transferOwnership(picked.id, c.senderNum);
    db.save();
    c.reply(`Robo exitoso! *${picked.name}* (${picked.rar.name}) ahora es tuya.\nRobada de *${nameOf(target)}* ♡`);
  }, ['robarwaifu', 'steal', 'robar']),

  // ── VOTAR por una waifu: sube su valor y rareza ──
  mk('votar', 'Vota por una waifu para subir su valor', '<nombre>', async (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}votar <nombre de waifu>\nEj: ${c.prefix}votar Ellen Joe`);
    if (!(await needPool(c))) return;
    let ch = g.findByName(c.q)[0];
    if (!ch) {
      try { const r = await g.search(c.q); if (r.length) { g.addToPool(r); ch = r[0]; } } catch {}
    }
    if (!ch) return c.reply(`No encontre a "${c.q}" en el pool. Asegurate de escribir bien el nombre.`);
    const ok = g.voteFor(ch.id, c.senderNum);
    if (!ok) return c.reply(`Ya votaste por *${ch.name}* antes. Solo se puede votar una vez por personaje.`);
    const v = g.view(g.find(ch.id) || ch);
    const totalV = g.getVotes(ch.id);
    c.reply(`Voto registrado por *${ch.name}*!\nVotos totales: ${totalV}\nValor actual: ${coin(v.value)}\nCada voto sube el valor y la dificultad de conseguirla.`);
  }, ['vote', 'votarwaifu']),

  mk('topvotos', 'Waifus con mas votos', '', async (c) => {
    if (!(await needPool(c))) return;
    const top = g.topVoted(10);
    if (!top.length) return c.reply('Aun no hay votos.');
    c.reply('*TOP WAIFUS POR VOTOS* ♛\n\n' +
      top.map((x, i) => `${i + 1}. ${x.rar.star} ${x.name} - ${x.votes} votos - ${coin(x.value)}`).join('\n'));
  }, ['topvotes', 'masvotos']),

  // ── TIENDAGACHA: waifus disponibles para comprar ──
  mk('tiendagacha', 'Muestra waifus disponibles para comprar (sin dueño)', '', async (c) => {
    if (!(await needPool(c))) return;
    const free = g.freeChars();
    if (!free.length) return c.reply('No hay waifus libres en este momento. Todas tienen dueno.');
    // Ordenar por valor y mostrar 12
    const sorted = free
      .map(ch => g.view(ch))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    const lines = sorted.map((v, i) =>
      `${i + 1}. ${v.rar.star} *${v.name}* (${v.series || '-'})\n   Rareza: ${v.rar.name} | Precio: ${coin(Math.round(v.value * 1.5))}`
    );
    c.reply([
      '*TIENDA GACHA - Waifus Libres*',
      'Estas waifus no tienen dueno. Consiguelas con .rw o compralas:',
      '',
      ...lines,
      '',
      `Usa ${c.prefix}buywaifu <nombre> para comprar directamente`,
      `Hay ${free.length} waifus libres en total`,
    ].join('\n'));
  }, ['shopgacha', 'waifushop', 'gachashop', 'wfree']),

  mk('waifulibre', 'Verifica si una waifu tiene dueno', '<nombre>', async (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}waifulibre <nombre>`);
    if (!(await needPool(c))) return;
    const ch = g.findByName(c.q)[0] || (await g.search(c.q).catch(() => []))[0];
    if (!ch) return c.reply(`No encontre a "${c.q}".`);
    const owner = g.ownChar(ch.id);
    const v = g.view(ch);
    if (owner) {
      c.reply(`*${v.name}* ya fue reclamada por @${owner}.\nPuedes: robarsela con ${c.prefix}robwaifu o esperar que la liberen.`, { mentions: [`${owner}@s.whatsapp.net`] });
    } else {
      c.reply(`*${v.name}* esta libre! Nadie la ha reclamado.\nConsieguala con ${c.prefix}rw o compra directa con ${c.prefix}buywaifu ${c.q}`);
    }
  }, ['checkwaifu', 'waifulibre', 'estaocupada']),
];

// Tienda: 6 personajes que cambian cada hora (mismos para todos)
function shopItems() {
  const hour = Math.floor(Date.now() / 3600000);
  const pool = g.G().pool.slice().sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return [];
  let s = hour * 2654435761 % 4294967296;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const out = [];
  const tries = Math.min(pool.length, 60);
  for (let i = 0; i < tries && out.length < 6; i++) {
    const ch = pool[Math.floor(rnd() * pool.length)];
    if (!out.some((x) => x.id === ch.id)) out.push(g.view(ch));
  }
  return out;
}
