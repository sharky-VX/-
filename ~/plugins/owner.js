const fs = require('fs');
const path = require('path');
const db = require('../lib/db');
const loader = require('../lib/loader');
const U = require('../lib/utils');
const media = require('../lib/media');
const ownerLib = require('../lib/owner');
const config = require('../config');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({
  name, aliases, desc, usage, category: 'owner', owner: true, ...extra, run,
});
const jidOf = (c) => {
  const j = c.mentioned[0] || c.quoted?.sender;
  if (j) return j;
  const n = (c.args[0] || '').replace(/\D/g, '');
  return n ? `${n}@s.whatsapp.net` : null;
};
const numOf = (j) => j.split('@')[0].split(':')[0];
// "5k" "2m" "1.5m" "1000" → número (0 si no vale)
function amount(a, def) {
  if (a === undefined || a === '') return def;
  const m = String(a).toLowerCase().replace(/[,_]/g, '').match(/^(\d+(?:\.\d+)?)([kmbt]?)$/);
  if (!m) return 0;
  const mult = { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[2]];
  return Math.min(Math.floor(parseFloat(m[1]) * mult), 1e13);
}

module.exports = [

  mk('addowner', 'Da permisos de owner a otro número (acceso total al bot)', '@usuario|número', async (c) => {
    const j = jidOf(c);
    if (!j) return c.reply('Menciona, responde a su mensaje o escribe el número. Ejemplo: .addowner 584121234567');
    const ids = new Set([numOf(j)]);
    if (c.isGroup) {
      try {
        const md = await c.getMeta();
        const p = md.participants.find((x) => [x.id, x.lid, x.phoneNumber].filter(Boolean).some((v) => numOf(v) === numOf(j)));
        if (p) [p.id, p.lid, p.phoneNumber].filter(Boolean).forEach((v) => ids.add(numOf(v)));
      } catch {}
    }
    let nuevos = 0;
    for (const i of ids) if (ownerLib.add(i)) nuevos++;
    c.reply(nuevos ? `Listo, ${[...ids].find((i) => i.length <= 13) || numOf(j)} ahora es owner (acceso total).` : 'Esa persona ya era owner.');
  }, ['setowner', 'agregarowner']),

  mk('delowner', 'Quita los permisos de owner a un número', '@usuario|número', (c) => {
    const j = jidOf(c);
    if (!j) return c.reply('Menciona, responde o escribe el número.');
    if (numOf(j) === ownerLib.num(config.owner.number)) return c.reply('Ese es el owner principal (está en config.js), no se puede quitar desde aquí.');
    ownerLib.remove(numOf(j));
    c.reply('Listo, ya no es owner.');
  }, ['quitarowner']),

  mk('owners', 'Lista de owners del bot con nombre y número', '', async (c) => {
    const l = ownerLib.list();
    const mainNum = ownerLib.num(config.owner.number);
    let lines = [];
    for (const n of l) {
      const jid = `${n}@s.whatsapp.net`;
      let name = null;
      try {
        const info = await c.sock.onWhatsApp(jid);
        if (info?.[0]?.exists) {
          const contact = c.sock.store?.contacts?.[jid] || await c.sock.fetchStatus(jid).catch(() => null);
          name = contact?.name || contact?.notify || null;
        }
      } catch {}
      const label = n === mainNum ? '👑 Principal' : '🔑 Owner';
      const display = name ? `*${name}* (+${n})` : `+${n}`;
      lines.push(`${label}: ${display}`);
    }
    c.reply([
      `*Owners del bot (${l.length}):*`,
      '',
      ...lines,
      '',
      `Añadir: ${c.prefix}addowner <número>`,
      `Quitar: ${c.prefix}delowner <número>`,
    ].join('\n'));
  }, ['listowners', 'listaowners']),

  mk('miid', 'Muestra tus identificadores y si el bot te reconoce como owner', '', async (c) => {
    const md = c.isGroup ? await c.getMeta().catch(() => null) : null;
    const p = md?.participants.find((x) => [x.id, x.lid, x.phoneNumber].filter(Boolean).some((v) => ownerLib.idsOf(c.m, c.sender).includes(numOf(v))));
    c.reply(
      `Tu ID: ${c.sender}\nIDs vistos: ${ownerLib.idsOf(c.m, c.sender).join(', ')}\n` +
      (p ? `En el grupo: ${[p.id, p.lid, p.phoneNumber].filter(Boolean).join(' | ')}\n` : '') +
      `Owner: ${c.isOwner ? 'SI' : 'NO'}\nSi dice NO y eres el dueño, desde el número vinculado escribe: ${c.prefix}addowner ${numOf(c.sender)}`
    );
  }, ['myid', 'whoami'], { owner: false, hidden: true }),

  mk('gifhd', 'Calidad de los GIF de anime (altura en px: 720, 1080, 2160)', '720|1080|2160', (c) => {
    const v = parseInt(c.args[0]);
    if (![480, 720, 1080, 1440, 2160].includes(v)) return c.reply(`Calidad actual: ${db.data.gifHeight || config.gifHeight}p\nUso: ${c.prefix}gifhd 720|1080|2160 (2160 = 4K, tarda más y pesa más)`);
    db.data.gifHeight = v;
    db.save();
    c.reply(`GIF de anime a ${v}p${v === 2160 ? ' (4K: puede tardar y pesar mucho)' : ''}.`);
  }, ['gifcalidad']),

  mk('reacciones', 'Activa o apaga las reacciones del bot a cada comando', 'on|off', (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(v)) return c.reply(`Reacciones: ${(db.data.reactions ?? config.reactions) ? 'ON' : 'OFF'}\nUso: ${c.prefix}reacciones on|off`);
    db.data.reactions = v === 'on';
    db.save();
    c.reply(`Reacciones ${v === 'on' ? 'activadas' : 'apagadas'}.`);
  }, ['reactions']),
  mk('reload', 'Recarga los plugins sin reiniciar', '', (c) => c.reply(`♻️ ${loader.load()} comandos recargados (el bot principal y todos los sub bots ya usan los comandos nuevos).`), ['recargar']),

  mk('restart', 'Reinicia el bot (tu panel o start.sh lo vuelve a abrir)', '', async (c) => {
    await c.reply('♻️ Reiniciando el bot y los sub bots (se reconectan solos con el código nuevo)...');
    setTimeout(() => process.exit(0), 500);
  }, ['reiniciar']),

  mk('mode', 'Cambia el modo público/privado', 'public|self', (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (!['public', 'self'].includes(v)) return c.reply('Uso: .mode public  |  .mode self');
    db.data.mode = v;
    db.save();
    c.reply(`🌐 Modo: *${v}*`);
  }, ['modo']),

  mk('banuser', 'Banea a un usuario del bot', '@usuario|número', (c) => {
    const j = jidOf(c);
    if (!j) return c.reply('Menciona, responde o escribe el número.');
    const n = numOf(j);
    if (!db.data.banned.includes(n)) db.data.banned.push(n);
    db.save();
    c.reply(`🔨 ${n} baneado.`);
  }, ['ban']),

  mk('unbanuser', 'Quita el ban a un usuario', '@usuario|número', (c) => {
    const j = jidOf(c);
    if (!j) return c.reply('Menciona, responde o escribe el número.');
    db.data.banned = db.data.banned.filter((x) => x !== numOf(j));
    db.save();
    c.reply(`✅ ${numOf(j)} desbaneado.`);
  }, ['unban']),

  mk('banchat', 'El bot ignora este chat/grupo', '', (c) => {
    if (!db.data.bannedChats.includes(c.from)) db.data.bannedChats.push(c.from);
    db.save();
    c.reply('🔕 Ignoraré este chat (excepto al owner). Usa .unbanchat para volver.');
  }),

  mk('unbanchat', 'El bot vuelve a responder en este chat', '', (c) => {
    db.data.bannedChats = db.data.bannedChats.filter((x) => x !== c.from);
    db.save();
    c.reply('🔔 Chat desbloqueado.');
  }),

  mk('block', 'Bloquea un usuario en WhatsApp', '@usuario|número', async (c) => {
    const j = jidOf(c);
    if (!j) return c.reply('Menciona, responde o escribe el número.');
    await c.sock.updateBlockStatus(j, 'block');
    c.reply('🚫 Bloqueado.');
  }),

  mk('unblock', 'Desbloquea un usuario en WhatsApp', '@usuario|número', async (c) => {
    const j = jidOf(c);
    if (!j) return c.reply('Menciona, responde o escribe el número.');
    await c.sock.updateBlockStatus(j, 'unblock');
    c.reply('✅ Desbloqueado.');
  }),

  mk('join', 'El bot entra a un grupo por enlace', '<enlace>', async (c) => {
    const code = (c.q.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/) || [])[1];
    if (!code) return c.reply('Pega un enlace de invitación válido.');
    await c.sock.groupAcceptInvite(code);
    c.reply('✅ Me uní al grupo.');
  }),

  mk('leave', 'El bot sale del grupo actual', '', async (c) => {
    await c.reply('👋 Adiós!');
    await c.sock.groupLeave(c.from);
  }, ['salir'], { group: true }),

  mk('grupos', 'Lista de grupos donde está el bot', '', async (c) => {
    const g = Object.values(await c.sock.groupFetchAllParticipating());
    c.replyLong(`👥 *Grupos (${g.length})*\n\n` + g.map((x, i) => `${i + 1}. ${x.subject} — ${x.participants.length} miembros`).join('\n'));
  }, ['listgroups']),

  // bc/broadcast: ver al final del archivo

  mk('say', 'El bot dice un texto', '<texto>', async (c) => {
    if (!c.q) return c.reply('Escribe el texto.');
    await c.sock.sendMessage(c.from, { text: c.q });
  }, ['decir']),

  mk('setbio', 'Cambia la bio del bot', '<texto>', async (c) => {
    if (!c.q) return c.reply('Escribe la nueva bio.');
    await c.sock.updateProfileStatus(c.q);
    c.reply('✅ Bio actualizada.');
  }, ['bio']),

  mk('setnamebot2', 'Cambia el nombre del perfil del bot en WhatsApp', '<nombre>', async (c) => {
    if (!c.q) return c.reply('Escribe el nuevo nombre.');
    await c.sock.updateProfileName(c.q);
    c.reply('✅ Nombre de perfil actualizado.');
  }),

  mk('setppbot', 'Cambia la foto del bot (responde a una imagen)', '<imagen>', async (c) => {
    const f = await c.getMedia(['image']);
    if (!f) return c.reply('📎 Responde a una imagen o envíala con el comando.');
    await c.sock.updateProfilePicture(c.sock.user.id, f.buffer);
    c.reply('✅ Foto actualizada.');
  }),

  mk('addcoins', 'Da monedas a un usuario', '@usuario <cantidad>', (c) => {
    const j = jidOf(c);
    const n = parseInt(c.args.find((x) => /^-?\d+$/.test(x) && x.length < 9));
    if (!j || !n) return c.reply('Ejemplo: .addcoins @usuario 500');
    db.user(numOf(j)).coins += n;
    db.save();
    c.reply(`✅ ${n >= 0 ? 'Añadidas' : 'Quitadas'} ${Math.abs(n)} monedas a ${numOf(j)}.`);
  }),

  mk('resetuser', 'Reinicia los datos de un usuario', '@usuario|número', (c) => {
    const j = jidOf(c);
    if (!j) return c.reply('Menciona, responde o escribe el número.');
    delete db.data.users[numOf(j)];
    db.save();
    c.reply(`🧹 Datos de ${numOf(j)} reiniciados.`);
  }),

  mk('backup', 'Te envía la base de datos del bot', '', async (c) => {
    if (!fs.existsSync('./database.json')) return c.reply('Aún no hay base de datos.');
    await c.sendFile(fs.readFileSync('./database.json'), 'database.json', 'application/json');
  }),

  mk('cleartmp', 'Borra los archivos temporales', '', (c) => {
    const dir = path.join(process.cwd(), 'tmp');
    let n = 0;
    for (const f of fs.readdirSync(dir)) if (f !== '.keep') { try { fs.unlinkSync(path.join(dir, f)); n++; } catch {} }
    c.reply(`🧹 ${n} archivos temporales borrados.`);
  }),

  mk('stats', 'Estadísticas de uso', '', (c) => {
    const top = Object.entries(db.data.users).sort((a, b) => b[1].commands - a[1].commands).slice(0, 5);
    c.reply(`📊 *ESTADÍSTICAS*\n\n📨 Comandos usados: ${db.data.stats.commands}\n👥 Usuarios: ${Object.keys(db.data.users).length}\n🔨 Baneados: ${db.data.banned.length}\n\n🏆 Top:\n${top.map(([n, u], i) => `${i + 1}. ${n} — ${u.commands}`).join('\n') || '-'}`);
  }, ['estadisticas']),

  mk('sologrupos', 'Que el bot solo responda en grupos (evita baneos) o tambien en privado', 'on|off', (c) => {
    const v = (c.args[0] || '').toLowerCase();
    const cur = (db.data.groupsOnly ?? config.groupsOnly ?? true) !== false;
    if (!['on', 'off'].includes(v)) return c.reply(`Solo grupos: ${cur ? 'ON (en privado no responde)' : 'OFF (responde tambien en privado)'}\nUso: ${c.prefix}sologrupos on|off`);
    db.data.groupsOnly = v === 'on';
    db.save();
    c.reply(v === 'on' ? 'Listo: el bot solo responde en grupos.' : 'Ojo: ahora tambien responde en privado (mas riesgo de baneo).');
  }, ['groupsonly', 'privado']),

  mk('reportes', 'Lee los reportes y sugerencias de los usuarios', '[limpiar]', (c) => {
    const r = db.data.reports || [];
    if ((c.args[0] || '').toLowerCase() === 'limpiar') { db.data.reports = []; db.save(); return c.reply('Reportes borrados.'); }
    if (!r.length) return c.reply('No hay reportes.');
    c.replyLong('REPORTES (' + r.length + ')\n\n' + r.slice(-15).map((x, i) => `${i + 1}. ${x.name || ''} (wa.me/${x.n}) ${new Date(x.t).toLocaleDateString('es')}\n${x.text}`).join('\n\n'));
  }, ['verreportes']),

  mk('setnamebot', 'Cambia el nombre del bot', '<nombre>', (c) => {
    if (!c.q) return c.reply(`Uso: ${c.prefix}setnamebot NombreNuevo`);
    const name = c.q.trim().slice(0, 32);
    db.data.botName = name;
    db.save();
    c.reply(`Nombre del bot cambiado a: *${name}*\nSe mostrara en el menu y botinfo.`);
  }, ['botname', 'nombrarbot']),

  // ── Ocultos: solo el owner los conoce (no salen en el menu) ──
  mk('chetar', 'Da coins al owner', '<cantidad>', (c) => {
    const raw = c.args[0];
    if (!raw) return c.reply(`Uso: ${c.prefix}chetar <cantidad>\nEjemplo: .chetar 50000`);
    const n = amount(raw, 0);
    if (!n || n < 1) return c.reply('Pon una cantidad valida. Ej: .chetar 10000');
    const u = db.user(c.senderNum);
    u.coins = Math.min(u.coins + n, 1e15);
    db.save();
    c.reply(`+${n.toLocaleString('es')} Coins.\nCartera: ${u.coins.toLocaleString('es')}`);
  }, ['cheat', 'addcoins'], { hidden: true }),

  mk('deschetar', 'Quita coins', '<cantidad|todo> [@usuario]', (c) => {
    const j = c.mentioned[0] || c.quoted?.sender;
    const key = j ? numOf(j) : c.senderNum;
    const u = db.user(key);
    const all = /^(todo|all|max)$/i.test(c.args[0] || '');
    const raw = all ? null : c.args[0];
    if (!raw && !all) return c.reply(`Uso: ${c.prefix}deschetar <cantidad|todo> [@usuario]\nEjemplo: .deschetar 5000 o .deschetar todo @usuario`);
    const n = all ? u.coins : amount(raw, 0);
    if (!n && !all) return c.reply('Cantidad invalida.');
    const q = Math.min(n || u.coins, u.coins);
    u.coins -= q;
    db.save();
    c.reply(`-${q.toLocaleString('es')} Coins${j ? ' a @' + key : ''}.\nCartera: ${u.coins.toLocaleString('es')}`, j ? { mentions: [j] } : {});
  }, ['unchetar', 'quitarcoins', 'quitarmonedas'], { hidden: true }),

  mk('reiniciareconomia', 'Resetea todos los coins de todos los usuarios', '', (c) => {
    let count = 0;
    for (const u of Object.values(db.data.users || {})) {
      u.coins = 0; u.bank = 0; u.loan = 0; u.loanPrincipal = 0; u.loanDue = 0;
      u.loanLate = false; u.taxDue = 0; u.xp = 0; count++;
    }
    db.save();
    c.reply(`Economia reiniciada. ${count} usuarios con 0 Coins.`);
  }, ['reseteconomia', 'resetear_economia'], { hidden: true }),

  mk('reiniciargacha', 'Resetea todo el gacha (waifus de todos)', '', (c) => {
    if (db.data.gacha) {
      db.data.gacha.users = {};
      db.data.gacha.trades = {};
      db.data.gacha.market = {};
      db.data.gacha.votes = {};
    }
    db.save();
    c.reply('Gacha reiniciado. Todos los usuarios pierden sus waifus y comienzan de cero.');
  }, ['resetgacha', 'resetear_gacha'], { hidden: true }),

  mk('sharkyX', 'Panel de control total del owner (SHARKNEX)', '[seccion]', (c) => {
    const p = c.prefix;
    const sec = (c.args[0] || '').toLowerCase();

    const sections = {
      coins: [
        '╔══[ 💰 COINS & ECONOMÍA ]══╗',
        `║ ${p}chetar <n>        → darte coins`,
        `║ ${p}chetar @user <n>  → dar a otro`,
        `║ ${p}deschetar <n|todo> [@user]`,
        `║ ${p}addcoins @user <n>`,
        `║ ${p}resetuser @user   → resetear user`,
        `║ ${p}reiniciareconomia → limpiar todo`,
        `║ ${p}economiaon / economiaoff`,
        `║ ${p}stats             → ver stats`,
        '╚═══════════════════════════╝',
      ],
      gacha: [
        '╔══[ 🎴 GACHA CONTROL ]══╗',
        `║ ${p}gachaX <n>         → waifus gratis`,
        `║ ${p}givewaifu @u <nom> → dar waifu`,
        `║ ${p}takewaifu @u <nom> → quitar waifu`,
        `║ ${p}gachareset @user   → limpiar colec.`,
        `║ ${p}reiniciargacha     → limpiar todo`,
        `║ ${p}fetchwaifus        → recargar pool`,
        `║ ${p}gachaon / gachaoff`,
        `║ ${p}poolinfo           → ver pool actual`,
        '╚══════════════════════════╝',
      ],
      bot: [
        '╔══[ 🤖 BOT CONFIG ]══╗',
        `║ ${p}setnamebot <nom>   → nombre del bot`,
        `║ ${p}setppbot           → foto del bot`,
        `║ ${p}setbio <texto>     → bio del bot`,
        `║ ${p}mode publico|vip|off`,
        `║ ${p}sologrupos on|off`,
        `║ ${p}subbotmode on|off`,
        `║ ${p}reload             → recargar plugins`,
        `║ ${p}restart            → reiniciar bot`,
        `║ ${p}cleartmp           → limpiar cache`,
        `║ ${p}backup             → exportar DB`,
        '╚══════════════════════════╝',
      ],
      grupo: [
        '╔══[ 👥 CONTROL DE GRUPOS ]══╗',
        `║ ${p}join <link>        → unirse a grupo`,
        `║ ${p}leave              → salir del grupo`,
        `║ ${p}grupos             → listar grupos`,
        `║ ${p}banchat / unbanchat`,
        `║ ${p}bc todo <msg>      → broadcast`,
        `║ ${p}bc <grupo> <msg>   → msg especifico`,
        `║ ${p}bc #numero <msg>   → por numero`,
        `║ ${p}reportes           → ver reportes`,
        `║ ${p}sologrupos on|off`,
        '╚══════════════════════════╝',
      ],
      user: [
        '╔══[ 👤 CONTROL DE USUARIOS ]══╗',
        `║ ${p}banuser @u         → banear user`,
        `║ ${p}unbanuser @u       → desbanear`,
        `║ ${p}block @u           → bloquear`,
        `║ ${p}unblock @u         → desbloquear`,
        `║ ${p}addowner @u        → dar owner`,
        `║ ${p}delowner @u        → quitar owner`,
        `║ ${p}owners             → lista owners`,
        `║ ${p}chetar @u <n>      → dar coins`,
        `║ ${p}resetuser @u       → reset user`,
        `║ ${p}miid               → ver mis IDs`,
        '╚══════════════════════════════╝',
      ],
      miku: [
        '╔══[ 🎤 MIKU CONTROL ]══╗',
        `║ ${p}mikuon / mikuoff   → activar Miku`,
        `║ ${p}mikuvoz on|off     → voz activada`,
        `║ ${p}mikuclear          → limpiar memoria`,
        `║ ${p}say <texto>        → el bot habla`,
        `║ (Miku responde al ser mencionada)`,
        '╚══════════════════════════╝',
      ],
      sub: [
        '╔══[ 🤖 SUB BOTS ]══╗',
        `║ ${p}bots               → listar sub bots`,
        `║ ${p}code <numero>      → vincular sub bot`,
        `║ ${p}delsubbot <num>    → quitar sub bot`,
        `║ ${p}setprimary         → bot primario`,
        `║ ${p}subbotmode on|off  → habilitar subs`,
        `║ ${p}setsubbotname <n>  → nombre sub bot`,
        `║ ${p}setsubbotbanner    → banner sub bot`,
        `║ ${p}resetsubbotbanner  → reset sub bot`,
        '╚══════════════════════════╝',
      ],
    };

    if (sections[sec]) {
      return c.reply(sections[sec].join('\n'));
    }

    const menu = [
      '╔══════════════════════════════╗',
      '║   🦈 SHARKNEX OWNER PANEL   ║',
      '║     Control total del bot    ║',
      '╠══════════════════════════════╣',
      `║ ${p}sharkyX coins  → economía`,
      `║ ${p}sharkyX gacha  → gacha`,
      `║ ${p}sharkyX bot    → config bot`,
      `║ ${p}sharkyX grupo  → grupos`,
      `║ ${p}sharkyX user   → usuarios`,
      `║ ${p}sharkyX miku   → Miku`,
      `║ ${p}sharkyX sub    → sub bots`,
      '╠══════════════════════════════╣',
      `║ 📊 ${p}stats  📦 ${p}backup`,
      `║ 🔄 ${p}reload  ⚡ ${p}restart`,
      `║ 🧹 ${p}cleartmp  📣 ${p}bc`,
      '╚══════════════════════════════╝',
    ].join('\n');
    c.reply(menu);
  }, ['menuoculto', 'hiddenX', 'ownerX', 'sharkyx', 'sharkyX'], { hidden: true }),

  mk('gachaX', 'Da waifus al owner directamente', '<cantidad>', async (c) => {
    const n = parseInt(c.args[0] || '1');
    if (!n || n < 1 || n > 9999) return c.reply('Uso: .gachaX <cantidad 1-9999>');
    const gacha = require('../lib/gacha');
    try {
      await Promise.race([
        gacha.ensurePool(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ]);
    } catch (e) {
      return c.reply(`No pude cargar el pool de waifus: ${e.message === 'timeout' ? 'tardó demasiado, intenta de nuevo' : e.message}`);
    }
    const pool = gacha.pool();
    if (!pool.length) return c.reply('Pool vacía. Usa .fetchwaifus primero para cargar personajes.');
    const u = gacha.user(c.senderNum);
    let got = [];
    for (let i = 0; i < n; i++) {
      const char = pool[Math.floor(Math.random() * pool.length)];
      gacha.give(u, char.id);
      if (got.length < 5) got.push(char.name);
    }
    db.save();
    c.reply(`✅ Te di *${n}* waifus del pool.\nEjemplos: ${got.join(', ')}${n > 5 ? '...' : ''}`);
  }, ['addwaifu', 'autowaifu'], { hidden: true }),

  mk('bc', 'Envia aviso a grupos', '<todo | nombre_grupo | #numero> <mensaje>', async (c) => {
    const parts = c.q.split('\n');
    const firstLine = (parts[0] || '').trim();
    const msg = parts.slice(1).join('\n').trim() || c.q.replace(/^(todo|\S+)\s+/, '').trim();
    if (!msg && !c.q) return c.reply(`Uso:\n.bc todo Mensaje para todos los grupos\n.bc nombre_grupo Mensaje especifico`);
    const allGroups = Object.entries(await c.sock.groupFetchAllParticipating().catch(() => ({})));
    let targets = [];
    const lower = firstLine.toLowerCase();
    if (lower === 'todo' || lower === 'all' || lower === 'todos') {
      targets = allGroups;
    } else if (/^#?\d+$/.test(lower)) {
      const idx = parseInt(lower.replace('#', '')) - 1;
      if (allGroups[idx]) targets = [allGroups[idx]];
      else return c.reply(`No existe el grupo #${idx+1}. Grupos: ${allGroups.length}`);
    } else {
      const search = firstLine.toLowerCase();
      targets = allGroups.filter(([, g]) => g.subject?.toLowerCase().includes(search));
      if (!targets.length) return c.reply(`No encontre grupos con "${firstLine}".\nUsa: .bc todo <msg> o .bc #numero <msg>\n\nGrupos disponibles:\n${allGroups.slice(0,15).map(([,g],i) => `${i+1}. ${g.subject}`).join('\n')}`);
    }
    const texto = lower === 'todo' || lower === 'all' || lower === 'todos' ? c.q.replace(/^(todo|all|todos)\s*/i,'') : msg;
    if (!texto) return c.reply('Escribe el mensaje despues del destino.');
    await c.reply(`📣 Enviando a ${targets.length} grupos...`);
    let ok = 0;
    for (const [id] of targets) {
      try { await c.sock.sendMessage(id, { text: `📣 *Aviso SHARKNEX*\n\n${texto}` }); ok++; } catch {}
      await U.sleep(1200);
    }
    c.reply(`✅ Enviado a ${ok}/${targets.length} grupos.`);
  }, ['broadcast', 'aviso'], { hidden: false }),
];
