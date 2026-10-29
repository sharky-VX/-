const db = require('../lib/db');
const U = require('../lib/utils');
const media = require('../lib/media');

const mk = (name, desc, usage, flags, run, aliases = []) => ({
  name, aliases, desc, usage, category: 'group', group: true, ...flags, run,
});
const num = (j) => j.split('@')[0].split(':')[0];
const tag = (j) => '@' + num(j);
const targetOf = (c) => c.mentioned[0] || c.quoted?.sender;
const onoff = (c, label, field, ex) => {
  const v = (c.args[0] || '').toLowerCase();
  if (!['on', 'off'].includes(v)) { c.reply(`Uso: ${c.prefix}${c.command} on / off${ex ? '\n' + ex : ''}`); return; }
  db.chat(c.from)[field] = v === 'on';
  db.save();
  c.reply(`${label} ${v === 'on' ? 'activado ✅' : 'desactivado ❌'}`);
};

module.exports = [
  mk('tagall', 'Menciona a todos', '[mensaje]', { admin: true }, async (c) => {
    const ids = (await c.getMeta()).participants.map((p) => p.id);
    await c.sock.sendMessage(c.from, { text: `📢 *${c.q || 'Atención'}*\n\n` + ids.map((i) => `◦ ${tag(i)}`).join('\n'), mentions: ids }, { quoted: c.m });
  }, ['todos', 'invocar']),

  mk('hidetag', 'Mensaje que menciona a todos sin mostrarlo', '<mensaje>', { admin: true }, async (c) => {
    const ids = (await c.getMeta()).participants.map((p) => p.id);
    await c.sock.sendMessage(c.from, { text: c.q || c.quotedText || '📢', mentions: ids }, { quoted: c.m });
  }, ['notify']),

  mk('admins', 'Menciona a los admins', '', {}, async (c) => {
    const ids = (await c.getMeta()).participants.filter((p) => p.admin).map((p) => p.id);
    await c.sock.sendMessage(c.from, { text: '🛡️ *Admins*\n\n' + ids.map((i) => `◦ ${tag(i)}`).join('\n'), mentions: ids }, { quoted: c.m });
  }, ['listadmin']),

  mk('kick', 'Expulsa a un miembro', '@usuario', { admin: true, botAdmin: true }, async (c) => {
    const t = targetOf(c);
    if (!t) return c.reply('Menciona o responde al usuario. Ej: .kick @usuario');
    await c.sock.groupParticipantsUpdate(c.from, [t], 'remove');
    c.reply(`👢 ${tag(t)} fue expulsado.`, { mentions: [t] });
  }, ['echar']),

  mk('add', 'Agrega un número al grupo', '<número>', { admin: true, botAdmin: true }, async (c) => {
    const n = (c.args[0] || '').replace(/\D/g, '');
    if (n.length < 8) return c.reply('Ejemplo: .add 584121234567');
    const r = await c.sock.groupParticipantsUpdate(c.from, [`${n}@s.whatsapp.net`], 'add');
    c.reply(r?.[0]?.status === '200' ? '✅ Agregado' : '⚠️ No se pudo agregar (privacidad del usuario o número inválido).');
  }),

  mk('promote', 'Da admin a un miembro', '@usuario', { admin: true, botAdmin: true }, async (c) => {
    const t = targetOf(c);
    if (!t) return c.reply('Menciona o responde al usuario.');
    await c.sock.groupParticipantsUpdate(c.from, [t], 'promote');
    c.reply(`🛡️ ${tag(t)} ahora es admin.`, { mentions: [t] });
  }, ['daradmin']),

  mk('demote', 'Quita admin a un miembro', '@usuario', { admin: true, botAdmin: true }, async (c) => {
    const t = targetOf(c);
    if (!t) return c.reply('Menciona o responde al usuario.');
    await c.sock.groupParticipantsUpdate(c.from, [t], 'demote');
    c.reply(`⬇️ ${tag(t)} ya no es admin.`, { mentions: [t] });
  }, ['quitaradmin']),

  mk('link', 'Enlace de invitación', '', { botAdmin: true }, async (c) =>
    c.reply('🔗 https://chat.whatsapp.com/' + (await c.sock.groupInviteCode(c.from))), ['linkgc', 'enlace']),

  mk('revoke', 'Restablece el enlace del grupo', '', { admin: true, botAdmin: true }, async (c) => {
    await c.sock.groupRevokeInvite(c.from);
    c.reply('♻️ Enlace restablecido.');
  }, ['resetlink']),

  mk('ginfo', 'Información del grupo', '', {}, async (c) => {
    const md = await c.getMeta();
    c.reply(`👥 *${md.subject}*\n👤 Miembros: ${md.participants.length}\n🛡️ Admins: ${md.participants.filter((p) => p.admin).length}\n📅 Creado: ${new Date(md.creation * 1000).toLocaleDateString('es-VE')}\n\n📜 ${md.desc || 'Sin descripción'}`);
  }, ['infogrupo', 'groupinfo']),

  mk('setname', 'Cambia el nombre del grupo', '<nombre>', { admin: true, botAdmin: true }, async (c) => {
    if (!c.q) return c.reply('Escribe el nuevo nombre.');
    await c.sock.groupUpdateSubject(c.from, c.q);
  }),

  mk('setdesc', 'Cambia la descripción del grupo', '<texto>', { admin: true, botAdmin: true }, async (c) => {
    if (!c.q) return c.reply('Escribe la nueva descripción.');
    await c.sock.groupUpdateDescription(c.from, c.q);
  }),

  mk('setppgroup', 'Cambia la foto del grupo (responde a una imagen)', '<imagen>', { admin: true, botAdmin: true }, async (c) => {
    const f = await c.getMedia(['image']);
    if (!f) return c.reply('📎 Responde a una imagen o envíala con el comando.');
    await c.sock.updateProfilePicture(c.from, f.buffer);
    c.reply('✅ Foto del grupo actualizada.');
  }, ['setfoto']),

  mk('cerrar', 'Solo admins pueden escribir', '', { admin: true, botAdmin: true }, async (c) => {
    await c.sock.groupSettingUpdate(c.from, 'announcement');
    c.reply('🔒 Grupo cerrado.');
  }, ['close']),

  mk('abrir', 'Todos pueden escribir', '', { admin: true, botAdmin: true }, async (c) => {
    await c.sock.groupSettingUpdate(c.from, 'not_announcement');
    c.reply('🔓 Grupo abierto.');
  }, ['open']),

  mk('del', 'Borra el mensaje al que respondes', '', { admin: true, botAdmin: true }, async (c) => {
    if (!c.quoted) return c.reply('Responde al mensaje que quieres borrar.');
    await c.sock.sendMessage(c.from, { delete: { remoteJid: c.from, fromMe: false, id: c.quoted.id, participant: c.quoted.sender } });
  }, ['delete', 'borrar']),

  mk('antilink', 'Expulsa a quien envíe enlaces de grupos', 'on|off', { admin: true, botAdmin: true }, (c) => onoff(c, 'Antilink', 'antilink')),
  mk('antispam', 'Elimina mensajes repetidos de un usuario', 'on|off', { admin: true, botAdmin: true }, (c) => onoff(c, 'Antispam', 'antispam'), ['nospam']),
  mk('economia', 'Activa o desactiva la economia en este grupo', 'on|off', { admin: true }, (c) => onoff(c, 'Economia', 'economyOn'), ['economyoff', 'economiaoff']),
  mk('gachact', 'Activa o desactiva el gacha en este grupo', 'on|off', { admin: true }, (c) => onoff(c, 'Gacha', 'gachaOn'), ['gachaoff']),
  mk('miku', 'Activa o desactiva a Miku (IA) en este grupo', 'on|off', { admin: true }, (c) => {
    if (!c.args[0] || !['on','off'].includes(c.args[0].toLowerCase())) return c.reply(`Uso: ${c.prefix}miku on / off`);
    const v = c.args[0].toLowerCase() === 'on';
    db.chat(c.from).mikuOn = v;
    db.save();
    c.reply(v ? '✅ Miku activada en este grupo ♡' : '❌ Miku desactivada en este grupo.');
  }, ['mikuon', 'mikuoff', 'ia']),

  mk('gp', 'Panel de configuracion del grupo', '', {}, async (c) => {
    const ch = db.chat(c.from);
    let meta;
    try { meta = await c.getMeta(); } catch { meta = null; }
    const name = meta?.subject || c.from.split('@')[0];
    const creator = meta?.owner ? `@${num(meta.owner)}` : 'Desconocido';
    const prim = ch.primary ? `+${ch.primary}` : 'Todos los bots';
    const p = c.prefix;
    const yn = (v, def = true) => (v === undefined ? def : v) ? '✅ ON' : '❌ OFF';
    const lines = [
      '╔══[ ⚙️ PANEL DEL GRUPO ]══╗',
      `║ 📛 Grupo   : ${name}`,
      `║ 👑 Creador : ${creator}`,
      `║ 🤖 Bot pri : ${prim}`,
      `║ 👥 Miembros: ${meta?.participants?.length || '?'}  🛡️ Admins: ${meta?.participants?.filter(p=>p.admin).length || '?'}`,
      '╠══════════════════════════╣',
      '║  🔧 MODERACION:',
      `║  Antilink   : ${yn(ch.antilink, false)}  (${p}antilink on/off)`,
      `║  Antispam   : ${yn(ch.antispam, false)}  (${p}antispam on/off)`,
      `║  Bienvenida : ${yn(ch.welcome, false)}  (${p}welcome on/off)`,
      `║  Despedida  : ${yn(ch.bye, false)}  (${p}bye on/off)`,
      '╠══════════════════════════╣',
      '║  🎮 FUNCIONES:',
      `║  Economia   : ${yn(ch.economyOn)}  (${p}economia on/off)`,
      `║  Gacha      : ${yn(ch.gachaOn)}  (${p}gachact on/off)`,
      `║  Miku IA    : ${yn(ch.mikuOn)}  (${p}miku on/off)`,
      `║  Miku Voz   : ${yn(ch.mikuVoice)}  (${p}mikuvozmode on/off)`,
      '╚══════════════════════════╝',
    ];
    const mentions = meta?.owner ? [meta.owner] : [];
    c.reply(lines.join('\n'), { mentions });
  }, ['panel', 'infogrup', 'grupoinfo']),

  mk('welcome', 'Mensaje de bienvenida', 'on|off', { admin: true }, (c) => onoff(c, 'Bienvenida', 'welcome'), ['bienvenida']),
  mk('bye', 'Mensaje de despedida', 'on|off', { admin: true }, (c) => onoff(c, '👋 Despedida', 'bye'), ['despedida']),

  mk('setwelcome', 'Personaliza la bienvenida', '<texto con @user {group} {members}>', { admin: true }, (c) => {
    if (!c.q) return c.reply('Ejemplo: .setwelcome Hola @user, bienvenido a {group} 🎉 (somos {members})');
    db.chat(c.from).welcomeMsg = c.q.slice(0, 600);
    db.save();
    c.reply('✅ Bienvenida guardada. Actívala con .welcome on');
  }),

  mk('setbye', 'Personaliza la despedida', '<texto con @user {group}>', { admin: true }, (c) => {
    if (!c.q) return c.reply('Ejemplo: .setbye Adiós @user 👋');
    db.chat(c.from).byeMsg = c.q.slice(0, 600);
    db.save();
    c.reply('✅ Despedida guardada. Actívala con .bye on');
  }),

  mk('warn', 'Da una advertencia (3 = expulsión)', '@usuario [razón]', { admin: true }, async (c) => {
    const t = targetOf(c);
    if (!t) return c.reply('Menciona o responde al usuario. Ej: .warn @usuario spam');
    const ch = db.chat(c.from);
    const n = (ch.warns[num(t)] = (ch.warns[num(t)] || 0) + 1);
    db.save();
    await c.reply(`⚠️ ${tag(t)} tiene *${n}/3* advertencias.${c.args.length > 1 ? `\n📝 ${c.args.slice(1).join(' ')}` : ''}`, { mentions: [t] });
    if (n >= 3) {
      ch.warns[num(t)] = 0;
      db.save();
      try {
        await c.sock.groupParticipantsUpdate(c.from, [t], 'remove');
        c.reply(`👢 ${tag(t)} fue expulsado por 3 advertencias.`, { mentions: [t] });
      } catch {
        c.reply('⚠️ Llegó a 3 advertencias pero no pude expulsarlo (necesito ser admin).');
      }
    }
  }, ['advertir']),

  mk('unwarn', 'Quita una advertencia', '@usuario', { admin: true }, (c) => {
    const t = targetOf(c);
    if (!t) return c.reply('Menciona o responde al usuario.');
    const ch = db.chat(c.from);
    ch.warns[num(t)] = Math.max(0, (ch.warns[num(t)] || 0) - 1);
    db.save();
    c.reply(`✅ ${tag(t)} ahora tiene ${ch.warns[num(t)]}/3 advertencias.`, { mentions: [t] });
  }),

  mk('warns', 'Lista de advertencias del grupo', '', {}, (c) => {
    const rows = Object.entries(db.chat(c.from).warns).filter(([, n]) => n > 0);
    if (!rows.length) return c.reply('✅ Nadie tiene advertencias.');
    c.reply('⚠️ *Advertencias*\n\n' + rows.map(([n, v]) => `• @${n}: ${v}/3`).join('\n'), { mentions: rows.map(([n]) => `${n}@s.whatsapp.net`) });
  }, ['listwarns']),

  mk('resetwarns', 'Borra todas las advertencias', '', { admin: true }, (c) => {
    db.chat(c.from).warns = {};
    db.save();
    c.reply('🧹 Advertencias borradas.');
  }),

  mk('mute', 'Silencia a un usuario (borro sus mensajes)', '@usuario', { admin: true, botAdmin: true }, (c) => {
    const t = targetOf(c);
    if (!t) return c.reply('Menciona o responde al usuario.');
    const ch = db.chat(c.from);
    if (!ch.muted.includes(num(t))) ch.muted.push(num(t));
    db.save();
    c.reply(`🔇 ${tag(t)} silenciado: borraré sus mensajes.`, { mentions: [t] });
  }, ['silenciar']),

  mk('unmute', 'Quita el silencio a un usuario', '@usuario', { admin: true }, (c) => {
    const t = targetOf(c);
    if (!t) return c.reply('Menciona o responde al usuario.');
    const ch = db.chat(c.from);
    ch.muted = ch.muted.filter((x) => x !== num(t));
    db.save();
    c.reply(`🔊 ${tag(t)} ya puede hablar.`, { mentions: [t] });
  }, ['desilenciar']),

  mk('topmensajes', 'Los miembros más activos del grupo', '', {}, (c) => {
    const rows = Object.entries(db.chat(c.from).msgs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!rows.length) return c.reply('Aún no hay mensajes contados.');
    c.reply('💬 *MÁS ACTIVOS*\n\n' + rows.map(([n, v], i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} @${n} — ${v} mensajes`).join('\n'), { mentions: rows.map(([n]) => `${n}@s.whatsapp.net`) });
  }, ['activos']),

  mk('inactivos', 'Miembros que nunca han escrito (desde que estoy aquí)', '', { admin: true }, async (c) => {
    const msgs = db.chat(c.from).msgs;
    const ids = (await c.getMeta()).participants.map((p) => p.id).filter((j) => !msgs[num(j)]);
    if (!ids.length) return c.reply('✅ Todos han escrito alguna vez.');
    await c.sock.sendMessage(c.from, { text: `👻 *Sin mensajes* (${ids.length})\n\n` + ids.slice(0, 60).map((j) => `◦ ${tag(j)}`).join('\n'), mentions: ids.slice(0, 60) }, { quoted: c.m });
  }, ['fantasmas']),
];
