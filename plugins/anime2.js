// ═══════════════════════════════════════════════
//  ANIME2 — Comandos de anime, frases, personajes,
//  mazos de trivia, info de series
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const axios = require('axios');
const db = require('../lib/db');
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'anime', ...extra, run });

// ── Info de anime via Jikan (MyAnimeList API sin key) ──
async function getAnimeInfo(query) {
  const r = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`, { timeout: 15000 });
  return r.data?.data?.[0];
}
async function getCharInfo(query) {
  const r = await axios.get(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(query)}&limit=1`, { timeout: 15000 });
  return r.data?.data?.[0];
}
async function getMangaInfo(query) {
  const r = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=1`, { timeout: 15000 });
  return r.data?.data?.[0];
}

const fmtScore = (s) => s ? `${s}/10` : 'N/A';
const fmtNum = (n) => n ? n.toLocaleString('es') : 'N/A';

module.exports = [
  mk('anime', 'Busca información de un anime', '<nombre>', async (c) => {
    if (!c.q) return c.reply('Escribe el nombre de un anime. Ejemplo: .anime Naruto');
    try {
      const a = await getAnimeInfo(c.q);
      if (!a) return c.reply('No encontré ese anime.');
      const cap = [
        `🎌 *${a.title}*`,
        a.title_english && a.title_english !== a.title ? `_(${a.title_english})_` : '',
        '',
        `📅 Año: ${a.year || a.aired?.prop?.from?.year || 'N/A'}`,
        `📺 Tipo: ${a.type || 'N/A'} | Eps: ${a.episodes || '?'}`,
        `⭐ Score: ${fmtScore(a.score)} (${fmtNum(a.scored_by)} votos)`,
        `👥 Miembros: ${fmtNum(a.members)}`,
        `📊 Estado: ${a.status || 'N/A'}`,
        `🎭 Géneros: ${a.genres?.map(g => g.name).join(', ') || 'N/A'}`,
        '',
        a.synopsis ? a.synopsis.slice(0, 300) + (a.synopsis.length > 300 ? '...' : '') : '',
      ].filter(x => x !== undefined && x !== '').join('\n');
      if (a.images?.jpg?.image_url) {
        try {
          const buf = await U.getBuffer(a.images.jpg.image_url, { timeout: 12000 });
          return c.sock.sendMessage(c.from, { image: buf, caption: cap }, { quoted: c.m });
        } catch {}
      }
      c.reply(cap);
    } catch (e) {
      c.reply('No pude obtener info del anime. Intenta de nuevo.');
    }
  }, ['animeinfo', 'buscaranime', 'mal']),

  mk('manga', 'Busca información de un manga', '<nombre>', async (c) => {
    if (!c.q) return c.reply('Escribe el nombre de un manga. Ejemplo: .manga Berserk');
    try {
      const m = await getMangaInfo(c.q);
      if (!m) return c.reply('No encontré ese manga.');
      const cap = [
        `📚 *${m.title}*`,
        m.title_english ? `_(${m.title_english})_` : '',
        '',
        `📅 Inicio: ${m.published?.prop?.from?.year || 'N/A'}`,
        `📖 Tipo: ${m.type || 'N/A'} | Capítulos: ${m.chapters || '?'}`,
        `⭐ Score: ${fmtScore(m.score)}`,
        `📊 Estado: ${m.status || 'N/A'}`,
        `🎭 Géneros: ${m.genres?.map(g => g.name).join(', ') || 'N/A'}`,
        '',
        m.synopsis ? m.synopsis.slice(0, 300) + '...' : '',
      ].filter(Boolean).join('\n');
      if (m.images?.jpg?.image_url) {
        try {
          const buf = await U.getBuffer(m.images.jpg.image_url, { timeout: 12000 });
          return c.sock.sendMessage(c.from, { image: buf, caption: cap }, { quoted: c.m });
        } catch {}
      }
      c.reply(cap);
    } catch {
      c.reply('No pude obtener info del manga. Intenta de nuevo.');
    }
  }, ['mangainfo', 'buscarmanga']),

  mk('personaje', 'Busca info de un personaje de anime', '<nombre>', async (c) => {
    if (!c.q) return c.reply('Escribe el nombre de un personaje. Ejemplo: .personaje Goku');
    try {
      const ch = await getCharInfo(c.q);
      if (!ch) return c.reply('No encontré ese personaje.');
      const about = ch.about?.slice(0, 400) || '';
      const cap = [
        `👤 *${ch.name}*`,
        ch.name_kanji ? `_(${ch.name_kanji})_` : '',
        '',
        `📺 Aparece en: ${ch.anime?.slice(0,3).map(a => a.anime?.title).join(', ') || ch.manga?.slice(0,3).map(m => m.manga?.title).join(', ') || 'N/A'}`,
        `❤️ Favoritos: ${fmtNum(ch.favorites)}`,
        '',
        about,
      ].filter(Boolean).join('\n');
      if (ch.images?.jpg?.image_url) {
        try {
          const buf = await U.getBuffer(ch.images.jpg.image_url, { timeout: 12000 });
          return c.sock.sendMessage(c.from, { image: buf, caption: cap }, { quoted: c.m });
        } catch {}
      }
      c.reply(cap);
    } catch {
      c.reply('No pude obtener info del personaje. Intenta de nuevo.');
    }
  }, ['char', 'charinfo', 'animechar']),

  mk('topanime', 'Top 10 animes del momento en MAL', '', async (c) => {
    try {
      const r = await axios.get('https://api.jikan.moe/v4/top/anime?limit=10', { timeout: 15000 });
      const list = r.data?.data || [];
      const lines = list.map((a, i) => `${i+1}. *${a.title}* — ⭐${a.score || 'N/A'}`);
      c.reply(`🏆 *TOP 10 ANIME (MAL)*\n\n${lines.join('\n')}`);
    } catch {
      c.reply('No pude obtener el top de anime ahora mismo.');
    }
  }, ['topanimes', 'mejoresanimes', 'rankingmal']),

  mk('animestemporada', 'Animes de la temporada actual', '', async (c) => {
    try {
      const r = await axios.get('https://api.jikan.moe/v4/seasons/now?limit=10', { timeout: 15000 });
      const list = r.data?.data?.slice(0, 10) || [];
      const lines = list.map((a, i) => `${i+1}. *${a.title}* (${a.episodes || '?'} eps) ⭐${a.score || 'N/A'}`);
      c.reply(`📺 *ANIMES DE LA TEMPORADA*\n\n${lines.join('\n')}`);
    } catch {
      c.reply('No pude obtener la temporada actual.');
    }
  }, ['temporada', 'seaanime', 'aniseason']),

  mk('recanime', 'Recomendaciones de anime por género', '<genero>', async (c) => {
    const generos = {
      accion: 'action', aventura: 'adventure', comedia: 'comedy', drama: 'drama',
      fantasia: 'fantasy', terror: 'horror', misterio: 'mystery', romance: 'romance',
      scifi: 'sci-fi', escolar: 'school', shounen: 'shounen', shoujo: 'shoujo',
      isekai: 'isekai', deportes: 'sports', musica: 'music',
    };
    const g = (c.args[0] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const jikanG = generos[g];
    if (!g) return c.reply(`Géneros:\n${Object.keys(generos).join(', ')}\n\nEjemplo: .recanime accion`);
    try {
      const r = await axios.get(`https://api.jikan.moe/v4/anime?genres=${jikanG}&order_by=score&sort=desc&limit=5`, { timeout: 15000 });
      const list = r.data?.data?.slice(0, 5) || [];
      if (!list.length) return c.reply(`No encontré animes de ${g}.`);
      const lines = list.map((a, i) => `${i+1}. *${a.title}* ⭐${a.score || 'N/A'}`);
      c.reply(`🎌 *RECOMENDACIONES — ${g.toUpperCase()}*\n\n${lines.join('\n')}`);
    } catch {
      c.reply('No pude obtener recomendaciones. Intenta de nuevo.');
    }
  }, ['rec', 'recomanime', 'sugerencias']),

  mk('fraseepica', 'Una frase épica de anime', '', (c) => {
    const frases = [
      { f: '"Yo simplemente me muevo hacia adelante."', a: 'Naruto Uzumaki — Naruto' },
      { f: '"Si pierdes la fe en ti mismo, ya has perdido la batalla."', a: 'Erwin Smith — Attack on Titan' },
      { f: '"Incluso un cobarde puede soñar."', a: 'Griffith — Berserk' },
      { f: '"El sol siempre vuelve a brillar después de la tormenta."', a: 'Proverbio — Anónimo' },
      { f: '"Siempre puedes avanzar. Aunque sea solo un milímetro."', a: 'Izuku Midoriya — MHA' },
      { f: '"En este mundo, los fuertes comen a los débiles."', a: 'Levi Ackerman — AoT' },
      { f: '"No me importa si soy un monstruo. Mientras pueda protegerlos."', a: 'Kaneki Ken — Tokyo Ghoul' },
      { f: '"La esperanza es la primera de todas las virtudes."', a: 'Ryuk — Death Note' },
      { f: '"Un guerrero verdadero nunca abandona lo que tiene que proteger."', a: 'Goku — Dragon Ball' },
      { f: '"El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor momento es ahora."', a: 'Proverbio anime' },
    ];
    const f = U.pick(frases);
    c.reply(`✨ *FRASE ÉPICA*\n\n_"${f.f}"_\n\n— ${f.a}`);
  }, ['epicfrase', 'animequote', 'fraseani']),

  mk('openings', 'Openings icónicos de anime', '[anime]', async (c) => {
    const openings = [
      { anime: 'Attack on Titan', op: 'Guren no Yumiya — Linked Horizon', url: 'https://youtu.be/CID-sYQNCew' },
      { anime: 'Naruto', op: 'ROCKS — Hound Dog', url: 'https://youtu.be/oKBxCKfgqT0' },
      { anime: 'Demon Slayer', op: 'Gurenge — LiSA', url: 'https://youtu.be/CwkzK-F0Y4k' },
      { anime: 'One Piece', op: 'We Are! — Hiroshi Kitadani', url: 'https://youtu.be/JE7SK35OmEU' },
      { anime: 'MHA', op: 'The Day — Porno Graffitti', url: 'https://youtu.be/KFb1IvKqPrk' },
      { anime: 'Fullmetal Alchemist', op: 'Again — YUI', url: 'https://youtu.be/f4DtVrCfLhU' },
      { anime: 'Cowboy Bebop', op: 'Tank! — The Seatbelts', url: 'https://youtu.be/vNeQREgK4KE' },
      { anime: 'Evangelion', op: 'A Cruel Angel\'s Thesis', url: 'https://youtu.be/iHR9n3jEBos' },
      { anime: 'Bocchi the Rock', op: 'Seishun Complex', url: 'https://youtu.be/lzDIQRlc-fA' },
    ];
    if (c.q) {
      const found = openings.find(o => o.anime.toLowerCase().includes(c.q.toLowerCase()));
      if (found) return c.reply(`🎵 *${found.anime}*\nOpening: ${found.op}\n${found.url}`);
    }
    const picked = U.pick(openings);
    c.reply(`🎵 *Opening icónico aleatorio*\n\n📺 ${picked.anime}\n🎵 ${picked.op}\n\n${picked.url}`);
  }, ['op', 'opening', 'animesong']),

  mk('ending', 'Endings icónicos de anime', '', (c) => {
    const endings = [
      { anime: 'Fullmetal Alchemist: Brotherhood', ed: 'Uso — SID' },
      { anime: 'Naruto Shippuden', ed: 'Blue Bird — Ikimono-gakari' },
      { anime: 'Sword Art Online', ed: 'Yume Sekai — Haruka Tomatsu' },
      { anime: 'Attack on Titan', ed: 'Great Escape — Cinema Staff' },
      { anime: 'Demon Slayer', ed: 'from the edge — FictionJunction' },
      { anime: 'Re:Zero', ed: 'Styx Helix — MYTH & ROID' },
    ];
    const e = U.pick(endings);
    c.reply(`🎵 *Ending icónico*\n\n📺 ${e.anime}\n🎵 ${e.ed}`);
  }, ['ed', 'animeending']),

  mk('poderes', 'Poderes de anime aleatorios para ti', '', (c) => {
    const poderes = [
      'Sharingan del Mangekyō 👁️', 'One For All 💥', 'Gear 5th 🌀', 'Bankai nivel Ichigo ⚔️',
      'Magia de explosión de Megumin 💣', 'Titan Fundador 🗿', 'Telekinesis Esper nivel 5 🧠',
      'Fruta del Diablo: Gura Gura no Mi 💎', 'Respiración del Sol 🔥', 'Quirk: Cero Gravedad 🌙',
      'Ultra Instinto 🤍', 'Jutsu de sellado infinito 🌀', 'Shikai y Bankai combinados ✨',
      'Alchemy de transmutación sin círculo 🔄',
    ];
    const p1 = U.pick(poderes);
    const p2 = U.pick(poderes.filter(p => p !== p1));
    c.reply(`⚡ *TUS PODERES DE ANIME*\n\n${c.pushName}, hoy tienes:\n\n1️⃣ ${p1}\n2️⃣ ${p2}\n\n¿Cómo los usarías? 👀`);
  }, ['superpoderes', 'superpower', 'poder']),

  mk('tipo', 'Qué tipo de personaje de anime serías', '', (c) => {
    const tipos = [
      '🦸 El héroe protagonista: perseverante, grita el nombre de sus ataques',
      '😤 El rival tsundere: "no es que me importe, baka"',
      '😈 El villano carismático: tiene razón en todo pero lo hace mal',
      '🤓 El genio estratega que nunca entra en combate',
      '💀 El personaje de fondo que muere en el episodio 3',
      '😴 El poderoso que siempre está durmiendo',
      '🌸 El waifu/husbando que todos aman',
      '🗡️ El loner misterioso de pasado oscuro',
      '😂 El comic relief que nunca se toma en serio',
      '🍚 El que siempre está comiendo',
    ];
    c.reply(`🎭 *¿QUÉ PERSONAJE SERÍAS?*\n\n${c.pushName}, serías:\n\n${U.pick(tipos)}`);
  }, ['rolpersonaje', 'archetipo', 'animetipo']),

  mk('nivel_poder', 'Mide tu nivel de poder como en un anime', '', (c) => {
    const seed = c.senderNum.split('').reduce((a, b) => a + parseInt(b) || a, 0);
    const base = (seed * 137 + 42) % 9999 + 1;
    let rango;
    if (base < 1000) rango = 'F — Rango débil 😅';
    else if (base < 3000) rango = 'D — Rango bajo 🙂';
    else if (base < 5000) rango = 'C — Rango medio 😤';
    else if (base < 7000) rango = 'B — Rango alto 💪';
    else if (base < 8500) rango = 'A — Elite 🔥';
    else if (base < 9500) rango = 'S — Sobrehumano ⚡';
    else rango = 'SS — Nivel Dios 🌟';
    c.reply(`⚡ *NIVEL DE PODER*\n\n${c.pushName}\n\nPoder: *${base.toLocaleString('es')}*\nRango: ${rango}\n\n"El poder de un guerrero no se mide solo con fuerza."`)
  }, ['powerlevel', 'scouter', 'nivel2']),

  mk('anipoema', 'Un haiku de anime generado', '', (c) => {
    const haikus = [
      'Sakura cayendo\nNaruto corre solo\nDattebayo',
      'La luna esta noche\nErwin mira el horizonte\nAvancemos ya',
      'Lluvia en primavera\nMiku canta en el vacío\nAdiós, mundo cruel',
      'Un rayo de luz\nGoku alcanza el Ultra\nInstinto perfecto',
      'El mar de las nubes\nAoT, resuena el grito\nArmin grita: ¡Eren!',
    ];
    c.reply(`📜 *HAIKU DE ANIME*\n\n${U.pick(haikus)}`);
  }, ['haiku', 'aniku', 'poemaani']),

  mk('popularidad', 'Popularidad de un personaje de anime', '<nombre>', async (c) => {
    if (!c.q) return c.reply('Escribe un personaje. Ejemplo: .popularidad Rem');
    try {
      const ch = await getCharInfo(c.q);
      if (!ch) return c.reply('No encontré ese personaje.');
      const fav = ch.favorites || 0;
      let tier;
      if (fav > 50000) tier = '👑 LEYENDA';
      else if (fav > 20000) tier = '💎 S-Tier';
      else if (fav > 8000) tier = '⭐ A-Tier';
      else if (fav > 3000) tier = '🔥 B-Tier';
      else tier = '📊 C-Tier';
      c.reply(`📊 *POPULARIDAD — ${ch.name}*\n\n❤️ Favoritos en MAL: ${fmtNum(fav)}\n🏆 Tier: ${tier}`);
    } catch {
      c.reply('No pude obtener la popularidad. Intenta de nuevo.');
    }
  }, ['favs', 'waifupop', 'charpopularity']),

  mk('studio', 'Busca información de un estudio de animación', '<nombre>', async (c) => {
    if (!c.q) return c.reply('Escribe un estudio. Ejemplo: .studio MAPPA');
    const estudios = {
      mappa: { nombre: 'MAPPA', fundado: 2011, obras: 'Attack on Titan Final, Chainsaw Man, Jujutsu Kaisen' },
      ufotable: { nombre: 'ufotable', fundado: 2000, obras: 'Demon Slayer, Fate series, Tales of...' },
      bones: { nombre: 'Bones', fundado: 1998, obras: 'Fullmetal Alchemist, MHA, Carole & Tuesday' },
      wit: { nombre: 'WIT Studio', fundado: 2012, obras: 'Attack on Titan (1-3), Vinland Saga, Spy x Family' },
      cloverworks: { nombre: 'CloverWorks', fundado: 2018, obras: 'Bunny Girl Senpai, Wonder Egg Priority, Fruits Basket' },
      kyoani: { nombre: 'Kyoto Animation', fundado: 1981, obras: 'Violet Evergarden, Clannad, K-On!, Hyouka' },
      trigger: { nombre: 'Trigger', fundado: 2011, obras: 'Kill la Kill, SSSS.Gridman, Darling in the FranXX' },
    };
    const key = c.q.toLowerCase().replace(/\s/g, '').replace(/[^a-z]/g, '');
    const found = Object.entries(estudios).find(([k]) => k.includes(key.slice(0, 5)) || key.includes(k.slice(0, 5)));
    if (!found) return c.reply(`No tengo datos de ese estudio. Estudios conocidos:\n${Object.values(estudios).map(s => s.nombre).join(', ')}`);
    const s = found[1];
    c.reply(`🎬 *${s.nombre}*\nFundado: ${s.fundado}\nObras conocidas: ${s.obras}`);
  }, ['animeestudio', 'produccion']),

  mk('seiyuu', 'Datos de un seiyuu (actor de voz)', '<nombre>', async (c) => {
    if (!c.q) return c.reply('Escribe un seiyuu. Ejemplo: .seiyuu Yuki Kaji');
    try {
      const r = await axios.get(`https://api.jikan.moe/v4/people?q=${encodeURIComponent(c.q)}&limit=1`, { timeout: 15000 });
      const p = r.data?.data?.[0];
      if (!p) return c.reply('No encontré ese seiyuu.');
      c.reply([
        `🎙️ *${p.name}*`,
        p.name_kanji ? `_(${p.name_kanji})_` : '',
        '',
        `📅 Nació: ${p.birthday?.split('T')[0] || 'N/A'}`,
        `❤️ Favoritos: ${fmtNum(p.favorites)}`,
        p.about ? '\n' + p.about.slice(0, 300) + '...' : '',
      ].filter(Boolean).join('\n'));
    } catch {
      c.reply('No pude obtener info del seiyuu. Intenta de nuevo.');
    }
  }, ['vozactor', 'animeactor', 'va']),

  mk('animefact', 'Un dato curioso de anime', '', (c) => {
    const facts = [
      'El nombre "anime" viene de la abreviación japonesa de "animation". En Japón, "anime" se refiere a TODA animación, no solo la japonesa.',
      'Dragon Ball Z fue doblado al español por primera vez en Venezuela 🇻🇪 — los venezolanos fueron los primeros en escuchar a Goku en español.',
      'El estudio Kyoto Animation es famoso por no usar guiones detallados de terceros: sus directores crean todo internamente.',
      'Hayao Miyazaki de Studio Ghibli dijo que se retiraría varias veces, pero siempre volvió. Ya lleva más de 5 "retiros".',
      'El manga de One Piece lleva activo desde 1997 y sigue siendo uno de los más vendidos de la historia.',
      'La famosa escena de "Omae wa mou shindeiru" de Hokuto no Ken no tenía guión previo — el animador la improvisó.',
      'Pokémon tiene más de 900 episodios y sigue en producción. Es el anime con más eps después de Doraemon.',
      'En Japón, las temporadas de anime se dividen en 4: Winter (Ene), Spring (Abr), Summer (Jul), Fall (Oct). Cada una dura ~3 meses.',
      'Los seiyuus (actores de voz) en Japón son celebridades de alto nivel con conciertos y fans dedicados.',
      'Neon Genesis Evangelion fue hecho con muy poco presupuesto al final de la serie, por eso los últimos episodios son tan "abstractos".',
    ];
    c.reply(`🎌 *DATO CURIOSO DE ANIME*\n\n${U.pick(facts)}`);
  }, ['datoanime', 'anifact', 'curiosidadanime']),

  mk('versus', 'Combate hipotético entre dos personajes', '<personaje1> vs <personaje2>', (c) => {
    if (!c.q || !c.q.includes(' vs ') && !c.q.includes(' VS ')) return c.reply('Uso: .versus Goku vs Naruto');
    const sep = c.q.toLowerCase().includes(' vs ') ? ' vs ' : ' VS ';
    const [p1, p2] = c.q.split(new RegExp(sep, 'i')).map(s => s.trim());
    if (!p1 || !p2) return c.reply('Separa los personajes con " vs ". Ejemplo: .versus Goku vs Saitama');
    const winner = Math.random() < 0.5 ? p1 : p2;
    const loser = winner === p1 ? p2 : p1;
    const motivos = [
      'por velocidad superior', 'gracias a su power level más alto',
      'porque la trama lo favorece', 'con un golpe definitivo',
      'porque simplemente es más popular en MAL', 'con una técnica secreta',
      'después de 47 capítulos de flashbacks', 'por la amistad y determinación',
    ];
    c.reply(`⚔️ *VERSUS: ${p1.toUpperCase()} vs ${p2.toUpperCase()}*\n\nGanador: *${winner}* 🏆\n${U.pick(motivos)}\n\n_${loser} fue derrotado, pero dio todo de sí._`);
  }, ['vs', 'battle', 'pelea']),

  mk('clasificar', 'Clasifica tu colección de animes vistos', '<lista separada por comas>', (c) => {
    if (!c.q) return c.reply('Escribe tu lista. Ejemplo: .clasificar Naruto, SAO, One Piece, Berserk');
    const animes = c.q.split(',').map(s => s.trim()).filter(Boolean);
    if (!animes.length) return c.reply('No detecté ningún anime en tu lista.');
    const rangos = ['🥇 Masterpiece', '🥈 Muy bueno', '🥉 Bueno', '😐 Regular', '💩 Terrible'];
    const clasificado = animes.map(a => `${U.pick(rangos)}: ${a}`);
    c.reply(`📋 *CLASIFICACIÓN DE ANIMES*\n_(aleatoria, por supuesto)_\n\n${clasificado.join('\n')}`);
  }, ['tierlist', 'tier', 'anirank']),

  mk('opening_quiz', 'Adivina el anime por su opening (solo letra)', '', (c) => {
    const ops = [
      { letra: '"Shingeki no kyojin, sono me ni wa nani ga mieru..."', anime: 'Attack on Titan (Guren no Yumiya)' },
      { letra: '"Kono yo ni umarete yokatta... tatakae!"', anime: 'Attack on Titan S4 (Shingeki no Kyojin)' },
      { letra: '"We are! We are on the cruise!"', anime: 'One Piece' },
      { letra: '"It\'s the eye of the storm... we\'re born to be warriors"', anime: 'Dragon Ball Super' },
      { letra: '"Gurenge... sakura no hana, chiru youni..."', anime: 'Demon Slayer (Gurenge — LiSA)' },
      { letra: '"Blue bird, blue bird, tsuretette fly away..."', anime: 'Naruto Shippuden' },
    ];
    const q = U.pick(ops);
    const key = `opquiz:${c.from}`;
    db.data._opquiz ||= {};
    db.data._opquiz[key] = { a: q.anime.toLowerCase(), at: Date.now() };
    db.save();
    c.reply(`🎵 *¿DE QUÉ ANIME ES ESTE OPENING?*\n\n_"${q.letra}"_\n\nResponde con: .responder <anime>`);
    setTimeout(() => { if (db.data._opquiz?.[key]) { delete db.data._opquiz[key]; db.save(); } }, 60000);
  }, ['adivop', 'opening_guess', 'opquiz']),

  mk('recomendapara', 'Anime recomendado según tu humor', '<humor>', (c) => {
    const moods = {
      triste: ['Clannad', 'Your Lie in April (Shigatsu wa Kimi no Uso)', 'Anohana'],
      feliz: ['Bocchi the Rock!', 'K-On!', 'Konosuba'],
      accion: ['Demon Slayer', 'Jujutsu Kaisen', 'Attack on Titan'],
      romance: ['Kaguya-sama: Love is War', 'Toradora', 'Horimiya'],
      terror: ['Another', 'Shiki', 'Higurashi'],
      filosofia: ['Neon Genesis Evangelion', 'Serial Experiments Lain', 'Mushishi'],
      epico: ['Fullmetal Alchemist: Brotherhood', 'Code Geass', 'Death Note'],
      relajar: ['Mushishi', 'Spice and Wolf', 'Non Non Biyori'],
    };
    const m = (c.args[0] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!m || !moods[m]) return c.reply(`¿Cómo te sientes hoy?\nOpciones: ${Object.keys(moods).join(', ')}\n\nEjemplo: .recomendapara feliz`);
    const recs = moods[m];
    c.reply(`🎌 *Para cuando estás ${m}:*\n\n${recs.map((r, i) => `${i+1}. ${r}`).join('\n')}`);
  }, ['animemood', 'recomienda', 'animerecom']),
];
