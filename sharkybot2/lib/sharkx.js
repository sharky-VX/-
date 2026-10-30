const db = require('./db');

function state() {
  if (!db.data.sharkx) {
    db.data.sharkx = {
      watching: false,
      target: '',
      targetName: '',
      samples: [],
      cmds: [],
      frame: null,
      at: 0,
    };
  }
  return db.data.sharkx;
}

function isDecoLine(l) {
  const s = String(l || '');
  if (!s.trim()) return false;
  if (/[❀𓆩𓆪✦➩╭╰│┃━═︎☪✰〔〕『』【】⟪⟫]/.test(s)) return true;
  const special = (s.match(/[^\w\s@.+]/g) || []).length;
  return special >= 4 && s.length <= 80;
}

function extractFrame(text) {
  const lines = String(text || '').split('\n');
  const deco = lines.filter(isDecoLine);
  const top = deco.slice(0, 4);
  const bottom = deco.slice(-3);
  // bullets style
  const bullet = lines.find((l) => /[➩➤►•❍]/.test(l)) || '';
  const bulletChar = (bullet.match(/[➩➤►•❍]/) || ['➩'])[0];
  return {
    top: top.length ? top : ['   ❀ 𓆩 SHARKNEX 𓆪 ❀'],
    bottom: bottom.length ? bottom : ['   ❀'],
    bullet: bulletChar,
  };
}

function extractCmds(text) {
  const out = [];
  const re = /(?:^|\s)([.#!\/])([a-zA-Z][\w]{1,24})\b/g;
  let m;
  const s = String(text || '');
  while ((m = re.exec(s)) && out.length < 80) {
    const name = m[2].toLowerCase();
    if (!out.includes(name)) out.push(name);
  }
  // also * .cmd * patterns
  const re2 = /\*([a-zA-Z][\w]{1,24})\*/g;
  while ((m = re2.exec(s)) && out.length < 80) {
    const name = m[1].toLowerCase();
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

function learnFromText(text, meta = {}) {
  const st = state();
  if (!text || String(text).length < 20) return;
  const sample = String(text).slice(0, 10000);
  st.samples = (st.samples || []).slice(-12);
  st.samples.push({ text: sample, at: Date.now(), ...(meta || {}) });
  // Prefer long samples as menu
  if (sample.length > 120 || /menu|comando|categoria|lista/i.test(sample)) {
    st.frame = extractFrame(sample);
    db.data.clonStyle = {
      text: sample,
      at: Date.now(),
      from: meta.from || st.targetName || 'bot',
      frame: st.frame,
    };
  } else if (!st.frame) {
    st.frame = extractFrame(sample);
  } else {
    // merge deco lines
    const f = extractFrame(sample);
    st.frame.top = f.top.length >= st.frame.top.length ? f.top : st.frame.top;
    st.frame.bottom = f.bottom.length ? f.bottom : st.frame.bottom;
  }
  const cmds = extractCmds(sample);
  for (const c of cmds) {
    if (!st.cmds.includes(c)) st.cmds.push(c);
  }
  st.cmds = st.cmds.slice(0, 120);
  st.at = Date.now();
  db.save();
}

function startWatch(targetJid, targetName, firstText) {
  const st = state();
  const num = String(targetJid || '').split('@')[0].split(':')[0];
  st.watching = true;
  st.target = num;
  st.targetName = targetName || num;
  st.at = Date.now();
  if (firstText) learnFromText(firstText, { from: targetName });
  db.save();
  return st;
}

function stopWatch() {
  const st = state();
  st.watching = false;
  st.target = '';
  db.save();
}

function isTarget(senderNum) {
  const st = state();
  if (!st.watching || !st.target) return false;
  const n = String(senderNum || '');
  return n === st.target || n.endsWith(st.target) || st.target.endsWith(n);
}

function applyFrame(body, title) {
  const st = state();
  const on = db.data.menuCloneOn;
  const frame = (db.data.clonStyle && db.data.clonStyle.frame) || st.frame;
  if (!on || !frame) return null;
  const top = (frame.top || []).join('\n');
  const bot = (frame.bottom || []).join('\n');
  const t = String(body || '').replace(/\s+$/, '');
  const head = title ? (top || '') : top;
  // si el body ya trae deco del clon, no doblar
  if (t.includes('𓆩') && frame.top && frame.top[0] && t.includes(String(frame.top[0]).slice(0, 8))) return t;
  return [head, t, bot].filter(Boolean).join('\n');
}

function statusText(prefix) {
  const st = state();
  const p = prefix || '.';
  const lines = [
    '   ❀ 𓆩 SharkX 𓆪 ❀',
    '  ✦ Vigilando ── ' + (st.watching ? ('si · ' + (st.targetName || st.target)) : 'no'),
    '  ✦ Muestras   ── ' + ((st.samples && st.samples.length) || 0),
    '  ✦ Comandos   ── ' + ((st.cmds && st.cmds.length) || 0),
    '  ✦ Clon menu  ── ' + (db.data.menuCloneOn ? 'activo' : 'off'),
    '',
    '  ' + p + 'sharkx  (responde al msg del bot)',
    '  ' + p + 'clon1',
    '  ' + p + 'clonreset',
    '   ❀',
  ];
  if (st.cmds && st.cmds.length) {
    lines.splice(5, 0, '  ✦ Vistos ── ' + st.cmds.slice(0, 15).join(', ') + (st.cmds.length > 15 ? '...' : ''));
  }
  return lines.join('\n');
}

module.exports = {
  state,
  learnFromText,
  startWatch,
  stopWatch,
  isTarget,
  applyFrame,
  statusText,
  extractFrame,
};
