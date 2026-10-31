/**
 * Sistema Anti-Spam / Anti-Ban para SharkyBot
 * ─────────────────────────────────────────────
 * Reduce el riesgo de ban de WhatsApp limitando:
 *  - Comandos por usuario (cooldown + ventana deslizante)
 *  - Mensajes enviados por el bot (rate global)
 *  - Flood de comandos iguales
 *  - Envios de media demasiado seguidos
 *
 * Niveles de sanción (por usuario):
 *  1. Warning (aviso)
 *  2. Cooldown forzado más largo
 *  3. Mute temporal (no responde)
 *  4. Ban temporal / permanente (si se configura)
 *
 * El owner siempre está exento.
 */

const config = require('../config');

// ── Estado en memoria (se reinicia al reiniciar el bot) ──
const userHits = new Map();   // senderNum → { cmds: number[], lastCmd: string, sameCount: number, warns: number, mutedUntil: number, lastMedia: number }
const globalSends = [];       // timestamps de envíos del bot
const chatHits = new Map();   // chatJid → timestamps recientes

function conf() {
  return config.antispam || {};
}

function pruneArr(arr, windowMs) {
  const cutoff = Date.now() - windowMs;
  while (arr.length && arr[0] < cutoff) arr.shift();
  return arr;
}

function getUser(num) {
  let u = userHits.get(num);
  if (!u) {
    u = { cmds: [], lastCmd: '', sameCount: 0, warns: 0, mutedUntil: 0, lastMedia: 0, lastWarn: 0 };
    userHits.set(num, u);
  }
  return u;
}

/** Limpia mapas grandes para no consumir RAM */
function pruneMaps() {
  const now = Date.now();
  if (userHits.size > 5000) {
    for (const [k, v] of userHits) {
      if (v.mutedUntil < now && (!v.cmds.length || v.cmds[v.cmds.length - 1] < now - 300000)) {
        userHits.delete(k);
      }
    }
  }
  if (chatHits.size > 2000) {
    for (const [k, v] of chatHits) {
      if (!v.length || v[v.length - 1] < now - 120000) chatHits.delete(k);
    }
  }
  pruneArr(globalSends, 60000);
}

/**
 * Comprueba si el usuario puede ejecutar un comando.
 * Devuelve { ok: true } o { ok: false, reason, waitMs?, level? }
 */
function checkCommand(senderNum, cmdName = '', isOwner = false) {
  if (isOwner) return { ok: true };
  const c = conf();
  if (c.enabled === false) return { ok: true };

  const now = Date.now();
  const u = getUser(senderNum);

  // Mute temporal
  if (u.mutedUntil > now) {
    return {
      ok: false,
      reason: 'muted',
      waitMs: u.mutedUntil - now,
      level: 'mute',
    };
  }

  // Cooldown mínimo entre comandos
  const cooldown = c.cooldownMs ?? config.cooldownMs ?? 50;
  if (u.cmds.length) {
    const last = u.cmds[u.cmds.length - 1];
    if (now - last < cooldown) {
      return {
        ok: false,
        reason: 'cooldown',
        waitMs: cooldown - (now - last),
        level: 'cooldown',
      };
    }
  }

  // Ventana deslizante: máx. N comandos en X segundos
  const windowMs = c.windowMs ?? 15000;
  const maxInWindow = c.maxCmdsPerWindow ?? 6;
  pruneArr(u.cmds, windowMs);
  if (u.cmds.length >= maxInWindow) {
    return registerViolation(senderNum, 'flood', u);
  }

  // Mismo comando repetido muchas veces seguidas
  if (cmdName && u.lastCmd === cmdName) {
    u.sameCount++;
    const maxSame = c.maxSameCmd ?? 4;
    if (u.sameCount >= maxSame) {
      return registerViolation(senderNum, 'repeat', u);
    }
  } else {
    u.lastCmd = cmdName;
    u.sameCount = 1;
  }

  return { ok: true };
}

/**
 * Registra que el usuario ejecutó un comando (llamar DESPUÉS de checkCommand ok)
 */
function markCommand(senderNum, isOwner = false) {
  if (isOwner) return;
  const u = getUser(senderNum);
  u.cmds.push(Date.now());
  pruneArr(u.cmds, conf().windowMs ?? 15000);
  if (Math.random() < 0.02) pruneMaps();
}

/**
 * Comprueba rate global del bot (mensajes que el bot envía)
 * Útil antes de sendMessage masivos.
 */
function checkGlobalSend() {
  const c = conf();
  if (c.enabled === false) return { ok: true };
  const maxPerMin = c.maxBotMsgsPerMin ?? 40;
  pruneArr(globalSends, 60000);
  if (globalSends.length >= maxPerMin) {
    return {
      ok: false,
      reason: 'global_rate',
      waitMs: 60000 - (Date.now() - globalSends[0]),
    };
  }
  return { ok: true };
}

function markSend() {
  globalSends.push(Date.now());
}

