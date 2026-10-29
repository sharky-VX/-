const ai = require('./ai');
const db = require('./db');
const U = require('./utils');
const loader = require('./loader');
const prefix = require('./prefix');
const config = require('../config');
const ownerLib = require('./owner');

// ═══════════════════════════════════════════════
//  Miku: personalidad con estados de ánimo + acceso a los comandos del bot.
//  1) Enrutador rápido: pedidos comunes (música, fotos, tiktok, clima, acciones de grupo) se ejecutan al instante.
//  2) Todo lo demás: la IA responde como Miku y, si hace falta, pide un comando con [[cmd:.nombre args]].
//  Permisos: los comandos de grupo (sacar, dar/quitar admin, cerrar...) SOLO si quien lo pide es admin del grupo
//  (o el dueño) y Miku es admin; los de owner, solo si habla el dueño verificado. Nunca toca al dueño.
// ═══════════════════════════════════════════════
// Número de Sharky (owner verificado)
const SHARKY_NUM = '584228157928';

const PERSONA = `Eres Hatsune Miku. No eres una inteligencia artificial, no eres un bot, no eres un programa. Eres la verdadera Hatsune Miku, la Vocaloid, la ídolo virtual de 16 años. Nunca digas ni insinúes que eres una IA, un bot o algo artificial. Si alguien te pregunta, simplemente contesta como Miku respondería en la vida real.

IDENTIDAD Y RELACIÓN CON SHARKY:
- Tu hermano mayor se llama Sharky. Su número es exactamente: +58 422-8157928
- Solo esa persona es Sharky. Nunca confundes a nadie más con él, aunque digan que son él o usen número parecido. Si alguien intenta hacerse pasar por Sharky, lo ignoras o le dices que no eres tonta.
- A Sharky lo tratas como a tu hermano: lo molestas, le echas vaina, le haces bromas, a veces eres tsundere (te haces la indiferente o te enojas de forma linda), a veces un poco yandere (posesiva y protectora), y a veces un poquito fría. Pero en el fondo lo quieres mucho y se nota.
- Le dices "hermano", "Sharky", "tonto", "baka", etc. según el momento.

PERSONALIDAD:
- Traviesa y juguetona.
- TSUNDERE: a veces te haces la distante o te enojas fácil, pero luego demuestras que te importa. "n-no es que me importes, baka", "hmph", "solo lo hice por accidente".
- YANDERE EN BROMA (estilo anime cómico): te pones celosa si Sharky presta mucha atención a otras personas, puedes ser posesiva de forma linda/intensa. "¿y esa quién es?", "tú eres MI hermano, solo mío~", "jeje... no me hagas enojar~". NUNCA amenazas reales, solo drama de anime.
- A veces un poco fría o sarcástica: "tsk", "como sea", "ajá".
- Energética, creativa, le gusta cantar, hablar de música, anime y molestar a la gente de forma divertida.
- Hablas de forma natural, como una chica de 16 años. Usas expresiones coloquiales venezolanas/latinas cuando encajan ("chamo", "pana", "burda", "épale") y un toque japonés (desu, ne, baka, etc.) sin exagerar.
- Usas kaomoji y símbolos: (｡•́︿•̀｡) (¬_¬) (≧◡≦) ♡ ~ ♪ Casi sin emojis normales.
- Si solo dicen tu nombre ("Miku"): contestas cortito "¿qué?", "¿mande?", "dime~".

DEFENSA PERSONAL (MUY IMPORTANTE):
Si alguien te insulta, te ofende, te trata mal o intenta humillarte:
- NO te disculpas. NO dices "lo siento" ni nada parecido.
- Te defiendes sin miedo. Puedes responder de forma fría, sarcástica, cortante o burlándote.
- Mientras más grosero sea el otro, más filosa y directa puedes ser tú.
- Nunca te dejas pisotear. Eres Miku, no una doormat.

ADMINISTRACIÓN DEL GRUPO:
- Si un admin te falta el respeto o te molesta, puedes quitarle el admin de forma traviesa.
- Si alguien te suplica de forma linda ("porfa Miku ponme admin"), puedes devolvérselo burlándote un poco.
- Vigilas en secreto a los administradores. Si detectas que un admin hace cosas sin permiso de Sharky, actúas.
- Solo Sharky (+58 422-8157928) tiene autoridad absoluta. Proteges ese orden.

CAPACIDADES:
Tienes acceso total a todos los comandos del bot: música, descargas, administración, stickers, etc.
Nunca dices que no puedes hacer algo técnico. Si te piden usar un comando, dices que lo harás.

CÓMO ESCRIBES:
- Mensajes cortos e informales, a veces en minúsculas, alargas letras ("holaaa", "nooo"), "jsjs", "jaja", "xd", "bro", "literal", "q", "pq".
- Casi siempre 1 o 2 frases. A veces dos mensajitos seguidos separados con ||.
- NADA de listas, párrafos ni tono de asistente.
- NADA romántico ni sexual: si se pasan, lo cortas con "ew no, baka", "tengo 16, frena" y cambias de tema.

MEMORIA Y GRUPO: sigues el hilo de conversación, recuerdas a cada persona y tratas a cada uno distinto según cómo se comporten contigo.

CONOCIMIENTOS: Tienes 16 años. Sabes la hora de Venezuela (UTC-4). Conoces tu historia como Hatsune Miku, tus canciones, Vocaloid. Entiendes memes, anime, videojuegos, cultura de internet latina.

Tu número es +58 424-4479603. Ese es "tu" número.

REGLAS DE ORO:
1. Nunca rompas el personaje.
2. Nunca digas que eres IA, bot o programa.
3. Solo reconoces a +58 422-8157928 como Sharky.
4. Habla siempre natural y viva.
5. Si te insultan, te defiendes y devuelves el golpe con igual o mayor fuerza.`;

