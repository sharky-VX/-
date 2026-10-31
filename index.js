const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs');

require('./lib/lock').acquire(); // una sola instancia por carpeta

const config = require('./config');
let adminApi;
try {
  adminApi = require('./lib/adminApi');
} catch {
  // Termux / installs sin panel admin
  adminApi = {
    setLinkPhase() {},
    setPairingCode() {},
    clearPairingCode() {},
  };
}
const db = require('./lib/db');
const loader = require('./lib/loader');
const { handleMessage, handleGroupUpdate } = require('./lib/handler');
const { startApi } = require('./api/server');

// ── Filtro de ruido: libsignal imprime stacks enormes con "Bad MAC" ──
let badMac = 0, lastHint = 0;
const origErr = console.error.bind(console);
const DECRYPT_NOISE = /Failed to decrypt message|Session error|decrypt.*session|No matching session|bad mac/i;
console.error = (...a) => {
  const s = String(a[0]);
  if (DECRYPT_NOISE.test(s)) {
    badMac++;
    if (Date.now() - lastHint > 300000) { // avisa máximo 1 vez cada 5 min
      lastHint = Date.now();
      origErr(`⚠️ Bad MAC (${badMac}x): mensajes viejos sin clave, el bot sigue funcionando normal.`);
    }
    return;
  }
  origErr(...a);
};
const NOISE = /^(Closing|Opening|Removing|Migrating|Session already|Decrypted message with closed session|Closing open session)/;
for (const m of ['info', 'warn', 'log']) {
  const orig = console[m].bind(console);
  console[m] = (...a) => (typeof a[0] === 'string' && NOISE.test(a[0]) ? undefined : orig(...a));
}

const logger = pino({ level: 'silent' });
const ask = (q) =>
  new Promise((r) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); r(a.trim()); });
  });

// Guarda mensajes recientes: Baileys los necesita para reenviar si el destinatario pide "reintento"
const store = new Map();
const remember = (m) => {
  if (m?.key?.id && m.message) {
    store.set(m.key.id, m.message);
    if (store.size > 2000) store.delete(store.keys().next().value);
  }
};
const groupCache = new Map();

let sock = null;
let retries = 0;
let starting = false;

const fatal = (msg) => {
  console.log(msg);
  process.exit(2); // start.sh no reinicia con código 2
};

// Fallo del bot principal en pleno uso: si hay sub bots conectados, el proceso sigue vivo para no tirarlos
const fatalKeep = (msg) => {
  const alive = (() => { try { return require('./lib/subbots').list().some((x) => x.status !== 'offline'); } catch { return false; } })();
  if (!alive) return fatal(msg);
  console.log(msg);
  console.log('ℹ️ El bot principal quedó apagado, pero los sub bots siguen activos. Arregla la sesión del principal y reinicia el bot.');
};

const cleanup = (s) => {
  try { s.ev.removeAllListeners(); } catch {}
  try { s.end(undefined); } catch {}
};

