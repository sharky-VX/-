const db = require('../lib/db');
const U = require('../lib/utils');
const media = require('../lib/media');
const { card, wrap, sans, C } = require('../lib/deco');

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


  mk('onlyadmin', 'Solo admins pueden usar el bot en este grupo', 'on|off', { admin: true }, (c) => onoff(c, 'OnlyAdmin', 'onlyAdmin'), ['soloadmin', 'adminmode']),

  mk('gstatus', 'Sube estado del grupo (foto/video + descripcion)', '<descripcion>', { admin: true }, async (c) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // 1) Media: mensaje actual O citado
    let f = await c.getMedia(['image', 'video']);
    if (!f || !f.buffer || f.buffer.length < 200) {
      return c.reply(wrap(
        'Envia una *foto o video* con caption:\n' + c.prefix + 'gstatus texto\n\nO *responde* a una foto/video:\n' + c.prefix + 'gstatus texto',
        'gstatus'
      ));
    }

    const desc = (c.q || '').trim() || 'Estado del grupo';
    const who = c.pushName || 'Admin';
    const cap = [
      C.ftop + ' ' + sans('gstatus') + ' 𓆪 ❀',
      '',
      '  ' + C.bul + ' ' + sans('Estado') + ' ── ' + desc,
      '  ' + C.bul + ' ' + sans('Por') + '    ── ' + who,
      '',
      C.fbot,
    ].join('\n');

    // 2) Normalizar imagen a JPEG (WhatsApp status es mas estable asi)
    let buf = f.buffer;
    let isVideo = f.type === 'video';
    let mime = f.mimetype || (isVideo ? 'video/mp4' : 'image/jpeg');
    if (!isVideo) {
      try {
        const Jimp = require('jimp');
        const img = await Jimp.read(buf);
        if (img.bitmap.width > 1600) img.resize(1600, Jimp.AUTO);
        buf = await img.quality(88).getBufferAsync(Jimp.MIME_JPEG);
        mime = 'image/jpeg';
      } catch (e) {
        console.error('gstatus jimp:', e?.message || e);
      }
    }

    // Guardar temporal por si hace falta enviar por path
    const ext = isVideo ? '.mp4' : '.jpg';
    const tmp = path.join(os.tmpdir(), 'gstatus_' + Date.now() + ext);
    try { fs.writeFileSync(tmp, buf); } catch {}

    // Miembros del grupo
    let statusJidList = [];
    try {
      const md = await c.getMeta();
      statusJidList = (md.participants || [])
        .map((p) => p.id || p.phoneNumber || p.jid)
        .filter(Boolean);
    } catch {}

    let okStatus = false;
    let okGroup = false;
    const errors = [];

    // 3) FORZAR estado nativo WhatsApp (varias formas)
    const statusPayload = isVideo
      ? { video: buf, caption: cap, mimetype: mime }
      : { image: buf, caption: cap, mimetype: mime };

    // 3a) status@broadcast + lista del grupo
    try {
      await c.sock.sendMessage('status@broadcast', statusPayload, {
        statusJidList: statusJidList.length ? statusJidList : undefined,
        backgroundColor: '#111111',
        font: 0,
      });
      okStatus = true;
    } catch (e) {
      errors.push('broadcast1:' + (e?.message || e));
      // 3b) sin statusJidList
      try {
        await c.sock.sendMessage('status@broadcast', statusPayload);
        okStatus = true;
      } catch (e2) {
        errors.push('broadcast2:' + (e2?.message || e2));
        // 3c) por archivo
        try {
          const byFile = isVideo
            ? { video: { url: tmp }, caption: cap, mimetype: mime }
            : { image: { url: tmp }, caption: cap, mimetype: mime };
          await c.sock.sendMessage('status@broadcast', byFile, {
            statusJidList: statusJidList.length ? statusJidList : undefined,
          });
          okStatus = true;
        } catch (e3) {
          errors.push('broadcast3:' + (e3?.message || e3));
        }
      }
    }

    // 4) SIEMPRE publicar tambien en el grupo (visible ahi si el estado falla)
    try {
      if (isVideo) {
        await c.sock.sendMessage(c.from, { video: buf, caption: cap, mimetype: mime }, { quoted: c.m });
      } else {
        await c.sock.sendMessage(c.from, { image: buf, caption: cap, mimetype: mime }, { quoted: c.m });
      }
      okGroup = true;
    } catch (e) {
      errors.push('group:' + (e?.message || e));
      // ultimo intento por path
      try {
        if (isVideo) {
          await c.sock.sendMessage(c.from, { video: { url: tmp }, caption: cap, mimetype: mime }, { quoted: c.m });
        } else {
          await c.sock.sendMessage(c.from, { image: { url: tmp }, caption: cap, mimetype: mime }, { quoted: c.m });
        }
        okGroup = true;
      } catch (e2) {
        errors.push('group2:' + (e2?.message || e2));
      }
    }

    try { fs.unlinkSync(tmp); } catch {}

    if (okStatus && okGroup) {
      return c.reply(wrap('Estado subido (Estados + grupo).', 'gstatus'));
    }
    if (okStatus) {
      return c.reply(wrap('Estado subido en Estados de WhatsApp.', 'gstatus'));
    }
    if (okGroup) {
      return c.reply(wrap('Publicado en el grupo (estado nativo no disponible en esta cuenta).', 'gstatus'));
    }
    return c.reply(wrap('No se pudo subir el estado.\n' + errors.slice(0, 2).join('\n'), 'gstatus'));
  }, ['groupstatus', 'estadogrupo']),

  mk('gp', 'Panel de configuracion del grupo', '', {}, async (c) => {
    const ch = db.chat(c.from);
    let meta;
    try { meta = await c.getMeta(); } catch { meta = null; }

    const name = meta?.subject || 'Grupo';
    const members = meta?.participants?.length || 0;
    const admins = meta?.participants?.filter((p) => p.admin)?.length || 0;
    const pfx = c.prefix || '.';

    // Owner del grupo (creador)
    let creator = 'Desconocido';
    let creatorJid = null;
    try {
      const own = meta?.owner || meta?.participants?.find((p) => p.admin === 'superadmin')?.id;
      if (own) {
        creatorJid = own;
        creator = '@' + String(own).split('@')[0].split(':')[0];
      }
    } catch {}

    // Bot primario
    let botLabel = 'Todos los bots';
    if (ch.primary) botLabel = '@' + String(ch.primary).replace(/\D/g, '');

    const on = (v, def = false) => {
      const val = v === undefined ? def : !!v;
      return val ? '✓ Activado' : '✘ Desactivado';
    };

    // Economia / gacha default ON
    const economy = on(ch.economyOn, true);
    const gacha = on(ch.gachaOn, true);
    const nsfw = on(ch.nsfwOn, true); // nsfwOn false = off; undefined = on
    // Fix nsfw: nsfwOn === false means disabled
    const nsfwTxt = (ch.nsfwOn === false) ? '✘ Desactivado' : '✓ Activado';

    const mentions = [];
    if (creatorJid) mentions.push(creatorJid);

    const text = [
      '*「✿」Grupo ◢ ' + name + ' ◤*',
      '',
      '➪ *Creador ›* ' + creator,
      '❖ *Bot Principal ›* ' + botLabel,
      '❒ *Usuarios ›* *' + members + '*',
      'ꕥ *Admins ›* *' + admins + '*',
      '',
      '➪ *Configuraciones:*',
      '✐ Antilink › *' + on(ch.antilink, false) + '*',
      '✐ Antispam › *' + on(ch.antispam, false) + '*',
      '✐ Bienvenidas › *' + on(ch.welcome, false) + '*',
      '✐ Despedidas › *' + on(ch.bye, false) + '*',
      '✐ Gacha › *' + gacha + '*',
      '✐ Economia › *' + economy + '*',
      '✐ Nsfw › *' + nsfwTxt + '*',
      '✐ ModoAdmin › *' + on(ch.onlyAdmin, false) + '*',
      '',
      '➪ *Ajustes:*',
      pfx + 'antilink on/off',
      pfx + 'antispam on/off',
      pfx + 'welcome on/off',
      pfx + 'bye on/off',
      pfx + 'economia on/off',
      pfx + 'gachact on/off',
      pfx + 'nsfw on/off',
      pfx + 'onlyadmin on/off',
      pfx + 'setprimary @bot',
    ].join('\n');

    return c.reply(text, mentions.length ? { mentions } : undefined);
  }, ['panel', 'infogrup', 'grupoinfo']),

  mk('welcome', 'Mensaje de bienvenida', 'on|off', { admin: true }, (c) => onoff(c, 'Bienvenida', 'welcome'), ['bienvenida']),
  mk('bye', 'Mensaje de despedida', 'on|off', { admin: true }, (c) => onoff(c, '👋 Despedida', 'bye'), ['despedida']),

  mk('setwelcome', 'Personaliza la bienvenida', '<texto>', { admin: true }, (c) => {
    if (!c.q) {
      return c.reply([
        '   ❀ 𓆩 setwelcome 𓆪 ❀',
        'Variables:',
        '  @user ── menciona al usuario',
        '  {group} ── nombre del grupo',
        '  {members} ── cantidad de miembros',
        '  {desc} ── descripcion del grupo',
        '',
        'Ejemplo:',
        c.prefix + 'setwelcome Hola @user, bienvenido a {group}. Somos {members}.',
        '',
        'Activa con: ' + c.prefix + 'welcome on',
        '   ❀',
      ].join('\n'));
    }
    db.chat(c.from).welcomeMsg = c.q.slice(0, 800);
    db.save();
    c.reply('Bienvenida guardada.\nActivala con ' + c.prefix + 'welcome on');
  }),

  mk('setbye', 'Personaliza la despedida', '<texto>', { admin: true }, (c) => {
    if (!c.q) {
      return c.reply([
        '   ❀ 𓆩 setbye 𓆪 ❀',
        'Variables: @user  {group}  {members}',
        '',
        'Ejemplo:',
        c.prefix + 'setbye Adios @user, te esperamos en {group}.',
        '',
        'Activa con: ' + c.prefix + 'bye on',
        '   ❀',
      ].join('\n'));
    }
    db.chat(c.from).byeMsg = c.q.slice(0, 800);
    db.save();
    c.reply('Despedida guardada.\nActivala con ' + c.prefix + 'bye on');
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

  mk('asstatus', 'Estado anti-spam de un usuario', '@usuario', { admin: true }, (c) => {
    const t = (c.mentioned && c.mentioned[0]) || c.quoted?.sender || c.sender;
    const n = num(t);
    const antispam = require('../lib/antispam');
    const s = antispam.statusOf(n);
    if (s.clean) return c.reply('Anti-spam: @' + n + ' esta limpio (sin sanciones).', { mentions: [t] });
    const muteLeft = s.mutedUntil > Date.now() ? Math.ceil((s.mutedUntil - Date.now()) / 1000) + 's' : 'no';
    c.reply(
      'Anti-spam @' + n + '\n\nWarns: ' + (s.warns || 0) + '\nMute: ' + muteLeft + '\nCmds en ventana: ' + (s.cmdsInWindow || 0) + '\nUltimo cmd: ' + (s.lastCmd || '-') + '\nMismo cmd x' + (s.sameCount || 0),
      { mentions: [t] }
    );
  }, ['spamstatus', 'antispamstatus']),

  mk('asreset', 'Resetea sanciones anti-spam de un usuario', '@usuario', { owner: true }, (c) => {
    const t = (c.mentioned && c.mentioned[0]) || c.quoted?.sender;
    if (!t) return c.reply('Menciona o responde al usuario.');
    require('../lib/antispam').resetUser(num(t));
    c.reply('Anti-spam reseteado para @' + num(t) + '.', { mentions: [t] });
  }, ['spamreset']),
];