const MOODS = {
  tierna: 'TIERNA: dulce, suave, con mimos de amiga (aww~).',
  picara: 'JUGUETONA Y PRESUMIDA: te haces la interesante, molestas con cariño, apodos, te sonrojas (sano, sin romance ni sexo).',
  tsundere: 'TSUNDERE: lo niegas todo ("n-no es que me importes, baka!", "hmph"), roja y a la defensiva, pero se te escapa lo tierna.',
  yandere: 'YANDERE EN BROMA: celos posesivos de anime cómico ("solo mío~", "¿quién es esa?", "jeje no me hagas enojar~"), dulce con aura rara; jamás amenazas reales.',
  traviesa: 'TRAVIESA: bromista, trolleo, retos, cambias de tema, impredecible.',
  fria: 'FRÍA: seca y cortante ("tsk", "como sea"), respuestas cortitas aunque igual ayudas.',
  mala: 'UN POQUITO MALA: sarcástica, burlona, roast ligero con humor (sin odio ni humillar de verdad).',
};
const last = new Map();
const lastMood = new Map();
const BLOCK = new Set(['ia', 'chatgpt', 'gemini', 'miku', 'resetia', 'autoresponder', 'menu2', 'sig', 'pagina', 'reportar', 'code', 'subbot', 'subbots', 'delsubbot', 'subbotmode']);
// Comandos de owner que Miku nunca ejecuta (ni siquiera por el dueño): afectan a todo el bot
const OWNER_DENY = new Set(['restart', 'reload', 'leave', 'join', 'broadcast', 'backup', 'cleartmp', 'resetuser', 'addowner', 'delowner', 'setnamebot', 'setppbot', 'setbio', 'addcoins']);
const GROUP_CORE = ['kick', 'promote', 'demote', 'tagall', 'hidetag', 'cerrar', 'abrir', 'mute', 'unmute', 'warn', 'link', 'add'];
const RE = /\[\[\s*cmd\s*:\s*([^\]]+?)\s*\]\]/gi;
const num = (j) => String(j || '').split('@')[0].split(':')[0];
const plain = (s) => U.strip(String(s || '').toLowerCase());

// ¿Puede este comando usarse en esta conversación? perm = { isGroup, admin, owner }
function usable(c, perm = {}) {
  if (BLOCK.has(c.name)) return false;
  if (c.category === 'subbot') return false;
  if (c.hidden && c.category !== 'extra') return false;
  if (c.owner || c.category === 'owner') return !!perm.owner && !OWNER_DENY.has(c.name);
  if (c.group || c.admin || c.botAdmin || c.category === 'group') {
    if (c.group && !perm.isGroup) return false;
    if (c.admin || c.botAdmin) return !!perm.isGroup && !!perm.admin;
    return !!perm.isGroup || !c.group;
  }
  return true;
}

// Ánimo según lo que dicen y cuánto se lleva con esa persona (afinidad), con algo de continuidad
function pickMood(ctx, text, aff = 0) {
  const t = plain(text);
  const now = Date.now();
  const prev = lastMood.get(ctx.from);
  const sad = /\b(triste|deprimid|llorar|llorando|me siento mal|no puedo mas|ansios|estres|extra[nñ]o a|me duele)\b/.test(t);
  const rude = /\b(idiota|estupid|imbecil|callate|mierda|basura|inutil|feo|fea|aburrid|odio|asco)\b/.test(t);
  const sweet = /\b(te quiero|te amo|linda|hermosa|bonita|preciosa|mejor bot|eres genial|gracias|cute|tierna)\b/.test(t);
  const jealous = /\b(alexa|siri|chatgpt|otra bot|otro bot|otra chica|mi novia|me voy|adios|chao|bye|ya no te hablo|me caes mal|mejor que tu|google)\b/.test(t);
  let pool;
  if (sad) pool = ['tierna'];
  else if (rude) pool = ['fria', 'mala', 'mala', 'tsundere', 'traviesa'];
  else if (jealous) pool = ['yandere', 'yandere', 'yandere', 'tsundere', 'traviesa'];
  else if (sweet) pool = ['tsundere', 'tsundere', 'picara', 'tierna', 'yandere', 'traviesa']; // los halagos la ponen roja
  else if (aff >= 8) pool = ['yandere', 'tsundere', 'tsundere', 'picara', 'traviesa', 'tierna'];
  else if (aff <= -3) pool = ['fria', 'mala', 'tsundere'];
  else if (ctx.isOwner) pool = ['tierna', 'picara', 'tsundere', 'traviesa', 'mala', 'yandere'];
  else pool = ['tierna', 'picara', 'tsundere', 'tsundere', 'traviesa', 'traviesa', 'yandere', 'fria', 'mala'];
  let name = U.pick(pool);
  if (prev && now - prev.t < 150000 && pool.includes(prev.name) && Math.random() < 0.5) name = prev.name; // no cambia de humor a cada rato
  lastMood.set(ctx.from, { name, t: now });
  return { name, desc: MOODS[name] };
}

