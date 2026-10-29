const U = require('../lib/utils');

const mk = (name, desc, fn, aliases = []) => ({
  name, aliases, desc, usage: '<texto>', category: 'text',
  run: async ({ q, quotedText, reply }) => {
    const t = q || quotedText;
    if (!t) return reply('✍️ Escribe un texto o responde a un mensaje.');
    reply(fn(t));
  },
});

const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const words = (t) => U.strip(t).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const shift = (t, n) => t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + n + 26) % 26) + b); });

module.exports = [
  mk('upper', 'MAYÚSCULAS', (t) => t.toUpperCase(), ['mayus']),
  mk('lower', 'minúsculas', (t) => t.toLowerCase(), ['minus']),
  mk('title', 'Primera Letra Mayúscula', (t) => t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())),
  mk('sentence', 'Primera mayúscula de cada oración', (t) => t.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-záéíóúñ])/g, (_, a, b) => a + b.toUpperCase())),
  mk('invertcase', 'iNVIERTE mAYÚSCULAS', (t) => [...t].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')),
  mk('reverse', 'Texto al revés', (t) => [...t].reverse().join(''), ['reves']),
  mk('reversewords', 'Invierte el orden de las palabras', (t) => t.split(/\s+/).reverse().join(' ')),
  mk('mock', 'tExTo De bUrLa', (t) => [...t].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('')),
  mk('slug', 'texto-para-url', (t) => U.strip(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')),
  mk('camel', 'camelCase', (t) => words(t).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('')),
  mk('pascal', 'PascalCase', (t) => words(t).map((w) => w[0].toUpperCase() + w.slice(1)).join('')),
  mk('snake', 'snake_case', (t) => words(t).join('_')),
  mk('kebab', 'kebab-case', (t) => words(t).join('-')),
  mk('constant', 'CONSTANT_CASE', (t) => words(t).join('_').toUpperCase()),
  mk('leet', 'L33T 5P34K', (t) => t.replace(/[aeiost]/gi, (c) => ({ a: 4, e: 3, i: 1, o: 0, s: 5, t: 7 })[c.toLowerCase()])),
  mk('morse', 'Texto a código Morse', (t) => U.strip(t).toLowerCase().split('').map((c) => (c === ' ' ? '/' : MORSE[c])).filter(Boolean).join(' ')),
  mk('unmorse', 'Código Morse a texto', (t) => t.trim().split(/\s+/).map((x) => (x === '/' ? ' ' : UNMORSE[x] || '')).join('')),
  mk('rot13', 'Cifrado ROT13', (t) => shift(t, 13)),
  mk('atbash', 'Cifrado Atbash (A↔Z)', (t) => t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); })),
  {
    name: 'cesar', aliases: ['caesar'], desc: 'Cifrado César (desplazamiento)', usage: '<n> <texto>', category: 'text',
    run: ({ args, reply }) => {
      const n = parseInt(args[0]);
      const t = args.slice(1).join(' ');
      if (isNaN(n) || !t) return reply('Ejemplo: .cesar 3 hola mundo   (usa -3 para descifrar)');
      reply(shift(t, n));
    },
  },
  mk('tobin', 'Texto a binario', (t) => [...Buffer.from(t)].map((b) => b.toString(2).padStart(8, '0')).join(' '), ['binario']),
  mk('frombin', 'Binario a texto', (t) => Buffer.from(t.trim().split(/\s+/).map((b) => parseInt(b, 2))).toString('utf8')),
  mk('hex', 'Texto a hexadecimal', (t) => Buffer.from(t).toString('hex')),
  mk('unhex', 'Hexadecimal a texto', (t) => Buffer.from(t.replace(/\s/g, ''), 'hex').toString('utf8')),
  mk('ascii', 'Códigos ASCII/Unicode del texto', (t) => [...t].slice(0, 80).map((c) => c.codePointAt(0)).join(' ')),
  mk('unicodechars', 'Códigos → caracteres', (t) => t.trim().split(/\s+/).map((n) => String.fromCodePoint(Math.max(32, Math.min(0x10FFFF, parseInt(n) || 63)))).join('')),
  mk('abc', 'Posición de cada letra en el abecedario', (t) => U.strip(t).toLowerCase().replace(/[a-z]/g, (c) => c.charCodeAt(0) - 96 + ' ').replace(/[^0-9 ]/g, ' ').trim().replace(/\s+/g, ' ')),
  mk('urlenc', 'Codifica para URL', (t) => encodeURIComponent(t)),
  mk('urldec', 'Decodifica de URL', (t) => { try { return decodeURIComponent(t); } catch { return '❌ Texto inválido'; } }),
  mk('htmlenc', 'Escapa caracteres HTML', (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')),
  mk('htmldec', 'Desescapa caracteres HTML', (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')),
  mk('jsonfmt', 'Da formato bonito a un JSON', (t) => { try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return '❌ JSON inválido'; } }, ['json']),
  mk('jsonmin', 'Minimiza un JSON', (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return '❌ JSON inválido'; } }),
  mk('count', 'Cuenta caracteres, palabras y líneas', (t) => `📝 Caracteres: ${t.length}\n🔤 Palabras: ${t.trim().split(/\s+/).length}\n📄 Líneas: ${t.split('\n').length}`, ['contar']),
  mk('vowels', 'Cuenta vocales y consonantes', (t) => { const s = U.strip(t); const v = (s.match(/[aeiou]/gi) || []).length; const c = (s.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length; return `🔠 Vocales: ${v}\n🔡 Consonantes: ${c}`; }, ['vocales']),
  mk('wordfreq', 'Palabras más repetidas', (t) => { const f = {}; words(t).forEach((w) => (f[w] = (f[w] || 0) + 1)); return '📊 ' + Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w, n]) => `${w}: ${n}`).join('\n'); }, ['frecuencia']),
  mk('longestword', 'Palabra más larga', (t) => { const w = t.split(/\s+/).sort((a, b) => b.length - a.length)[0]; return `🔤 ${w} (${w.length} letras)`; }, ['palabralarga']),
  mk('palindrome', '¿Es palíndromo?', (t) => { const s = U.strip(t).toLowerCase().replace(/[^a-z0-9]/g, ''); return s === [...s].reverse().join('') ? '✅ Sí es palíndromo' : '❌ No es palíndromo'; }, ['palindromo']),
  mk('anagram', '¿Son anagramas? (dos palabras)', (t) => { const [a, b] = t.split(/\s+/); if (!b) return 'Ejemplo: .anagram roma amor'; const n = (x) => [...U.strip(x).toLowerCase()].sort().join(''); return n(a) === n(b) ? '✅ Son anagramas' : '❌ No son anagramas'; }, ['anagrama']),
  mk('shuffle', 'Mezcla las palabras', (t) => t.split(/\s+/).sort(() => Math.random() - 0.5).join(' '), ['mezclar']),
  mk('shuffleletters', 'Mezcla las letras de cada palabra', (t) => t.split(/\s+/).map((w) => [...w].sort(() => Math.random() - 0.5).join('')).join(' ')),
  mk('sortwords', 'Ordena palabras A-Z', (t) => t.split(/\s+/).sort((a, b) => a.localeCompare(b)).join(' '), ['ordenar']),
  mk('sortlines', 'Ordena líneas A-Z', (t) => t.split('\n').sort((a, b) => a.localeCompare(b)).join('\n')),
  mk('uniqlines', 'Quita líneas repetidas', (t) => [...new Set(t.split('\n'))].join('\n')),
  mk('numlines', 'Numera las líneas', (t) => t.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'), ['numerar']),
  mk('bullets', 'Convierte líneas en viñetas', (t) => t.split('\n').filter(Boolean).map((l) => `• ${l}`).join('\n'), ['vinetas']),
  mk('trim', 'Quita espacios sobrantes', (t) => t.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).join('\n').trim()),
  mk('nospaces', 'Quita todos los espacios', (t) => t.replace(/\s+/g, ''), ['sinespacios']),
  mk('sinacentos', 'Quita los acentos', (t) => U.strip(t), ['noaccents']),
  mk('sinvocales', 'Texto sin vocales', (t) => t.replace(/[aeiouáéíóú]/gi, '')),
  mk('clap', 'Texto 👏 con 👏 aplausos', (t) => t.trim().split(/\s+/).join(' 👏 ') + ' 👏', ['aplausos']),
  mk('spaced', 'T e x t o  e s p a c i a d o', (t) => [...t].join(' '), ['espaciar']),
  mk('acronym', 'Acrónimo de las palabras', (t) => t.trim().split(/\s+/).map((w) => w[0].toUpperCase()).join(''), ['siglas']),
  mk('initials', 'Iniciales de un nombre', (t) => t.trim().split(/\s+/).map((w) => w[0].toUpperCase() + '.').join(' '), ['iniciales']),
  mk('emojify', 'Letras a emojis (🅰️ estilo)', (t) => [...U.strip(t).toLowerCase()].map((c) => (/[a-z]/.test(c) ? String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 97) : c)).join(' ')),
  {
    name: 'repetir', aliases: ['repeat'], desc: 'Repite un texto N veces', usage: '<n> <texto>', category: 'text',
    run: ({ args, reply }) => {
      const n = Math.min(parseInt(args[0]), 30);
      const t = args.slice(1).join(' ');
      if (!n || !t) return reply('Ejemplo: .repetir 5 hola');
      reply(Array(n).fill(t).join(' '));
    },
  },
  {
    name: 'reemplazar', aliases: ['replace'], desc: 'Reemplaza una palabra por otra', usage: 'buscar | nuevo | texto', category: 'text',
    run: ({ q, reply }) => {
      const [a, b, ...t] = q.split('|').map((x) => x.trim());
      if (!a || b === undefined || !t.length) return reply('Ejemplo: .reemplazar gato | perro | el gato come');
      reply(t.join('|').split(a).join(b));
    },
  },
];
