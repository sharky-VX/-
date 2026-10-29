const M = require('../lib/media');
const U = require('../lib/utils');
const config = require('../config');

// ═══════════════════════════════════════════════
//  Calidad HD / 2K / 4K para imagenes, videos y audio (ffmpeg, funciona en Termux).
//  Honestidad: estos comandos escalan con algoritmo lanczos, afinan, quitan ruido y mejoran color;
//  no inventan detalle que la foto original no tiene (eso lo hace una IA de pago).
// ═══════════════════════════════════════════════
const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'quality', run });
const MAXMB = 50;

// lado mayor = n px (mantiene proporcion, par)
const side = (n) => `scale='if(gte(iw,ih),${n},-2)':'if(gte(iw,ih),-2,${n})':flags=lanczos`;
const SHARP = 'unsharp=5:5:0.9:5:5:0.0';
const DEN = 'hqdn3d=2:1.5:3:2.5';

async function getImg(c) {
  const f = await c.getMedia(['image', 'sticker']);
  if (!f) { await c.reply(`Envia una imagen con ${c.prefix}${c.command} en el texto, o responde a una imagen.`); return null; }
  if (f.buffer.length > MAXMB * 1048576) { await c.reply('La imagen es demasiado pesada.'); return null; }
  return f;
}
async function getVid(c, maxSec = 90) {
  const f = await c.getMedia(['video']);
  if (!f) { await c.reply(`Envia un video con ${c.prefix}${c.command} en el texto, o responde a un video.`); return null; }
  if (f.seconds && f.seconds > maxSec) { await c.reply(`Ese video dura ${f.seconds}s; el maximo para este comando es ${maxSec}s (se procesa en tu telefono/panel).`); return null; }
  if (f.buffer.length > MAXMB * 1048576) { await c.reply('El video es demasiado pesado.'); return null; }
  return f;
}
const dims = (n) => ({ 1280: 'HD 720p', 1920: 'Full HD 1080p', 2560: '2K', 3840: '4K', 7680: '8K' }[n] || `${n}px`);

// Comando de imagen: aplica un filtro y devuelve la foto + el archivo sin comprimir
const img = (name, aliases, desc, vf, label) => mk(name, desc, '<imagen>', async (c) => {
  const f = await getImg(c);
  if (!f) return;
  await c.reply('Procesando imagen...');
  const out = await M.runFf(f.buffer, 'png', (i, o) => ['-i', i, '-frames:v', '1', '-vf', typeof vf === 'function' ? vf(c) : vf, o], 'bin', 120000);
  const jpg = await M.runFf(out, 'jpg', (i, o) => ['-i', i, '-q:v', '2', o], 'png');
  await c.sendImage(jpg, `${label}`);
  await c.sendFile(out.length < 40 * 1048576 ? out : jpg, `${name}.${out.length < 40 * 1048576 ? 'png' : 'jpg'}`, out.length < 40 * 1048576 ? 'image/png' : 'image/jpeg'); // archivo original sin recompresion de WhatsApp
}, aliases);

// Comando de video
const vid = (name, aliases, desc, vfFn, label, { maxSec = 90, af = null, fps = null, crf = 19 } = {}) => mk(name, desc, '<video>', async (c) => {
  const f = await getVid(c, maxSec);
  if (!f) return;
  await c.reply(`Procesando video (${label})... puede tardar un poco, no mandes otro.`);
  const vf = typeof vfFn === 'function' ? vfFn(c) : vfFn;
  const out = await M.runFf(f.buffer, 'mp4', (i, o) => [
    '-i', i, '-vf', vf + ',scale=trunc(iw/2)*2:trunc(ih/2)*2', ...(fps ? ['-r', String(fps)] : []),
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ...(af ? ['-af', af, '-c:a', 'aac', '-b:a', '192k'] : ['-c:a', 'aac', '-b:a', '160k']), o,
  ], 'bin', 600000);
  if (out.length > config.maxFileMB * 1048576) return c.reply(`El resultado pesa ${U.fmtBytes(out.length)} y pasa el limite de envio (${config.maxFileMB} MB). Prueba con ${c.prefix}comprimir o un video mas corto.`);
  await c.sendVideo(out, label);
}, aliases);

