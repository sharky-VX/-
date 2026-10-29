// ═══════════════════════════════════════════════
//  Conversores. Los atajos como .km2mi se GENERAN solos a partir de las tablas de abajo.
//  Para agregar una unidad: añádela a su familia con su factor respecto a la unidad base.
// ═══════════════════════════════════════════════
const U = require('../lib/utils');

// familia → { unidad: factor para llegar a la unidad base }
const FAMILIES = {
  longitud: { base: 'metro', units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852 } },
  masa: { base: 'kg', units: { mg: 1e-6, g: 0.001, kg: 1, ton: 1000, oz: 0.028349523, lb: 0.45359237, st: 6.35029318 } },
  volumen: { base: 'litro', units: { ml: 0.001, l: 1, m3: 1000, tsp: 0.00492892, tbsp: 0.0147868, cup: 0.236588, floz: 0.0295735, pt: 0.473176, qt: 0.946353, gal: 3.785411784 } },
  area: { base: 'm²', units: { sqmm: 1e-6, sqcm: 1e-4, sqm: 1, sqkm: 1e6, ha: 1e4, acre: 4046.8564224, sqft: 0.09290304, sqin: 0.00064516, sqyd: 0.83612736, sqmi: 2589988.110336 } },
  velocidad: { base: 'm/s', units: { ms: 1, kmh: 1 / 3.6, mph: 0.44704, kn: 0.514444, fts: 0.3048 } },
  tiempo: { base: 'segundo', units: { sec: 1, min: 60, hr: 3600, day: 86400, wk: 604800, mo: 2629800, yr: 31557600 } },
  datos: { base: 'byte', units: { byte: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4, pb: 1024 ** 5 } },
  energia: { base: 'joule', units: { j: 1, kj: 1000, cal: 4.184, kcal: 4184, wh: 3600, kwh: 3.6e6, btu: 1055.056 } },
  presion: { base: 'pascal', units: { pa: 1, kpa: 1000, bar: 1e5, atm: 101325, psi: 6894.757, mmhg: 133.322 } },
  vatios: { base: 'watt', units: { w: 1, kw: 1000, hp: 745.6999 } },
  angulo: { base: 'grado', units: { deg: 1, rad: 180 / Math.PI, grad: 0.9 } },
};

const TEMP = {
  c: { f: (x) => (x * 9) / 5 + 32, k: (x) => x + 273.15 },
  f: { c: (x) => ((x - 32) * 5) / 9, k: (x) => ((x - 32) * 5) / 9 + 273.15 },
  k: { c: (x) => x - 273.15, f: (x) => ((x - 273.15) * 9) / 5 + 32 },
};

const round = (n) => (Math.abs(n) >= 1e-4 && Math.abs(n) < 1e12 ? +n.toPrecision(10) : n.toExponential(6));
const first = (c) => parseFloat(String(c.args[0] || '').replace(',', '.'));

const list = [];

// Convertidor universal: .convertir 5 km mi
const find = (u) => {
  const x = u.toLowerCase();
  for (const f of Object.values(FAMILIES)) if (f.units[x] !== undefined) return f.units;
  return null;
};
list.push({
  name: 'convertir', aliases: ['convert', 'unidades'], category: 'convert', desc: 'Convierte entre cualquier unidad', usage: '<valor> <de> <a>',
  run: (c) => {
    const n = first(c);
    const [, a, b] = c.args;
    if (isNaN(n) || !a || !b) return c.reply('Ejemplo: .convertir 5 km mi\nVer unidades: .conversiones');
    const k = a.toLowerCase(), l = b.toLowerCase();
    if (TEMP[k]?.[l]) return c.reply(`🌡️ ${n}°${k.toUpperCase()} = *${round(TEMP[k][l](n))}°${l.toUpperCase()}*`);
    const ua = find(k), ub = find(l);
    if (!ua || ua !== ub) return c.reply('❌ Unidades desconocidas o de familias distintas. Mira .conversiones');
    c.reply(`🔁 ${n} ${k} = *${round((n * ua[k]) / ua[l])} ${l}*`);
  },
});

// Guía de unidades
list.push({
  name: 'conversiones', aliases: ['unidadeslista'], category: 'convert', desc: 'Lista de unidades disponibles', usage: '',
  run: (c) => {
    const lines = Object.entries(FAMILIES).map(([f, { units }]) => `📐 *${f}*: ${Object.keys(units).join(', ')}`);
    c.reply(`🔁 *CONVERSORES*\n\nUso: ${c.prefix}convertir <valor> <de> <a>  →  ej: ${c.prefix}convertir 10 km mi\n\n${lines.join('\n')}\n🌡️ *temperatura*: c, f, k  (ej: ${c.prefix}convertir 30 c f)`);
  },
});

// Guías por familia (visibles en el menú): .longitud, .masa ...
for (const [fam, { units }] of Object.entries(FAMILIES)) {
  const names = Object.keys(units);
  list.push({
    name: fam, category: 'convert', desc: `Unidades de ${fam}`, usage: '',
    run: (c) => c.reply(`📐 *${fam.toUpperCase()}*\nUnidades: ${names.join(', ')}\n\nEjemplos:\n• ${c.prefix}convertir 10 ${names[0]} ${names[1]}\n• ${c.prefix}convertir 10 ${names[1]} ${names[0]}`),
  });
}

module.exports = list;
