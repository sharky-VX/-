// ═══════════════════════════════════════════════
//  Fuentes: convierten texto a letras Unicode con estilo (funcionan en cualquier chat)
// ═══════════════════════════════════════════════
const mk = (name, desc, fn, aliases = []) => ({
  name, aliases, desc, usage: '<texto>', category: 'fonts',
  run: ({ q, quotedText, reply }) => {
    const t = q || quotedText;
    return t ? reply(fn(t)) : reply('✍️ Escribe un texto. Ej: .' + name + ' Sharky');
  },
});

// Letras: bloque Unicode contiguo (+ excepciones de huecos históricos)
const block = (UP, LOW, DIG, ex = {}) => (t) =>
  [...t].map((c) => {
    if (ex[c]) return ex[c];
    const k = c.charCodeAt(0);
    if (k >= 65 && k <= 90 && UP) return String.fromCodePoint(UP + k - 65);
    if (k >= 97 && k <= 122 && LOW) return String.fromCodePoint(LOW + k - 97);
    if (k >= 48 && k <= 57 && DIG) return String.fromCodePoint(DIG + k - 48);
    return c;
  }).join('');

// Mapa carácter a carácter
const table = (from, to) => {
  const f = [...from], o = [...to];
  const m = Object.fromEntries(f.map((c, i) => [c, o[i]]));
  return (t) => [...t].map((c) => m[c] ?? m[c.toLowerCase()] ?? c).join('');
};
const combine = (mark) => (t) => [...t].map((c) => (c === ' ' ? c : c + mark)).join('');
const wrap = (a, b) => (t) => `${a}${t}${b}`;

const ABC = 'abcdefghijklmnopqrstuvwxyz';
const FONTS = {
  bold: ['Negrita serif', block(0x1d400, 0x1d41a, 0x1d7ce), ['negrita']],
  italic: ['Cursiva serif', block(0x1d434, 0x1d44e, 0, { h: 'ℎ' }), ['cursiva']],
  bolditalic: ['Negrita cursiva serif', block(0x1d468, 0x1d482, 0), []],
  script: ['Script elegante', block(0x1d49c, 0x1d4b6, 0, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' }), ['cursivaelegante']],
  boldscript: ['Script negrita', block(0x1d4d0, 0x1d4ea, 0), []],
  fraktur: ['Gótica', block(0x1d504, 0x1d51e, 0, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }), ['gotica']],
  boldfraktur: ['Gótica negrita', block(0x1d56c, 0x1d586, 0), []],
  double: ['Doble trazo', block(0x1d538, 0x1d552, 0x1d7d8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }), ['doblelinea']],
  sans: ['Sans-serif', block(0x1d5a0, 0x1d5ba, 0x1d7e2), []],
  sansbold: ['Sans-serif negrita', block(0x1d5d4, 0x1d5ee, 0x1d7ec), []],
  sansitalic: ['Sans-serif cursiva', block(0x1d608, 0x1d622, 0), []],
  sansbolditalic: ['Sans-serif negrita cursiva', block(0x1d63c, 0x1d656, 0), []],
  mono: ['Monoespaciada', block(0x1d670, 0x1d68a, 0x1d7f6), ['monoespacio']],
  bubble: ['Burbujas', (t) => block(0x24b6, 0x24d0, 0)(t).replace(/[1-9]/g, (d) => String.fromCodePoint(0x2460 + +d - 1)).replace(/0/g, '⓪'), ['circulos']],
  bubbleneg: ['Burbujas negras', block(0x1f150, 0x1f150, 0), []],
  square: ['Cuadrados', block(0x1f130, 0x1f130, 0), ['cuadros']],
  squareneg: ['Cuadrados negros', block(0x1f170, 0x1f170, 0), []],
  paren: ['Entre paréntesis', (t) => [...t].map((c) => (/[a-z]/i.test(c) ? String.fromCodePoint(0x249c + c.toLowerCase().charCodeAt(0) - 97) : c)).join(''), ['parentesis']],
  fullwidth: ['Ancho completo', (t) => [...t].map((c) => (c === ' ' ? '　' : c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126 ? String.fromCharCode(c.charCodeAt(0) + 0xfee0) : c)).join(''), ['vaporwave']],
  smallcaps: ['Versalitas', table(ABC, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ'), ['versalitas']],
  upside: ['Al revés (de cabeza)', (t) => [...table(ABC + '1234567890?!.,', 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz⇂ᘔƐ߈ϛ9ㄥ860¿¡˙\'')(t)].reverse().join(''), ['decabeza']],
  superscript: ['Superíndice', table(ABC + '0123456789+-=()', 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾'), ['superindice']],
  subscript: ['Subíndice', table('aehijklmnoprstuvx0123456789+-=()', 'ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎'), ['subindice']],
  strike: ['Tachado', combine('̶'), ['tachado']],
  underline: ['Subrayado', combine('̲'), ['subrayado']],
  dunderline: ['Doble subrayado', combine('̳'), []],
  overline: ['Sobrerrayado', combine('̅'), []],
  slash: ['Texto con barra', combine('̸'), []],
  regional: ['Letras bandera', (t) => [...t.toLowerCase()].map((c) => (/[a-z]/.test(c) ? String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 97) + '​' : c)).join(''), []],
  deco1: ['Adorno ꧁༺ ༻꧂', wrap('꧁༺ ', ' ༻꧂'), []],
  deco2: ['Adorno ⚡ ⚡', wrap('⚡ ', ' ⚡'), []],
  deco3: ['Adorno 『 』', wrap('『 ', ' 』'), []],
  deco4: ['Adorno ღ ღ', wrap('ღ ', ' ღ'), []],
  deco5: ['Adorno ★彡 彡★', wrap('★彡[ ', ' ]彡★'), []],
  deco6: ['Adorno 🦈 🦈', wrap('🦈 ', ' 🦈'), []],
};

module.exports = Object.entries(FONTS).map(([name, [desc, fn, aliases]]) => mk(name, `Fuente: ${desc}`, fn, aliases));
