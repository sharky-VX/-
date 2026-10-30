// ═══════════════════════════════════════════════
//  Akinator — adivina el personaje
// ═══════════════════════════════════════════════
const axios = require('axios');
const { sans, C } = require('../lib/deco');

const mk = (name, desc, usage, run, aliases = []) => ({
  name, aliases, desc, usage, category: 'games', run,
});

// sesiones en memoria: chatId -> session
const sessions = new Map();

async function akiStart(lang = 'es') {
  const { data } = await axios.post(
    'https://api.akinator.com/api/v1/start',
    { language: lang, theme: 'characters' },
    { timeout: 20000, headers: { 'Content-Type': 'application/json' } }
  ).catch(() => ({ data: null }));
  // API alternativa (no oficial estable): usar endpoint comunitario
  return data;
}

// Implementación ligera con API pública no oficial
async function createSession() {
  try {
    const { data } = await axios.get('https://server-prod-1.akinator.com/ws/new_session', {
      params: {
        callback: '',
        partner: 1,
        player: 'website-desktop',
        uid_ext_session: '',
        frontaddr: 'ODUuMTcuODYuMTEw',
        constraint: 'SIDEN=',
        soft_constraint: '',
        question_filter: '',
        childMod: false,
      },
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    // a veces viene JSONP
    let j = data;
    if (typeof data === 'string') {
      const m = data.match(/\{[\s\S]*\}/);
      j = m ? JSON.parse(m[0]) : null;
    }
    const p = j?.parameters;
    if (!p) throw new Error('no session');
    return {
      session: p.identification.session,
      signature: p.identification.signature,
      step: 0,
      question: p.step_information.question,
    };
  } catch (e) {
    console.error('aki create:', e?.message || e);
    return null;
  }
}

async function answerSession(s, answer) {
  // answer: 0=si 1=no 2=no se 3=probablemente 4=probablemente no
  const { data } = await axios.get('https://server-prod-1.akinator.com/ws/answer', {
    params: {
      callback: '',
      session: s.session,
      signature: s.signature,
      step: s.step,
      answer,
      question_filter: '',
    },
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  let j = data;
  if (typeof data === 'string') {
    const m = data.match(/\{[\s\S]*\}/);
    j = m ? JSON.parse(m[0]) : null;
  }
  const p = j?.parameters;
  if (!p) throw new Error('no answer');
  s.step = Number(p.step);
  s.question = p.question;
  s.progression = Number(p.progression || 0);
  return s;
}

async function winSession(s) {
  const { data } = await axios.get('https://server-prod-1.akinator.com/ws/list', {
    params: {
      callback: '',
      session: s.session,
      signature: s.signature,
      step: s.step,
      size: 1,
      max_pic_width: 246,
      max_pic_height: 294,
      pref_photos: 'VO-OK',
      du_color: '0',
      mode: 2,
      childMod: false,
    },
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  let j = data;
  if (typeof data === 'string') {
    const m = data.match(/\{[\s\S]*\}/);
    j = m ? JSON.parse(m[0]) : null;
  }
  const el = j?.parameters?.elements?.[0]?.element;
  return el || null;
}

const ANS = {
  si: 0, yes: 0, s: 0, '1': 0,
  no: 1, n: 1, '2': 1,
  nose: 2, idk: 2, 'no se': 2, ns: 2, '3': 2,
  probablemente: 3, prob: 3, '4': 3,
  'probablemente no': 4, 'prob no': 4, '5': 4,
};

module.exports = [
  mk('akinator', 'Akinator: piensa un personaje y responde', 'start | si/no/nose/...', async (c) => {
    const key = c.from + ':' + c.senderNum;
    const arg = (c.args[0] || c.q || '').toLowerCase().trim();

    if (!arg || arg === 'start' || arg === 'nuevo' || arg === 'new') {
      await c.react('🔮');
      const s = await createSession();
      if (!s) {
        return c.reply(C.quote + 'Akinator no respondio. Intenta mas tarde.');
      }
      sessions.set(key, s);
      return c.reply([
        '   ❀ 𓆩 ' + sans('akinator') + ' 𓆪 ❀',
        'Piensa en un personaje...',
        '',
        'Pregunta 1:',
        '*' + s.question + '*',
        '',
        'Responde:',
        c.prefix + 'akinator si | no | nose | probablemente | prob no',
        '   ❀',
      ].join('\n'));
    }

    const s = sessions.get(key);
    if (!s) return c.reply(C.quote + 'No hay partida. Usa: ' + c.prefix + 'akinator start');

    if (arg === 'cancel' || arg === 'salir' || arg === 'stop') {
      sessions.delete(key);
      return c.reply(C.quote + 'Partida de Akinator cancelada.');
    }

    const a = ANS[arg];
    if (a === undefined) {
      return c.reply(C.quote + 'Opciones: si | no | nose | probablemente | prob no');
    }

    try {
      await answerSession(s, a);
      sessions.set(key, s);
      if (s.progression >= 90 || s.step >= 75) {
        const win = await winSession(s);
        sessions.delete(key);
        if (!win) return c.reply(C.quote + 'No pude adivinar. Intenta de nuevo: ' + c.prefix + 'akinator start');
        const name = win.name || win.absolute_name || '???';
        const desc = win.description || '';
        const photo = win.absolute_picture_path || win.picture_path;
        const text = [
          '   ❀ 𓆩 ' + sans('akinator') + ' 𓆪 ❀',
          '¡Ya se! Es *' + name + '*',
          desc ? desc : '',
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
        c.prefix + 'akinator si | no | nose | probablemente | prob no',
        '   ❀',
      ].join('\n'));
    } catch (e) {
      console.error('aki:', e?.message || e);
      sessions.delete(key);
      return c.reply(C.quote + 'Error en Akinator. Empieza de nuevo: ' + c.prefix + 'akinator start');
    }
  }, ['aki', 'adivina']),
];
