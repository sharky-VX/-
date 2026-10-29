// ═══════════════════════════════════════════════
//  UTILIDADES EXTRA — comandos útiles de todo tipo
// ═══════════════════════════════════════════════
const db = require('../lib/db');
const U = require('../lib/utils');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'tools', ...extra, run });

// ── helpers ──
const escRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const roman = (n) => {
  const v = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let r = ''; for (const [val,sym] of v) while (n >= val) { r += sym; n -= val; } return r;
};
const isMorse = (s) => /^[.\- /]+$/.test(s.trim());
const MORSE = { A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.' };
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k]));
const toBin = (n) => (n>>>0).toString(2);
const toHex = (n) => n.toString(16).toUpperCase();
const toOct = (n) => n.toString(8);

module.exports = [

  // ── Conversores de texto / datos ──
  mk('morse', 'Convierte texto a código Morse (o al revés)', '<texto | código morse>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}morse <texto>\nEjemplo: ${c.prefix}morse HOLA\nTambién decodifica morse: ${c.prefix}morse .... --- .-.. .-`);
    if (isMorse(c.q)) {
      const words = c.q.trim().split('   ');
      const decoded = words.map(w => w.split(' ').map(s => MORSE_REV[s] || '?').join('')).join(' ');
      return c.reply(`📡 *Morse → Texto:*\n${decoded}`);
    }
    const encoded = c.q.toUpperCase().split('').map(ch => ch === ' ' ? '   ' : (MORSE[ch] || ch)).join(' ');
    c.reply(`📡 *Texto → Morse:*\n${encoded}`);
  }, ['morsecode', 'codigomorse']),

  mk('binario', 'Convierte texto a binario y viceversa', '<texto | binario>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}binario <texto>`);
    if (/^[01\s]+$/.test(c.q.trim())) {
      const bytes = c.q.trim().split(/\s+/);
      const text = bytes.map(b => String.fromCharCode(parseInt(b, 2))).join('');
      return c.reply(`💻 *Binario → Texto:*\n${text}`);
    }
    const bin = c.q.split('').map(ch => ch.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    c.reply(`💻 *Texto → Binario:*\n${bin}`);
  }, ['binary', 'bintxt']),

  mk('base64', 'Codifica o decodifica en Base64', '<enc | dec> <texto>', (c) => {
    const [mode, ...rest] = c.args;
    const txt = rest.join(' ');
    if (!mode || !txt) return c.reply(`Uso:\n${c.prefix}base64 enc <texto>\n${c.prefix}base64 dec <base64>`);
    if (mode === 'enc') return c.reply(`🔐 *Base64:*\n${Buffer.from(txt).toString('base64')}`);
    if (mode === 'dec') {
      try { return c.reply(`🔓 *Decodificado:*\n${Buffer.from(txt, 'base64').toString('utf8')}`); }
      catch { return c.reply('❌ Base64 inválido.'); }
    }
    c.reply(`Usa: ${c.prefix}base64 enc <texto>  o  ${c.prefix}base64 dec <base64>`);
  }, ['b64', 'base']),

  mk('hex', 'Convierte texto a hexadecimal y viceversa', '<texto | hex>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}hex <texto>`);
    if (/^[0-9a-fA-F\s]+$/.test(c.q.trim()) && c.q.includes(' ')) {
      const text = c.q.trim().split(/\s+/).map(h => String.fromCharCode(parseInt(h, 16))).join('');
      return c.reply(`🔢 *Hex → Texto:*\n${text}`);
    }
    const hex = c.q.split('').map(ch => toHex(ch.charCodeAt(0))).join(' ');
    c.reply(`🔢 *Texto → Hex:*\n${hex}`);
  }, ['hexadecimal']),

  mk('romano', 'Convierte número a romano y viceversa', '<número | romano>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}romano <número>\nEjemplo: ${c.prefix}romano 2024`);
    if (/^[IVXLCDM]+$/i.test(c.q.trim())) {
      const map = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
      let n = 0, s = c.q.toUpperCase();
      for (let i = 0; i < s.length; i++) n += map[s[i+1]] > map[s[i]] ? -map[s[i]] : map[s[i]];
      return c.reply(`🏛️ *${c.q.toUpperCase()}* = ${n}`);
    }
    const n = parseInt(c.q);
    if (isNaN(n) || n < 1 || n > 3999) return c.reply('❌ Número entre 1 y 3999.');
    c.reply(`🏛️ *${n}* = ${roman(n)}`);
  }, ['numerosromanos']),

  mk('numbase', 'Convierte números entre bases (dec, bin, hex, oct)', '<número> <de> <a>', (c) => {
    const [num, from, to] = c.args;
    const bases = { dec: 10, bin: 2, hex: 16, oct: 8, 10: 10, 2: 2, 16: 16, 8: 8 };
    if (!num || !from || !to) return c.reply(`Uso: ${c.prefix}numbase <número> <de_base> <a_base>\nBases: dec bin hex oct\nEjemplo: ${c.prefix}numbase FF hex dec`);
    const fb = bases[from.toLowerCase()], tb = bases[to.toLowerCase()];
    if (!fb || !tb) return c.reply('Bases válidas: dec bin hex oct');
    const val = parseInt(num, fb);
    if (isNaN(val)) return c.reply('❌ Número inválido para esa base.');
    c.reply(`🔢 ${num} (base ${fb}) = *${val.toString(tb).toUpperCase()}* (base ${tb})`);
  }, ['baseconverter', 'convertbase']),

  // ── Tiempo / fecha ──
  mk('timestamp', 'Convierte timestamp Unix a fecha y viceversa', '[timestamp | fecha]', (c) => {
    if (!c.q) {
      const now = Date.now();
      return c.reply(`⏱️ *Timestamp actual:*\n${Math.floor(now/1000)} (segundos)\n${now} (ms)\n📅 ${new Date(now).toLocaleString('es-VE', {timeZone:'America/Caracas'})}`);
    }
    if (/^\d{10,13}$/.test(c.q.trim())) {
      const ts = c.q.length >= 13 ? parseInt(c.q) : parseInt(c.q) * 1000;
      const d = new Date(ts);
      return c.reply(`📅 *Timestamp → Fecha:*\n${d.toLocaleString('es-VE', {timeZone:'America/Caracas'})}\nUTC: ${d.toUTCString()}`);
    }
    c.reply(`⏱️ Timestamp actual: *${Math.floor(Date.now()/1000)}*`);
  }, ['unix', 'epoch', 'fechaunix']),

  mk('countdown', 'Cuántos días faltan para una fecha', '<dd/mm/yyyy>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}countdown 25/12/2026`);
    const [d, m, y] = c.q.split(/[\/\-]/).map(Number);
    if (!d || !m || !y) return c.reply('Formato: dd/mm/yyyy');
    const target = new Date(y, m - 1, d);
    const now = new Date(); now.setHours(0,0,0,0);
    const diff = Math.round((target - now) / 86400000);
    if (diff < 0) return c.reply(`📅 Esa fecha ya pasó hace *${Math.abs(diff)}* días.`);
    if (diff === 0) return c.reply('🎉 ¡Es HOY!');
    c.reply(`⏳ Faltan *${diff}* días para el *${d}/${m}/${y}*`);
  }, ['diasfalta', 'cuantosfalta']),

  mk('edad', 'Calcula la edad exacta desde una fecha de nacimiento', '<dd/mm/yyyy>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}edad 15/06/1995`);
    const [d, m, y] = c.q.split(/[\/\-]/).map(Number);
    if (!d || !m || !y) return c.reply('Formato: dd/mm/yyyy');
    const born = new Date(y, m - 1, d);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    const bday = new Date(now.getFullYear(), born.getMonth(), born.getDate());
    if (now < bday) age--;
    const nextBday = now >= bday ? new Date(now.getFullYear() + 1, born.getMonth(), born.getDate()) : bday;
    const daysLeft = Math.round((nextBday - now) / 86400000);
    c.reply(`🎂 *Edad:* ${age} años\n📅 Naciste el: ${d}/${m}/${y}\n🎉 Tu próximo cumpleaños en: ${daysLeft} días`);
  }, ['birthday', 'cumple', 'howold']),

  // ── Generadores ──
  mk('uuid', 'Genera un UUID v4 aleatorio', '', (c) => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0;
      return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    c.reply(`🔑 *UUID v4:*\n\`${uuid}\``);
  }, ['uid', 'generateuuid']),

  mk('hash', 'Genera el hash SHA-256 de un texto', '<texto>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}hash <texto>`);
    const crypto = require('crypto');
    const sha256 = crypto.createHash('sha256').update(c.q).digest('hex');
    const md5 = crypto.createHash('md5').update(c.q).digest('hex');
    c.reply(`🔒 *Hashes de:* "${c.q.slice(0,50)}"\n\n*SHA-256:*\n${sha256}\n\n*MD5:*\n${md5}`);
  }, ['sha256', 'checksum', 'md5']),

  mk('password', 'Genera una contraseña segura aleatoria', '[longitud 8-64]', (c) => {
    const len = Math.min(64, Math.max(8, parseInt(c.args[0]) || 16));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    let pass = '';
    for (let i = 0; i < len; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    c.reply(`🔐 *Contraseña (${len} chars):*\n\`${pass}\`\n\n_Guárdala en un lugar seguro._`);
  }, ['genpass', 'generarcontrasena', 'passwd']),

  mk('genpin', 'Genera un PIN numérico aleatorio', '[longitud 4-12]', (c) => {
    const len = Math.min(12, Math.max(4, parseInt(c.args[0]) || 6));
    let pin = '';
    for (let i = 0; i < len; i++) pin += Math.floor(Math.random() * 10);
    c.reply(`🔢 *PIN (${len} dígitos):*\n\`${pin}\``);
  }, ['generatepin', 'codigopin', 'pinrandom']),

  mk('token', 'Genera un token alfanumérico aleatorio', '[longitud]', (c) => {
    const len = Math.min(64, Math.max(8, parseInt(c.args[0]) || 32));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let tok = '';
    for (let i = 0; i < len; i++) tok += chars[Math.floor(Math.random() * chars.length)];
    c.reply(`🎟️ *Token:*\n\`${tok}\``);
  }, ['apikey', 'randtoken']),

  // ── Texto / análisis ──
  mk('contar', 'Cuenta palabras, letras y líneas de un texto', '<texto>', (c) => {
    const t = c.q || c.quotedText;
    if (!t) return c.reply(`Uso: ${c.prefix}contar <texto> o responde a un mensaje`);
    const words = t.trim().split(/\s+/).filter(Boolean).length;
    const chars = t.length;
    const noSpace = t.replace(/\s/g, '').length;
    const lines = t.split('\n').length;
    c.reply(`📊 *Análisis de texto:*\n📝 Palabras: ${words}\n🔤 Caracteres (con espacios): ${chars}\n🔡 Caracteres (sin espacios): ${noSpace}\n📄 Líneas: ${lines}`);
  }, ['wordcount', 'contador', 'charcount']),

  mk('palíndromo', 'Comprueba si una palabra o frase es palíndromo', '<palabra>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}palindromo <texto>`);
    const clean = c.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const rev = clean.split('').reverse().join('');
    const is = clean === rev;
    c.reply(is ? `✅ *"${c.q}"* es palíndromo! 🔄` : `❌ *"${c.q}"* NO es palíndromo.\n(Normal: ${clean} | Invertido: ${rev})`);
  }, ['palindrome', 'palindromo']),

  mk('buscar', 'Busca y reemplaza texto', '<buscar> | <reemplazar> | <texto>', (c) => {
    const parts = c.q.split('|');
    if (parts.length < 3) return c.reply(`Uso: ${c.prefix}buscar <buscar> | <reemplazar> | <texto>\nEjemplo: ${c.prefix}buscar hola | adios | hola mundo hola`);
    const [find, replace, ...rest] = parts.map(p => p.trim());
    const text = rest.join('|');
    const result = text.replace(new RegExp(escRegex(find), 'gi'), replace);
    c.reply(`✏️ *Resultado:*\n${result}`);
  }, ['replace', 'reemplazar', 'findreplace']),

  mk('repetir', 'Repite un texto N veces', '<veces> <texto>', (c) => {
    const n = parseInt(c.args[0]);
    const txt = c.args.slice(1).join(' ');
    if (!n || !txt) return c.reply(`Uso: ${c.prefix}repetir <veces> <texto>\nEjemplo: ${c.prefix}repetir 3 hola`);
    if (n > 50) return c.reply('Máximo 50 repeticiones.');
    c.reply(Array(n).fill(txt).join('\n'));
  }, ['repeat', 'loop']),

  mk('separar', 'Separa un texto con un delimitador', '<delimitador> | <texto>', (c) => {
    const idx = c.q.indexOf('|');
    if (idx < 0) return c.reply(`Uso: ${c.prefix}separar , | manzana,pera,uva`);
    const sep = c.q.slice(0, idx).trim();
    const txt = c.q.slice(idx + 1).trim();
    const parts = txt.split(sep).map((p, i) => `${i + 1}. ${p.trim()}`);
    c.reply(`📋 *${parts.length} elementos:*\n${parts.join('\n')}`);
  }, ['split', 'dividir']),

  mk('lorem', 'Genera texto Lorem Ipsum', '[párrafos 1-5]', (c) => {
    const pars = Math.min(5, Math.max(1, parseInt(c.args[0]) || 1));
    const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';
    c.reply(Array(pars).fill(lorem).join('\n\n'));
  }, ['placeholder', 'dummy']),

  // ── Calculadoras ──
  mk('imc', 'Calcula el Índice de Masa Corporal', '<peso kg> <altura cm>', (c) => {
    const [pesoStr, altStr] = c.args;
    if (!pesoStr || !altStr) return c.reply(`Uso: ${c.prefix}imc <peso en kg> <altura en cm>\nEjemplo: ${c.prefix}imc 70 175`);
    const peso = parseFloat(pesoStr), alt = parseFloat(altStr) / 100;
    if (isNaN(peso) || isNaN(alt) || alt <= 0) return c.reply('❌ Datos inválidos.');
    const imc = peso / (alt * alt);
    let cat = '';
    if (imc < 18.5) cat = '🔵 Bajo peso';
    else if (imc < 25) cat = '🟢 Normal';
    else if (imc < 30) cat = '🟡 Sobrepeso';
    else cat = '🔴 Obesidad';
    c.reply(`⚖️ *IMC:* ${imc.toFixed(2)}\n*Categoría:* ${cat}\n\n_Peso: ${peso}kg | Altura: ${parseFloat(altStr)}cm_`);
  }, ['bmi', 'masacorporal']),

  mk('propina', 'Calcula la propina de una cuenta', '<monto> [% propina]', (c) => {
    const monto = parseFloat(c.args[0]);
    const pct = parseFloat(c.args[1]) || 15;
    if (isNaN(monto)) return c.reply(`Uso: ${c.prefix}propina <monto> [%]\nEjemplo: ${c.prefix}propina 100 20`);
    const tip = monto * pct / 100;
    c.reply(`💵 *Propina (${pct}%):*\nCuenta: $${monto.toFixed(2)}\nPropina: $${tip.toFixed(2)}\nTotal: $${(monto + tip).toFixed(2)}`);
  }, ['tip', 'cuenta']),

  mk('split', 'Divide una cuenta entre varias personas', '<total> <personas> [% propina]', (c) => {
    const total = parseFloat(c.args[0]);
    const personas = parseInt(c.args[1]);
    const pct = parseFloat(c.args[2]) || 0;
    if (isNaN(total) || isNaN(personas) || personas < 1) return c.reply(`Uso: ${c.prefix}split <total> <personas> [%propina]\nEjemplo: ${c.prefix}split 120 4 10`);
    const totalFinal = total * (1 + pct / 100);
    const porPersona = totalFinal / personas;
    c.reply(`👥 *División de cuenta:*\nTotal: $${total.toFixed(2)}\nPropina (${pct}%): $${(total * pct / 100).toFixed(2)}\nTotal final: $${totalFinal.toFixed(2)}\n\n*Por persona (${personas}):* $${porPersona.toFixed(2)}`);
  }, ['dividircuenta', 'splitcuenta', 'dividecheck']),

  mk('porcentaje', 'Calcula porcentajes de varias formas', '<valor> de <total> | <total> + <pct>% | desc <total> <pct>%', (c) => {
    if (!c.q) return c.reply(`Uso:\n${c.prefix}porcentaje 25 de 200  → Qué % es 25 de 200\n${c.prefix}porcentaje 200 + 15%  → 200 más el 15%\n${c.prefix}porcentaje desc 200 20%  → Descuento 20% en 200`);
    const q = c.q.toLowerCase();
    if (q.startsWith('desc')) {
      const m = q.match(/(\d+\.?\d*)\s+(\d+\.?\d*)%?/);
      if (!m) return c.reply('Ejemplo: .porcentaje desc 200 20%');
      const [,base,pct] = m.map(Number);
      const desc = base * pct / 100;
      return c.reply(`🏷️ Precio: ${base}\nDescuento ${pct}%: -${desc.toFixed(2)}\nPrecio final: ${(base - desc).toFixed(2)}`);
    }
    if (q.includes('de')) {
      const m = q.match(/(\d+\.?\d*)\s+de\s+(\d+\.?\d*)/);
      if (!m) return c.reply('Ejemplo: .porcentaje 25 de 200');
      const pct = (parseFloat(m[1]) / parseFloat(m[2])) * 100;
      return c.reply(`📊 ${m[1]} es el *${pct.toFixed(2)}%* de ${m[2]}`);
    }
    if (q.includes('+')) {
      const m = q.match(/(\d+\.?\d*)\s*\+\s*(\d+\.?\d*)%?/);
      if (!m) return c.reply('Ejemplo: .porcentaje 200 + 15%');
      const [,base,pct] = m.map(parseFloat);
      return c.reply(`➕ ${base} + ${pct}% = *${(base * (1 + pct/100)).toFixed(2)}*`);
    }
    c.reply(`Uso:\n${c.prefix}porcentaje 25 de 200\n${c.prefix}porcentaje 200 + 15%\n${c.prefix}porcentaje desc 200 20%`);
  }, ['percent', 'porciento', 'descuento']),

  mk('prestamo', 'Calcula cuotas de un préstamo', '<monto> <tasa%> <meses>', (c) => {
    const [montoS, tasaS, mesesS] = c.args;
    if (!montoS || !tasaS || !mesesS) return c.reply(`Uso: ${c.prefix}prestamo <monto> <tasa% mensual> <meses>\nEjemplo: ${c.prefix}prestamo 1000 2 12`);
    const P = parseFloat(montoS), r = parseFloat(tasaS) / 100, n = parseInt(mesesS);
    if (isNaN(P) || isNaN(r) || isNaN(n)) return c.reply('❌ Datos inválidos.');
    const cuota = r === 0 ? P/n : P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
    const total = cuota * n;
    c.reply(`🏦 *Simulación de préstamo:*\nMonto: $${P.toFixed(2)}\nTasa mensual: ${(r*100).toFixed(2)}%\nPlazo: ${n} meses\n\n💳 Cuota mensual: $${cuota.toFixed(2)}\n💰 Total a pagar: $${total.toFixed(2)}\n📊 Intereses: $${(total - P).toFixed(2)}`);
  }, ['loan', 'credito', 'cuota']),

  mk('inflacion', 'Calcula el efecto de la inflación en un valor', '<monto> <tasa%> <años>', (c) => {
    const [montoS, tasaS, anosS] = c.args;
    if (!montoS || !tasaS || !anosS) return c.reply(`Uso: ${c.prefix}inflacion <monto> <tasa% anual> <años>\nEjemplo: ${c.prefix}inflacion 100 5 10`);
    const P = parseFloat(montoS), r = parseFloat(tasaS) / 100, n = parseInt(anosS);
    const futuro = P * Math.pow(1 + r, n);
    const poderActual = P / Math.pow(1 + r, n);
    c.reply(`📉 *Efecto de la inflación:*\nValor hoy: $${P.toFixed(2)}\nInflación: ${(r*100).toFixed(1)}% anual | ${n} años\n\nEn ${n} años necesitarás: $${futuro.toFixed(2)}\nPoder adquisitivo actual de $${P}: $${poderActual.toFixed(2)}`);
  }, ['inflation', 'poder']),

  // ── Misc útil ──
  mk('ipinfo', 'Información sobre una IP o dominio', '<ip | dominio>', async (c) => {
    const target = c.args[0] || '';
    if (!target) return c.reply(`Uso: ${c.prefix}ipinfo <ip o dominio>\nEjemplo: ${c.prefix}ipinfo 8.8.8.8`);
    try {
      const axios = require('axios');
      const r = await axios.get(`http://ip-api.com/json/${target}?lang=es`, { timeout: 8000 });
      const d = r.data;
      if (d.status !== 'success') return c.reply(`❌ No encontré info de "${target}".`);
      c.reply(`🌐 *Info de ${d.query}:*\n🗺️ País: ${d.country} (${d.countryCode})\n🏙️ Ciudad: ${d.city}\n📍 Región: ${d.regionName}\n🕐 Zona horaria: ${d.timezone}\n📡 ISP: ${d.isp}\n🏢 ORG: ${d.org || '-'}\n📊 AS: ${d.as || '-'}`);
    } catch { c.reply('❌ No pude consultar esa IP ahora.'); }
  }, ['geoip', 'whoisip', 'myip']),

  mk('qr', 'Genera un código QR de cualquier texto o enlace', '<texto | url>', async (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}qr <texto o enlace>`);
    try {
      const axios = require('axios');
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(c.q.slice(0, 2000))}`;
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      await c.sendImage(Buffer.from(r.data), `📱 QR: ${c.q.slice(0, 50)}`);
    } catch { c.reply('❌ No pude generar el QR ahora.'); }
  }, ['codigoqr', 'generateqr']),

  mk('acortar', 'Acorta una URL larga', '<url>', async (c) => {
    const url = c.args[0] || c.q;
    if (!url || !url.startsWith('http')) return c.reply(`Uso: ${c.prefix}acortar <url>\nEjemplo: ${c.prefix}acortar https://ejemplo.com/pagina-muy-larga`);
    try {
      const axios = require('axios');
      const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
      c.reply(`🔗 *URL acortada:*\n${r.data}`);
    } catch { c.reply('❌ No pude acortar esa URL ahora.'); }
  }, ['shorturl', 'urlcorta', 'tinyurl']),

  mk('dns', 'Consulta los registros DNS de un dominio', '<dominio>', async (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}dns google.com`);
    try {
      const dns = require('dns').promises;
      const [a, mx, ns] = await Promise.allSettled([
        dns.resolve4(c.q),
        dns.resolveMx(c.q).catch(() => []),
        dns.resolveNs(c.q).catch(() => []),
      ]);
      const lines = [`🌐 *DNS de ${c.q}:*`];
      if (a.value?.length) lines.push(`\n📍 *A (IPv4):*\n${a.value.join('\n')}`);
      if (mx.value?.length) lines.push(`\n📧 *MX (Mail):*\n${mx.value.map(x => `${x.priority} ${x.exchange}`).join('\n')}`);
      if (ns.value?.length) lines.push(`\n🔧 *NS:*\n${ns.value.join('\n')}`);
      c.reply(lines.join('') || 'No encontré registros DNS.');
    } catch { c.reply(`❌ No pude resolver "${c.q}".`); }
  }, ['nslookup', 'dnsquery']),

  mk('colorhex', 'Información de un color HEX', '#rrggbb', (c) => {
    const hex = (c.args[0] || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return c.reply(`Uso: ${c.prefix}colorhex #FF6B6B\nEjemplo: ${c.prefix}colorhex 1a73e8`);
    const r = parseInt(hex.slice(0,2), 16);
    const g = parseInt(hex.slice(2,4), 16);
    const b = parseInt(hex.slice(4,6), 16);
    const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
    const hsl = (() => {
      const rn=r/255,gn=g/255,bn=b/255;
      const max=Math.max(rn,gn,bn),min=Math.min(rn,gn,bn);
      let h,s,l=(max+min)/2;
      if(max===min){h=s=0;}else{
        const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
        switch(max){case rn:h=((gn-bn)/d+(gn<bn?6:0))/6;break;case gn:h=((bn-rn)/d+2)/6;break;default:h=((rn-gn)/d+4)/6;}
      }
      return `hsl(${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`;
    })();
    c.reply(`🎨 *Color #${hex.toUpperCase()}:*\n\n🔴 R: ${r}\n🟢 G: ${g}\n🔵 B: ${b}\nRGB: rgb(${r},${g},${b})\nHSL: ${hsl}\nLuminosidad: ${Math.round(lum*100)}%\nTexto: ${lum > 0.5 ? 'negro (oscuro)' : 'blanco (claro)'}`);
  }, ['color', 'hexcolor', 'rgbcolor']),

  mk('leer', 'Lee el texto de un mensaje respondido (para copiarlo fácil)', '', (c) => {
    const t = c.quotedText || c.q;
    if (!t) return c.reply('Responde al mensaje que quieres leer.');
    c.reply(`📋 *Texto del mensaje:*\n\n${t}`);
  }, ['copiar', 'readmsg', 'gettext']),

  mk('chars', 'Muestra info de caracteres especiales en un texto', '<texto>', (c) => {
    const t = c.q || c.quotedText;
    if (!t) return c.reply(`Uso: ${c.prefix}chars <texto>`);
    const unicodes = [...t].slice(0, 20).map(ch => `${ch} → U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`);
    c.reply(`🔣 *Caracteres (primeros 20):*\n${unicodes.join('\n')}`);
  }, ['unicode', 'codepoints']),
];
