// ═══════════════════════════════════════════════
//  GACHA: personajes de anime (waifus y husbandos) con imagen, rareza y valor.
//  Fuente real: AniList (https://graphql.anilist.co, gratis y sin clave): nombre, serie, foto y cantidad de favoritos.
//  La rareza y el valor salen de los favoritos: mientras más querido el personaje, más raro y más caro.
//  Si AniList no responde, se usa una lista interna (sin foto) para que el gacha nunca quede muerto.
// ═══════════════════════════════════════════════
const axios = require('axios');
const db = require('./db');
const U = require('./utils');

const G = () => (db.data.gacha ||= { pool: [], poolAt: 0, th: null, users: {}, market: [], mid: 1, tradeLog: 0, votes: {}, owners: {} });

// Rarezas: peso de salida en .roll y rango de valor (monedas)
const RAR = [
  { k: 'comun', name: 'Comun', star: '☆', w: 55, min: 150, max: 600 },
  { k: 'rara', name: 'Rara', star: '★', w: 28, min: 700, max: 2000 },
  { k: 'epica', name: 'Epica', star: '★★', w: 12, min: 2500, max: 6000 },
  { k: 'legendaria', name: 'Legendaria', star: '★★★', w: 4.2, min: 8000, max: 20000 },
  { k: 'mitica', name: 'Mitica', star: '★★★★', w: 0.8, min: 30000, max: 80000 },
];
const CUT = [0, 0.62, 0.32, 0.12, 0.03]; // % de la lista (ordenada por favoritos) que queda por ENCIMA de cada rareza

