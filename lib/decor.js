const { C, sans } = require('./deco');

const decorated = (t) => {
  if (typeof t !== 'string') return false;
  if (t.includes('𓆩') && t.includes('❀')) return true;
  // ping limpio: no envolver
  if (/^\s*❀\s*\*Pong\*/m.test(t)) return true;
  return false;
};

const SYM = [];
const EMOJI = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F?))*[\u{1F3FB}-\u{1F3FF}]?|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|[\u{1F3FB}-\u{1F3FF}]/gu;
const EXTRA = /[\u2600-\u26FF\u2700-\u27BF\u23E9-\u23FA\u2B50\u2B55\u2B1B\u2B1C\u231A\u231B]\uFE0F/gu;
function clean(t) {
  if (typeof t !== 'string' || !t) return t;
  let s = t;
  for (const [re, to] of SYM) s = s.replace(re, to);
  // Quita emojis; conserva simbolos del marco del menu (𓆩 ✦ ➩ ❀ etc.)
  s = s.replace(new RegExp('(?:' + EMOJI.source + ')+ ?', 'gu'), '').replace(new RegExp('(?:' + EXTRA.source + ') ?', 'gu'), '').replace(/\uFE0F/g, '');
  return s.replace(/[ \t]+\n/g, '\n');
}

function wrap(text, title) {
  const t = String(text ?? '');
  if (!t.trim() || decorated(t)) return t;
  const head = title
    ? `   ❀ 𓆩 ${sans(String(title))} 𓆪 ❀`
    : `   ❀ 𓆩 SHARKNEX 𓆪 ❀`;
  const body = t.replace(/\s+$/, '').split('\n').map((l) => (l.trim() === '' ? '' : `  ${l}`)).join('\n');
  return `${head}\n${body}\n   ❀`;
}

function content(msg, opts, title) {
  if (!msg || typeof msg !== 'object') return msg;
  if (msg.react || msg.delete || msg.forward || msg.contacts || msg.poll) return msg;
  if (typeof msg.text === 'string') msg = { ...msg, text: clean(msg.text) };
  if (typeof msg.caption === 'string') msg = { ...msg, caption: clean(msg.caption) };
  if (!opts?.quoted && !msg.edit) return msg;
  if (typeof msg.text === 'string') return { ...msg, text: wrap(msg.text, title) };
  if (typeof msg.caption === 'string' && msg.caption) return { ...msg, caption: wrap(msg.caption, title) };
  return msg;
}

function proxy(sock, holder) {
  return new Proxy(sock, {
    get(t, p) {
      if (p === 'sendMessage') {
        return (jid, msg, opts) => {
          const c = content(msg, opts, holder.v);
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
