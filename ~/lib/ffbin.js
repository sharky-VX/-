const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════
//  Busca un ffmpeg que SÍ funcione, en este orden:
//  1) variable FFMPEG_PATH   2) ffmpeg del sistema (PATH)   3) ./bin/ffmpeg
//  4) paquete npm @ffmpeg-installer/ffmpeg (trae el binario dentro: sirve en paneles sin apt)
//  5) paquete npm ffmpeg-static
// ═══════════════════════════════════════════════
let cached;

const works = (bin) => {
  try { execFileSync(bin, ['-version'], { timeout: 10000, stdio: 'ignore' }); return true; } catch { return false; }
};

function candidates() {
  const out = [];
  if (process.env.FFMPEG_PATH) out.push(process.env.FFMPEG_PATH);
  out.push('ffmpeg');
  out.push(path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'));
  for (const pkg of ['@ffmpeg-installer/ffmpeg', 'ffmpeg-static']) {
    try {
      const m = require(pkg);
      const p = typeof m === 'string' ? m : m?.path;
      if (p && fs.existsSync(p)) out.push(p);
    } catch {}
  }
  return out;
}

function resolve(force = false) {
  if (cached !== undefined && !force) return cached;
  cached = null;
  for (const bin of candidates()) {
    if (works(bin)) { cached = bin; break; }
  }
  return cached;
}

module.exports = { resolve, reset: () => { cached = undefined; } };
