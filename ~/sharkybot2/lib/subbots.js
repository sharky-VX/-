const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
  default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion,
  Browsers, makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const config = require('../config');
const db = require('./db');

// ═══════════════════════════════════════════════
//  SUB BOTS: cualquier miembro vincula SU número y el bot corre con una sesión propia.
//  - Cada sub bot tiene su carpeta (sessions/sub-<número>), su socket, su caché y su propio reintento:
//    si uno se cae o se desincroniza, el principal y los demás ni se enteran.
//  - Usa los mismos comandos. El dueño del sub bot (su propio número) usa todo menos los comandos
//    de owner del bot principal. Los owners del bot principal siguen siendo owners en todos los sub bots.
// ═══════════════════════════════════════════════
const logger = pino({ level: 'silent' });
const ROOT = path.join(process.cwd(), 'sessions');
const subs = new Map(); // número → entrada
const PAIR_TIMEOUT = 3 * 60 * 1000;

db.data.subbots ||= {};
const max = () => Number(config.subbots?.max ?? 10);
const enabled = () => (db.data.subbotsOn ?? config.subbots?.enabled ?? true) !== false;
const dirOf = (n) => path.join(ROOT, `sub-${n}`);
const num = (j) => String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const cleanup = (s) => {
  try { s.ev.removeAllListeners(); } catch {}
  try { s.end(undefined); } catch {}
};
const wipe = (n) => {
  try { fs.rmSync(dirOf(n), { recursive: true, force: true }); } catch {}
  delete db.data.subbots[n];
  db.save();
};

function remember(e, m) {
  if (m?.key?.id && m.message) {
    e.store.set(m.key.id, m.message);
    if (e.store.size > 1000) e.store.delete(e.store.keys().next().value);
  }
}

