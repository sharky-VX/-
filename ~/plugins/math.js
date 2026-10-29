const U = require('../lib/utils');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'math', run });

// Lee todos los argumentos como números (acepta coma decimal)
const nums = (c) => c.args.map((x) => parseFloat(String(x).replace(',', '.'))).filter((x) => !isNaN(x));
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toPrecision(10)));
const one = (name, desc, ex, fn, aliases = []) =>
  mk(name, desc, '<número>', (c) => {
    const [n] = nums(c);
    if (n === undefined) return c.reply(`Ejemplo: .${name} ${ex}`);
    const r = fn(n);
    return c.reply(`🧮 ${name}(${fmt(n)}) = *${typeof r === 'number' ? fmt(r) : r}*`);
  }, aliases);
const many = (name, desc, fn, aliases = []) =>
  mk(name, desc, '<n1> <n2> ...', (c) => {
    const n = nums(c);
    if (!n.length) return c.reply(`Ejemplo: .${name} 4 8 15 16 23 42`);
    return c.reply(`🧮 ${name} = *${fmt(fn(n))}*`);
  }, aliases);

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const fact = (n) => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const isPrime = (n) => { if (n < 2 || !Number.isInteger(n)) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };

// Número → palabras en español (hasta 999.999.999.999)
const U20 = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUND = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
const below1000 = (n) => {
  if (n === 100) return 'cien';
  if (n < 30) return U20[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' y ' + U20[n % 10] : '');
  return HUND[Math.floor(n / 100)] + (n % 100 ? ' ' + below1000(n % 100) : '');
};
const words = (n) => {
  if (n < 1000) return below1000(n);
  if (n < 1e6) { const m = Math.floor(n / 1000), r = n % 1000; return (m === 1 ? 'mil' : below1000(m).replace(/uno$/, 'ún') + ' mil') + (r ? ' ' + below1000(r) : ''); }
  if (n < 1e12) { const m = Math.floor(n / 1e6), r = n % 1e6; return (m === 1 ? 'un millón' : words(m).replace(/uno$/, 'ún') + ' millones') + (r ? ' ' + words(r) : ''); }
  return 'número demasiado grande';
};

const ZODIAC = [['Capricornio ♑', 20], ['Acuario ♒', 19], ['Piscis ♓', 20], ['Aries ♈', 20], ['Tauro ♉', 21], ['Géminis ♊', 21], ['Cáncer ♋', 22], ['Leo ♌', 22], ['Virgo ♍', 22], ['Libra ♎', 23], ['Escorpio ♏', 22], ['Sagitario ♐', 21]];
const zodiac = (d, m) => (d < ZODIAC[m - 1][1] ? ZODIAC[(m + 10) % 12][0] : ZODIAC[m - 1][0]);

const parseDate = (s) => {
  const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return isNaN(d) ? null : d;
};

