// ═══════════════════════════════════════════════
//  Categoría POKEMON — SHARKNEX
// ═══════════════════════════════════════════════
const axios = require('axios');
const db = require('../lib/db');
const U = require('../lib/utils');
const { sans, C } = require('../lib/deco');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({
  name, aliases, desc, usage, category: 'pokemon', run, ...extra,
});

const numOf = (j) => String(j || '').split('@')[0].split(':')[0];
const nameOf = (n) => db.data.names?.[n] || ('+' + String(n).slice(-4));

function pokeUser(n) {
  const u = db.user(n);
  if (!u.pokemon) u.pokemon = { list: [], catches: 0, lastCatch: 0 };
  if (!Array.isArray(u.pokemon.list)) u.pokemon.list = [];
  return u.pokemon;
}

async function randomPoke() {
  const id = U.rand(1, 151); // gen 1
  try {
    const { data } = await axios.get('https://pokeapi.co/api/v2/pokemon/' + id, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return {
      id: data.id,
      name: data.name,
      sprite: data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default,
      types: (data.types || []).map((t) => t.type.name).join(', '),
      hp: data.stats?.find((s) => s.stat.name === 'hp')?.base_stat || 50,
    };
  } catch {
    return { id, name: 'pokemon-' + id, sprite: null, types: 'normal', hp: 50 };
  }
}

const list = [
  mk('pokecatch', 'Captura un pokemon aleatorio (cooldown)', '', async (c) => {
    const p = pokeUser(c.senderNum);
    const wait = 45000;
    if (Date.now() - (p.lastCatch || 0) < wait) {
      const s = Math.ceil((wait - (Date.now() - p.lastCatch)) / 1000);
      return c.reply(C.quote + 'Espera ' + s + 's para otra captura.');
    }
    const poke = await randomPoke();
    p.lastCatch = Date.now();
    p.catches = (p.catches || 0) + 1;
    p.list.push({ id: poke.id, name: poke.name, at: Date.now() });
    if (p.list.length > 60) p.list = p.list.slice(-60);
    db.save();
    const caption = [
      '   ❀ 𓆩 ' + sans('pokecatch') + ' 𓆪 ❀',
      '',
      '*' + c.pushName + '* capturo a *' + poke.name.toUpperCase() + '*',
      'Tipo: ' + poke.types,
      'HP base: ' + poke.hp,
      'Total: ' + p.list.length + ' pokemon',
      '   ❀',
    ].join('\n');
    if (poke.sprite) {
      try {
        const buf = await U.getBuffer(poke.sprite, { timeout: 15000 });
        return c.sock.sendMessage(c.from, { image: buf, caption }, { quoted: c.m });
      } catch {}
    }
    return c.reply(caption);
  }, ['catch', 'capturar', 'pokeball']),

  mk('pokedex', 'Tu lista de pokemon', '[@usuario]', async (c) => {
    const key = c.mentioned[0] ? numOf(c.mentioned[0]) : c.senderNum;
    const p = pokeUser(key);
    if (!p.list.length) return c.reply(C.quote + 'Sin pokemon. Usa .pokecatch');
    const counts = {};
    for (const x of p.list) counts[x.name] = (counts[x.name] || 0) + 1;
    const lines = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([n, v], i) => (i + 1) + '. ' + n + ' x' + v);
    return c.reply([
      '   ❀ 𓆩 ' + sans('pokedex') + ' 𓆪 ❀',
      'Entrenador: ' + nameOf(key),
      'Total: ' + p.list.length + ' | Capturas: ' + (p.catches || 0),
      '',
      ...lines,
      '   ❀',
    ].join('\n'));
  }, ['mispokemon', 'pokemon']),

  mk('pokeinfo', 'Info de un pokemon (PokeAPI)', '<nombre|id>', async (c) => {
    const q = (c.q || '').trim().toLowerCase();
    if (!q) return c.reply(C.quote + 'Ej: .pokeinfo pikachu');
    try {
      const { data } = await axios.get('https://pokeapi.co/api/v2/pokemon/' + encodeURIComponent(q), {
        timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const types = (data.types || []).map((t) => t.type.name).join(', ');
      const stats = (data.stats || []).map((s) => s.stat.name + ': ' + s.base_stat).join('\n  ');
      const sprite = data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default;
      const caption = [
        '   ❀ 𓆩 ' + sans(data.name) + ' 𓆪 ❀',
        'ID: ' + data.id,
        'Tipos: ' + types,
        'Altura: ' + data.height + ' | Peso: ' + data.weight,
        'Stats:',
        '  ' + stats,
        '   ❀',
      ].join('\n');
      if (sprite) {
        const buf = await U.getBuffer(sprite);
        return c.sock.sendMessage(c.from, { image: buf, caption }, { quoted: c.m });
      }
      return c.reply(caption);
    } catch {
      return c.reply(C.quote + 'No encontre ese pokemon.');
    }
  }, ['pokedata']),

  mk('poketop', 'Top entrenadores con mas pokemon', '', (c) => {
    const rows = Object.entries(db.data.users || {})
      .map(([n, u]) => [n, (u.pokemon && u.pokemon.list && u.pokemon.list.length) || 0, (u.pokemon && u.pokemon.catches) || 0])
      .filter((r) => r[1] > 0)
      .sort((a, b) => b[1] - a[1] || b[2] - a[2])
      .slice(0, 10);
    if (!rows.length) return c.reply(C.quote + 'Nadie ha capturado aun.');
    const lines = rows.map(([n, total, catches], i) =>
      (i + 1) + '. ' + nameOf(n) + ' — ' + total + ' poke (' + catches + ' capturas)'
    );
    return c.reply([
      '   ❀ 𓆩 ' + sans('poketop') + ' 𓆪 ❀',
      '',
      ...lines,
      '   ❀',
    ].join('\n'));
  }, ['toppokemon', 'toppoke']),

  mk('pokerelease', 'Libera un pokemon de tu lista', '<nombre>', (c) => {
    const q = (c.q || '').trim().toLowerCase();
    if (!q) return c.reply(C.quote + 'Ej: .pokerelease pikachu');
    const p = pokeUser(c.senderNum);
    const idx = p.list.findIndex((x) => x.name === q);
    if (idx < 0) return c.reply(C.quote + 'No tienes ese pokemon.');
    p.list.splice(idx, 1);
    db.save();
    return c.reply(C.quote + 'Liberaste a *' + q + '*. Te quedan ' + p.list.length);
  }, ['liberar']),

  mk('pokevs', 'Combate simple vs otro entrenador (al azar)', '@usuario', async (c) => {
    const t = c.mentioned[0] || c.quoted?.sender;
    if (!t) return c.reply(C.quote + 'Menciona a alguien.');
    const a = pokeUser(c.senderNum);
    const b = pokeUser(numOf(t));
    if (!a.list.length || !b.list.length) return c.reply(C.quote + 'Ambos necesitan al menos 1 pokemon (.pokecatch).');
    const pa = a.list[U.rand(0, a.list.length - 1)];
    const pb = b.list[U.rand(0, b.list.length - 1)];
    const scoreA = U.rand(40, 100);
    const scoreB = U.rand(40, 100);
    const win = scoreA >= scoreB ? c.pushName : nameOf(numOf(t));
    return c.reply([
      '   ❀ 𓆩 ' + sans('pokevs') + ' 𓆪 ❀',
      c.pushName + ' saco a *' + pa.name + '* (' + scoreA + ')',
      nameOf(numOf(t)) + ' saco a *' + pb.name + '* (' + scoreB + ')',
      '',
      'Ganador: *' + win + '*',
      '   ❀',
    ].join('\n'));
  }, ['pokepelea']),

  mk('pokehelp', 'Ayuda categoria pokemon', '', (c) => {
    const p = c.prefix || '.';
    return c.reply([
      '   ❀ 𓆩 ' + sans('pokemon') + ' 𓆪 ❀',
      p + 'pokecatch — capturar',
      p + 'pokedex — tu lista',
      p + 'pokeinfo <nombre>',
      p + 'poketop — ranking',
      p + 'pokerelease <nombre>',
      p + 'pokevs @user',
      '   ❀',
    ].join('\n'));
  }, ['menupokemon']),
];

module.exports = list;
