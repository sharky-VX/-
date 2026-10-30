const { normalizeMessageContent, jidNormalizedUser } = require('@whiskeysockets/baileys');
const config = require('../config');
const db = require('./db');
const loader = require('./loader');
const U = require('./utils');
const media = require('./media');
const ownerLib = require('./owner');
const decor = require('./decor');
const antispam = require('./antispam');
const dedupe = require('./dedupe');
const state = require('./state');

const numOf = (jid) => (jid || '').split('@')[0].split(':')[0];

function getContent(m) {
  return normalizeMessageContent(m.message) || {};
}

function getText(m) {
  const c = getContent(m);
  return (
    c.conversation ||
    c.extendedTextMessage?.text ||
    c.imageMessage?.caption ||
    c.videoMessage?.caption ||
    c.buttonsResponseMessage?.selectedButtonId ||
    c.templateButtonReplyMessage?.selectedId ||
    (() => { try { return JSON.parse(c.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}').id; } catch { return ''; } })() ||
    c.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

function getContextInfo(m) {
  const c = getContent(m);
  for (const v of Object.values(c)) if (v && typeof v === 'object' && v.contextInfo) return v.contextInfo;
  return {};
}

function getQuoted(ci) {
  if (!ci.quotedMessage) return null;
  const q = normalizeMessageContent(ci.quotedMessage) || {};
  return {
    sender: ci.participant,
    id: ci.stanzaId,
    message: ci.quotedMessage,
    text: q.conversation || q.extendedTextMessage?.text || q.imageMessage?.caption || q.videoMessage?.caption || '',
  };
}

// Compara un JID con la lista de participantes (soporta número normal, LID y phoneNumber)
// Normaliza cualquier id de participante a un set de claves comparables
function idKeys(jid) {
  if (!jid) return new Set();
  const s = String(jid);
  const n = numOf(s);
  const keys = new Set([s, s.split(':')[0], s.split('@')[0], n].filter(Boolean));
  if (n && n.length >= 8) {
    keys.add(n.slice(-10));
    keys.add(n.slice(-8));
  }
  return keys;
}
function samePerson(a, b) {
  const A = idKeys(a), B = idKeys(b);
  for (const k of A) if (B.has(k)) return true;
  return false;
}
function findParticipant(md, jid) {
  if (!md?.participants || !jid) return null;
  return md.participants.find((p) =>
    [p.id, p.phoneNumber, p.lid].filter(Boolean).some((x) => samePerson(x, jid))
  ) || null;
}
function isAdminJid(md, jid) {
  const p = findParticipant(md, jid);
  return !!(p && p.admin); // 'admin' | 'superadmin'
}
function botAdminIn(md, sock) {
  if (!md?.participants || !sock?.user) return false;
  const candidates = [sock.user.id, sock.user.lid, sock.user.phoneNumber].filter(Boolean);
  // Tambien el jid "limpio" sin :device
  for (const c of [...candidates]) {
    if (typeof c === 'string' && c.includes(':')) candidates.push(c.split(':')[0] + '@s.whatsapp.net');
  }
  for (const c of candidates) {
    if (isAdminJid(md, c)) return true;
  }
  // Ultimo recurso: buscar participante cuyo id contenga el numero del bot
  const botN = numOf(sock.user.id);
  if (botN) {
    for (const p of md.participants) {
      if (!p.admin) continue;
      for (const x of [p.id, p.phoneNumber, p.lid]) {
        if (x && String(x).includes(botN)) return true;
        if (x && botN.includes(numOf(x)) && numOf(x).length >= 8) return true;
      }
    }
  }
  return false;
}

const lastCmd = new Map();

// ── ¿Solo grupos? (por defecto SÍ: en privado el bot no responde nada, así se evitan baneos) ──
const groupsOnly = () => (db.data.groupsOnly ?? config.groupsOnly ?? true) !== false;

// ── Bot principal por grupo (.setprimary): si hay uno elegido y está en línea, solo ese contesta ──
const botNum = (raw) => numOf(raw?.user?.id);
function botOnline(n) {
  const mainN = botNum(state.mainSock);
  if (mainN && mainN === n) return true;
  try { return require('./subbots').list().some((x) => x.num === n && x.status === 'online'); } catch { return false; }
}
function isPrimaryFor(raw, from) {
  const p = db.data.chats[from]?.primary;
  if (!p) return true; // sin primario: responden todos
  const me = botNum(raw);
  if (p === me) return true;
  return !botOnline(p); // si el primario está desconectado, contestan los demás
}

// Comandos que cambian datos compartidos (dinero, gacha, juegos, ajustes, admin de grupo...): los ejecuta UN bot
// y los otros repiten sus respuestas. Los de solo consulta (menú, descargas, IA, imágenes...) los ejecutan todos.
const STATELESS_CATS = new Set(['ai', 'downloads', 'media', 'tools', 'info', 'text', 'fonts', 'convert', 'math', 'fun', 'anime', 'extra', 'quality']);
const STATELESS_MAIN = new Set(['menu', 'ping', 'speedtest', 'runtime', 'owner', 'botinfo', 'sysinfo', 'prefijos', 'api', 'sig', 'pagina', 'bots']);
const isStateful = (cmd) => (cmd.stateful !== undefined ? !!cmd.stateful
  : cmd.category === 'main' ? !STATELESS_MAIN.has(cmd.name) && !/^menu/.test(cmd.name)
  : !STATELESS_CATS.has(cmd.category));

// Prefijo del mensaje. '' = modo "none" (sin prefijo): vale si la primera palabra es un comando de verdad.
const NONE_SKIP = new Set(['a', 'e', 'o', 'y', 'p', 'x', 'si', 'no', 'ok', 'hola', 'que', 'como', 'yo', 'tu', 'el', 'la', 'de', 'en', 'un', 'mi', 'me', 'te', 'se', 'es', 'ya', 'jaja', 'jeje']);
function matchPrefix(text, list) {
  const real = list.filter(Boolean);
  const hit = real.find((p) => text.startsWith(p));
  if (hit !== undefined) return hit;
  if (!list.includes('')) return undefined;
  const words = text.trim().split(/\s+/);
  const first = U.strip((words[0] || '').toLowerCase());
  // Comando real registrado (p, ping, hug...): modo none OK aunque sea 1 letra
  if (first && loader.find(first)) return '';
  if (first.length < 2 || words.length > 12 || NONE_SKIP.has(first)) return undefined;
  return undefined;
}

async function handleMessage(sock, m) {
  const sub = sock.isSub === true;
  if (!m.message || m.key.remoteJid === 'status@broadcast') return;
  const startedAt = Date.now();
  const from = m.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const sender = jidNormalizedUser(m.key.fromMe ? sock.user.id : m.key.participant || from);
  const senderNum = numOf(sender);
  const text = getText(m);
  if (!isGroup && groupsOnly()) return; // el bot solo trabaja en grupos
  // primary: se aplica mas abajo solo a comandos con estado (menu/ping siempre OK)
  const ids = ownerLib.idsOf(m, sender);
  let isOwner = ownerLib.quick(m, sender, !sub);
  const isSubOwner = sub && !!m.key.fromMe && !isOwner; // dueño del sub bot: usa los comandos, pero no los de owner del bot principal
  // Recuerda el nombre de cada persona (Miku lo usa para saber quién es quién)
  if (m.pushName && !m.key.fromMe) { (db.data.names ||= {})[senderNum] = m.pushName; }

  const deco = { v: '', rec: null }; // nombre del comando en curso: título del marco
  const raw = sock;
  sock = decor.proxy(raw, deco); // todo lo que mande un comando sale con el marco de Miku
  const reply = (t, opts = {}) => sock.sendMessage(from, { text: String(t), ...opts }, { quoted: m });
  const replyPlain = (t) => raw.sendMessage(from, { text: decor.clean(String(t)) }, { quoted: m }); // sin marco (charla de Miku)
  // Las reacciones se mandan en segundo plano: el comando no espera la red para empezar
  const react = (e) => {
    if (db.data.reactions ?? config.reactions) sock.sendMessage(from, { react: { text: e, key: m.key } }).catch(() => {});
    return Promise.resolve();
  };

  let meta = null;
  const getMeta = async () => {
    if (meta) return meta;
    meta = sock.groupCache?.get(from) || (await sock.groupMetadata(from));
    sock.groupCache?.set(from, meta);
    return meta;
  };

  // ── Funciones de grupo: contador de mensajes, silenciados, antilink ──
  if (isGroup && !m.key.fromMe) {
    const chat = db.chat(from);
    if (dedupe.once(m, 'count')) { chat.msgs[senderNum] = (chat.msgs[senderNum] || 0) + 1; require('./memory').push(from, m.pushName || senderNum, text); db.save(); }

    if (chat.muted.includes(senderNum) && !isOwner) {
      if (dedupe.once(m, 'mute')) { try { await sock.sendMessage(from, { delete: m.key }); } catch {} }
      return;
    }

    if (text && chat.antilink && !isOwner && /chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(text)) {
      try {
        const md = await getMeta();
        const botIds = [sock.user.id, sock.user.lid].filter(Boolean);
        if (botIds.some((b) => isAdminJid(md, b)) && !isAdminJid(md, sender) && dedupe.once(m, 'antilink')) {
          await sock.sendMessage(from, { delete: m.key });
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
          return reply('Antilink: sin enlaces de grupos.');
        }
      } catch {}
    }




    // ── Antispam: detecta mensajes repetidos del mismo usuario ──
    if (text && chat.antispam && !isOwner && dedupe.once(m, 'spamcheck')) {
      const spamKey = `spam:${from}:${senderNum}`;
      const spamLog = (db.data._spam ||= {});
      const sl = (spamLog[spamKey] ||= []);
      const now = Date.now();
      sl.push({ t: now, txt: text.slice(0, 60) });
      // Mantener solo los ultimos 60s
      const cutoff = now - 60000;
      while (sl.length && sl[0].t < cutoff) sl.shift();
      // Si 4+ mensajes en 30s con el mismo texto → spam
      const recent = sl.filter(x => x.t > now - 30000);
      const sameText = recent.filter(x => x.txt === text.slice(0, 60));
      if (sameText.length >= 4) {
        try {
          const md = await getMeta();
          const botIds = [sock.user.id, sock.user.lid].filter(Boolean);
          if (botIds.some((b) => isAdminJid(md, b))) {
            await sock.sendMessage(from, { delete: m.key });
            delete spamLog[spamKey];
            reply(`Antispam: @${senderNum} detectado haciendo spam.`, { mentions: [sender] });
          }
        } catch {}
      }
    }
  }

  const mode = db.data.mode || config.mode;
  // WhatsApp a veces manda un ID interno (LID) en vez del número: se une con la lista del grupo
  // (solo se hace cuando hace falta: comandos o modo privado)
  const prefixes = require('./prefix').list();
  const prefix = matchPrefix(text, prefixes);
  if (!isOwner && text && (mode === 'self' || /^\s*prefijos?\s*$/i.test(text) || prefix !== undefined)) {
    isOwner = await ownerLib.resolve(sock, ids, isGroup, getMeta);
  }
  if (mode === 'self' && !isOwner && !isSubOwner) return;
  if (!isOwner && db.data.banned.includes(senderNum)) return;
  if (!isOwner && db.data.bannedChats.includes(from)) return;

  const ci = getContextInfo(m);
  const quoted = getQuoted(ci);

  const makeCtx = (prefix, command, q, args) => ({
    sock, m, from, sender, senderNum, isGroup, isOwner,
    pushName: m.pushName || 'usuario',
    text, q, args, prefix, command, startedAt, config, db,
    quoted, quotedText: quoted?.text || '',
    mentioned: ci.mentionedJid || [],
    isAdmin: async () => {
      if (isOwner || isSubOwner) return true;
      if (!isGroup) return false;
      try {
        const md = await raw.groupMetadata(from).catch(() => getMeta());
        if (findParticipant(md, sender)?.admin) return true;
        return ids.some((i) => isAdminJid(md, i));
      } catch { return false; }
    },
    botIsAdmin: async () => {
      if (!isGroup) return false;
      try {
        const md = await raw.groupMetadata(from).catch(() => getMeta());
        return botAdminIn(md, raw);
      } catch { return false; }
    },
    getMeta, reply, replyPlain, react, decoTitle: deco, ids, isSub: sub, isSubOwner,
    // Texto largo → se parte en varios mensajes automáticamente
    replyLong: async (t) => {
      for (const part of U.chunkText(String(t), 3500)) await reply(part);
    },
    replyLongPlain: async (t) => {
      for (const part of U.chunkText(String(t), 3500)) await replyPlain(part);
    },
    sendImage: (img, caption = '') =>
      sock.sendMessage(from, { image: Buffer.isBuffer(img) ? img : { url: img }, caption }, { quoted: m }),
    sendVideo: (vid, caption = '') =>
      sock.sendMessage(from, { video: Buffer.isBuffer(vid) ? vid : { url: vid }, caption }, { quoted: m }),
    sendGif: (vid, caption = '') =>
      sock.sendMessage(from, { video: Buffer.isBuffer(vid) ? vid : { url: vid }, caption, gifPlayback: true }, { quoted: m }),
    sendAudio: (aud, ptt = false) =>
      sock.sendMessage(
        from,
        { audio: Buffer.isBuffer(aud) ? aud : { url: aud }, mimetype: ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg', ptt },
        { quoted: m }
      ),
    sendSticker: (buf) => sock.sendMessage(from, { sticker: buf }, { quoted: m }),
    sendFile: (file, fileName, mimetype) =>
      sock.sendMessage(from, { document: Buffer.isBuffer(file) ? file : { url: file }, fileName, mimetype }, { quoted: m }),
    sendMentions: (t, mentions) => sock.sendMessage(from, { text: t, mentions }, { quoted: m }),
    // Descarga la imagen/video/audio/sticker del mensaje (o del mensaje respondido)
    getMedia: (kinds) => media.getMedia(sock, m, quoted, kinds),
  });

  // El owner siempre puede preguntar el prefijo escribiendo solo "prefijo"
  if (isOwner && /^prefijos?$/i.test(text.trim())) return reply(`Prefijo actual: ${prefixes.map((p) => p || '(sin prefijo)').join('   ')}`);

  const body = prefix === undefined ? '' : text.slice(prefix.length).trim();
  const rawCmd = body.split(/\s+/)[0];
  const command = U.strip(rawCmd.toLowerCase());
  const cmd = body ? loader.find(command) : null;
  if (prefix === undefined || !cmd) {
    // Sin comando: Miku puede responder si el autorresponder está activo (un solo bot por mensaje)
    if (text && !m.key.fromMe && dedupe.once(m, 'miku')) {
      const mikuEnabled = !isGroup || db.chat(from).mikuOn !== false;
      if (mikuEnabled) {
        try { await require('./miku').auto(makeCtx('', '', text, text.split(/\s+/))); } catch (e) { console.error('Miku auto:', e?.message || e); }
      }
      // Ellen Joe auto
      try { await require('./ellen').auto(makeCtx('', '', text, text.split(/\s+/))); } catch (e) { console.error('Ellen auto:', e?.message || e); }
    }
    return;
  }
  deco.v = cmd.name;

  // Anti-spam / rate-limit (protege la cuenta del ban)
  try {
    if (!isOwner && !isSubOwner) {
      const as = antispam.checkCommand(senderNum, cmd.name, false);
      if (!as.ok) {
        if (as.notify) {
          const msg = antispam.messageFor(as, senderNum);
          if (msg) reply(msg, { mentions: [sender] }).catch(() => {});
        }
        return;
      }
      if (!antispam.checkChat(from).ok || !antispam.checkGlobalSend().ok) return;
      antispam.markCommand(senderNum, false);
      antispam.markChat(from);
      antispam.markSend();
      const delay = antispam.humanDelay();
      if (delay > 0) await U.sleep(delay);
    } else {
      antispam.markSend();
    }
  } catch (e) { console.error('antispam:', e?.message || e); }



  if (!isOwner && !isSubOwner) {
    const now = Date.now();
    const ck = botNum(raw) + '|' + senderNum; // el cooldown es de cada bot: los dos pueden contestar al mismo mensaje
    if (now - (lastCmd.get(ck) || 0) < config.cooldownMs) return;
    lastCmd.set(ck, now);
  }

  const q = body.slice(rawCmd.length).trim();
  const args = q ? q.split(/\s+/) : [];
  console.log(`[CMD] ${prefix}${cmd.name} <- ${senderNum}${isGroup ? ' (grupo)' : ''}${isOwner ? ' (owner)' : ''}${sub ? ' [sub ' + sock.subNumber + ']' : ''}`);

  // Solo admins del grupo pueden usar comandos (si onlyAdmin ON)
  if (isGroup && db.chat(from).onlyAdmin && !isOwner && !isSubOwner) {
    try {
      const md = await getMeta();
      const ok = ids.some((i) => isAdminJid(md, i)) || isAdminJid(md, sender);
      if (!ok) return; // silencio: solo admins
    } catch {}
  }
  // Solo el bot primario ejecuta comandos con estado; menu/ping/descargas los puede cualquiera
  // Solo el bot primario responde en el grupo (todos los comandos)
  if (isGroup && !isPrimaryFor(sock, from)) return;
  if (cmd.owner && !isOwner) return reply('Este comando es solo para el owner.');
  // nsfw on/off siempre disponible; el resto de NSFW se bloquea si está off
  if (cmd.category === 'nsfw' && isGroup && !['nsfwtoggle', 'nsfw', 'menu2'].includes(cmd.name)) {
    const ch = db.chat(from);
    if (ch.nsfwOn === false) return reply('NSFW desactivado en este grupo. Un admin: ' + (prefix || '.') + 'nsfw on');
  }

  if (cmd.group && !isGroup) return reply('Este comando solo funciona en grupos.');

  // ── Enforcement: economía/gacha/miku desactivados en este grupo ──
  if (isGroup && !isOwner) {
    const ch = db.chat(from);
    const cat = cmd.category;
    if (cat === 'economy' && ch.economyOn === false) return reply('❌ La economía está desactivada en este grupo.\nUn admin puede activarla con .economia on');
    if (cat === 'gacha' && ch.gachaOn === false) return reply('❌ El gacha está desactivado en este grupo.\nUn admin puede activarlo con .gachact on');
    if (cat === 'ai' && ch.mikuOn === false && (cmd.name === 'miku' || cmd.name === 'ia' || cmd.aliases?.includes('miku'))) return reply('❌ Miku está desactivada en este grupo.\nUn admin puede activarla con .miku on');
  }
  if (cmd.admin || cmd.botAdmin) {
    let md;
    try {
      md = await raw.groupMetadata(from);
      raw.groupCache?.set(from, md);
      meta = md;
    } catch {
      md = await getMeta();
    }
    // Ampliar ids del remitente con los del participante del grupo (LID <-> numero)
    const mePart = findParticipant(md, sender);
    if (mePart) {
      for (const x of [mePart.id, mePart.phoneNumber, mePart.lid]) {
        if (x) ids.push(numOf(x));
      }
    }
    if (cmd.admin && !isOwner && !isSubOwner) {
      const userOk = ids.some((i) => isAdminJid(md, i)) || isAdminJid(md, sender);
      if (!userOk) return reply('Solo admins del grupo.');
    }
    if (cmd.botAdmin) {
      let ok = botAdminIn(md, raw);
      if (!ok) {
        try {
          await U.sleep(500);
          md = await raw.groupMetadata(from);
          raw.groupCache?.set(from, md);
          meta = md;
        } catch {}
        ok = botAdminIn(md, raw);
      }
      if (!ok) {
        return reply('Necesito ser admin del grupo para hacer eso.\nSi me acabas de dar admin, espera 5 segundos y reintenta.');
      }
    }
  }

  // Comando con estado y otro bot del grupo ya lo está ejecutando: espero y repito sus mismas respuestas con mi cuenta
  let run = null;
  if (isGroup && isStateful(cmd)) {
    const b = dedupe.begin(m, cmd.name);
    if (!b.first) {
      await Promise.race([b.entry.done, U.sleep(120000)]).catch(() => {});
      for (const out of b.entry.out) { try { await raw.sendMessage(from, out, { quoted: m }); } catch {} }
      if (raw.subEntry) raw.subEntry.cmd++;
      return;
    }
    run = b.entry;
    deco.rec = run.out;
  }

  const ctx = makeCtx(prefix, command, q, args);
  if (raw.subEntry) { raw.subEntry.cmd++; raw.subEntry.err = ''; }

  const u = db.user(senderNum);
  if (dedupe.once(m, 'acct')) {
    db.data.stats.commands++;
    // El banco cobra solo (impuestos, intereses, préstamos vencidos) y avisa una vez al día
    try {
      const ev = require('./bank').accrue(u);
      if (ev.length && !m.key.fromMe) await raw.sendMessage(from, { text: decor.wrap('Movimientos del banco:\n' + ev.map((e) => '- ' + e).join('\n'), 'banco') }, { quoted: m });
    } catch (e) { console.error('Banco:', e?.message || e); }
    u.commands++;
    u.xp += U.rand(1, 3);
    db.save();
  }

  try {
    await cmd.run(ctx);
  } catch (e) {
    console.error(`Error en ${prefix}${cmd.name}:`, e?.message || e);
    if (raw.subEntry) raw.subEntry.err = `${cmd.name}: ${String(e?.message || e).slice(0, 80)}`;
    reply(`Error en *${prefix}${cmd.name}*: ${U.friendlyError(e).slice(0, 250)}`).catch(() => {});
  } finally {
    if (run) { deco.rec = null; run.finish(); }
  }
}

const fillMsg = (tpl, jid, md) =>
  String(tpl || '')
    .replace(/@user/gi, '@' + numOf(jid))
    .replace(/\{group\}/gi, md.subject || 'el grupo')
    .replace(/\{members\}/gi, String(md.participants?.length || 0))
    .replace(/\{desc\}/gi, (md.desc || '').slice(0, 200));

const ELLEN_WELCOME = [
  'Respeta las reglas del grupo. No me hagas trabajar de mas... pero si es necesario, sere rapida y letal. ── Ellen Joe',
  'Entra, pero respeta el territorio. Las reglas no son opcionales. ── Ellen Joe',
  'Bienvenido. Cumple las normas y no habra problemas... de lo contrario, sere letal. ── Ellen Joe',
];
const ELLEN_BYE = [
  'Se fue... espero que haya respetado el grupo mientras estuvo. ── Ellen Joe',
  'Hasta luego. El grupo sigue su curso. ── Ellen Joe',
];

async function profilePicBuf(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, 'image');
    if (!url) return null;
    const U = require('./utils');
    return await U.getBuffer(url, { timeout: 12000 });
  } catch {
    return null;
  }
}

async function sendWelcomeCard(sock, id, jid, md, chat) {
  const user = '@' + numOf(jid);
  const members = md.participants?.length || 0;
  const custom = (chat.welcomeMsg || '').trim();
  const body = custom
    ? fillMsg(custom, jid, md)
    : [
        '   ❀ 𓆩 ʙɪᴇɴᴠᴇɴɪᴅᴀ 𓆪 ❀',
        '',
        '  Hola ' + user + ', bienvenido a la elite.',
        '  Grupo ── *' + (md.subject || '') + '*',
        '  Miembros ── *' + members + '*',
        '',
        '  Respeta las reglas del grupo.',
        '  Se amable, sin spam y sin links sospechosos.',
        '',
        '> 𓆩☪︎𓆪 "' + ELLEN_WELCOME[Math.floor(Math.random() * ELLEN_WELCOME.length)] + '"',
        '   ❀',
      ].join('\n');

  const pic = await profilePicBuf(sock, jid);
  try {
    if (pic) {
      await sock.sendMessage(id, { image: pic, caption: body, mentions: [jid] });
    } else {
      await sock.sendMessage(id, { text: body, mentions: [jid] });
    }
  } catch (e) {
    console.error('welcome send:', e?.message || e);
    try { await sock.sendMessage(id, { text: body, mentions: [jid] }); } catch {}
  }
}

async function sendByeCard(sock, id, jid, md, chat) {
  const user = '@' + numOf(jid);
  const custom = (chat.byeMsg || '').trim();
  const body = custom
    ? fillMsg(custom, jid, md)
    : [
        '   ❀ 𓆩 ᴅᴇsᴘᴇᴅɪᴅᴀ 𓆪 ❀',
        '',
        '  ' + user + ' salio de *' + (md.subject || 'el grupo') + '*',
        '  Miembros ── *' + (md.participants?.length || 0) + '*',
        '',
        '> 𓆩☪︎𓆪 "' + ELLEN_BYE[Math.floor(Math.random() * ELLEN_BYE.length)] + '"',
        '   ❀',
      ].join('\n');

  const pic = await profilePicBuf(sock, jid);
  try {
    if (pic) {
      await sock.sendMessage(id, { image: pic, caption: body, mentions: [jid] });
    } else {
      await sock.sendMessage(id, { text: body, mentions: [jid] });
    }
  } catch (e) {
    console.error('bye send:', e?.message || e);
    try { await sock.sendMessage(id, { text: body, mentions: [jid] }); } catch {}
  }
}

async function handleGroupUpdate(sock, { id, participants, action }) {
  if (action !== 'add' && action !== 'remove') return;
  if (!isPrimaryFor(sock, id)) return;
  const tag = `${action}-${participants.map((p) => (typeof p === 'string' ? p : p.id)).join(',')}`;
  if (!dedupe.once({ key: { remoteJid: id, id: tag + '-' + Math.floor(Date.now() / 20000) } }, 'welcome')) return;
  const chat = db.chat(id);
  let md;
  try {
    md = sock.groupCache?.get(id) || (await sock.groupMetadata(id));
  } catch (e) {
    console.error('welcome meta:', e?.message || e);
    return;
  }
  for (const p of participants) {
    const jid = typeof p === 'string' ? p : p.id;
    try {
      if (action === 'add' && chat.welcome) await sendWelcomeCard(sock, id, jid, md, chat);
      if (action === 'remove' && chat.bye) await sendByeCard(sock, id, jid, md, chat);
    } catch (e) {
      console.error('welcome/bye:', e?.message || e);
    }
  }
}

module.exports = { handleMessage, handleGroupUpdate, isPrimaryFor, groupsOnly, botNum };
