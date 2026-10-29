const fs = require('fs');
const FILE = './.bot.lock';
const BEAT = 5000;   // el bot "late" cada 5 s
const STALE = 20000; // si el latido tiene más de 20 s, el candado se considera viejo

// Evita que corran dos bots con la misma sesión (causa clásica de "Bad MAC").
// Usa un latido en vez del PID, así no se traba cuando un panel/contenedor reinicia el bot.
function acquire() {
  if (process.env.NO_LOCK === '1') return;
  try {
    const [pid, ts] = fs.readFileSync(FILE, 'utf8').split(':').map(Number);
    if (pid && pid !== process.pid && Date.now() - ts < STALE) {
      console.error(`❌ Ya hay otro bot usando esta carpeta (PID ${pid}, activo hace ${Math.round((Date.now() - ts) / 1000)} s).`);
      console.error('   Ciérralo primero. Si estás seguro de que no hay otro, espera 20 s y vuelve a iniciar.');
      process.exit(2);
    }
  } catch {}
  const beat = () => { try { fs.writeFileSync(FILE, `${process.pid}:${Date.now()}`); } catch {} };
  beat();
  setInterval(beat, BEAT).unref();
  process.on('exit', () => {
    try { if (Number(fs.readFileSync(FILE, 'utf8').split(':')[0]) === process.pid) fs.unlinkSync(FILE); } catch {}
  });
  process.on('SIGINT', () => process.exit(130));
  process.on('SIGTERM', () => process.exit(143));
}

module.exports = { acquire };