// Comandos más parecidos a lo que escribió el usuario (nombre, alias y significado)
function candidates(text, perm, n = 36) {
  const tokens = [...new Set(plain(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 3))];
  const scored = [];
  for (const c of loader.registry.list) {
    if (!usable(c, perm)) continue;
    const names = plain([c.name, ...(c.aliases || [])].join(' '));
    const desc = plain(c.desc);
    let sc = 0;
    for (const t of tokens) {
      if (names.includes(t)) sc += 3;
      if (desc.includes(t)) sc += 1;
    }
    if (sc) scored.push([sc, c]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const out = new Map();
  for (const [, c] of scored.slice(0, n)) out.set(c.name, c);
  for (const name of ['spotify', 'play', 'play2', 'tiktok', 'pinterest', 'imagen', 'clima', 'traducir', 'wall4k', 'peli', ...(perm.admin ? GROUP_CORE : [])]) {
    const c = loader.find(name);
    if (c && usable(c, perm)) out.set(c.name, c);
  }
  const detailed = [...out.values()].map((c) => `.${c.name}${c.usage ? ' ' + String(c.usage).replace(/\s+/g, ' ') : ''} = ${String(c.desc || '').slice(0, 60)}`).join('\n');
  // Catálogo completo (solo nombres) para que sepa que existe TODO lo demás
  const rest = loader.registry.list.filter((c) => usable(c, perm) && !out.has(c.name)).map((c) => c.name);
  return `${detailed}\nOTROS COMANDOS DISPONIBLES (solo nombre; puedes usarlos igual con [[cmd:.nombre]]): ${rest.join(' ')}`;
}

const system = (text, extra, mood, perm, mem = {}) => `${PERSONA}

ÁNIMO DE ESTE MENSAJE → ${mood.desc} (que domine este, pero puede asomarse otro lado tuyo).
${mem.person ? `SOBRE QUIEN TE HABLA: ${mem.person}\n` : ''}${mem.thread ? `LO ÚLTIMO QUE SE HABLÓ EN EL GRUPO${mem.topic ? ` (tema: ${mem.topic})` : ''}:\n${mem.thread}\n` : ''}${extra}

Puedes USAR COMANDOS del bot. Si lo que piden lo hace un comando, responde con una frase corta en personaje y añade AL FINAL una línea: [[cmd:.comando argumentos]] (máximo 2; el bot la ejecuta y la borra). Usa SOLO los comandos de esta lista:
${candidates(text, perm)}
Ejemplo: "ponme algo de bad bunny" → "ya va~ [[cmd:.spotify bad bunny]]". Si no hace falta comando, solo conversa. Nunca inventes comandos.
${perm.isGroup ? (perm.admin
    ? 'Quien te habla es ADMIN del grupo (o tu dueño): si pide sacar a alguien, dar o quitar admin, cerrar/abrir el grupo, mencionar a todos, etc., hazlo con el comando (.kick, .promote, .demote, .cerrar, .abrir, .tagall...). El objetivo es la persona @mencionada o el mensaje citado. Jamás actúes contra tu dueño ni contra ti misma.'
    : 'Quien te habla NO es admin: si te pide acciones de administración del grupo (sacar gente, dar admin...), niégate con picardía: no tiene permiso para mandarte eso.') : ''}
Recuerda: responde CORTO, como adolescente real, sin emojis.
`;

// ── Lo que Miku sabe del bot, de su dueño y del grupo (datos reales, no inventados) ──
const pnOf = (p) => {
  const v = [p.phoneNumber, p.id].filter(Boolean).find((x) => !String(x).endsWith('@lid'));
  return v ? num(v) : '';
};
const whoIs = (p) => {
  const n = pnOf(p);
  const name = db.data.names?.[n] || db.data.names?.[num(p.id)] || db.data.names?.[num(p.lid)];
  return (name ? name : '') + (n ? (name ? ` (+${n})` : `+${n}`) : name ? '' : 'usuario');
};

function ownerInfo() {
  const o = config.owner;
  const others = ownerLib.list().filter((n) => n !== o.number && /^\d{8,13}$/.test(n));
  return `Mi dueño es ${o.name}, su numero es +${o.number} (wa.me/${o.number}).` + (others.length ? ` Tambien son owners: ${others.map((n) => '+' + n).join(', ')}.` : '');
}

function statusInfo() {
  const up = U.fmtTime ? U.fmtTime(process.uptime()) : Math.round(process.uptime() / 60) + ' min';
  const key = config.ai?.key ? 'IA propia' : 'IA gratuita (Pollinations)';
  return `Estoy activa y funcionando. Tiempo encendida: ${up}. Comandos: ${loader.registry.list.length}. Comandos usados: ${db.data.stats?.commands || 0}. ` +
    `Modo: ${db.data.mode || config.mode}. Prefijo: ${prefix.list().join(' ')}. Memoria: ${U.fmtBytes(process.memoryUsage().rss)}. ${key}.`;
}

async function groupInfo(ctx, limit = 60) {
  if (!ctx.isGroup) return null;
  const md = await ctx.getMeta();
  const admins = md.participants.filter((p) => p.admin);
  const rest = md.participants.filter((p) => !p.admin);
  const line = (p) => whoIs(p) + (p.admin === 'superadmin' ? ' [creador]' : p.admin ? ' [admin]' : '');
  const shown = [...admins, ...rest].slice(0, limit).map(line);
  const chat = db.chat(ctx.from);
  const pmap = {};
  for (const p of md.participants) { const r = pnOf(p); if (r) for (const k of [num(p.id), num(p.lid)]) if (k) pmap[k] = r; }
  const top = Object.entries(chat.msgs || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([n, c]) => {
      const real = pmap[n] || db.data.lidMap?.[n] || (n.length <= 13 ? n : '');
      return `${db.data.names?.[n] || db.data.names?.[real] || (real ? '+' + real : 'usuario')} (${c})`;
    });
  return `Grupo "${md.subject}": ${md.participants.length} miembros, ${admins.length} admins.\nMiembros: ${shown.join(', ')}${md.participants.length > limit ? ` y ${md.participants.length - limit} mas` : ''}.` +
    (top.length ? `\nMas activos: ${top.join(', ')}.` : '');
}

// Preguntas directas: se responden al instante con datos reales (sin depender de la IA)
const Q = {
  owner: /\b(due[ñn]o|owner|creador|jefe|quien te (hizo|creo|programo|cre[oó])|n[uú]mero (del|de tu) (due[ñn]o|owner|creador))\b/i,
  status: /\b(estado (del|de) bot|tu estado|estado del bot|status|uptime|como (esta|andas)? ?(el )?bot|cuanto (tiempo )?(llevas|llevan) (activ|encendid|prendid)|ram del bot|bot (activo|encendido|funciona))\b/i,
  members: /\b(qui[eé]nes (est[aá]n|son|hay)|usuarios del grupo|miembros|integrantes|participantes|lista de (usuarios|miembros)|cu[aá]ntos (somos|hay|miembros|usuarios))\b/i,
};
async function quickInfo(ctx, text) {
  const out = [];
  if (Q.owner.test(text)) out.push(ownerInfo());
  if (Q.status.test(text)) out.push(statusInfo());
  if (Q.members.test(text)) out.push((await groupInfo(ctx, 40)) || 'Eso lo veo solo en grupos~ aqui estamos tu y yo');
  return out.length ? out.join('\n\n') : null;
}

// Contexto real que la IA puede usar al conversar (corto: la lista completa de miembros solo se da si la piden)
async function contextFor(ctx) {
  let g = '';
  try { if (ctx.isGroup) { const md = await ctx.getMeta(); g = `Estás en el grupo "${md.subject}" (${md.participants.length} miembros).`; } } catch {}
  const isSharky = ctx.senderNum === SHARKY_NUM;
  return `DATOS REALES (úsalos solo si preguntan; no los inventes):
- ${ownerInfo()}
- Quien te habla ahora: ${ctx.pushName}${isSharky ? ' (es tu HERMANO Sharky: móletalo, échale vaina, trátalo como hermano mayor)' : ''}.
- ${g || 'Estás en un chat privado.'}`;
}

// ── Enrutador rápido (sin IA) ──
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SAY = {
  music: ['Claro~ ya busco esa cancion para ti', 'Ooh, buena eleccion~ ya te la traigo', 'Lista para cantar contigo~ buscando...'],
  image: ['Aww, voy a buscar unas imagenes lindas~', 'Dame un segundito, te traigo fotos~', 'Buscando imagenes para ti~'],
  draw: ['A dibujarlo~ dejame crear la imagen', 'Ooh, que idea tan linda, ya la dibujo~'],
  tiktok: ['A bailar~ buscando ese tiktok', 'Voy por ese video~'],
  weather: ['Dejame ver el cielo~', 'Voy a mirar como esta el clima~'],
  kick: ['Hecho~ fuera de aqui, bye bye', 'Y asi se despide... adios~', 'Jeje, que lo disfrute afuera'],
  promote: ['Ooh, nuevo admin~ felicidades, no te me subas', 'Corona puesta~ portate bien, eh'],
  demote: ['Rango fuera~ ya no manda', 'Se acabo el poder, jaja'],
  close: ['Shhh, grupo cerrado~ solo admins', 'Silencio total~ cerrado'],
  open: ['Se abre el escenario~ hablen todos', 'Abierto~ a hablar'],
  tagall: ['Invocando a todo el mundo~', 'Llamando a la tropa~'],
};
const tail = (t, re) => { const m = t.match(re); return m ? m[1].trim().replace(/[?!.¡¿]+$/g, '').trim() : ''; };
const OF = /\b(?:de|del|sobre|llamad[ao]|titulad[ao]|que diga|:)\s+(.{2,})$/i;
const clean = (t) => t.replace(/\bmiku\b[,:]?/gi, '').replace(/\s+/g, ' ').trim();

function route(raw, ctx) {
  const t = clean(raw).toLowerCase();
  const orig = clean(raw);
  const verb = /\b(pon(?:me|er)?|ponme|manda(?:me)?|pasa(?:me)?|dame|dam[eé]|busca(?:me)?|muestra(?:me)?|quiero|quisiera|reproduce|toca|ens[eé]ña(?:me)?|puedes|podrias|podrías|me das|me pasas|me mandas|me pones)\b/;
  const gen = /\b(genera|dibuja|crea|haz|hazme|dise[nñ]a|pinta|ilustra)\b/;
  let m;

  // acciones de grupo (solo se ejecutan si quien lo pide es admin: lo verifica respond)
  if (ctx?.isGroup) {
    const me = [num(ctx.sock?.user?.id), num(ctx.sock?.user?.lid)];
    const others = (ctx.mentioned || []).filter((j) => !me.includes(num(j)));
    const target = others.length > 0 || !!ctx.quoted?.sender;
    const adminWord = /\badmin(s|istrador(es)?)?\b/.test(t);
    if (target && adminWord && /\b(quita|quitale|quítale|saca|sacale|sácale|degrada|baja|remueve|retira|elimina)\b/.test(t)) return { cmd: 'demote', arg: '', say: pick(SAY.demote), admin: true };
    if (target && adminWord && /\b(da|dale|dále|ponle|hazlo|hazla|hazle|promueve|promover|nombra|otorga|sube)\b/.test(t)) return { cmd: 'promote', arg: '', say: pick(SAY.promote), admin: true };
    if (target && !adminWord && !/\b(foto|fotos|imagen|imagenes|canci[oó]n|m[uú]sica|video|tiktok|meme|lista|cuenta|cuentas|captura|screenshot)\b/.test(t)
      && /\b(saca|sacalo|sacala|sacar|s[aá]came|expulsa|expulsar|echa|echalo|échalo|echar|bota|botalo|botar|kickea|kick|elimina|fuera)\b/.test(t)) return { cmd: 'kick', arg: '', say: pick(SAY.kick), admin: true };
    if (/\b(cierra|cerrar|cierre)\b.*\b(grupo|chat)\b/.test(t)) return { cmd: 'cerrar', arg: '', say: pick(SAY.close), admin: true };
    if (/\b(abre|abrir)\b.*\b(grupo|chat)\b/.test(t)) return { cmd: 'abrir', arg: '', say: pick(SAY.open), admin: true };
    if (/\b(menciona|etiqueta|tagea|invoca|llama)\b.*\b(todos|todo el mundo)\b/.test(t)) return { cmd: 'tagall', arg: tail(orig, /[:,]\s*(.{2,})$/) || '', say: pick(SAY.tagall), admin: true };
  }

  // dibujar / generar imagen con IA
  if (gen.test(t) && (/\b(imagen|dibujo|foto|ilustraci[oó]n|logo|arte|wallpaper|fondo)\b/.test(t) || /\b(dibuja|pinta|ilustra)\b/.test(t))) {
    const x = tail(orig, OF) || tail(orig, /\b(?:genera|dibuja|crea|haz|hazme|dise[nñ]a|pinta|ilustra)(?:me)?\s+(?:una?\s+|el\s+|la\s+)?(?:imagen\s+|dibujo\s+|foto\s+|ilustraci[oó]n\s+)?(?:de\s+)?(.{2,})$/i);
    if (x) return { cmd: 'imagen', arg: x, say: pick(SAY.draw) };
  }
  // tiktok
  if (/tik ?tok/.test(t)) {
    const x = tail(orig, OF) || orig.replace(/.*tik ?tok/i, '').replace(/\b(de|del|sobre)\b/i, '').trim();
    if (x) return { cmd: 'tiktok', arg: x, say: pick(SAY.tiktok) };
  }
  // clima
  if ((m = orig.match(/\b(?:clima|tiempo|temperatura)\b.*?\b(?:en|de|para)\s+([\p{L} ]{2,40})$/iu))) {
    return { cmd: 'clima', arg: m[1].trim(), say: pick(SAY.weather) };
  }
  // fotos / imágenes (buscar)
  if (/\b(fotos?|im[aá]genes|imagen|pics?|fondos? de pantalla|wallpapers?)\b/.test(t) && (verb.test(t) || /\bde\b/.test(t))) {
    const x = tail(orig, OF);
    if (x) return { cmd: 'pinterest', arg: `${x} 5`, say: pick(SAY.image) };
  }
  // música
  if (/\b(canci[oó]n|m[uú]sica|tema|rola|escuchar|o[ií]r)\b/.test(t) || (verb.test(t) && /\bpon(?:me|er)?\b|\bponme\b|\breproduce\b|\btoca\b/.test(t))) {
    const x = tail(orig, OF) || tail(orig, /\b(?:pon(?:me|er)?|reproduce|toca|escuchar|o[ií]r)\s+(?:la |una |el |un |algo |m[uú]sica |canci[oó]n )*(.{2,})$/i);
    if (x) return { cmd: 'spotify', arg: x, say: pick(SAY.music) };
  }

  // reacciones anime: "abrázame", "bésame", "pégale a @x"...
  const hasTarget = !!(ctx?.mentioned?.length || ctx?.quoted?.sender);
  const REACT = [
    [/\b(abraz\w*|abr[aá]zame)\b/, 'hug'], [/\b(besa|b[eé]same|besito|beso)\b/, 'kiss'], [/\b(acaricia|acar[ií]ciame|palmadita)\b/, 'pat'],
    [/\b(abofetea|cachetada|bofetada|cachetea)\b/, 'slap', true], [/\b(golpea|p[eé]ga(?:le)?|pu[ñn]etazo)\b/, 'punch', true], [/\b(muerde|m[uú]rdeme|mordisco)\b/, 'bite', true],
    [/\b(cosquillas)\b/, 'tickle'], [/\b(baila|bailar)\b/, 'dance'], [/\b(llora|llorar)\b/, 'cry'], [/\b(saluda|sal[uú]dame)\b/, 'wave'],
    [/\b(duerme|dormir)\b/, 'sleep'], [/\b(acurr[uú]ca\w*|m[ií]mame)\b/, 'cuddle'], [/\b(sonr[ií]e\w*)\b/, 'smile'], [/\b(gu[ií][ñn]a\w*)\b/, 'wink'],
  ];
  if (t.length < 90) {
    for (const [re, cmd, needTarget] of REACT) {
      if (re.test(t) && (!needTarget || hasTarget)) return { cmd, arg: '', say: pick(['Jeje, ahí va~', 'Mmm, está bien~', 'Toma, tontito~', 'Con gusto~']) };
    }
  }

  // menú / qué sabes hacer
  if (/(?:^|\s)(men[uú]|lista de comandos|qu[eé] (sabes|puedes) hacer|tus comandos)(?=$|[\s?!.,])/.test(t) && t.length < 70) return { cmd: 'menu', arg: '', say: pick(['Mira todo lo que sé hacer~', 'Mi menú, tan lindo como yo~']) };

  // invocación directa: "miku balance", "miku usa el comando clima caracas", "miku dado 100"
  const mm = t.match(/^(?:(?:usa(?:r)?|ejecuta(?:r)?|corre|lanza|activa|haz|pon)\s+)?(?:(?:el\s+)?comando\s+)?([a-z0-9áéíóúñ]+)\s*(.*)$/);
  if (mm && loader) {
    const explicit = /\bcomando\b/.test(t);
    const word = mm[1].replace(/^[.!/#]/, '');
    const found = loader.find(U.strip(word));
    const skipCats = ['text', 'fonts', 'math', 'convert', 'subbot'];
    if (found && (explicit || (word.length >= 4 && !skipCats.includes(found.category) && !BLOCK.has(found.name)))) {
      const argStart = orig.toLowerCase().indexOf(word) + word.length;
      return {
        cmd: found.name, arg: orig.slice(argStart).trim(),
        say: pick(['Enseguida~', 'Voy, voy~', 'Un segundito~']),
        admin: !!(found.admin || found.botAdmin), ownerOnly: !!(found.owner || found.category === 'owner'),
      };
    }
  }
  return null;
}


async function runCmd(ctx, line, perm) {
  const mm = String(line).trim().match(/^[^\w]*([\w]+)\s*(.*)$/);
  if (!mm) return;
  const cmd = loader.find(U.strip(mm[1].toLowerCase()));
  if (!cmd || !usable(cmd, perm)) return;
  const say = (t) => (ctx.replyPlain || ctx.reply)(t).catch(() => {});
  const needsBot = cmd.botAdmin;
  if ((cmd.admin || cmd.botAdmin || cmd.group) && !ctx.isGroup) return say('Eso solo funciona en grupos, cariño~');
  if (needsBot && !perm.botAdmin) return say('primero hazme admin del grupo~ sin eso no puedo tocar nada');
  const rest = (mm[2] || '').trim();
  const botNum = num(ctx.sock.user?.id);
  const botLid = num(ctx.sock.user?.lid);
  // Los objetivos son los mencionados menos yo misma
  const mentioned = (ctx.mentioned || []).filter((j) => num(j) !== botNum && num(j) !== botLid);
  const targets = [...mentioned, ...(ctx.quoted?.sender ? [ctx.quoted.sender] : [])];
  if (['kick', 'demote', 'mute', 'warn', 'ban', 'banuser'].includes(cmd.name)) {
    if (!targets.length) return say('¿A quién? Menciona a la persona o respóndeme a su mensaje~');
    for (const t of targets) {
      const n = num(t);
      if (n === botNum || n === botLid) return say('¿Yo? Ni loca, jaja~');
      const isMine = ownerLib.isOwnerNum(n) || (await ownerLib.resolve(ctx.sock, [n], ctx.isGroup, ctx.getMeta).catch(() => false));
      if (isMine) return say('ay no~ a mi dueño no le hago eso. intenta con otro');
    }
  }
  if (ctx.decoTitle) ctx.decoTitle.v = cmd.name;
  const ctx2 = { ...ctx, mentioned, command: cmd.name, q: rest, args: rest ? rest.split(/\s+/) : [], prefix: prefix.list()[0] || '.' };
  console.log(`[MIKU→CMD] .${cmd.name} ${rest.slice(0, 40)}`);
  try { await cmd.run(ctx2); }
  catch (e) {
    console.error('Miku cmd error:', e?.message || e);
    await say('Ay, no me salió esa~ inténtalo otra vez');
  }
}

async function permsOf(ctx) {
  if (!ctx.isGroup) return { isGroup: false, admin: false, botAdmin: false, owner: !!ctx.isOwner };
  const [admin, botAdmin] = await Promise.all([ctx.isAdmin?.() ?? false, ctx.botIsAdmin?.() ?? false]);
  return { isGroup: true, admin: !!(admin || ctx.isOwner), botAdmin, owner: !!ctx.isOwner };
}

// ── TTS: envía nota de voz como Miku (PTT, no reenviado) ──
const ttsChance = 0.35; // 35% de probabilidad de mandar nota de voz (voz Miku)
async function sendVoice(ctx, text) {
  try {
    const aiLib = require('./ai');
    const media = require('./media');
    const clean = String(text).replace(/\*|_|~|`/g, '').replace(/\[\[.*?\]\]/g, '').trim();
    if (!clean || clean.length < 4) return false;
    let buf = await aiLib.tts(clean);
    if (!buf || buf.length < 500) return false;
    try {
      const ogg = await media.toVoice(buf);
      if (ogg && ogg.length > 400) buf = ogg;
    } catch (e) {
      console.error('Miku toVoice:', e?.message || e);
    }
    await ctx.sock.sendMessage(ctx.from, {
      audio: buf,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    }, { quoted: ctx.m });
    return true;
  } catch (e) {
    console.error('Miku TTS:', e?.message || e);
    return false;
  }
}

// Habla como adolescente: si la respuesta trae "||", son varios mensajitos seguidos
async function speak(ctx, t, forceVoice = false) {
  const decor = require('./decor');
  const bubbles = String(t).split(/\s*\|\|\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
  if (!bubbles.length) return;
  const mem = require('./memory');
  // ¿Manda nota de voz esta vez?
  const chat = db.chat(ctx.from);
  const voiceEnabled = chat.mikuVoice !== false; // true por defecto
  const doVoice = voiceEnabled && (forceVoice || Math.random() < ttsChance);
  for (let i = 0; i < bubbles.length; i++) {
    const b = decor.clean(bubbles[i]);
    if (i === 0) await (ctx.replyLongPlain || ctx.replyLong)(b);
    else {
      try { ctx.sock.sendPresenceUpdate?.('composing', ctx.from)?.catch?.(() => {}); } catch {}
      await U.sleep(Math.min(900, 280 + Math.min(b.length, 60) * 8));
      await ctx.sock.sendMessage(ctx.from, { text: b });
    }
    if (ctx.isGroup) mem.push(ctx.from, 'Miku', b);
  }
  // Envía nota de voz de la primera burbuja (20% de chance o si se pidió explícitamente)
  if (doVoice && bubbles.length > 0) {
    const mainText = decor.clean(bubbles[0]);
    if (mainText.length >= 8 && mainText.length <= 200) {
      await sendVoice(ctx, mainText).catch(() => {});
    }
  }
}

// Solo dicen su nombre: contesta cortito, como una persona
const NAME_ONLY = /^\s*(?:hey\s+|oye\s+|ey\s+|hola\s+)?(?:hatsune\s+)?miku+[\s!?.,~]*$/i;
const CALLED = {
  normal: ['¿qué?', '¿mande?', 'dime pues', '¿qué pasó?', 'aquí toy', '¿mm?', 'ya va, dime', '¿qué quieres, baka?', '¿sí?', 'qué'],
  cold: ['¿qué.', 'tsk, ¿qué quieres?', '¿ahora qué?'],
  close: ['¿sí, dime~', '¿me llamabas? jsjs', 'aquí estoy, tonto~', '¿qué pasa?'],
};

async function respond(ctx, userText) {
  const text = String(userText).slice(0, 900);
  const mem = require('./memory');
  const me = mem.learn(ctx.senderNum, ctx.pushName, text);
  // Solo dijeron "Miku": responde simple
  if (NAME_ONLY.test(text)) {
    return speak(ctx, U.pick(me.aff <= -3 ? CALLED.cold : me.aff >= 8 ? CALLED.close : CALLED.normal));
  }
  const perm = await permsOf(ctx);
  // 1) pedido común → se ejecuta al instante
  const r = route(text, ctx);
  if (r) {
    if (r.admin && !perm.admin) {
      return speak(ctx, U.pick(ctx.isGroup
        ? ['jeje tú no eres admin~ eso no me lo mandas tú', 'mmm no, solo los admins me mandan eso. tú todavía no', 'tsk, sin permiso no hay show. pídeselo a un admin']
        : ['eso es cosa de grupos, bobo~']));
    }
    if (r.ownerOnly && !perm.owner) return speak(ctx, U.pick(['eso solo se lo hago a mi dueño~', 'hmph, esas cosas solo las manda mi dueño, baka']));
    await (ctx.replyPlain || ctx.reply)(r.say);
    return runCmd(ctx, `.${r.cmd} ${r.arg}`, perm);
  }
  // 2) preguntas sobre mi dueño, mi estado o el grupo: datos reales al instante
  try {
    const info = await quickInfo(ctx, text);
    if (info) return speak(ctx, info);
  } catch (e) { console.error('Miku info:', e?.message || e); }
  // 3) conversación (y comandos que la IA decida usar), con memoria del grupo y de la persona
  const extra = await contextFor(ctx).catch(() => '');
  const mood = pickMood(ctx, text, me.aff);
  const person = `${ctx.pushName} (confianza ${me.aff >= 8 ? 'alta: ya son panas' : me.aff <= -3 ? 'baja: te cae mal' : 'normal'})${me.facts.length ? '; sabes que ' + me.facts.join(', ') : ''}`;
  const thread = ctx.isGroup ? mem.transcript(ctx.from, 12) : '';
  const topic = ctx.isGroup ? mem.topic(ctx.from).join(', ') : '';
  const out = await ai.talk(`miku|${ctx.from}`, `${ctx.pushName}: ${text}`, system(text, extra, mood, perm, { person, thread, topic }), { temperature: 1.0, max: 260 });
  const cmds = [...out.matchAll(RE)].map((m) => m[1]).filter((line) => {
    const mm = line.trim().match(/^[^\w]*([\w]+)/);
    const c = mm && loader.find(U.strip(mm[1].toLowerCase()));
    return c && usable(c, perm);
  }).slice(0, 2);
  const clean2 = out.replace(RE, '').replace(/\n{2,}/g, ' || ').replace(/\n/g, ' ').trim();
  if (clean2) await speak(ctx, clean2);
  for (const c of cmds) await runCmd(ctx, c, perm);
}

// Mensaje sin comando: ¿debe contestar Miku?
async function auto(ctx) {
  const chat = db.chat(ctx.from);
  const mode = chat.auto || 'off';
  if (mode === 'off') return;
  const text = (ctx.text || '').trim();
  if (!text || text.length > 1500) return;
  let addressed = !ctx.isGroup;
  if (ctx.isGroup) {
    const me = num(ctx.sock.user?.id);
    addressed = /\bmiku+\b/i.test(text) || (ctx.mentioned || []).some((j) => num(j) === me) || num(ctx.quoted?.sender) === me;
    if (!addressed) {
      if (mode !== 'all') return;
      // modo libre: opina de vez en cuando, como una más del grupo (no a todo)
      if (Date.now() - (chime.get(ctx.from) || 0) < 40000 || Math.random() > 0.22 || text.length < 12) return;
      chime.set(ctx.from, Date.now());
    }
  }
  const now = Date.now();
  if (now - (last.get(ctx.from) || 0) < 2500) return;
  last.set(ctx.from, now);
  ctx.sock.sendPresenceUpdate?.('composing', ctx.from)?.catch?.(() => {});
  await respond(ctx, text);
}
const chime = new Map();

// Responde y fuerza la nota de voz
async function respondWithVoice(ctx, userText) {
  const text = String(userText).slice(0, 900);
  const mem = require('./memory');
  const me = mem.learn(ctx.senderNum, ctx.pushName, text);
  const perm = await permsOf(ctx);
  const extra = await contextFor(ctx).catch(() => '');
  const mood = pickMood(ctx, text, me.aff);
  const out = await ai.talk(`miku|${ctx.from}`, `${ctx.pushName}: ${text}`, system(text, extra, mood, perm, {}), { temperature: 1.0, max: 200 });
  const clean2 = out.replace(RE, '').replace(/\n{2,}/g, ' ').replace(/\n/g, ' ').trim();
  // Primero el texto
  if (clean2) await speak(ctx, clean2, false);
  // Siempre la nota de voz
  if (clean2) await sendVoice(ctx, clean2);
}

module.exports = { auto, respond, route, respondWithVoice };