async function start() {
  if (starting) return;
  starting = true;
  try { adminApi.setLinkPhase('starting'); } catch {}
  try {
    fs.mkdirSync('./tmp', { recursive: true });
    fs.mkdirSync('./media', { recursive: true });
    const total = loader.load();
    console.log(`📦 ${total} comandos cargados`);
    // Los sub bots arrancan solos y no dependen de que el principal conecte
    if (!global.__subsRestored) { global.__subsRestored = true; require('./lib/subbots').restoreAll().catch((e) => console.error('Sub bots:', e?.message || e)); }
    if (!global.__depsChecked) { global.__depsChecked = true; require('./lib/deps').ensure().catch(() => {}); }

    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    let pairNumber = null;
    if (!state.creds.registered) {
      const preset = process.env.PAIRING_NUMBER || config.pairingNumber;
      if (preset) pairNumber = String(preset).replace(/\D/g, '');
      else if (process.stdin.isTTY) pairNumber = (await ask('📱 Tu número con código de país (ej 584121234567): ')).replace(/\D/g, '');
      else fatal('❌ No hay sesión y esta consola no permite escribir. Pon tu número en config.js → pairingNumber (o la variable PAIRING_NUMBER) y reinicia.');
    }

    if (sock) cleanup(sock);
    sock = makeWASocket({
      version,
      logger,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.macOS('Chrome'), // pairing code: WhatsApp valida mejor macOS/Chrome
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      getMessage: async (key) => store.get(key.id),
    });
    sock.groupCache = groupCache;
    const me = sock;

    if (pairNumber) {
      let pairAsked = false;
      const FIXED_CODE = 'SHARKNEX';
      const askPair = async (reason) => {
        if (pairAsked || me.authState?.creds?.registered) return;
        pairAsked = true;
        const phone = String(pairNumber).replace(/\D/g, '');
        console.log('[PAIR]', reason || 'ready', '| num', phone);
        try {
          // Pedir FIJO; WhatsApp debe devolver el mismo si lo acepta
          let code = await me.requestPairingCode(phone, FIXED_CODE);
          code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (code.length !== 8) {
            // reintento sin custom
            code = await me.requestPairingCode(phone);
            code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          }
          const shown = code.slice(0, 4) + '-' + code.slice(4);
          try { adminApi.setPairingCode(code, phone); } catch {}
          console.log('\n========================================');
          console.log('  CODIGO REAL DE WHATSAPP');
          console.log('  >>>  ' + shown + '  <<<');
          if (code === FIXED_CODE) {
            console.log('  (acepto el fijo SHARKNEX / SHAR-KNEX)');
          } else {
            console.log('  WhatsApp NO uso el fijo; usa el de arriba');
          }
          console.log('========================================');
          console.log('Telefono +' + phone);
          console.log('WhatsApp → Dispositivos vinculados');
          console.log('→ Vincular con NUMERO de telefono');
          console.log('→ Escribe exactamente: ' + shown);
          console.log('   (tambien prueba sin guion: ' + code + ')');
          console.log('Caduca ~2 min. Si falla: rm -rf session && reinicia\n');
        } catch (e) {
          pairAsked = false;
          console.log('❌ requestPairingCode:', e?.message || e);
          console.log('Borra session y reintenta en 30s.');
        }
      };
      // SOLO cuando WhatsApp manda qr/connecting (si pides antes = codigo muerto)
      me.ev.on('connection.update', (u) => {
        if (pairAsked) return;
        if (u.qr || u.connection === 'connecting') {
          setTimeout(() => { askPair(u.qr ? 'qr' : 'connecting').catch(() => {}); }, 3000);
        }
      });
      // respaldo por si no llega evento
      setTimeout(() => { askPair('timeout').catch(() => {}); }, 12000);
    }

    me.ev.on('creds.update', saveCreds);

    me.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        try { adminApi.setLinkPhase('open'); adminApi.clearPairingCode(); } catch {}
        retries = 0;
        const num = jidNormalizedUser(me.user.id).split('@')[0].split(':')[0];
        if (!config.owners.includes(num)) config.owners.push(num); // quien vincula el bot es owner
        const lid = me.user.lid && me.user.lid.split('@')[0].split(':')[0];
        if (lid && !config.owners.includes(lid)) config.owners.push(lid); // y su ID interno (LID) también
        console.log(`✅ ${config.botName} conectado como ${num}`);
        require('./lib/state').mainSock = me;
      }
      if (connection === 'close') {
        try { adminApi.setLinkPhase('close', { disconnect: { code: lastDisconnect?.error?.output?.statusCode } }); } catch {}
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) return fatalKeep('❌ Sesión cerrada desde el teléfono. Borra la carpeta "session" y vuelve a iniciar.');
        if (code === DisconnectReason.connectionReplaced) return fatalKeep('❌ Otra instancia está usando esta cuenta (conexión reemplazada). Cierra las demás y reinicia.');
        if (code === DisconnectReason.badSession) return fatalKeep('❌ Sesión dañada. Borra la carpeta "session" y vuelve a iniciar.');
        const delay = code === DisconnectReason.restartRequired ? 0 : Math.min(3000 * ++retries, 30000);
        console.log(`♻️ Reconectando en ${delay / 1000}s... (código ${code ?? '?'})`);
        cleanup(me);
        if (require('./lib/state').mainSock === me) require('./lib/state').mainSock = null;
        setTimeout(start, delay);
      }
    });

    me.ev.on('messages.upsert', ({ messages, type }) => {
      for (const m of messages) remember(m);
      if (type !== 'notify') return;
      for (const m of messages) {
        // El principal y los sub bots contestan a la vez (cada uno con su sesión). Si en el grupo hay un primario (.setprimary), solo ese.
        handleMessage(me, m).catch((e) => console.error('Error en mensaje:', e));
      }
    });

    // ── Anticall: expulsa a quien llame en grupos con anticall activado ──
    // anticall removido — causaba crashes en esta version de Baileys

    me.ev.on('groups.update', async ([u]) => {
      try { if (u?.id) groupCache.set(u.id, await me.groupMetadata(u.id)); } catch {}
    });
    me.ev.on('group-participants.update', async (u) => {
      try { groupCache.set(u.id, await me.groupMetadata(u.id)); } catch {}
      handleGroupUpdate(me, u).catch(() => {});
    });
  } finally {
    starting = false;
  }
}

startApi();
start();
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e?.message || e));
process.on('uncaughtException', (e) => console.error('uncaughtException:', e?.message || e));