// [nombre, serie, genero, favoritos aprox.] — lista de respaldo (sin foto)
const SEED = [
  ['Zero Two', 'Darling in the FranXX', 'F', 36000], ['Rem', 'Re:Zero', 'F', 33000], ['Mikasa Ackerman', 'Attack on Titan', 'F', 41000],
  ['Asuna Yuuki', 'Sword Art Online', 'F', 24000], ['Hinata Hyuga', 'Naruto', 'F', 28000], ['Miku Nakano', 'The Quintessential Quintuplets', 'F', 26000],
  ['Nezuko Kamado', 'Demon Slayer', 'F', 22000], ['Emilia', 'Re:Zero', 'F', 20000], ['Violet Evergarden', 'Violet Evergarden', 'F', 19000],
  ['Kaguya Shinomiya', 'Kaguya-sama: Love is War', 'F', 21000], ['Megumin', 'KonoSuba', 'F', 19500], ['Makima', 'Chainsaw Man', 'F', 23000],
  ['Power', 'Chainsaw Man', 'F', 14000], ['Marin Kitagawa', 'My Dress-Up Darling', 'F', 15000], ['Anya Forger', 'Spy x Family', 'F', 17000],
  ['Yor Forger', 'Spy x Family', 'F', 16000], ['Hatsune Miku', 'Vocaloid', 'F', 18000], ['Rias Gremory', 'High School DxD', 'F', 12000],
  ['Erza Scarlet', 'Fairy Tail', 'F', 17500], ['Lucy Heartfilia', 'Fairy Tail', 'F', 9000], ['Nami', 'One Piece', 'F', 11000], ['Nico Robin', 'One Piece', 'F', 13000],
  ['Sakura Haruno', 'Naruto', 'F', 7000], ['Tsunade', 'Naruto', 'F', 6500], ['Rukia Kuchiki', 'Bleach', 'F', 8500], ['Orihime Inoue', 'Bleach', 'F', 8000],
  ['Misaka Mikoto', 'A Certain Scientific Railgun', 'F', 8200], ['Saber', 'Fate/stay night', 'F', 14500], ['Rin Tohsaka', 'Fate/stay night', 'F', 9500],
  ['Mai Sakurajima', 'Rascal Does Not Dream of Bunny Girl Senpai', 'F', 15500], ['Chika Fujiwara', 'Kaguya-sama: Love is War', 'F', 9800],
  ['Ai Hayasaka', 'Kaguya-sama: Love is War', 'F', 5200], ['Hitori Gotoh', 'Bocchi the Rock!', 'F', 12500], ['Frieren', 'Frieren', 'F', 16500],
  ['Mitsuri Kanroji', 'Demon Slayer', 'F', 9000], ['Shinobu Kocho', 'Demon Slayer', 'F', 8700], ['Ochaco Uraraka', 'My Hero Academia', 'F', 7600],
  ['Tohru Honda', 'Fruits Basket', 'F', 6800], ['Taiga Aisaka', 'Toradora!', 'F', 7400], ['Holo', 'Spice and Wolf', 'F', 7900], ['Kurumi Tokisaki', 'Date A Live', 'F', 11500],
  ['Yuno Gasai', 'Future Diary', 'F', 6100], ['Konata Izumi', 'Lucky Star', 'F', 3000], ['Asia Argento', 'High School DxD', 'F', 2500], ['Kanna Kamui', 'Miss Kobayashi', 'F', 4000],
  ['Ellen Joe', 'Zenless Zone Zero', 'F', 19000], ['Nicole Demara', 'Zenless Zone Zero', 'F', 11000], ['Grace Howard', 'Zenless Zone Zero', 'F', 9500],
  ['Hu Tao', 'Genshin Impact', 'F', 21000], ['Raiden Shogun', 'Genshin Impact', 'F', 25000], ['Eula', 'Genshin Impact', 'F', 14000],
  ['Amber', 'Genshin Impact', 'F', 8000], ['Fischl', 'Genshin Impact', 'F', 10000],
  ['Seraphina', 'The Beginning After the End', 'F', 8500], ['Sylvie', 'I Fell in Love with the Villainess', 'F', 7000],
  ['Roxy Migurdia', 'Mushoku Tensei', 'F', 9000], ['Eris Boreas Greyrat', 'Mushoku Tensei', 'F', 8000],
  ['Rimuru Tempest', 'That Time I Got Reincarnated as a Slime', 'M', 14000],
  ['Ainz Ooal Gown', 'Overlord', 'M', 13000], ['Albedo', 'Overlord', 'F', 12000], ['Shalltear Bloodfallen', 'Overlord', 'F', 7000],
  ['Levi Ackerman', 'Attack on Titan', 'M', 65000], ['Lelouch Lamperouge', 'Code Geass', 'M', 52000], ['Itachi Uchiha', 'Naruto', 'M', 47000], ['Gojo Satoru', 'Jujutsu Kaisen', 'M', 45000],
  ['Eren Yeager', 'Attack on Titan', 'M', 32000], ['Kakashi Hatake', 'Naruto', 'M', 33000], ['Light Yagami', 'Death Note', 'M', 30000], ['Killua Zoldyck', 'Hunter x Hunter', 'M', 29000],
  ['Tanjiro Kamado', 'Demon Slayer', 'M', 18000], ['Zenitsu Agatsuma', 'Demon Slayer', 'M', 11000], ['Roronoa Zoro', 'One Piece', 'M', 27000], ['Monkey D. Luffy', 'One Piece', 'M', 24000],
  ['Naruto Uzumaki', 'Naruto', 'M', 23000], ['Sasuke Uchiha', 'Naruto', 'M', 26000], ['Goku', 'Dragon Ball', 'M', 20000], ['Vegeta', 'Dragon Ball', 'M', 15000],
  ['Edward Elric', 'Fullmetal Alchemist', 'M', 21000], ['Roy Mustang', 'Fullmetal Alchemist', 'M', 16000], ['Saitama', 'One Punch Man', 'M', 14000], ['Denji', 'Chainsaw Man', 'M', 11500],
  ['Yuji Itadori', 'Jujutsu Kaisen', 'M', 9000], ['Sukuna', 'Jujutsu Kaisen', 'M', 12000], ['Giyu Tomioka', 'Demon Slayer', 'M', 10000], ['Rengoku Kyojuro', 'Demon Slayer', 'M', 13000],
  ['Okabe Rintaro', 'Steins;Gate', 'M', 12000], ['Spike Spiegel', 'Cowboy Bebop', 'M', 14500], ['Senku Ishigami', 'Dr. Stone', 'M', 9800], ['Kirito', 'Sword Art Online', 'M', 8000],
];

