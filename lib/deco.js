// ═══════════════════════════════════════════════
//  Decoración SHARKNEX — estilo élite (sin emojis)
// ═══════════════════════════════════════════════
const C = {
  top: '𓆩 𝗦𝗛𝗔𝗥𝗞𝗡𝗘𝗫𝕏 𓆪',
  bul: '✦',
  arrow: '➩',
  ftop: '   ❀ 𓆩',
  fcat: '',
  fbot: '   ❀',
  quote: '> 𓆩✰𓆪 ',
  quote2: '> 𓆩☪︎𓆪 ',
  line: '──',
  page: '✦',
  foot: '> 𓆩✰𓆪 PÁGINA',
};

// Sans-serif unicode (matemático bold)
const MAP = {
  a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',k:'𝗸',l:'𝗹',m:'𝗺',
  n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',
  A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',K:'𝗞',L:'𝗟',M:'𝗠',
  N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭',
  '0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵',
};
const sans = (s) => String(s || '').split('').map((c) => MAP[c] || c).join('');
const bold = sans;

function card(title, bodyLines = []) {
  const lines = [`${C.ftop} ${sans(title)} 𓆪 ❀`];
  for (const l of bodyLines) lines.push(`  ${C.arrow} ${l}`);
  lines.push(C.fbot);
  return lines.join('\n');
}

function wrap(text, title) {
  const t = String(text ?? '').replace(/\s+$/, '');
  if (!t.trim()) return t;
  if (/^\s*❀\s*\*Pong\*/m.test(t)) return t;
  // Clon SharkX
  try {
    const sharkx = require('./sharkx');
    const cloned = sharkx.applyFrame(t, title);
    if (cloned) return cloned;
  } catch {}
  if (t.includes('𓆩') && t.includes('❀')) return t;
  const head = title ? `${C.ftop} ${sans(String(title))} 𓆪 ❀` : `${C.ftop} SHARKNEX 𓆪 ❀`;
  const body = t.split('\n').map((l) => (l.trim() === '' ? '' : `  ${l}`)).join('\n');
  return `${head}\n${body}\n${C.fbot}`;
}

function decorate(content, title) {
  if (!content || typeof content !== 'object') return content;
  const SKIP = ['react', 'delete', 'sticker', 'audio', 'contacts', 'poll', 'location', 'forward', 'buttons', 'sections', 'raw'];
  if (SKIP.some((k) => content[k] !== undefined)) return content;
  if (typeof content.text === 'string') return { ...content, text: wrap(content.text, title) };
  if (typeof content.caption === 'string' && content.caption.trim()) return { ...content, caption: wrap(content.caption, title) };
  return content;
}

module.exports = { C, sans, bold, card, wrap, decorate };