const list = [
  one('raiz', 'Raíz cuadrada', '144', Math.sqrt, ['sqrt']),
  one('cubo', 'Elevar al cubo', '3', (n) => n ** 3),
  one('cuadrado', 'Elevar al cuadrado', '12', (n) => n ** 2),
  one('raizcubica', 'Raíz cúbica', '27', Math.cbrt, ['cbrt']),
  one('abs', 'Valor absoluto', '-7', Math.abs),
  one('redondear', 'Redondea al entero más cercano', '3.7', Math.round),
  one('piso', 'Redondea hacia abajo', '3.7', Math.floor, ['floor']),
  one('techo', 'Redondea hacia arriba', '3.2', Math.ceil, ['ceil']),
  one('seno', 'Seno (grados)', '30', (n) => +Math.sin((n * Math.PI) / 180).toFixed(10), ['sin']),
  one('coseno', 'Coseno (grados)', '60', (n) => +Math.cos((n * Math.PI) / 180).toFixed(10), ['cos']),
  one('tangente', 'Tangente (grados)', '45', (n) => +Math.tan((n * Math.PI) / 180).toFixed(10), ['tan']),
  one('log10', 'Logaritmo base 10', '1000', Math.log10),
  one('ln', 'Logaritmo natural', '2.718', Math.log),
  one('log2', 'Logaritmo base 2', '1024', Math.log2),
  one('exp', 'e elevado a x', '1', Math.exp),
  one('par', '¿Par o impar?', '7', (n) => (n % 2 === 0 ? 'par' : 'impar'), ['impar']),
  one('bisiesto', '¿Es año bisiesto?', '2028', (n) => ((n % 4 === 0 && n % 100 !== 0) || n % 400 === 0 ? 'sí 🟢' : 'no 🔴')),
  one('primo', '¿Es número primo?', '97', (n) => (isPrime(n) ? 'sí es primo ✅' : 'no es primo ❌')),
  one('factorial', 'Factorial (hasta 500)', '10', (n) => (n < 0 || n > 500 || !Number.isInteger(n) ? 'solo enteros 0-500' : fact(n).toString())),
  one('fibonacci', 'Término n de Fibonacci', '30', (n) => {
    if (n < 0 || n > 1000 || !Number.isInteger(n)) return 'solo enteros 0-1000';
    let a = 0n, b = 1n;
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a.toString();
  }, ['fib']),
  one('factores', 'Factores primos', '360', (n) => {
    if (!Number.isInteger(n) || n < 2 || n > 1e12) return 'entero entre 2 y 1e12';
    const f = [];
    for (let i = 2; i * i <= n; i++) while (n % i === 0) { f.push(i); n /= i; }
    if (n > 1) f.push(n);
    return f.join(' × ');
  }),
  one('divisores', 'Todos los divisores de un número', '28', (n) => {
    if (!Number.isInteger(n) || n < 1 || n > 1e9) return 'entero entre 1 y 1e9';
    const d = [];
    for (let i = 1; i * i <= n; i++) if (n % i === 0) { d.push(i); if (i !== n / i) d.push(n / i); }
    return d.sort((a, b) => a - b).join(', ');
  }),
  one('palabras', 'Número en palabras (español)', '1250', (n) => (n < 0 || !Number.isInteger(n) ? 'solo enteros positivos' : words(n)), ['numerotexto']),
  one('fraccion', 'Decimal a fracción', '0.75', (n) => {
    let [h1, h0, k1, k0, x] = [1, 0, 0, 1, Math.abs(n)];
    for (let i = 0; i < 30; i++) {
      const a = Math.floor(x);
      [h1, h0] = [a * h1 + h0, h1];
      [k1, k0] = [a * k1 + k0, k1];
      if (Math.abs(Math.abs(n) - h1 / k1) < 1e-9 || k1 > 10000) break;
      x = 1 / (x - a);
    }
    return `${n < 0 ? '-' : ''}${h1}/${k1}`;
  }),
  one('areacirculo', 'Área de un círculo (radio)', '5', (n) => +(Math.PI * n * n).toFixed(4)),
  one('perimetrocirculo', 'Perímetro de un círculo (radio)', '5', (n) => +(2 * Math.PI * n).toFixed(4)),
  one('volesfera', 'Volumen de una esfera (radio)', '3', (n) => +((4 / 3) * Math.PI * n ** 3).toFixed(4)),
  one('areacuadrado', 'Área de un cuadrado (lado)', '4', (n) => n * n),
  one('volcubo', 'Volumen de un cubo (lado)', '3', (n) => n ** 3),

  many('suma', 'Suma de números', (n) => n.reduce((a, b) => a + b, 0), ['sum']),
  many('producto', 'Multiplica todos los números', (n) => n.reduce((a, b) => a * b, 1)),
  many('promedio', 'Promedio (media)', (n) => n.reduce((a, b) => a + b, 0) / n.length, ['media', 'avg']),
  many('mediana', 'Mediana', (n) => { const s = [...n].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }),
  many('maximo', 'Número mayor', (n) => Math.max(...n), ['max']),
  many('minimo', 'Número menor', (n) => Math.min(...n), ['min']),
  many('rango', 'Rango (máx - mín)', (n) => Math.max(...n) - Math.min(...n)),
  many('desviacion', 'Desviación estándar', (n) => { const m = n.reduce((a, b) => a + b, 0) / n.length; return Math.sqrt(n.reduce((a, b) => a + (b - m) ** 2, 0) / n.length); }, ['stdev']),
  many('mcd', 'Máximo común divisor', (n) => n.reduce((a, b) => gcd(a, b)), ['gcd']),
  many('mcm', 'Mínimo común múltiplo', (n) => n.reduce((a, b) => Math.abs(a * b) / gcd(a, b)), ['lcm']),
  many('hipotenusa', 'Hipotenusa (catetos a b)', ([a, b]) => Math.hypot(a, b ?? 0)),

  mk('potencia', 'Base elevada a un exponente', '<base> <exponente>', (c) => {
    const [a, b] = nums(c);
    if (b === undefined) return c.reply('Ejemplo: .potencia 2 10');
    c.reply(`🧮 ${fmt(a)}^${fmt(b)} = *${fmt(a ** b)}*`);
  }, ['pow']),

  mk('logbase', 'Logaritmo en cualquier base', '<número> <base>', (c) => {
    const [a, b] = nums(c);
    if (b === undefined) return c.reply('Ejemplo: .logbase 81 3');
    c.reply(`🧮 log base ${b} de ${a} = *${fmt(Math.log(a) / Math.log(b))}*`);
  }),

  mk('porcentaje', 'Calcula el X% de un número', '<porcentaje> <número>', (c) => {
    const [p, n] = nums(c);
    if (n === undefined) return c.reply('Ejemplo: .porcentaje 15 200  (el 15% de 200)');
    c.reply(`📊 El ${fmt(p)}% de ${fmt(n)} es *${fmt((p / 100) * n)}*`);
  }, ['percent']),

  mk('quepercent', '¿Qué porcentaje es A de B?', '<a> <b>', (c) => {
    const [a, b] = nums(c);
    if (!b) return c.reply('Ejemplo: .quepercent 30 120');
    c.reply(`📊 ${fmt(a)} es el *${fmt((a / b) * 100)}%* de ${fmt(b)}`);
  }),

  mk('regla3', 'Regla de tres simple', '<a> <b> <c>   (a es a b como c es a ?)', (c) => {
    const [a, b, x] = nums(c);
    if (x === undefined || !a) return c.reply('Ejemplo: .regla3 5 20 8  → si 5 es a 20, 8 es a ?');
    c.reply(`📐 ${fmt(a)} → ${fmt(b)}\n${fmt(x)} → *${fmt((b * x) / a)}*`);
  }),

  mk('iva', 'Calcula el IVA', '<monto> [porcentaje=16]', (c) => {
    const [m, p = 16] = nums(c);
    if (m === undefined) return c.reply('Ejemplo: .iva 100 16');
    c.reply(`🧾 Base: ${fmt(m)}\nIVA ${p}%: ${fmt((m * p) / 100)}\n💰 Total: *${fmt(m * (1 + p / 100))}*`);
  }),

  mk('descuento', 'Precio con descuento', '<precio> <% descuento>', (c) => {
    const [m, p] = nums(c);
    if (p === undefined) return c.reply('Ejemplo: .descuento 80 25');
    c.reply(`🏷️ Precio: ${fmt(m)}\nDescuento ${p}%: -${fmt((m * p) / 100)}\n💰 Pagas: *${fmt(m * (1 - p / 100))}*`);
  }),

  mk('propina', 'Calcula la propina', '<cuenta> [% = 10] [personas = 1]', (c) => {
    const [m, p = 10, n = 1] = nums(c);
    if (m === undefined) return c.reply('Ejemplo: .propina 50 10 4');
    const total = m * (1 + p / 100);
    c.reply(`🍽️ Cuenta: ${fmt(m)}\nPropina ${p}%: ${fmt((m * p) / 100)}\n💰 Total: *${fmt(total)}*\n👥 Por persona (${n}): *${fmt(total / n)}*`);
  }),

  mk('interes', 'Interés compuesto', '<capital> <% anual> <años>', (c) => {
    const [P, r, t] = nums(c);
    if (t === undefined) return c.reply('Ejemplo: .interes 1000 8 5');
    const total = P * (1 + r / 100) ** t;
    c.reply(`📈 Capital: ${fmt(P)}\nTasa: ${r}% anual • ${t} años\n💰 Final: *${fmt(+total.toFixed(2))}*\n🪙 Ganancia: ${fmt(+(total - P).toFixed(2))}`);
  }),

  mk('cuota', 'Cuota mensual de un préstamo', '<monto> <% anual> <meses>', (c) => {
    const [P, a, n] = nums(c);
    if (n === undefined) return c.reply('Ejemplo: .cuota 5000 12 24');
    const r = a / 100 / 12;
    const pay = r ? (P * r) / (1 - (1 + r) ** -n) : P / n;
    c.reply(`🏦 Préstamo: ${fmt(P)} • ${a}% anual • ${n} meses\n💳 Cuota mensual: *${fmt(+pay.toFixed(2))}*\n💰 Total a pagar: ${fmt(+(pay * n).toFixed(2))}\n🧾 Intereses: ${fmt(+(pay * n - P).toFixed(2))}`);
  }, ['cuotaprestamo', 'loancalc']),

  mk('imc', 'Índice de masa corporal', '<peso kg> <estatura m o cm>', (c) => {
    let [w, h] = nums(c);
    if (h === undefined) return c.reply('Ejemplo: .imc 70 1.75   (o 175)');
    if (h > 3) h /= 100;
    const v = w / h ** 2;
    const cat = v < 18.5 ? 'Bajo peso' : v < 25 ? 'Peso normal' : v < 30 ? 'Sobrepeso' : 'Obesidad';
    c.reply(`⚖️ IMC: *${v.toFixed(1)}* — ${cat}\n_Es solo una referencia general, no un diagnóstico. Consulta a un profesional de la salud._`);
  }, ['bmi']),

  mk('edadcalc', 'Tu edad exacta a partir de la fecha de nacimiento', '<dd/mm/aaaa>', (c) => {
    const b = parseDate(c.args[0]);
    if (!b) return c.reply('Ejemplo: .edadcalc 25/12/2000');
    const n = new Date();
    let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth(), d = n.getDate() - b.getDate();
    if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    c.reply(`🎂 Tienes *${y} años, ${m} meses y ${d} días*\n📆 Has vivido ${Math.floor((n - b) / 86400000).toLocaleString('es')} días\n${zodiac(b.getDate(), b.getMonth() + 1)}`);
  }, ['edad']),

  mk('diasentre', 'Días entre dos fechas', '<dd/mm/aaaa> <dd/mm/aaaa>', (c) => {
    const a = parseDate(c.args[0]), b = parseDate(c.args[1]);
    if (!a || !b) return c.reply('Ejemplo: .diasentre 01/01/2026 25/12/2026');
    const d = Math.round((b - a) / 86400000);
    c.reply(`📆 Hay *${Math.abs(d)} días* (${(Math.abs(d) / 7).toFixed(1)} semanas) entre ambas fechas.`);
  }),

  mk('diasemana', 'Qué día de la semana cae una fecha', '<dd/mm/aaaa>', (c) => {
    const a = parseDate(c.args[0]);
    if (!a) return c.reply('Ejemplo: .diasemana 25/12/2026');
    c.reply(`📆 Cae en *${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][a.getDay()]}*`);
  }),

  mk('zodiaco', 'Tu signo zodiacal', '<dd/mm>', (c) => {
    const m = /^(\d{1,2})[\/-](\d{1,2})/.exec(c.args[0] || '');
    if (!m || +m[2] > 12 || +m[1] > 31) return c.reply('Ejemplo: .zodiaco 25/12');
    c.reply(`🔮 Tu signo es *${zodiac(+m[1], +m[2])}*`);
  }, ['signo']),

  mk('base', 'Convierte un número entre bases (2-36)', '<número> <base origen> <base destino>', (c) => {
    const [num, from, to] = c.args;
    if (!num || !from || !to) return c.reply('Ejemplo: .base ff 16 2');
    const n = parseInt(num, +from);
    if (isNaN(n)) return c.reply('❌ Número inválido para esa base.');
    c.reply(`🔢 ${num} (base ${from}) = *${n.toString(+to).toUpperCase()}* (base ${to})`);
  }),

  mk('roman', 'Número → romano', '<1-3999>', (c) => {
    let n = parseInt(c.args[0]);
    if (!n || n < 1 || n > 3999) return c.reply('Ejemplo: .roman 2026 (1 a 3999)');
    let r = '';
    for (const [v, s] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { r += s; n -= v; }
    c.reply(`🏛️ ${r}`);
  }, ['romano']),

  mk('unroman', 'Romano → número', '<XIV>', (c) => {
    const s = (c.args[0] || '').toUpperCase();
    if (!/^[IVXLCDM]+$/.test(s)) return c.reply('Ejemplo: .unroman MMXXVI');
    const m = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let t = 0;
    for (let i = 0; i < s.length; i++) t += m[s[i]] < (m[s[i + 1]] || 0) ? -m[s[i]] : m[s[i]];
    c.reply(`🔢 ${t}`);
  }, ['deromano']),

  mk('dec2bin', 'Decimal → binario', '<número>', (c) => (isNaN(parseInt(c.args[0])) ? c.reply('Ejemplo: .dec2bin 25') : c.reply(`🔁 ${parseInt(c.args[0]).toString(2)}`)), ['d2b']),
  mk('bin2dec', 'Binario → decimal', '<binario>', (c) => (/^[01]+$/.test(c.args[0] || '') ? c.reply(`🔁 ${parseInt(c.args[0], 2)}`) : c.reply('Ejemplo: .bin2dec 11001')), ['b2d']),
  mk('dec2hex', 'Decimal → hexadecimal', '<número>', (c) => (isNaN(parseInt(c.args[0])) ? c.reply('Ejemplo: .dec2hex 255') : c.reply(`🔁 ${parseInt(c.args[0]).toString(16).toUpperCase()}`)), ['d2x']),
  mk('hex2dec', 'Hexadecimal → decimal', '<hex>', (c) => (/^[0-9a-f]+$/i.test(c.args[0] || '') ? c.reply(`🔁 ${parseInt(c.args[0], 16)}`) : c.reply('Ejemplo: .hex2dec FF')), ['x2d']),
  mk('dec2oct', 'Decimal → octal', '<número>', (c) => (isNaN(parseInt(c.args[0])) ? c.reply('Ejemplo: .dec2oct 64') : c.reply(`🔁 ${parseInt(c.args[0]).toString(8)}`))),
  mk('oct2dec', 'Octal → decimal', '<octal>', (c) => (/^[0-7]+$/.test(c.args[0] || '') ? c.reply(`🔁 ${parseInt(c.args[0], 8)}`) : c.reply('Ejemplo: .oct2dec 100'))),

  mk('combinaciones', 'Combinaciones C(n, r)', '<n> <r>', (c) => {
    const [n, r] = nums(c);
    if (r === undefined || !Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n || n > 500) return c.reply('Ejemplo: .combinaciones 10 3  (n ≤ 500)');
    c.reply(`🎲 C(${n},${r}) = *${(fact(n) / (fact(r) * fact(n - r))).toString()}*`);
  }, ['ncr']),

  mk('permutaciones', 'Permutaciones P(n, r)', '<n> <r>', (c) => {
    const [n, r] = nums(c);
    if (r === undefined || !Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n || n > 500) return c.reply('Ejemplo: .permutaciones 10 3  (n ≤ 500)');
    c.reply(`🎲 P(${n},${r}) = *${(fact(n) / fact(n - r)).toString()}*`);
  }, ['npr']),

  mk('ecuacion2', 'Ecuación de 2º grado ax²+bx+c=0', '<a> <b> <c>', (c) => {
    const [a, b, k] = nums(c);
    if (k === undefined || a === 0) return c.reply('Ejemplo: .ecuacion2 1 -3 2');
    const d = b * b - 4 * a * k;
    if (d < 0) return c.reply(`📐 Discriminante ${fmt(d)} < 0 → no tiene soluciones reales.`);
    const x1 = (-b + Math.sqrt(d)) / (2 * a), x2 = (-b - Math.sqrt(d)) / (2 * a);
    c.reply(`📐 Discriminante: ${fmt(d)}\nx₁ = *${fmt(+x1.toFixed(8))}*\nx₂ = *${fmt(+x2.toFixed(8))}*`);
  }, ['cuadratica']),
];

// ── Dados de rol: .d20  .d6 3 (tira 3 dados) ──
for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
  list.push(mk(`d${sides}`, `Tira un dado de ${sides} caras`, '[cantidad]', (c) => {
    const n = U.clamp(parseInt(c.args[0]) || 1, 1, 20);
    const r = Array.from({ length: n }, () => U.rand(1, sides));
    c.reply(`🎲 d${sides} ×${n}: *${r.join(', ')}*${n > 1 ? `\nTotal: ${r.reduce((a, b) => a + b, 0)}` : ''}`);
  }));
}

module.exports = list;