const norm = (s) => U.strip(String(s || '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();

// ── Pool (lista de personajes) ──
let loading = null;
const clean = (a) => ({ id: a.id, name: a.name, series: a.series || '', img: a.img || '', fav: a.fav || 0, g: a.g || 'F' });

function computeThresholds(list) {
  const favs = list.map((c) => c.fav).sort((a, b) => b - a);
  const n = favs.length || 1;
  const th = [0];
  for (let t = 1; t <= 4; t++) th.push(favs[Math.min(n - 1, Math.floor(CUT[t] * n))] ?? 0);
  // asegura orden creciente
  for (let t = 1; t <= 4; t++) if (th[t] <= th[t - 1]) th[t] = th[t - 1] + 1;
  return { th, max: favs[0] || 1 };
}

function seedPool() {
  const g = G();
  g.pool = SEED.map(([name, series, gender, fav], i) => ({ id: 'sd' + i, name, series, img: '', fav, g: gender }));
  const t = computeThresholds(g.pool); g.th = t.th; g.max = t.max;
  g.seed = true;
}

async function fetchPage(page) {
  const query = 'query($p:Int){Page(page:$p,perPage:50){characters(sort:FAVOURITES_DESC){id name{full} gender favourites image{large} media(perPage:1,sort:POPULARITY_DESC){nodes{title{romaji english}}}}}}';
  const r = await U.withRetry(() => axios.post('https://graphql.anilist.co', { query, variables: { p: page } }, { timeout: 20000, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'SharkyBot/6' } }), 2);
  return (r.data?.data?.Page?.characters || []).map(fromAni).filter(Boolean);
}
function fromAni(x) {
  const img = x?.image?.large || '';
  if (!x?.id || !x?.name?.full || !img || /default\./.test(img)) return null;
  const g = x.gender === 'Male' ? 'M' : x.gender === 'Female' ? 'F' : null;
  if (!g) return null; // solo personajes con genero claro (waifus / husbandos)
  const m = x.media?.nodes?.[0]?.title;
  return clean({ id: 'al' + x.id, name: x.name.full, series: m?.english || m?.romaji || '', img, fav: x.favourites || 0, g });
}

async function buildPool(pages = [1, 2, 3, 4, 5, 6]) {
  const g = G();
  const out = new Map();
  const res = await Promise.allSettled(pages.map((p, i) => U.sleep(i * 350).then(() => fetchPage(p))));
  for (const r of res) if (r.status === 'fulfilled') for (const c of r.value) out.set(c.id, c);
  if (out.size < 30) throw new Error('AniList no respondio');
  g.pool = [...out.values()];
  const t = computeThresholds(g.pool); g.th = t.th; g.max = t.max;
  g.poolAt = Date.now(); g.seed = false;
  db.save();
  return g.pool.length;
}

// Garantiza que haya pool (de AniList o la lista interna)
async function ensurePool(force = false) {
  const g = G();
  const stale = !g.poolAt || Date.now() - g.poolAt > 7 * 24 * 3600 * 1000;
  if (!force && g.pool.length >= 30 && !(g.seed && Date.now() - (g.tryAt || 0) > 30 * 60 * 1000) && !stale) return g.pool.length;
  if (!g.pool.length) seedPool();
  if (!loading) {
    g.tryAt = Date.now();
    loading = buildPool().catch((e) => { if (!g.pool.length) seedPool(); return -1; }).finally(() => { loading = null; });
  }
  // si ya hay algo usable no hace esperar al usuario más de unos segundos
  if (g.pool.length >= 30 && !force) { await Promise.race([loading, U.sleep(6000)]); return g.pool.length; }
  await loading;
  return g.pool.length;
}

// ── Rareza y valor (salen de los favoritos) ──
function rarityOf(fav) {
  const g = G();
  if (!g.th) { if (!g.pool.length) seedPool(); }
  const th = g.th;
  let t = 0;
  for (let i = 1; i <= 4; i++) if (fav >= th[i]) t = i;
  return t;
}
function valueOf(fav) {
  const g = G();
  const t = rarityOf(fav);
  const lo = g.th[t];
  const hi = t === 4 ? Math.max(g.max || lo + 1, lo + 1) : g.th[t + 1];
  const f = Math.min(1, Math.max(0, (fav - lo) / Math.max(1, hi - lo)));
  const r = RAR[t];
  return Math.round((r.min + f * (r.max - r.min)) / 10) * 10;
}
const view = (c) => {
  const r = rarityOf(c.fav);
  return { ...c, r, rar: RAR[r], value: valueOf(c.fav) };
};

function find(id) { return G().pool.find((c) => c.id === id) || null; }

// Elige un personaje al azar según las probabilidades de cada rareza
function pick(gender) {
  const g = G();
  const list = g.pool.filter((c) => !gender || c.g === gender);
  if (!list.length) return null;
  const byR = [[], [], [], [], []];
  for (const c of list) byR[rarityOf(c.fav)].push(c);
  const avail = RAR.map((r, i) => (byR[i].length ? r.w : 0));
  let x = Math.random() * avail.reduce((a, b) => a + b, 0);
  let t = 0;
  for (; t < avail.length; t++) { x -= avail[t]; if (x <= 0) break; }
  t = Math.min(t, 4);
  const bucket = byR[t].length ? byR[t] : list;
  return bucket[Math.floor(Math.random() * bucket.length)];
}

// Búsqueda en AniList (para .searchwaifu / .winfo de personajes que no están en el pool)
async function search(q) {
  const query = 'query($s:String){Page(page:1,perPage:8){characters(search:$s,sort:FAVOURITES_DESC){id name{full} gender favourites image{large} media(perPage:1,sort:POPULARITY_DESC){nodes{title{romaji english}}}}}}';
  const r = await U.withRetry(() => axios.post('https://graphql.anilist.co', { query, variables: { s: q } }, { timeout: 20000, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }), 2);
  return (r.data?.data?.Page?.characters || []).map(fromAni).filter(Boolean);
}
function addToPool(list) {
  const g = G();
  let n = 0;
  for (const c of list) if (!g.pool.some((p) => p.id === c.id)) { g.pool.push(c); n++; }
  if (n) db.save();
  return n;
}
// Busca en el pool local por nombre (aproximado)
function findByName(q) {
  const nq = norm(q);
  if (!nq) return [];
  const pool = G().pool;
  const exact = pool.filter((c) => norm(c.name) === nq);
  if (exact.length) return exact;
  const toks = nq.split(' ');
  return pool.filter((c) => { const n = norm(c.name); return n.includes(nq) || toks.every((t) => n.includes(t)); }).sort((a, b) => b.fav - a.fav);
}

// ── Usuarios ──
const user = (n) => {
  const u = (G().users[n] ||= { h: {}, fav: null, rolls: 5, reset: 0, bonus: 0, gd: 0, wins: 0, losses: 0, team: [], bought: {}, sold: 0, got: 0 });
  u.h ||= {}; u.team ||= []; u.bought ||= {};
  return u;
};
const ROLLS_PER_HOUR = 5;
function refill(u) {
  if (Date.now() >= (u.reset || 0)) { u.rolls = ROLLS_PER_HOUR; u.reset = Date.now() + 3600000; }
}
const total = (u) => Object.values(u.h).reduce((a, b) => a + b, 0);
const uniq = (u) => Object.keys(u.h).length;
const give = (u, id, n = 1) => { u.h[id] = (u.h[id] || 0) + n; u.got = (u.got || 0) + n; };
function take(u, id, n = 1) {
  if (!u.h[id]) return false;
  u.h[id] -= n;
  if (u.h[id] <= 0) { delete u.h[id]; u.team = u.team.filter((x) => x !== id); if (u.fav === id) u.fav = null; }
  return true;
}
// lista del usuario ordenada por valor (la misma que muestra .harem, para usar #número)
function ownedList(u) {
  return Object.entries(u.h).map(([id, n]) => { const c = find(id); return c ? { ...view(c), n } : null; }).filter(Boolean).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
// "#3" = posición en el harem; si no, nombre aproximado
function findOwned(u, q) {
  const list = ownedList(u);
  const s = String(q || '').trim();
  const m = s.match(/^#?(\d{1,4})$/);
  if (m && s.startsWith('#')) return list[Number(m[1]) - 1] || null;
  const nq = norm(s);
  if (!nq) return null;
  return list.find((c) => norm(c.name) === nq) || list.find((c) => norm(c.name).includes(nq)) || list.find((c) => nq.split(' ').every((t) => norm(c.name).includes(t))) || null;
}
const power = (c) => Math.sqrt(c.value) * (1 + c.r * 0.25);
function teamOf(u) {
  const list = ownedList(u);
  const chosen = u.team.map((id) => list.find((c) => c.id === id)).filter(Boolean);
  return (chosen.length ? chosen : list.slice(0, 3)).slice(0, 3);
}
const card = (c, extra = []) => [
  `${c.rar.star}  ${c.name}`,
  `Serie: ${c.series || '-'}`,
  `Rareza: ${c.rar.name} ${c.rar.star}`,
  `Valor: ${c.value.toLocaleString('es')} monedas`,
  `Favoritos: ${Number(c.fav).toLocaleString('es')}`,
  `Tipo: ${c.g === 'M' ? 'Husbando' : 'Waifu'}`,
  ...extra,
].join('\n');

// ── Ownership único: una waifu = un dueño ──
// owners[charId] = senderNum | null
function ownChar(charId) {
  return G().owners[charId] || null;
}
function claimOwnership(charId, senderNum) {
  G().owners[charId] = senderNum;
}
function releaseOwnership(charId) {
  delete G().owners[charId];
}
// Cuando se transfiere: actualizar owner
function transferOwnership(charId, newOwner) {
  G().owners[charId] = newOwner;
}
// Lista de personajes libres (sin dueño) que están en el pool
function freeChars() {
  const g = G();
  return g.pool.filter((c) => !g.owners[c.id]);
}

// ── Sistema de votos ──
// votes[charId] = { count, voters: [senderNum] }
function voteFor(charId, senderNum) {
  const g = G();
  g.votes ||= {};
  const v = (g.votes[charId] ||= { count: 0, voters: [] });
  if (v.voters.includes(senderNum)) return false; // ya votó
  v.voters.push(senderNum);
  v.count++;
  // El valor de la waifu sube con los votos
  const c = find(charId);
  if (c) c.fav = (c.fav || 0) + 500; // cada voto +500 favs -> sube rareza/valor
  db.save();
  return true;
}
function getVotes(charId) {
  return G().votes?.[charId]?.count || 0;
}
function topVoted(n = 10) {
  const g = G();
  return Object.entries(g.votes || {})
    .map(([id, v]) => { const c = find(id); return c ? { ...view(c), votes: v.count } : null; })
    .filter(Boolean).sort((a, b) => b.votes - a.votes).slice(0, n);
}
// Pool getter para uso en owner commands
const pool = () => G().pool;

module.exports = { G, RAR, ensurePool, buildPool, pick, find, findByName, search, addToPool, view, rarityOf, valueOf, user, refill, total, uniq, give, take, ownedList, findOwned, teamOf, power, card, norm, ROLLS_PER_HOUR, seedPool, pool, ownChar, claimOwnership, releaseOwnership, transferOwnership, freeChars, voteFor, getVotes, topVoted };
