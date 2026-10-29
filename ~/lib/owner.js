const config = require('../config');
const db = require('./db');

// ═══════════════════════════════════════════════
//  ¿Quién es owner?
//  WhatsApp ya no siempre muestra el número en grupos: manda un ID interno (LID).
//  Por eso se comparan TODOS los identificadores posibles del que escribe:
//  número, LID, y el número real que da el mensaje o la lista de participantes.
//  Lo aprendido se guarda en database.json (lidMap) para reconocerte al instante.
// ═══════════════════════════════════════════════
const num = (j) => String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '');

db.data.owners ||= [];   // owners añadidos con .addowner
db.data.lidMap ||= {};   // id interno (LID) → número real

const ownerSet = () => new Set([...config.owners, ...db.data.owners].map(num).filter(Boolean));
const isOwnerNum = (n) => !!n && ownerSet().has(num(n));

// Identificadores que trae el propio mensaje
function idsOf(m, sender) {
  const k = m.key || {};
  const out = new Set([num(sender)]);
  for (const f of ['participant', 'participantAlt', 'participantPn', 'senderPn', 'remoteJidAlt']) if (k[f]) out.add(num(k[f]));
  if (!String(k.remoteJid || '').endsWith('@g.us')) out.add(num(k.remoteJid)); // chat privado: el chat es la persona
  out.delete('');
  return [...out];
}

const matches = (ids) => ids.some((i) => isOwnerNum(i) || isOwnerNum(db.data.lidMap[i]));

// Rápido (sin red): ¿alguno de sus IDs es de un owner?
// En un sub bot, el número que escribe desde SU propia cuenta NO es owner del bot principal (allowFromMe = false)
const quick = (m, sender, allowFromMe = true) => (allowFromMe && !!m.key?.fromMe) || matches(idsOf(m, sender));

// Lento: mira la lista de participantes del grupo para unir LID ↔ número
async function resolve(sock, ids, isGroup, getMeta) {
  if (matches(ids)) return true;
  try {
    const lm = sock.signalRepository?.lidMapping;
    for (const i of ids) {
      const pn = lm?.getPNForLID ? await lm.getPNForLID(`${i}@lid`) : null;
      if (pn && isOwnerNum(num(pn))) { db.data.lidMap[i] = num(pn); db.save(); return true; }
    }
  } catch {}
  if (!isGroup) return false;
  try {
    const md = await getMeta();
    const p = md.participants.find((x) => [x.id, x.lid, x.phoneNumber].filter(Boolean).some((v) => ids.includes(num(v))));
    if (!p) return false;
    const all = [p.id, p.lid, p.phoneNumber].filter(Boolean).map(num);
    const real = all.find((a) => isOwnerNum(a));
    if (real) {
      for (const a of all) if (a !== real) db.data.lidMap[a] = real; // aprende: ese LID eres tú
      db.save();
      return true;
    }
  } catch {}
  return false;
}

// Añade un owner (número o LID). Devuelve true si es nuevo.
function add(n) {
  const x = num(n);
  if (!x || ownerSet().has(x)) return false;
  db.data.owners.push(x);
  db.save();
  return true;
}
function remove(n) {
  const x = num(n);
  if (config.owners.map(num).includes(x) && x === num(config.owner.number)) return false; // el principal no se quita
  db.data.owners = db.data.owners.filter((o) => num(o) !== x);
  config.owners = config.owners.filter((o) => num(o) !== x);
  for (const [k, v] of Object.entries(db.data.lidMap)) if (k === x || v === x) delete db.data.lidMap[k];
  db.save();
  return true;
}
const list = () => [...ownerSet()];

module.exports = { num, idsOf, quick, resolve, add, remove, list, isOwnerNum };
