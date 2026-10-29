// Decoración estilo "Miku" (marcos y letra) usada por el menú y las tarjetas de descarga
const C = {"top": "۪  ໍ╭۪۪۪۪۪۪۪۪ٜ݊᷼┈۪۪۪۪ٜ࣪᷼─۪۪۪۪۪۪۪۪ٜ᷼┈̈᷼ ۪۪۪۪ٜ─⃔᷼┈᷼⏜᮫ ํᩥ᩿✿⵿֟፝✿᮫ ํᩥ᩿⏜۪֯᷼ ּ┈⃔᷼ ─۪۪۪۪ٜ᷼┈۪۪۪۪۪۪۪۪ٜ̈᷼─۪۪۪۪ٜ࣪᷼┈۪۪۪۪۪۪۪۪ٜ݊᷼╮ ۪  ໍ", "bul": "├ׁ̟̇", "ftop": "╭╼ׅ─꯭ׂ─꯭─ׅ⌢ׅ 〪ׄ⌒ Ⳋᰍ ⌒⌢᮫᩠ׄ─꯭ׂ─꯭─ׅ╾╮", "fcat": "│૮ ֖͡ ͝ ᩧ֢ ᩧ͝ ᩧ֥͡ 𑇖 ", "fbot": "╰╼ׅ─꯭ׂ─꯭─ׅ⌢ׅ 〪ׄ⌒ Ⳋᰍ ⌒⌢᮫᩠ׄ─꯭ׂ─꯭─ׅ╾╯", "quote": "> ᯓ𐔌՞. .՞𐦯. ", "foot": "├ׁ̟̇ ✿ *𝗕𝗼𝘁:* 𝖧𝖺𝗍𝗌𝗎𝗇𝖾 𝖬𝗂𝗄𝗎"};

// Letra "sans" matemática (𝖠𝖻𝖼...) manteniendo acentos y la ñ
const UP = [...'𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹'];
const LO = [...'𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓'];
const DG = [...'𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫'];
function sans(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[A-Za-z0-9]/g, (ch) => {
      const k = ch.charCodeAt(0);
      if (k >= 65 && k <= 90) return UP[k - 65];
      if (k >= 97 && k <= 122) return LO[k - 97];
      return DG[k - 48];
    })
    .normalize('NFC');
}
const bold = (t) => `*${t}*`;

// Tarjeta con marco: card('Título', [['🎤','Canal','Fulano'], ...], 'pie')
function card(title, rows = [], foot = '') {
  const lines = [`${C.ftop}`, `${C.fcat}\`${title}\``];
  for (const [, label, value] of rows) {
    if (value === undefined || value === null || value === '') continue;
    lines.push(`│ ✦ *${label}:* ${value}`);
  }
  lines.push(C.fbot);
  if (foot) lines.push('', `${C.quote}${foot}`);
  return lines.join('\n');
}

// Envuelve CUALQUIER respuesta de comando con el marco del menú (cada línea con su barra).
// Si el texto ya trae marco (menú, tarjetas) o es muy corto/vacío, se deja igual.
function wrap(text, title = '') {
  const t = String(text ?? '');
  if (!t.trim() || t.includes(C.fbot) || t.includes(C.ftop)) return t;
  const lines = t.replace(/\s+$/g, '').split('\n').map((l) => (l.trim() ? `│ ${l}` : '│'));
  const head = title ? `${C.ftop}\n${C.fcat}\`${sans(String(title).toLowerCase())}\`` : C.ftop;
  return `${head}\n${lines.join('\n')}\n${C.fbot}`;
}

// Decora el contenido de un mensaje de Baileys (texto o pie de foto/video). Lo demás pasa igual.
const SKIP = ['react', 'delete', 'sticker', 'audio', 'contacts', 'poll', 'location', 'forward', 'buttons', 'sections', 'raw'];
function decorate(content, title) {
  if (!content || typeof content !== 'object' || SKIP.some((k) => content[k] !== undefined)) return content;
  if (typeof content.text === 'string') return { ...content, text: wrap(content.text, title) };
  if (typeof content.caption === 'string' && content.caption.trim()) return { ...content, caption: wrap(content.caption, title) };
  return content;
}

module.exports = { C, sans, bold, card, wrap, decorate };
