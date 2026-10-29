const { sans, C } = require('./deco');

// ═══════════════════════════════════════════════
//  Marco Miku para TODAS las respuestas de comandos (texto y pies de foto/video).
//  Lo que ya viene decorado (menú, tarjetas de descarga) se deja tal cual.
// ═══════════════════════════════════════════════
const decorated = (t) => t.includes(C.ftop) || t.includes(C.fbot);

// ── Sin emojis: los más usados se cambian por símbolos del marco, el resto se quita ──
const SYM = [
  [/(?:✅|✔️?|☑️?)/gu, '✓'], [/(?:❌|✖️?|❎)/gu, '✗'], [/⚠️?/gu, '△'], [/ℹ️?/gu, '◇'],
  [/(?:🚫|⛔|🔞)/gu, '⊘'], [/(?:💰|💵|💸|🪙|💎|🏦|💳)/gu, '◈'], [/(?:🏆|🥇|🥈|🥉|🔥)/gu, '✦'],
  [/(?:👑)/gu, '♛'], [/(?:⭐|🌟|✨|💫)/gu, '✧'], [/(?:❤️?|💙|💜|💖|💕|💗|💘|🩷|🧡|💛|💚|🤍)/gu, '♡'],
  [/(?:🎁|🎀)/gu, '❖'], [/(?:🎲|🎰|🃏|🎯)/gu, '◆'], [/(?:⏳|⌛)/gu, '…'], [/(?:🔍|🔎)/gu, '⌕'],
  [/(?:📥|⬇️?)/gu, '↓'], [/(?:📤|⬆️?)/gu, '↑'], [/🔗/gu, '↗'], [/(?:🎵|🎶|🎧|🎤)/gu, '♪'],
  [/(?:📌|📍|👉|➡️?)/gu, '➤'], [/▶️?/gu, '▸'], [/(?:🌸|🌺|🌷|🌼)/gu, '✿'], [/(?:🦈|🐟)/gu, '✦'], [/🏓/gu, '◦'],
];
const EMOJI = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F?))*[\u{1F3FB}-\u{1F3FF}]?|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|[\u{1F3FB}-\u{1F3FF}]/gu;
const EXTRA = /[\u2600-\u26FF\u2700-\u27BF\u23E9-\u23FA\u2B50\u2B55\u2B1B\u2B1C\u231A\u231B]\uFE0F/gu;
function clean(t) {
  if (typeof t !== 'string' || !t) return t;
  let s = t;
  for (const [re, to] of SYM) s = s.replace(re, to);
  s = s.replace(new RegExp('(?:' + EMOJI.source + ')+ ?', 'gu'), '').replace(new RegExp('(?:' + EXTRA.source + ') ?', 'gu'), '').replace(/\uFE0F/g, '');
  return s.replace(/[ \t]+\n/g, '\n');
}

function wrap(text, title) {
  const t = String(text ?? '');
  if (!t.trim() || decorated(t)) return t;
  const lines = t.replace(/\s+$/, '').split('\n').map((l) => (l.trim() === '' ? '│' : `│ ${l}`));
  return [C.ftop, `${C.fcat}\`${sans(title || 'Miku')}\``, ...lines, C.fbot].join('\n');
}

// Devuelve el contenido de sendMessage con el texto o caption decorado (si es respuesta a un comando)
function content(msg, opts, title) {
  if (!msg || typeof msg !== 'object') return msg;
  if (msg.react || msg.delete || msg.forward || msg.contacts || msg.poll) return msg;
  // Sin emojis en nada de lo que sale (los símbolos del marco no se tocan)
  if (typeof msg.text === 'string') msg = { ...msg, text: clean(msg.text) };
  if (typeof msg.caption === 'string') msg = { ...msg, caption: clean(msg.caption) };
  if (!opts?.quoted && !msg.edit) return msg; // avisos sueltos (bienvenida, broadcast, .say) no se decoran
  if (typeof msg.text === 'string') return { ...msg, text: wrap(msg.text, title) };
  if (typeof msg.caption === 'string' && msg.caption) return { ...msg, caption: wrap(msg.caption, title) };
  return msg;
}

// sock con decoración automática. holder.v = nombre del comando en curso
function proxy(sock, holder) {
  return new Proxy(sock, {
    get(t, p) {
      if (p === 'sendMessage') {
        return (jid, msg, opts) => {
          const c = content(msg, opts, holder.v);
          // grabación: otro bot del mismo grupo puede repetir estas respuestas (ver lib/dedupe.js)
          if (holder.rec && opts?.quoted && c && typeof c === 'object' && !c.react && !c.delete && !c.edit) holder.rec.push(c);
          return t.sendMessage(jid, c, opts);
        };
      }
      if (p === '__raw') return t;
      return Reflect.get(t, p);
    },
  });
}

module.exports = { wrap, content, proxy, decorated, clean };
