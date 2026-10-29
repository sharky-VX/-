// Cuando el bot principal y uno o más sub bots están en el mismo grupo, TODOS reciben cada mensaje y TODOS responden.
// Para no repetir efectos (cobrar dos veces, sumar dos veces un contador, empezar dos juegos):
//  - los comandos "con estado" (economía, gacha, juegos, grupo, owner...) los ejecuta UN solo bot; los demás
//    esperan a que termine y repiten sus mismas respuestas con su propia cuenta (así todos contestan igual).
//  - las tareas pasivas (contadores, estadísticas, charla de Miku) también las hace uno solo.
const seen = new Map(); // clave → { t, done, finish, out }

function prune() {
  if (seen.size <= 3000) return;
  const old = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of seen) if (v.t < old || seen.size > 4000) seen.delete(k);
}
const keyOf = (m, tag) => `${m?.key?.remoteJid}|${m?.key?.id}|${tag}`;

// ¿soy el primero en reclamar esta tarea para este mensaje?
function once(m, tag = 'x') {
  if (!m?.key?.id) return true;
  const k = keyOf(m, tag);
  if (seen.has(k)) return false;
  seen.set(k, { t: Date.now() });
  prune();
  return true;
}

// Para comandos con estado: devuelve { first, entry }. entry.out = respuestas del que lo ejecutó.
function begin(m, tag) {
  const k = keyOf(m, 'cmd:' + tag);
  let e = seen.get(k);
  if (e) return { first: false, entry: e };
  e = { t: Date.now(), out: [] };
  e.done = new Promise((r) => { e.finish = r; });
  seen.set(k, e);
  prune();
  return { first: true, entry: e };
}

module.exports = { once, begin };
