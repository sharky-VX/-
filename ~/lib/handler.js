const { normalizeMessageContent, jidNormalizedUser } = require('@whiskeysockets/baileys');
const config = require('../config');
const db = require('./db');
const loader = require('./loader');
const U = require('./utils');
const media = require('./media');
const ownerLib = require('./owner');
const decor = require('./decor');
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
function isAdminJid(md, jid) {
  const n = numOf(jid);
  return md.participants.some(
    (p) => p.admin && [p.id, p.phoneNumber, p.lid].filter(Boolean).some((x) => numOf(x) === n)
  );
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
  if (first.length < 2 || words.length > 12 || NONE_SKIP.has(first)) return undefined;
  return loader.find(first) ? '' : undefined;
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
  if (isGroup && !isPrimaryFor(sock, from)) return; // hay otro bot primario en este grupo
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
    isAdmin: async () => { // ¿quien escribe es admin del grupo? (o dueño)
      if (isOwner || isSubOwner) return true;
      if (!isGroup) return false;
      try { const md = await getMeta(); return ids.some((i) => isAdminJid(md, i)); } catch { return false; }
    },
    botIsAdmin: async () => {
      if (!isGroup) return false;
      try { const md = await getMeta(); return [raw.user?.id, raw.user?.lid].filter(Boolean).some((b) => isAdminJid(md, b)); } catch { return false; }
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
    }
    return;
  }
  deco.v = cmd.name;

  if (!isOwner && !isSubOwner) {
    const now = Date.now();
    const ck = botNum(raw) + '|' + senderNum; // el cooldown es de cada bot: los dos pueden contestar al mismo mensaje
    if (now - (lastCmd.get(ck) || 0) < config.cooldownMs) return;
    lastCmd.set(ck, now);
  }

  const q = body.slice(rawCmd.length).trim();
  const args = q ? q.split(/\s+/) : [];
  console.log(`[CMD] ${prefix}${cmd.name} <- ${senderNum}${isGroup ? ' (grupo)' : ''}${isOwner ? ' (owner)' : ''}${sub ? ' [sub ' + sock.subNumber + ']' : ''}`);

  if (cmd.owner && !isOwner) return reply('Este comando es solo para el owner.');
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
    const md = await getMeta();
    if (cmd.admin && !isOwner && !isSubOwner && !ids.some((i) => isAdminJid(md, i))) return reply('Solo admins del grupo.');
    if (cmd.botAdmin) {
      const ok = [raw.user?.id, raw.user?.lid].filter(Boolean).some((b) => isAdminJid(md, b));
      if (!ok) return reply('Necesito ser admin del grupo para hacer eso.');
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
  tpl.replace(/@user/gi, '@' + numOf(jid)).replace(/\{group\}/gi, md.subject).replace(/\{members\}/gi, md.participants.length);

async function handleGroupUpdate(sock, { id, participants, action }) {
  if (action !== 'add' && action !== 'remove') return;
  if (!isPrimaryFor(sock, id)) return;
  const tag = `${action}-${participants.map((p) => (typeof p === 'string' ? p : p.id)).join(',')}`;
  if (!dedupe.once({ key: { remoteJid: id, id: tag + '-' + Math.floor(Date.now() / 20000) } }, 'welcome')) return;
  const chat = db.chat(id);
  const md = sock.groupCache?.get(id) || (await sock.groupMetadata(id));
  for (const p of participants) {
    const jid = typeof p === 'string' ? p : p.id;
    if (action === 'add' && chat.welcome) {
      const tpl = chat.welcomeMsg || `Bienvenido/a @user a *{group}*\n\n${md.desc ? md.desc.slice(0, 300) : 'Disfruta tu estadia'}`;
      await sock.sendMessage(id, { text: fillMsg(tpl, jid, md), mentions: [jid] });
    }
    if (action === 'remove' && chat.bye) {
      const tpl = chat.byeMsg || '@user salio de *{group}*';
      await sock.sendMessage(id, { text: fillMsg(tpl, jid, md), mentions: [jid] });
    }
  }
}

module.exports = { handleMessage, handleGroupUpdate, isPrimaryFor, groupsOnly, botNum };
