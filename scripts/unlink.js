// Desvincula un sub bot desde la terminal (con el bot apagado o encendido):
//   node scripts/unlink.js 584121234567
const path = require('path');
process.chdir(path.join(__dirname, '..'));
const subbots = require('../lib/subbots');
const db = require('../lib/db');
const n = String(process.argv[2] || '').replace(/\D/g, '');
if (!n) { console.log('Uso: node scripts/unlink.js 584121234567'); process.exit(1); }
console.log(`Cerrando la sesion de +${n} en WhatsApp...`);
subbots.remove(n).then((how) => {
  const msg = { ok: 'Listo: desvinculado de WhatsApp y borrado.', already: 'Ya estaba cerrado en WhatsApp; borre los datos.', none: 'No habia sesion guardada.', timeout: 'No conecto a tiempo; borre la sesion del bot. Si sigue en tu WhatsApp, cierrala desde Dispositivos vinculados.', fail: 'No pude cerrarla en WhatsApp; borre la sesion del bot. Cierrala desde Dispositivos vinculados.' }[how] || how;
  console.log(msg);
  try { require('fs').writeFileSync('./database.json', JSON.stringify(db.data)); } catch {}
  process.exit(0);
});