const hv = (h) => `scale=-2:'max(ih,${h})':flags=lanczos,${SHARP}`; // alto minimo h
const list = [
  // ── IMAGENES: resoluciones ──
  img('fotohd', ['mejorar', 'hdimg'], 'Imagen a HD (1280 px) con nitidez', `${side(1280)},${SHARP}`, 'Imagen HD (1280 px)'),
  img('imgfhd', ['fullhd', 'img1080'], 'Imagen a Full HD (1920 px) con nitidez', `${side(1920)},${SHARP}`, 'Imagen Full HD (1920 px)'),
  img('img2k', ['2k', 'qhd'], 'Imagen a 2K (2560 px) con nitidez', `${side(2560)},${SHARP}`, 'Imagen 2K (2560 px)'),
  img('foto4k', ['4k', 'uhd', 'ultrahd'], 'Imagen a 4K (3840 px) con nitidez y menos ruido', `${DEN},${side(3840)},${SHARP}`, 'Imagen 4K (3840 px)'),
  img('img8k', ['8k'], 'Imagen a 8K (7680 px): pesada, solo para fotos pequenas', `${DEN},${side(7680)},unsharp=7:7:0.8:7:7:0.0`, 'Imagen 8K (7680 px)'),
  img('upscale', ['escalar', 'aumentar', 'x2'], 'Agranda la imagen x2 (o x3/x4 escribiendo el numero)', (c) => { const k = Math.min(4, Math.max(2, parseInt(c.args[0]) || 2)); return `scale=iw*${k}:ih*${k}:flags=lanczos,${SHARP}`; }, 'Imagen ampliada con lanczos + nitidez'),
  img('upscale4', ['x4'], 'Agranda la imagen x4', `scale=iw*4:ih*4:flags=lanczos,${SHARP}`, 'Imagen x4'),
  // ── IMAGENES: mejoras ──
  img('nitidez', ['sharpen', 'afilar'], 'Aumenta la nitidez', 'unsharp=7:7:1.4:7:7:0.0', 'Nitidez aumentada'),
  img('desenfoque', ['deblur', 'enfocar'], 'Intenta corregir fotos algo movidas', 'unsharp=9:9:2.0:9:9:0.0,unsharp=3:3:0.8', 'Enfoque corregido'),
  img('denoise', ['sinruido', 'limpiar', 'quitarruido'], 'Quita ruido y granulado', 'hqdn3d=6:5:8:7', 'Ruido reducido'),
  img('jpgfix', ['quitarpixeles', 'dejpeg'], 'Suaviza bloques y pixeles de fotos muy comprimidas', 'hqdn3d=4:3:6:5,smartblur=1.0:0.5:0', 'Artefactos suavizados'),
  img('enhance', ['mejorfoto', 'autoajuste', 'magia'], 'Mejora automatica: color, contraste, ruido y nitidez', `${DEN},eq=contrast=1.08:saturation=1.18:gamma=1.02,${SHARP}`, 'Foto mejorada'),
  img('hdr', ['efectohdr', 'hdrfoto'], 'Efecto HDR: mas rango, detalle y color', `eq=contrast=1.15:saturation=1.3:gamma=0.95,unsharp=9:9:1.2:9:9:0.0,curves=all='0/0 0.25/0.2 0.75/0.82 1/1'`, 'Efecto HDR'),
  img('vivid', ['colorboost', 'colores'], 'Colores mas vivos', 'eq=saturation=1.5:contrast=1.06', 'Colores vivos'),
  img('claridad', ['clarity', 'localcontrast'], 'Mas contraste local (claridad)', 'unsharp=13:13:0.9:13:13:0.0,eq=contrast=1.1', 'Claridad aumentada'),
  img('iluminar', ['lowlight', 'fotooscura'], 'Aclara fotos oscuras sin quemar los blancos', "eq=brightness=0.08:gamma=1.45:saturation=1.1,hqdn3d=4:3:6:5", 'Foto iluminada'),
  img('oscurecer', ['bajarbrillo', 'sobreexpuesta'], 'Baja el brillo de fotos quemadas', 'eq=brightness=-0.06:gamma=0.8', 'Foto oscurecida'),
  img('calida', ['warm', 'tonocalido'], 'Tono calido (atardecer)', 'colorbalance=rs=.15:gs=.02:bs=-.12:rm=.1:bm=-.08', 'Tono calido'),
  img('fria', ['cold', 'tonofrio'], 'Tono frio (azulado)', 'colorbalance=rs=-.12:bs=.15:rm=-.08:bm=.1', 'Tono frio'),
  img('piel', ['suavizarpiel', 'skin'], 'Suaviza la piel y el ruido conservando bordes', 'smartblur=2.0:0.4:0,eq=brightness=0.02:saturation=1.05', 'Piel suavizada'),
  img('antialias', ['suavizarbordes'], 'Suaviza bordes dentados', 'scale=iw*2:ih*2:flags=lanczos,smartblur=0.8:0.3:0,scale=iw/2:ih/2:flags=lanczos', 'Bordes suavizados'),
  img('nitidez4k', ['hdpro', 'ultra'], 'Combo: limpia, escala a 4K y afila (el mas fuerte)', `${DEN},${side(3840)},unsharp=7:7:1.2:7:7:0.0,eq=contrast=1.06:saturation=1.12`, 'Combo ultra 4K'),
  img('wallpaper4k', ['wp4k'], 'Convierte la imagen en fondo de pantalla 4K 16:9 (3840x2160)', `scale=3840:2160:force_original_aspect_ratio=increase:flags=lanczos,crop=3840:2160,${SHARP}`, 'Fondo 4K 3840x2160'),
  img('wallpapermovil', ['fondomovil', 'wpphone'], 'Fondo vertical para celular 4K (2160x3840)', `scale=2160:3840:force_original_aspect_ratio=increase:flags=lanczos,crop=2160:3840,${SHARP}`, 'Fondo para movil 2160x3840'),

  // ── VIDEO: resoluciones ──
  vid('video720', ['v720', 'hd720'], 'Video a 720p con nitidez', hv(720), 'Video 720p', { maxSec: 120 }),
  vid('video1080', ['v1080', 'fullhdvideo'], 'Video a Full HD 1080p con nitidez', hv(1080), 'Video 1080p', { maxSec: 90 }),
  vid('video2k', ['v2k', 'qhdvideo'], 'Video a 2K (1440p)', hv(1440), 'Video 2K 1440p', { maxSec: 60 }),
  vid('video4k', ['v4k', 'uhdvideo'], 'Video a 4K (2160p): pesado, maximo 45 s', hv(2160), 'Video 4K 2160p', { maxSec: 45, crf: 20 }),
  vid('resolucion', ['resolution', 'escalarvideo'], 'Video a la altura que elijas (360 a 2160)', (c) => hv(Math.min(2160, Math.max(240, parseInt(c.args[0]) || 1080))), 'Video escalado', { maxSec: 60 }),
  // ── VIDEO: mejoras ──
  vid('videonitido', ['videosharpen', 'afilarvideo'], 'Mas nitidez en video', 'unsharp=7:7:1.3:7:7:0.0', 'Video con mas nitidez'),
  vid('videodenoise', ['videosinruido', 'limpiarvideo'], 'Quita ruido de videos oscuros o grabados con poca luz', 'hqdn3d=6:5:8:7', 'Video limpio'),
  vid('videoenhance', ['mejorarvideo', 'videomagico'], 'Mejora automatica: color, ruido y nitidez', `${DEN},eq=contrast=1.08:saturation=1.2,${SHARP}`, 'Video mejorado'),
  vid('videohdr', ['hdrvideo'], 'Efecto HDR en video', "eq=contrast=1.15:saturation=1.3:gamma=0.95,unsharp=7:7:1.0:7:7:0.0", 'Video HDR'),
  vid('videoiluminar', ['videooscuro', 'videolowlight'], 'Aclara videos oscuros', 'eq=brightness=0.08:gamma=1.45:saturation=1.1,hqdn3d=5:4:7:6', 'Video iluminado'),
  vid('estabilizar', ['stabilize', 'deshake'], 'Reduce el temblor de videos grabados a mano', 'deshake=rx=24:ry=24', 'Video estabilizado', { maxSec: 60 }),
  vid('fps30', ['v30fps'], 'Convierte el video a 30 fps', 'null', 'Video a 30 fps', { fps: 30 }),
  vid('fps60', ['v60fps', 'suave60'], 'Video a 60 fps (interpola cuadros: movimiento mas suave; maximo 20 s)', 'minterpolate=fps=60:mi_mode=blend', 'Video a 60 fps', { maxSec: 20 }),
  vid('slowmo', ['camaralenta'], 'Camara lenta suave x2 (interpolada; maximo 15 s)', 'setpts=2.0*PTS,minterpolate=fps=48:mi_mode=blend', 'Camara lenta x2', { maxSec: 15, af: 'atempo=0.5' }),
  vid('comprimir', ['compress', 'reducirpeso'], 'Reduce el peso del video sin perder mucha calidad', 'scale=-2:min(ih\\,720)', 'Video comprimido', { crf: 28, maxSec: 300 }),
  vid('videoaudiohd', ['sonidoclaro'], 'Mejora el audio del video: quita ruido y sube el volumen parejo', 'null', 'Audio del video mejorado', { af: 'afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11', maxSec: 120 }),

  // ── AUDIO ──
  mk('audiohd', 'Audio en alta calidad: limpia ruido y normaliza volumen (mp3 256k)', '<audio | video>', async (c) => {
    const f = await c.getMedia(['audio', 'video']);
    if (!f) return c.reply(`Envia o responde a un audio con ${c.prefix}audiohd.`);
    await c.reply('Mejorando audio...');
    const out = await M.runFf(f.buffer, 'mp3', (i, o) => ['-i', i, '-vn', '-af', 'afftdn=nf=-25,highpass=f=60,loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-b:a', '256k', o]);
    await c.sendAudio(out);
  }, ['mejoraraudio', 'limpiaraudio']),
  mk('bass', 'Refuerza los graves del audio', '<audio>', async (c) => {
    const f = await c.getMedia(['audio', 'video']);
    if (!f) return c.reply('Responde a un audio.');
    await c.sendAudio(await M.audioFx(f.buffer, 'bass=g=12,loudnorm=I=-14'));
  }, ['graves', 'bassboost2']),
  mk('volumen', 'Sube o baja el volumen (ej: .volumen 2 = el doble)', '<audio> [factor]', async (c) => {
    const f = await c.getMedia(['audio', 'video']);
    if (!f) return c.reply('Responde a un audio.');
    const k = Math.min(10, Math.max(0.1, parseFloat(c.args[0]) || 2));
    await c.sendAudio(await M.audioFx(f.buffer, `volume=${k}`));
  }, ['volume', 'subirvolumen']),

  // ── Info ──
  mk('calidad', 'Muestra la lista de comandos de calidad HD/4K y sus limites', '', (c) => {
    const p = c.prefix;
    c.reply([
      'CALIDAD HD / 2K / 4K',
      `Imagen: ${p}fotohd ${p}imgfhd ${p}img2k ${p}foto4k ${p}img8k ${p}upscale [2-4] ${p}nitidez4k`,
      `Mejoras: ${p}enhance ${p}hdr ${p}denoise ${p}nitidez ${p}desenfoque ${p}jpgfix ${p}vivid ${p}iluminar ${p}piel ${p}claridad`,
      `Fondos: ${p}wallpaper4k ${p}wallpapermovil`,
      `Video: ${p}video720 ${p}video1080 ${p}video2k ${p}video4k ${p}resolucion <alto>`,
      `Video mejoras: ${p}videoenhance ${p}videohdr ${p}videonitido ${p}videodenoise ${p}estabilizar ${p}fps60 ${p}slowmo ${p}comprimir`,
      `Audio: ${p}audiohd ${p}bass ${p}volumen`,
      '',
      'Responde a la imagen/video con el comando. Escalan y mejoran con lanczos + filtros (no inventan detalle nuevo). Necesitan ffmpeg.',
    ].join('\n'));
  }, ['menucalidad', 'hdmenu', 'ayudacalidad']),
];

module.exports = list;
