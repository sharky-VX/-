const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffbin = require('./ffbin');
const config = require('../config');

// ═══════════════════════════════════════════════
//  Comprueba ffmpeg y yt-dlp al iniciar. En Termux los instala solos si faltan
//  (se apaga con AUTO_INSTALL=0). Sin ellos fallan los GIF de anime, .play, .spotify, stickers...
// ═══════════════════════════════════════════════
const has = (cmd, args) => new Promise((resolve) => {
  execFile(cmd, args, { timeout: 10000 }, (err) => resolve(!err || err.code !== 'ENOENT'));
});

const sh = (cmd) => new Promise((resolve) => {
  const p = spawn('sh', ['-c', cmd], { stdio: 'inherit', env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' } });
  const t = setTimeout(() => p.kill(), 15 * 60 * 1000);
  p.on('exit', (code) => { clearTimeout(t); resolve(code === 0); });
  p.on('error', () => { clearTimeout(t); resolve(false); });
});

const state = { ffmpeg: true, ytdlp: true };

// Descarga el binario de yt-dlp (para paneles/servidores sin pip). Devuelve true si quedó funcionando.
async function downloadYtdlp() {
  const dir = path.join(process.cwd(), 'bin');
  fs.mkdirSync(dir, { recursive: true });
  const win = process.platform === 'win32';
  const file = path.join(dir, win ? 'yt-dlp.exe' : 'yt-dlp');
  const arch = process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  const names = win ? ['yt-dlp.exe'] : process.platform === 'darwin' ? ['yt-dlp_macos'] : [arch, 'yt-dlp']; // 'yt-dlp' = versión python
  for (const n of names) {
    try {
      console.log(`📥 Descargando yt-dlp (${n})...`);
      const r = await axios.get(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${n}`, { responseType: 'arraybuffer', timeout: 180000, maxRedirects: 8 });
      fs.writeFileSync(file, Buffer.from(r.data));
      fs.chmodSync(file, 0o755);
      if (await has(file, ['--version'])) { config.ytdlp = file; return true; }
    } catch (e) { console.log(`   no se pudo con ${n}: ${String(e.message).slice(0, 80)}`); }
  }
  try { fs.unlinkSync(file); } catch {}
  return false;
}

async function ensure() {
  const local = path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  state.ffmpeg = !!ffbin.resolve();
  state.ytdlp = await has(config.ytdlp || 'yt-dlp', ['--version']);
  if (!state.ytdlp && fs.existsSync(local) && (await has(local, ['--version']))) { config.ytdlp = local; state.ytdlp = true; }
  if (state.ffmpeg && state.ytdlp) return console.log('✅ ffmpeg y yt-dlp listos');
  const falta = [!state.ffmpeg && 'ffmpeg', !state.ytdlp && 'yt-dlp'].filter(Boolean).join(' y ');
  console.log(`⚠️ Falta ${falta}.`);
  if (process.env.AUTO_INSTALL === '0') return;
  const termux = /com\.termux/.test(process.env.PREFIX || '');
  console.log('📦 Instalando lo que falta en segundo plano (el bot ya funciona mientras tanto)...');
  if (termux) {
    if (!state.ffmpeg && (await sh('pkg install -y ffmpeg'))) { ffbin.reset(); state.ffmpeg = !!ffbin.resolve(); }
    if (!state.ytdlp) {
      await sh('pkg install -y python');
      if (await sh('pip install -U yt-dlp')) state.ytdlp = true;
    }
  } else {
    // Panel / servidor: ffmpeg viene dentro de un paquete npm; yt-dlp se descarga como binario
    if (!state.ffmpeg) {
      await sh('npm install --no-save --no-audit --no-fund --legacy-peer-deps @ffmpeg-installer/ffmpeg');
      ffbin.reset();
      state.ffmpeg = !!ffbin.resolve();
    }
    if (!state.ytdlp) state.ytdlp = await downloadYtdlp();
  }
  console.log(state.ffmpeg && state.ytdlp
    ? '✅ Listo: ffmpeg y yt-dlp funcionando'
    : `❌ Aún falta ${[!state.ffmpeg && 'ffmpeg', !state.ytdlp && 'yt-dlp'].filter(Boolean).join(' y ')}. ${termux ? 'Hazlo a mano: pkg install -y ffmpeg python && pip install -U yt-dlp' : 'Panel: npm install @ffmpeg-installer/ffmpeg (ffmpeg) y sube yt-dlp a la carpeta bin/'}`);
}

module.exports = { ensure, state, has };
