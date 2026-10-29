// ═══════════════════════════════════════════════
//  CONFIGURACIÓN DEL BOT  —  edita todo desde aquí
//  (o crea config.local.js para que tus cambios no se pierdan al actualizar)
// ═══════════════════════════════════════════════
const config = {
  botName: 'SHARKNEX',

  // 👑 Dueño del bot (número con código de país, SIN + ni espacios)
  // El número con el que vincules el bot también cuenta como owner automáticamente.
  owner: { name: 'Sharky', number: '584228157928' }, // <-- CAMBIA ESTE NÚMERO

  // Prefijos que activan comandos (.menu  !menu  /menu  #menu). El owner puede cambiarlos con .setprefix
  // (y con .setprefix none el bot responde SIN prefijo: escribes "menu" y listo)
  prefixes: ['.', '!', '/', '#'],

  // 🖼️ Banner del menú: guarda tu imagen en media/banner.jpg
  banner: './media/banner.jpg',
  // 'image' = banner como imagen normal + menú debajo (se ve en TODOS los teléfonos) ✅ recomendado
  // 'ad'    = banner grande tipo anuncio (algunos teléfonos no lo muestran)
  menuButtons: false, // botones Siguiente/Anterior: WhatsApp normal casi nunca los muestra, mejor dejarlos apagados
  menuName: 'SHARKNEX',
  menuDesc: true, // true = cada comando con su significado (más páginas) · false = lista compacta
  menuMaxCharsAd: 6000, // caracteres por página en estilo 'ad' (texto, aguanta mucho)
  menuMaxChars: 2800, // caracteres por página (va en el pie de la foto)
  reactions: false, // reacciones ⏳✅❌ a cada comando (apagadas: en algunos teléfonos salen como "Esperando mensaje")
  menuStyle: 'foto', // 'foto' = foto normal (la que SÍ ven todos) · 'ad' = banner incrustado (algunos teléfonos no lo muestran)

  // Enlace que se abre al tocar el banner (solo en menuStyle 'ad')
  links: { owner: 'https://wa.me/584228157928' },

  // true = el bot SOLO responde en grupos (en privado no contesta nada: evita baneos). Owner: .sologrupos on|off
  groupsOnly: true,

  // 'public' = todos usan el bot | 'self' = solo el owner
  mode: 'public',

  // Número para el código de vinculación (con código de país, sin +).
  // Si lo dejas vacío: usa la variable de entorno PAIRING_NUMBER, o te lo pregunta en la consola.
  // En un PANEL sin teclado, escríbelo aquí o define PAIRING_NUMBER.
  pairingNumber: '',
  sessionDir: './session',

  // Sub bots: los miembros vinculan su propio número (sesión independiente)
  subbots: { enabled: true, max: 10 },

  // Anti-spam: milisegundos mínimos entre comandos de un mismo usuario (owner exento)
  cooldownMs: 1500,

  // Descargas (yt-dlp)
  ytdlp: 'yt-dlp',
  spotify: { clientId: '', clientSecret: '' }, // opcional: gratis en developer.spotify.com (sin claves usa iTunes)
  gifHeight: 1080,   // altura de los GIF de anime (se escalan con lanczos). 2160 = '4K' (pesado). Owner: .gifhd 720|1080|2160
  imagesMax: 10,     // máximo de imágenes por búsqueda (.pinterest)
  imagesDefault: 7,  // cantidad por defecto
  maxFileMB: 90,         // tamaño máximo de archivo a enviar
  maxDurationSec: 1800,  // duración máxima (30 min)

  // 🤖 Inteligencia Artificial
  // SIN key: usa Pollinations (gratis, sin registro, pero puede fallar o ir lento).
  // CON key (recomendado, gratis): crea una cuenta en https://console.groq.com
  //   o usa Google AI Studio (baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai').
  //   Funciona con cualquier servicio compatible con OpenAI (OpenRouter, DeepSeek, OpenAI...).
  ai: {
    key: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile', // revisa en tu proveedor el nombre de modelo vigente
    system: 'Eres SharkyBot, un asistente de WhatsApp. Responde en español, claro y directo, en menos de 1500 caracteres salvo que pidan más.',
    memoryTurns: 8,
  },

  // 🌐 API REST propia (descargas, IA, clima, traductor...). APAGADA por defecto para no
  // chocar con el servidor de tu panel. Para encenderla: enabled: true (o API_ENABLED=1)
  // y elige un puerto libre.
  api: {
    enabled: process.env.API_ENABLED === '1',
    host: '127.0.0.1',   // '0.0.0.0' para exponerla a tu red
    port: Number(process.env.API_PORT) || 3000,
    key: 'sharky-cambiame', // <-- CAMBIA ESTA CLAVE
  },

  // Orden y nombres de categorías en el menú
  categories: {
    main:      { emoji: '🏠', title: 'PRINCIPAL' },
    ai:        { emoji: '🤖', title: 'INTELIGENCIA ARTIFICIAL' },
    downloads: { emoji: '📥', title: 'DESCARGAS' },
    media:     { emoji: '🎞️', title: 'MULTIMEDIA' },
    tools:     { emoji: '🛠️', title: 'HERRAMIENTAS' },
    info:      { emoji: '🌍', title: 'INFORMACIÓN' },
    text:      { emoji: '🔤', title: 'TEXTO' },
    fonts:     { emoji: '🅰️', title: 'FUENTES' },
    convert:   { emoji: '🔁', title: 'CONVERSORES' },
    math:      { emoji: '🧮', title: 'MATEMÁTICAS' },
    fun:       { emoji: '🎉', title: 'DIVERSIÓN' },
    anime:     { emoji: '🌸', title: 'ANIME' },
    games:     { emoji: '🎮', title: 'JUEGOS' },
    economy:   { emoji: '💰', title: 'ECONOMÍA' },
    gacha:     { emoji: '🎴', title: 'GACHA' },
    quality:   { emoji: '🖼️', title: 'CALIDAD HD 4K' },
    group:     { emoji: '👥', title: 'GRUPOS' },
    extra:     { emoji: '🤫', title: 'EXTRA HD' },
    subbot:    { emoji: '🤖', title: 'SUB BOTS' },
    owner:     { emoji: '👑', title: 'OWNER' },
    nsfw:      { emoji: '🔞', title: 'NSFW (oculto · menu2)' },
  },
};

// config.local.js (opcional) se mezcla encima de este archivo
const merge = (a, b) => {
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) merge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
};
try { merge(config, require('./config.local')); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }

config.owners = [config.owner.number];
module.exports = config;
