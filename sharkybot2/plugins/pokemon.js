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
  const id = U.rand(1, 386); // gen 1-3
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
      p + 'pokebattle @user',
      p + 'pokeshiny — shiny raro',
      p + 'pokeheal — curar equipo',
      p + 'pokerank — rango',
      p + 'pokecompare a | b',
      p + 'pokeitem pocion|superball',
      '   ❀',
    ].join('\n'));
  }, ['menupokemon']),

  mk('pokeheal', 'Cura a tu equipo (cooldown)', '', (c) => {
    const p = pokeUser(c.senderNum);
    if (!p.list.length) return c.reply(C.quote + 'No tienes pokemon.');
    const wait = 120000;
    if (Date.now() - (p.lastHeal || 0) < wait) {
      return c.reply(C.quote + 'Espera ' + Math.ceil((wait - (Date.now() - p.lastHeal)) / 1000) + 's.');
    }
    p.lastHeal = Date.now();
    p.list.forEach((x) => { x.hp = 100; });
    db.save();
    return c.reply([
      '   ❀ 𓆩 ' + sans('pokeheal') + ' 𓆪 ❀',
      'Equipo curado: ' + p.list.length + ' pokemon al 100%',
      '   ❀',
    ].join('\n'));
  }, ['curarpoke']),

  mk('pokebattle', 'Batalla vs otro entrenador (random)', '@usuario', async (c) => {
    const t = (c.mentioned && c.mentioned[0]) || (c.quoted && c.quoted.sender);
    if (!t) return c.reply(C.quote + 'Menciona a alguien: .pokebattle @user');
    const a = pokeUser(c.senderNum);
    const b = pokeUser(numOf(t));
    if (!a.list.length || !b.list.length) return c.reply(C.quote + 'Ambos necesitan al menos 1 pokemon.');
    const pa = a.list[U.rand(0, a.list.length - 1)];
    const pb = b.list[U.rand(0, b.list.length - 1)];
    const sa = U.rand(40, 120);
    const sb = U.rand(40, 120);
    const winA = sa >= sb;
    const winner = winA ? c.pushName : nameOf(numOf(t));
    return c.reply([
      '   ❀ 𓆩 ' + sans('pokebattle') + ' 𓆪 ❀',
      '',
      c.pushName + ' uso *' + String(pa.name).toUpperCase() + '* (pwr ' + sa + ')',
      nameOf(numOf(t)) + ' uso *' + String(pb.name).toUpperCase() + '* (pwr ' + sb + ')',
      '',
      'Ganador: *' + winner + '*',
      '   ❀',
    ].join('\n'), { mentions: [c.sender, t] });
  }, ['batallapoke']),

  mk('pokeshiny', 'Intenta encontrar un shiny (raro)', '', async (c) => {
    const p = pokeUser(c.senderNum);
    const wait = 90000;
    if (Date.now() - (p.lastShiny || 0) < wait) {
      return c.reply(C.quote + 'Espera ' + Math.ceil((wait - (Date.now() - p.lastShiny)) / 1000) + 's.');
    }
    p.lastShiny = Date.now();
    const shiny = Math.random() < 0.08;
    const poke = await randomPoke();
    if (shiny) {
      p.list.push({ id: poke.id, name: poke.name + ' ★', shiny: true, at: Date.now() });
      p.catches = (p.catches || 0) + 1;
      if (p.list.length > 60) p.list = p.list.slice(-60);
      db.save();
      const caption = [
        '   ❀ 𓆩 ' + sans('pokeshiny') + ' 𓆪 ❀',
        '¡SHINY! *' + poke.name.toUpperCase() + ' ★*',
        'Tipo: ' + poke.types,
        '   ❀',
      ].join('\n');
      if (poke.sprite) {
        try {
          const buf = await U.getBuffer(poke.sprite, { timeout: 15000 });
          return c.sock.sendMessage(c.from, { image: buf, caption }, { quoted: c.m });
        } catch {}
      }
      return c.reply(caption);
    }
    db.save();
    return c.reply([
      '   ❀ 𓆩 ' + sans('pokeshiny') + ' 𓆪 ❀',
      'No hubo shiny esta vez...',
      'Sigue intentando.',
      '   ❀',
    ].join('\n'));
  }, ['shiny']),

  mk('pokerank', 'Rango de entrenador segun capturas', '', (c) => {
    const p = pokeUser(c.senderNum);
    const n = p.catches || 0;
    let rank = 'Novato';
    if (n >= 10) rank = 'Entrenador';
    if (n >= 30) rank = 'Experto';
    if (n >= 60) rank = 'Elite';
    if (n >= 100) rank = 'Maestro Pokemon';
    if (n >= 200) rank = 'Campeon de la Liga';
    return c.reply([
      '   ❀ 𓆩 ' + sans('pokerank') + ' 𓆪 ❀',
      'Entrenador: ' + c.pushName,
      'Capturas: ' + n,
      'Equipo: ' + p.list.length,
      'Rango: *' + rank + '*',
      '   ❀',
    ].join('\n'));
  }, ['rango poke', 'pokerango']),

  mk('pokecompare', 'Compara dos pokemon por nombre', '<a> | <b>', async (c) => {
    const parts = (c.q || '').split(/\s*\|\s*|\s+vs\s+/i).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return c.reply(C.quote + 'Ej: .pokecompare pikachu | charizard');
    try {
      const [ra, rb] = await Promise.all([
        axios.get('https://pokeapi.co/api/v2/pokemon/' + encodeURIComponent(parts[0].toLowerCase()), { timeout: 12000 }),
        axios.get('https://pokeapi.co/api/v2/pokemon/' + encodeURIComponent(parts[1].toLowerCase()), { timeout: 12000 }),
      ]);
      const sum = (d) => (d.stats || []).reduce((a, s) => a + s.base_stat, 0);
      const sa = sum(ra.data), sb = sum(rb.data);
      return c.reply([
        '   ❀ 𓆩 ' + sans('pokecompare') + ' 𓆪 ❀',
        ra.data.name.toUpperCase() + ' BST: ' + sa,
        rb.data.name.toUpperCase() + ' BST: ' + sb,
        '',
        'Ventaja: *' + (sa === sb ? 'Empate' : (sa > sb ? ra.data.name : rb.data.name).toUpperCase()) + '*',
        '   ❀',
      ].join('\n'));
    } catch {
      return c.reply(C.quote + 'No encontre uno de los pokemon.');
    }
  }, ['comparepoke']),

  mk('pokeitem', 'Usa una pocion / superball (texto)', '<pocion|superball>', (c) => {
    const q = (c.q || '').toLowerCase();
    const p = pokeUser(c.senderNum);
    if (!p.list.length) return c.reply(C.quote + 'Sin pokemon.');
    if (q.includes('pocion') || q.includes('potion')) {
      p.list.forEach((x) => { x.hp = Math.min(100, (x.hp || 50) + 30); });
      db.save();
      return c.reply(C.quote + 'Usaste Pocion. +30 HP al equipo.');
    }
    if (q.includes('super') || q.includes('ball')) {
      p.boost = Date.now() + 300000;
      db.save();
      return c.reply(C.quote + 'Super Ball activa 5 min (solo roleplay de suerte).');
    }
    return c.reply(C.quote + 'Items: pocion | superball');
  }, ['itempoke']),

];

module.exports = list;