/**
 * Rate por chat (grupo o privado) — evita que el bot responda demasiado en un solo grupo
 */
function checkChat(chatJid) {
  const c = conf();
  if (c.enabled === false) return { ok: true };
  const maxPerChat = c.maxMsgsPerChatPerMin ?? 25;
  let arr = chatHits.get(chatJid);
  if (!arr) {
    arr = [];
    chatHits.set(chatJid, arr);
  }
  pruneArr(arr, 60000);
  if (arr.length >= maxPerChat) {
    return { ok: false, reason: 'chat_rate', waitMs: 60000 - (Date.now() - arr[0]) };
  }
  return { ok: true };
}

function markChat(chatJid) {
  let arr = chatHits.get(chatJid);
  if (!arr) {
    arr = [];
    chatHits.set(chatJid, arr);
  }
  arr.push(Date.now());
}

/**
 * Control de envíos de media (fotos, videos, stickers, audio)
 * WhatsApp es más sensible a media frecuente.
 */
function checkMedia(senderNum, isOwner = false) {
  if (isOwner) return { ok: true };
  const c = conf();
  if (c.enabled === false) return { ok: true };
  const minInterval = c.mediaCooldownMs ?? 3500;
  const u = getUser(senderNum);
  const now = Date.now();
  if (u.lastMedia && now - u.lastMedia < minInterval) {
    return {
      ok: false,
      reason: 'media_cooldown',
      waitMs: minInterval - (now - u.lastMedia),
    };
  }
  return { ok: true };
}

function markMedia(senderNum) {
  getUser(senderNum).lastMedia = Date.now();
}

/**
 * Registra una violación y aplica sanción progresiva
 */
function registerViolation(senderNum, type, u) {
  const c = conf();
  const now = Date.now();
  u.warns = (u.warns || 0) + 1;

  // No spamear warnings
  const warnCooldown = 8000;
  const canWarn = now - (u.lastWarn || 0) > warnCooldown;
  if (canWarn) u.lastWarn = now;

  const muteAfter = c.muteAfterWarns ?? 3;
  const banAfter = c.banAfterWarns ?? 6;
  const muteMs = c.muteMs ?? 3 * 60 * 1000; // 3 min

  if (u.warns >= banAfter && c.autoBan) {
    u.mutedUntil = now + (c.banMs || 30 * 60 * 1000);
    return {
      ok: false,
      reason: type,
      level: 'ban',
      warns: u.warns,
      waitMs: u.mutedUntil - now,
      notify: canWarn,
    };
  }

  if (u.warns >= muteAfter) {
    u.mutedUntil = now + muteMs;
    // Bajar warns un poco para no cascadear
    u.warns = Math.max(0, u.warns - 1);
    return {
      ok: false,
      reason: type,
      level: 'mute',
      warns: u.warns,
      waitMs: muteMs,
      notify: canWarn,
    };
  }

  // Solo warning + cooldown extra
  const extra = Math.min(15000, 2000 * u.warns);
  u.cmds.push(now + extra); // fuerza espera
  return {
    ok: false,
    reason: type,
    level: 'warn',
    warns: u.warns,
    waitMs: extra,
    notify: canWarn,
  };
}

/**
 * Mensaje amigable según el nivel de sanción
 */
function messageFor(result, senderNum) {
  if (!result || result.ok) return null;
  const sec = Math.ceil((result.waitMs || 0) / 1000);
  switch (result.level) {
    case 'cooldown':
      return null; // silencioso: no contestar para no generar más tráfico
    case 'media_cooldown':
      return null;
    case 'warn':
      return `⚠️ Antispam: no envíes comandos tan rápido (@${senderNum}). Espera un momento.`;
    case 'mute':
      return `🔇 Antispam: @${senderNum} silenciado temporalmente (${sec}s) por flood.`;
    case 'ban':
      return `🚫 Antispam: @${senderNum} bloqueado temporalmente por abuso.`;
    case 'global_rate':
    case 'chat_rate':
      return null; // silencioso a nivel global
    default:
      return null;
  }
}

/** Delay humano aleatorio antes de responder (ms) */
function humanDelay() {
  const c = conf();
  if (c.humanDelay === false) return 0;
  const min = c.delayMinMs ?? 400;
  const max = c.delayMaxMs ?? 1800;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Reset de un usuario (owner) */
function resetUser(num) {
  userHits.delete(String(num));
}

/** Estado de un usuario (para debug / owner) */
function statusOf(num) {
  const u = userHits.get(String(num));
  if (!u) return { clean: true };
  return {
    warns: u.warns,
    mutedUntil: u.mutedUntil,
    cmdsInWindow: u.cmds.length,
    lastCmd: u.lastCmd,
    sameCount: u.sameCount,
  };
}

module.exports = {
  checkCommand,
  markCommand,
  checkGlobalSend,
  markSend,
  checkChat,
  markChat,
  checkMedia,
  markMedia,
  humanDelay,
  messageFor,
  resetUser,
  statusOf,
  getUser,
};
