/**
 * DEATHJOE.NEX ↔ SHARKNEX — capa administrativa
 * Estado real de proceso + WhatsApp, logs acotados, vinculación, control controlado.
 * No expone archivos de sesión ni secretos.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const state = require('./state');

const INSTANCE_ID = process.env.SHARKNEX_INSTANCE_ID
  || config.adminApi?.instanceId
  || `sharknex-${(config.botName || 'bot').toLowerCase().replace(/\s+/g, '-')}`;

const startedAt = Date.now();
const LOG_MAX = Number(config.adminApi?.logMax || 200);
const logs = []; // { t, level, msg }

// Vinculación / conexión (rellenado desde index.js)
const link = {
  phase: 'unknown', // unknown|starting|waiting_pair|code_ready|connecting|open|close
  lastCode: null,   // solo en memoria, TTL corto
  codeAt: 0,
  codeExpiresAt: 0,
  pairNumberHint: null, // últimos 4 dígitos
  lastDisconnect: null,
  lastError: null,
  qrAvailable: false, // esta build usa pairing code, no QR por defecto
};

function cfg() {
  return config.adminApi || {};
}

function adminKey() {
  return process.env.SHARKNEX_ADMIN_KEY || cfg().adminKey || '';
}

function publicKey() {
  return process.env.API_KEY || config.api?.key || '';
}

/** Auth por header Authorization: Bearer <key> o X-Admin-Key */
function authAdmin(req) {
  const expected = adminKey();
  if (!expected) return { ok: false, code: 503, error: 'admin_key_not_configured' };
  const h = req.headers || {};
  const bearer = String(h.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const xkey = String(h['x-admin-key'] || h['x-api-key'] || '').trim();
  const got = bearer || xkey;
  if (!got) return { ok: false, code: 401, error: 'missing_credentials' };
  if (got !== expected) return { ok: false, code: 403, error: 'invalid_credentials' };
  return { ok: true };
}

/** Rate limit simple en memoria por IP+ruta */
const hits = new Map();
function rateLimit(ip, route, max = 60, windowMs = 60000) {
  const k = `${ip}|${route}`;
  const now = Date.now();
  let arr = hits.get(k) || [];
  arr = arr.filter((t) => t > now - windowMs);
  if (arr.length >= max) {
    hits.set(k, arr);
    return false;
  }
  arr.push(now);
  hits.set(k, arr);
  return true;
}

function pushLog(level, msg) {
  const text = String(msg || '').slice(0, 500);
  // Nunca guardar secretos obvios
  const redacted = text
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/(api[_-]?key|admin[_-]?key|token)["'\s:=]+[^\s"',]+/gi, '$1=***');
  logs.push({ t: Date.now(), level: level || 'info', msg: redacted });
  while (logs.length > LOG_MAX) logs.shift();
}

function maskCode(code) {
  if (!code) return null;
  const s = String(code).replace(/\s|-/g, '');
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
}

// ── Actualizadores llamados desde index.js ──
function setLinkPhase(phase, extra = {}) {
  link.phase = phase;
  if (extra.error) link.lastError = String(extra.error).slice(0, 200);
  if (extra.disconnect) link.lastDisconnect = extra.disconnect;
  if (extra.pairNumber) link.pairNumberHint = String(extra.pairNumber).replace(/\D/g, '').slice(-4);
  pushLog('info', `link.phase=${phase}`);
}

function setPairingCode(code, pairNumber) {
  const ttl = Number(cfg().pairingCodeTtlMs || 120000);
  link.lastCode = String(code || '');
  link.codeAt = Date.now();
  link.codeExpiresAt = Date.now() + ttl;
  link.phase = 'code_ready';
  if (pairNumber) link.pairNumberHint = String(pairNumber).replace(/\D/g, '').slice(-4);
  pushLog('info', `pairing_code_ready masked=${maskCode(code)}`);
}

function clearPairingCode() {
  link.lastCode = null;
  link.codeAt = 0;
  link.codeExpiresAt = 0;
}

function getWhatsAppStatus() {
  const sock = state.mainSock;
  const user = sock?.user;
  const open = !!(sock && user?.id);
  let number = null;
  if (user?.id) {
    number = String(user.id).split(':')[0].split('@')[0];
  }
  return {
    connected: open,
    state: open ? 'open' : (link.phase === 'close' ? 'close' : link.phase || 'disconnected'),
    number: open ? number : null,
    displayName: open ? (user?.name || null) : null,
    platform: open ? (user?.platform || null) : null,
    pairing: {
      phase: link.phase,
      codeAvailable: !!(link.lastCode && Date.now() < link.codeExpiresAt),
      codeExpiresAt: link.codeExpiresAt || null,
      pairNumberHint: link.pairNumberHint,
      qrSupported: false, // flujo actual: pairing code, no QR
      note: 'SHARKNEX usa requestPairingCode (Baileys). No emite QR por defecto.',
    },
    lastDisconnect: link.lastDisconnect,
    lastError: link.lastError,
  };
}

function getProcessStatus() {
  const mem = process.memoryUsage();
  return {
    alive: true,
    pid: process.pid,
    node: process.version,
    uptimeSec: Math.floor(process.uptime()),
    startedAt,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    platform: `${os.platform()} ${os.arch()}`,
    hostname: os.hostname(),
  };
}

function detectSupervisor() {
  const out = { pm2: false, systemd: false, startShLoop: true, canRestart: true, canStop: true };
  if (process.env.PM2_HOME || process.env.pm_id !== undefined) out.pm2 = true;
  if (process.env.INVOCATION_ID || process.env.JOURNAL_STREAM) out.systemd = true;
  // start.sh reinicia si exit code != 2/130/143
  out.restartMethod = out.pm2 ? 'pm2' : out.systemd ? 'systemd' : 'exit_code_0_start_sh';
  out.stopMethod = 'exit_code_2';
  out.limitations = [
    'Sin supervisor externo, apagar la API también apaga el panel de control de este proceso.',
    'Reinicio: process.exit(0) confía en start.sh / PM2 / systemd para volver a levantar el bot.',
  ];
  return out;
}

function getCapabilities() {
  return {
    instanceId: INSTANCE_ID,
    botName: config.botName || 'SHARKNEX',
    version: require('../package.json').version || '2.0.0',
    admin: {
      health: true,
      status: true,
      whatsapp: true,
      logs: true,
      linkStatus: true,
      linkCode: true, // código real si está en ventana TTL
      restart: true,
      stop: true,
      arbitraryShell: false,
    },
    whatsapp: {
      library: '@whiskeysockets/baileys',
      pairingCode: true,
      qr: false,
      multiDevice: true,
      subbots: true,
    },
    supervisor: detectSupervisor(),
  };
}

function getLogs(limit = 50) {
  const n = Math.min(Math.max(1, Number(limit) || 50), LOG_MAX);
  return logs.slice(-n);
}

function getLinkStatus(includeCode = false) {
  const expired = link.lastCode && Date.now() >= link.codeExpiresAt;
  if (expired) clearPairingCode();
  const base = {
    phase: link.phase,
    codeAvailable: !!(link.lastCode && Date.now() < link.codeExpiresAt),
    codeExpiresAt: link.codeExpiresAt || null,
    pairNumberHint: link.pairNumberHint,
    qrAvailable: false,
    maskedCode: link.lastCode ? maskCode(link.lastCode) : null,
  };
  if (includeCode && base.codeAvailable) {
    return { ...base, code: link.lastCode };
  }
  return base;
}

/** Señales de control (no shell arbitrario) */
let pendingAction = null; // { type, at, by }
function requestRestart() {
  pendingAction = { type: 'restart', at: Date.now() };
  pushLog('warn', 'admin_request_restart');
  setTimeout(() => {
    pushLog('warn', 'process_exit_0_restart');
    process.exit(0); // start.sh / PM2 reinician
  }, 800);
  return { accepted: true, action: 'restart', method: detectSupervisor().restartMethod };
}
function requestStop() {
  pendingAction = { type: 'stop', at: Date.now() };
  pushLog('warn', 'admin_request_stop');
  setTimeout(() => {
    pushLog('warn', 'process_exit_2_stop');
    process.exit(2); // start.sh NO reinicia
  }, 800);
  return { accepted: true, action: 'stop', method: 'exit_code_2' };
}

function envelope(ok, data, error) {
  const body = {
    ok: !!ok,
    instanceId: INSTANCE_ID,
    ts: Date.now(),
  };
  if (ok) Object.assign(body, data);
  else body.error = error || 'error';
  return body;
}

module.exports = {
  INSTANCE_ID,
  authAdmin,
  rateLimit,
  pushLog,
  setLinkPhase,
  setPairingCode,
  clearPairingCode,
  getWhatsAppStatus,
  getProcessStatus,
  getCapabilities,
  getLogs,
  getLinkStatus,
  requestRestart,
  requestStop,
  detectSupervisor,
  envelope,
  adminKeyConfigured: () => !!adminKey(),
};