async function connect(e) {
  if (e.stopped || e.connecting) return;
  e.connecting = true;
  try {
    fs.mkdirSync(e.dir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(e.dir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
    if (e.sock) cleanup(e.sock);
    const sock = makeWASocket({
      version, logger,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.macOS('Chrome'),
      markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 30000, connectTimeoutMs: 60000, defaultQueryTimeoutMs: 60000,
      getMessage: async (key) => e.store.get(key.id),
    });
    sock.isSub = true;
    sock.subNumber = e.num;
    sock.subEntry = e; // el handler cuenta aquí los comandos (se ve con .bots)
    sock.groupCache = e.groupCache;
    e.sock = sock;

    if (!state.creds.registered && e.pairing && !e.codeAsked) {
      e.codeAsked = true;
      const phone = String(e.num).replace(/\D/g, '');
      const FIXED_CODE = 'SHARKNEX';
      let pairDone = false;
      const askPair = async (reason) => {
        if (pairDone || e.stopped) return;
        pairDone = true;
        console.log(`[SUB ${phone}] pair ready (${reason}) → pidiendo ${FIXED_CODE}`);
        try {
          let got;
          try {
            got = await sock.requestPairingCode(phone, FIXED_CODE);
          } catch (e1) {
            console.log(`[SUB ${phone}] fijo fallo:`, e1?.message || e1);
            got = await sock.requestPairingCode(phone);
          }
          const clean = String(got || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const use = clean.length === 8 ? clean : FIXED_CODE;
          // Si WhatsApp acepto SHARKNEX, mostrar SHAR-KNEX (mismo formato que el principal)
          const code = use === FIXED_CODE ? 'SHAR-KNEX' : (use.slice(0, 4) + '-' + use.slice(4));
          console.log(`[SUB ${phone}] CODIGO: ${code}` + (use === FIXED_CODE ? ' (fijo OK)' : ' (WhatsApp dio otro)'));
          e.resolveCode?.(code);
        } catch (err) {
          pairDone = false;
          console.log(`[SUB ${phone}] error:`, err?.message || err);
          e.rejectCode?.(err);
        }
      };
      // Igual que el principal: esperar qr/connecting (si pides antes = codigo muerto)
      sock.ev.on('connection.update', (u) => {
        if (pairDone) return;
        if (u.qr || u.connection === 'connecting') {
          setTimeout(() => { askPair(u.qr ? 'qr' : 'connecting').catch(() => {}); }, 3000);
        }
      });
      // respaldo
      setTimeout(() => { askPair('timeout').catch(() => {}); }, 12000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (e.sock !== sock) return;
      if (connection === 'open') {
        e.retries = 0;
        e.status = 'online';
        e.since = Date.now();
        e.ids = [num(sock.user?.id), num(sock.user?.lid), e.num].filter(Boolean); // para que el bot principal no atienda los mensajes de este sub bot
        db.data.subbots[e.num] = { ...(db.data.subbots[e.num] || {}), registered: true, created: db.data.subbots[e.num]?.created || Date.now() };
        db.save();
        clearTimeout(e.pairTimer);
        console.log(`[SUB ${e.num}] conectado`);
        if (e.pairing) { e.pairing = false; Promise.resolve(e.notify?.(`Sub bot conectado. El numero +${e.num} ya usa el bot con su propia sesion. Prefijo: ${require('./prefix').list().join(' ')}`)).catch(() => {}); }
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        e.status = 'offline';
        e.lastCode = code;
        if (code === DisconnectReason.loggedOut) e.loggedOut = true;
        if (e.stopped) return;
        if ([DisconnectReason.loggedOut, DisconnectReason.badSession, DisconnectReason.forbidden].includes(code)) {
          console.log(`[SUB ${e.num}] sesión cerrada (código ${code}): se elimina`);
          Promise.resolve(e.notify?.(`El sub bot de +${e.num} se cerro (la sesion fue cerrada desde el telefono). Vuelve a vincularlo con .code`)).catch(() => {});
          return stop(e.num, { wipe: true });
        }
        if (code === DisconnectReason.connectionReplaced) {
          console.log(`[SUB ${e.num}] conexión reemplazada: otra instancia usa esa cuenta`);
          return stop(e.num, { keep: true });
        }
        const delay = code === DisconnectReason.restartRequired ? 0 : Math.min(3000 * ++e.retries, 30000);
        cleanup(sock);
        e.connecting = false;
        setTimeout(() => connect(e), delay);
      }
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      for (const m of messages) remember(e, m);
      // 'notify' = mensajes nuevos. 'append' solo se acepta si es un mensaje propio y reciente
      // (algunos teléfonos mandan así lo que el dueño escribe desde su celular).
      const fresh = (m) => Date.now() / 1000 - Number(m.messageTimestamp?.low ?? m.messageTimestamp ?? 0) < 30;
      if (type !== 'notify' && !(type === 'append' && messages.some((m) => m.key?.fromMe && fresh(m)))) return;
      const { handleMessage } = require('./handler');
      for (const m of messages) {
        if (type === 'append' && !(m.key?.fromMe && fresh(m))) continue;
        if (!m.message) continue;
        e.rx++;
        e.lastRx = Date.now();
        // Responde a la vez que el bot principal (el handler evita repetir efectos y respeta .setprimary)
        handleMessage(sock, m).catch((err) => { e.err = String(err?.message || err).slice(0, 120); console.error(`[SUB ${e.num}] error en mensaje:`, err?.message || err); });
      }
    });

    const refresh = async (id) => { try { e.groupCache.set(id, await sock.groupMetadata(id)); } catch {} };
    sock.ev.on('groups.update', ([u]) => u?.id && refresh(u.id));
    sock.ev.on('group-participants.update', (u) => {
      refresh(u.id);
      require('./handler').handleGroupUpdate(sock, u).catch(() => {});
    });
  } catch (err) {
    console.error(`[SUB ${e.num}] fallo al conectar:`, err?.message || err);
    e.rejectCode?.(err);
    if (!e.stopped) setTimeout(() => { e.connecting = false; connect(e); }, Math.min(5000 * ++e.retries, 60000));
  } finally {
    e.connecting = false;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Cierra la sesión en WhatsApp DE VERDAD: manda la orden de quitar el dispositivo y espera la respuesta
// (sock.logout() de Baileys cierra el socket sin esperar, y a veces WhatsApp ni la recibe).
async function hardLogout(sock) {
  const jid = sock?.authState?.creds?.me?.id;
  if (!jid) return false;
  const node = { tag: 'iq', attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'md' }, content: [{ tag: 'remove-companion-device', attrs: { jid, reason: 'user_initiated' } }] };
  try {
    await sock.query(node, 12000);
    return true;
  } catch (err) {
    // Al quitar el dispositivo WhatsApp corta la conexión: eso también significa que funcionó
    if (/closed|lost|401|logged|removed|terminated/i.test(String(err?.message || err))) return true;
  }
  try { await Promise.race([sock.logout(), wait(8000)]); return true; } catch { return false; }
}

// Detiene un sub bot. Con logout:true cierra la sesión en WhatsApp y devuelve 'ok' | 'already' | 'offline' | 'fail'.
async function stop(n, { wipe: doWipe = false, logout = false, keep = false } = {}) {
  const e = subs.get(n);
  let how = 'none';
  if (e) {
    clearTimeout(e.pairTimer);
    if (logout) {
      if (e.status === 'online' && e.sock?.ws?.isOpen !== false) {
        const sent = await hardLogout(e.sock);
        if (sent) {
          for (let i = 0; i < 20 && !e.loggedOut; i++) await wait(250); // espera la confirmación (cierre 401)
          how = 'ok';
        } else how = 'fail';
      } else how = 'offline'; // no hay conexión viva: se intenta desde el disco (unlinkOffline)
    }
    e.stopped = true;
    if (e.sock) cleanup(e.sock);
    subs.delete(n);
  }
  if (doWipe) wipe(n);
  return logout ? how : (!!e || doWipe);
}

// Desvincula un sub bot que no está conectado: abre la sesión guardada solo para cerrarla en WhatsApp.
// Devuelve 'ok' | 'already' | 'none' | 'timeout' | 'fail'.
async function unlinkOffline(n, { wipeAfter = true } = {}) {
  const dir = dirOf(n);
  let reg = false;
  try { reg = JSON.parse(fs.readFileSync(path.join(dir, 'creds.json'), 'utf8')).registered === true; } catch {}
  if (!reg) { if (wipeAfter) wipe(n); return 'none'; }
  let sock;
  let result = 'timeout';
  try {
    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
    sock = makeWASocket({
      version, logger,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.macOS('Chrome'), markOnlineOnConnect: false, syncFullHistory: false,
    });
    sock.ev.on('creds.update', saveCreds);
    result = await new Promise((resolve) => {
      const t = setTimeout(() => resolve('timeout'), 40000);
      sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
          const ok = await hardLogout(sock).catch(() => false);
          clearTimeout(t);
          resolve(ok ? 'ok' : 'fail');
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if ([DisconnectReason.loggedOut, DisconnectReason.badSession, DisconnectReason.forbidden].includes(code)) { clearTimeout(t); resolve('already'); }
        }
      });
    });
  } catch { result = 'fail'; }
  if (sock) cleanup(sock);
  if (wipeAfter) wipe(n);
  return result;
}

// Desvincula pase lo que pase (con el sub bot conectado, caído o solo guardado en disco).
// Devuelve 'ok' | 'already' | 'none' | 'timeout' | 'fail'.
async function remove(n) {
  const creds = path.join(dirOf(n), 'creds.json');
  const saved = fs.existsSync(creds);
  let how;
  if (subs.has(n)) {
    how = await stop(n, { logout: true });
    if (how === 'ok') { wipe(n); }
    else how = await unlinkOffline(n); // no había conexión viva: lo cierro desde el disco
  } else {
    how = await unlinkOffline(n);
  }
  wipe(n);
  setTimeout(() => wipe(n), 8000).unref?.(); // por si algo alcanzó a reescribir la carpeta
  db.data.subDeleted ||= {};
  db.data.subDeleted[n] = Date.now();
  db.save();
  if (how === 'none' && saved) how = 'fail';
  return how;
}

const entry = (n, extra = {}) => ({
  num: n, dir: dirOf(n), sock: null, status: 'connecting', retries: 0, store: new Map(), groupCache: new Map(),
  stopped: false, connecting: false, since: 0, ids: [n], rx: 0, cmd: 0, lastRx: 0, err: '', ...extra,
});

// Vincula un nuevo sub bot. Devuelve el código de 8 letras.
function create(n, notify) {
  if (!enabled()) return Promise.reject(new Error('Los sub bots estan desactivados por el owner.'));
  if (db.data.subDeleted) delete db.data.subDeleted[n];
  if (subs.has(n)) return Promise.reject(new Error('Ese numero ya es un sub bot (usa .delsubbot para quitarlo).'));
  if (subs.size >= max()) return Promise.reject(new Error(`Ya hay ${max()} sub bots (el maximo). Pide al owner que quite alguno.`));
  const main = require('./owner').num(config.owner.number);
  if (n === main) return Promise.reject(new Error('Ese es el numero del owner.'));
  wipe(n); // empieza limpio
  const e = entry(n, { pairing: true, notify });
  subs.set(n, e);
  db.data.subbots[n] = { registered: false, created: Date.now() };
  db.save();
  return new Promise((resolve, reject) => {
    e.resolveCode = resolve;
    e.rejectCode = (err) => { stop(n, { wipe: true }); reject(err); };
    e.pairTimer = setTimeout(() => {
      if (e.status !== 'online') {
        stop(n, { wipe: true });
        Promise.resolve(notify?.(`Se vencio el codigo del sub bot +${n}. Si no alcanzaste, pide otro con .code`)).catch(() => {});
      }
    }, PAIR_TIMEOUT);
    connect(e);
  });
}

// Al iniciar el bot principal: levanta los sub bots que ya estaban vinculados
async function restoreAll() {
  fs.mkdirSync(ROOT, { recursive: true });
  for (const n of Object.keys(db.data.subbots)) {
    let ok = false;
    try { ok = JSON.parse(fs.readFileSync(path.join(dirOf(n), 'creds.json'), 'utf8')).registered === true; } catch {}
    if (!ok || db.data.subDeleted?.[n]) { wipe(n); continue; }
    if (subs.has(n)) continue;
    const e = entry(n);
    subs.set(n, e);
    connect(e);
    await new Promise((r) => setTimeout(r, 2500)); // de a uno, sin saturar
  }
  if (subs.size) console.log(`🤖 ${subs.size} sub bot(s) restaurados`);
}

const list = () => [...subs.values()].map((e) => ({ num: e.num, status: e.status, since: e.since, rx: e.rx, cmd: e.cmd, lastRx: e.lastRx, err: e.err }));
const has = (n) => subs.has(n);
// ¿este JID (o LID) es de la cuenta de algún sub bot? (el bot principal ignora esos mensajes en grupos: los atiende el sub bot)
const isSubId = (jid) => { const n = num(jid); return !!n && [...subs.values()].some((e) => e.status === 'online' && e.ids.includes(n)); };

const sockOf = (n) => subs.get(n)?.sock || null;
module.exports = { sockOf, create, stop, unlinkOffline, remove, restoreAll, list, has, isSubId, enabled, max, num };
