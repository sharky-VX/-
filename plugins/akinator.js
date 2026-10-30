// Akinator + fallback local (si la API falla)
const axios = require('axios');
const { sans, C } = require('../lib/deco');

const mk = (name, desc, usage, run, aliases = []) => ({
  name, aliases, desc, usage, category: 'games', run,
});

const sessions = new Map();

const SERVERS = [
  'https://server-prod-1.akinator.com/ws',
  'https://srv2.akinator.com:9162/ws',
  'https://srv3.akinator.com:9163/ws',
  'https://srv4.akinator.com:9164/ws',
];

function parseJsonp(data) {
  if (data && typeof data === 'object') return data;
  const s = String(data || '');
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function akiGet(path, params) {
  let lastErr;
  for (const base of SERVERS) {
    try {
      const { data } = await axios.get(base + path, {
        params: Object.assign({ callback: '', childMod: false }, params),
        timeout: 18000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        validateStatus: () => true,
      });
      const j = parseJsonp(data);
      if (j && (j.completion === 'OK' || j.parameters)) return j;
      lastErr = (j && j.completion) || 'bad response';
    } catch (e) {
      lastErr = e.message || e;
    }
  }
  throw new Error(String(lastErr || 'akinator offline'));
}

async function createAki() {
  const j = await akiGet('/new_session', {
    partner: 1,
    player: 'website-desktop',
    uid_ext_session: '',
    frontaddr: 'ODUuMTcuODYuMTEw',
    constraint: 'SIDEN=',
    soft_constraint: '',
    question_filter: '',
  });
  const p = j.parameters;
  if (!p || !p.identification) throw new Error('no session');
  return {
    mode: 'aki',
    session: p.identification.session,
    signature: p.identification.signature,
    step: 0,
    question: p.step_information.question,
    progression: 0,
  };
}

async function answerAki(s, answer) {
  const j = await akiGet('/answer', {
    session: s.session,
    signature: s.signature,
    step: s.step,
    answer,
    question_filter: '',
  });
  const p = j.parameters;
  if (!p) throw new Error('no answer');
  s.step = Number(p.step);
  s.question = p.question;
  s.progression = Number(p.progression || 0);
  return s;
}

async function winAki(s) {
  const j = await akiGet('/list', {
    session: s.session,
    signature: s.signature,
    step: s.step,
    size: 1,
    max_pic_width: 246,
    max_pic_height: 294,
    pref_photos: 'VO-OK',
    du_color: '0',
    mode: 2,
  });
  return j.parameters?.elements?.[0]?.element || null;
}

// Fallback local: personajes anime (siempre funciona)
const LOCAL_CHARS = [
  { name: 'Ellen Joe', tags: ['chica', 'pelo negro', 'ojos rojos', 'tiburon', 'zenless', 'videojuego'] },
  { name: 'Hatsune Miku', tags: ['chica', 'pelo azul', 'cantante', 'vocaloid', 'anime'] },
  { name: 'Goku', tags: ['chico', 'pelo negro', 'saiyan', 'dragon ball', 'fuerte'] },
  { name: 'Naruto', tags: ['chico', 'pelo rubio', 'ninja', 'naruto', 'aldea'] },
  { name: 'Luffy', tags: ['chico', 'sombrero', 'pirata', 'one piece'] },
  { name: 'Sakura Haruno', tags: ['chica', 'pelo rosa', 'ninja', 'naruto'] },
  { name: 'Nezuko', tags: ['chica', 'demonio', 'kimetsu', 'bambu'] },
  { name: 'Gojo Satoru', tags: ['chico', 'pelo blanco', 'jujutsu', 'ciego', 'fuerte'] },
  { name: 'Asuna', tags: ['chica', 'pelo naranja', 'sao', 'espadachin'] },
  { name: 'Rem', tags: ['chica', 'pelo azul', 're zero', 'maid'] },
  { name: 'Zero Two', tags: ['chica', 'cuernos', 'pelo rosa', 'darling'] },
  { name: 'Tanjiro', tags: ['chico', 'kimetsu', 'aretes', 'espada'] },
  { name: 'Levi Ackerman', tags: ['chico', 'attack on titan', 'corto', 'limpieza'] },
  { name: 'Mikasa', tags: ['chica', 'attack on titan', 'bufanda', 'pelo negro'] },
  { name: 'Pikachu', tags: ['pokemon', 'amarillo', 'rayo', 'animal'] },
];

const LOCAL_QS = [
  { q: '¿Es una chica?', test: (c) => c.tags.includes('chica') },
  { q: '¿Es un chico?', test: (c) => c.tags.includes('chico') },
  { q: '¿Es de un anime?', test: (c) => c.tags.includes('anime') || c.tags.includes('naruto') || c.tags.includes('dragon ball') || c.tags.includes('one piece') || c.tags.includes('kimetsu') || c.tags.includes('jujutsu') || c.tags.includes('sao') || c.tags.includes('re zero') || c.tags.includes('darling') || c.tags.includes('attack on titan') },
  { q: '¿Tiene pelo de color llamativo (azul, rosa, blanco, rubio)?', test: (c) => c.tags.some((t) => /azul|rosa|blanco|rubio|naranja|amarillo/.test(t)) },
  { q: '¿Es un personaje de videojuego?', test: (c) => c.tags.includes('videojuego') || c.tags.includes('zenless') || c.tags.includes('pokemon') },
  { q: '¿Es ninja?', test: (c) => c.tags.includes('ninja') },
  { q: '¿Es pirata?', test: (c) => c.tags.includes('pirata') },
  { q: '¿Es un demonio o tiene poderes sobrenaturales?', test: (c) => c.tags.includes('demonio') || c.tags.includes('saiyan') || c.tags.includes('jujutsu') },
  { q: '¿Es de Dragon Ball?', test: (c) => c.tags.includes('dragon ball') },
  { q: '¿Es de Naruto?', test: (c) => c.tags.includes('naruto') },
];

function startLocal() {
  return {
    mode: 'local',
    pool: LOCAL_CHARS.slice(),
    qi: 0,
    question: LOCAL_QS[0].q,
  };
}

function answerLocal(s, yes) {
  const qq = LOCAL_QS[s.qi];
  if (qq) {
    s.pool = s.pool.filter((c) => (yes ? qq.test(c) : !qq.test(c)));
  }
  s.qi++;
  if (s.pool.length <= 1 || s.qi >= LOCAL_QS.length) {
    s.done = true;
    s.guess = s.pool[0] || null;
    return s;
  }
  s.question = LOCAL_QS[s.qi].q;
  return s;
}

const ANS = {
  si: 0, yes: 0, s: 0, '1': 0,
  no: 1, n: 1, '2': 1,
  nose: 2, idk: 2, 'no se': 2, ns: 2, '3': 2,
  probablemente: 3, prob: 3, '4': 3,
  'probablemente no': 4, 'prob no': 4, '5': 4,
};

module.exports = [
  mk('akinator', 'Akinator: piensa un personaje', 'start | si/no/nose', async (c) => {
    const key = c.from + ':' + c.senderNum;
    const arg = (c.args[0] || c.q || '').toLowerCase().trim();

    if (!arg || arg === 'start' || arg === 'nuevo' || arg === 'new' || arg === 'on') {
      await c.react('🔮');
      let s = null;
      try {
        s = await createAki();
      } catch (e) {
        console.error('aki create:', e && e.message ? e.message : e);
        s = startLocal();
      }
      sessions.set(key, s);
      return c.reply([
        '   ❀ 𓆩 ' + sans('akinator') + ' 𓆪 ❀',
        s.mode === 'local' ? 'Modo local (API ocupada)' : 'Modo Akinator',
        '',
        'Piensa un personaje...',
        '',
        'Pregunta:',
        '*' + s.question + '*',
        '',
        'Responde:',
        c.prefix + 'aki si',
        c.prefix + 'aki no',
        c.prefix + 'aki nose',
        '   ❀',
      ].join('\n'));
    }

    const s = sessions.get(key);
    if (!s) return c.reply(C.quote + 'No hay partida. Usa: ' + c.prefix + 'aki start');

    if (arg === 'cancel' || arg === 'salir' || arg === 'stop') {
      sessions.delete(key);
      return c.reply(C.quote + 'Partida cancelada.');
    }

    const a = ANS[arg];
    if (a === undefined) {
      return c.reply(C.quote + 'Opciones: si | no | nose | probablemente | prob no');
    }

    try {
      if (s.mode === 'local') {
        answerLocal(s, a === 0 || a === 3);
        sessions.set(key, s);
        if (s.done) {
          sessions.delete(key);
          if (!s.guess) return c.reply(C.quote + 'No adivine. Otra vez: ' + c.prefix + 'aki start');
          return c.reply([
            '   ❀ 𓆩 ' + sans('akinator') + ' 𓆪 ❀',
            'Creo que es *' + s.guess.name + '*',
            'Otra partida: ' + c.prefix + 'aki start',
            '   ❀',
          ].join('\n'));
        }
        return c.reply([
          '   ❀ 𓆩 ' + sans('akinator') + ' 𓆪 ❀',
          'Pregunta ' + (s.qi + 1),
          '',
          '*' + s.question + '*',
          '',
          c.prefix + 'aki si | no',
          '   ❀',
        ].join('\n'));
      }

      await answerAki(s, a);
      sessions.set(key, s);
      if (s.progression >= 88 || s.step >= 70) {
        const win = await winAki(s);
        sessions.delete(key);
        if (!win) return c.reply(C.quote + 'No pude adivinar. ' + c.prefix + 'aki start');
        const name = win.name || win.absolute_name || '???';
        const desc = win.description || '';
        const photo = win.absolute_picture_path || win.picture_path;
        const text = [
          '   ❀ 𓆩 ' + sans('akinator') + ' 𓆪 ❀',
          '¡Ya se! Es *' + name + '*',
          desc,
          '   ❀',
        ].filter(Boolean).join('\n');
        if (photo) {
          try {
            const U = require('../lib/utils');
            const buf = await U.getBuffer(photo, { timeout: 15000 });
            return c.sock.sendMessage(c.from, { image: buf, caption: text }, { quoted: c.m });
          } catch {}
        }
        return c.reply(text);
      }
      return c.reply([
        '   ❀ 𓆩 ' + sans('akinator') + ' 𓆪 ❀',
        'Pregunta ' + (s.step + 1) + ' · ' + Math.floor(s.progression || 0) + '%',
        '',
        '*' + s.question + '*',
        '',
        c.prefix + 'aki si | no | nose',
        '   ❀',
      ].join('\n'));
    } catch (e) {
      console.error('aki:', e && e.message ? e.message : e);
      // cambiar a local si API cae a mitad
      const loc = startLocal();
      sessions.set(key, loc);
      return c.reply([
        C.quote + 'API Akinator fallo. Paso a modo local.',
        '',
        '*' + loc.question + '*',
        '',
        c.prefix + 'aki si | no',
      ].join('\n'));
    }
  }, ['aki', 'adivina', 'akinador']),
];
