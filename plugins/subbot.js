const subbots = require('../lib/subbots');
const decor = require('../lib/decor');
const db = require('../lib/db');
const config = require('../config');
const { sans, C } = require('../lib/deco');
const U = require('../lib/utils');
const fs = require('fs');
const path = require('path');
const os = require('os');

const digits = (s) => String(s || '').replace(/\D/g, '');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'subbot', ...extra, run });

module.exports = [
  mk('code', 'Vincula TU numero como sub bot (codigo SHAR-KNEX)', '[tu numero con codigo de pais]', async (c) => {
    let n = digits(c.args.join(''));
    if (!n && /^\d{8,13}$/.test(c.senderNum)) n = c.senderNum;
    if (!c.isOwner && /^\d{8,13}$/.test(c.senderNum) && n !== c.senderNum) return c.reply('Solo puedes vincular tu propio numero.');
    if (!/^\d{8,15}$/.test(n)) return c.reply('Escribe tu numero con codigo de pais, sin + ni espacios.\nEjemplo: ' + c.prefix + 'code 584121234567');
    const dest = c.from;
    await c.reply('Pidiendo codigo FIJO *SHAR-KNEX* para +' + n + '...');
    const notify = (txt) => c.sock.sendMessage(dest, { text: decor.wrap(txt, 'code') });
    try {
      await subbots.create(n, notify);
    } catch (e) {
      return c.sock.sendMessage(dest, { text: decor.wrap('No se pudo crear el sub bot: ' + String(e && e.message ? e.message : e).slice(0, 200), 'code') });
    }
    const shown = 'SHAR-KNEX';
    await c.sock.sendMessage(dest, {
      text: decor.wrap(
        'Codigo FIJO para +' + n + ':\n\n*' + shown + '*\n\n' +
        '1. WhatsApp en ESE numero\n' +
        '2. Dispositivos vinculados\n' +
        '3. Vincular con el numero de telefono\n' +
        '4. Escribe exactamente: SHAR-KNEX\n\n' +
        'Cuando conecte te aviso.',
        'code'
      ),
    });
    await c.sock.sendMessage(dest, { text: shown });
  }, ['subbot', 'serbot', 'jadibot', 'vincular']),


    mk('bots', 'Bots vinculados: el principal y los sub bots (estado, mensajes y comandos)', '', (c) => {
    const st = require('../lib/state');
    const l = subbots.list();
    const main = st.mainSock?.user ? subbots.num(st.mainSock.user.id) : subbots.num(config.owner.number);
    const mainOnline = !!st.mainSock?.user;
    const mainUp = U.fmtTime((Date.now() - st.startTime) / 1000);
    const up = (s) => (s.status === 'online' && s.since ? U.fmtTime((Date.now() - s.since) / 1000) : '—');
    const icon = (online) => (online ? '● ONLINE' : '○ OFF');
    const onlineN = l.filter((s) => s.status === 'online').length;
    const lines = [
      '   ❀ 𓆩 ' + sans('bots') + ' 𓆪 ❀',
      '',
      '  ✦ Total      ── ' + (l.length + 1) + ' bots',
      '  ✦ Sub bots   ── ' + l.length + ' / ' + subbots.max(),
      '  ✦ En linea   ── ' + (onlineN + (mainOnline ? 1 : 0)),
      '',
      '  ➩ ' + sans('principal'),
      '  ✦ Numero     ── +' + main,
      '  ✦ Estado     ── ' + icon(mainOnline),
      '  ✦ Activo     ── ' + mainUp,
      '',
      '  ➩ ' + sans('sub bots'),
    ];
    if (!l.length) {
      lines.push('  (ninguno vinculado)');
    } else {
      l.forEach((s, i) => {
        const on = s.status === 'online';
        lines.push('');
        lines.push('  ' + (i + 1) + '. +' + s.num);
        lines.push('     Estado   ── ' + icon(on));
        lines.push('     Activo   ── ' + up(s));
        lines.push('     Msgs     ── ' + (s.rx || 0));
        lines.push('     Cmds     ── ' + (s.cmd || 0));
        if (c.isOwner && s.err) lines.push('     Error    ── ' + String(s.err).slice(0, 40));
      });
    }
    if (c.isGroup && db.data.chats[c.from]?.primary) {
      lines.push('');
      lines.push('  ✦ Primario grupo ── +' + db.data.chats[c.from].primary);
    }
    lines.push('');
    lines.push('  ➩ Vincula: ' + (c.prefix || '.') + 'code');
    lines.push('  ➩ Quitar:  ' + (c.prefix || '.') + 'delsubbot <num>');
    lines.push('   ❀');
    c.reply(lines.join('\n'));
  }, ['subbots', 'listbots', 'botslist']),

  mk('delsubbot', 'Desvincula un sub bot (el owner cualquiera; cada quien el suyo)', '[numero]', async (c) => {
    const n = digits(c.args.join('')) || (/^\d{8,13}$/.test(c.senderNum) ? c.senderNum : '');
    if (!n) return c.reply(`Escribe el numero: ${c.prefix}delsubbot 584121234567`);
    if (!c.isOwner && n !== c.senderNum) return c.reply('Solo puedes quitar tu propio sub bot.');
    // Si quien ejecuta ES ese sub bot, el aviso final sale por el bot principal (el sub bot se desconecta al terminar)
    const selfKill = c.isSub && c.sock.subNumber === n;
    const out = (t) => (selfKill && require('../lib/state').mainSock
      ? require('../lib/state').mainSock.sendMessage(c.from, { text: decor.wrap(t, 'delsubbot') }, { quoted: c.m })
      : c.reply(t));
    await c.reply(`Cerrando la sesion de +${n} en WhatsApp... (unos segundos)`);
    const how = await subbots.remove(n);
    const phone = 'Si todavia te sale en tu WhatsApp: Ajustes > Dispositivos vinculados > toca el dispositivo > Cerrar sesion.';
    if (how === 'ok') return out(`Sub bot +${n} eliminado y desvinculado de WhatsApp. (Ya no aparecera en Dispositivos vinculados.)`);
    if (how === 'already') return out(`La sesion de +${n} ya estaba cerrada en WhatsApp; limpie los datos del bot.\n${phone}`);
    if (how === 'none') return out(`No habia ninguna sesion guardada de +${n} (no llego a vincularse o ya se habia borrado).\n${phone}`);
    return out(`No pude contactar a WhatsApp para cerrar la sesion de +${n}, pero borre la sesion del bot para que no vuelva a conectarse.\n${phone}\nDesde Termux tambien puedes: node scripts/unlink.js ${n}`);
  }, ['quitarsubbot', 'stopsubbot', 'desvincular']),

  mk('setprimary', 'Establece el bot primario del grupo', '@bot', async (c) => {
    if (!c.isGroup) return c.reply('Solo en grupos.');
    if (!(await c.isAdmin()) && !c.isOwner) return c.reply('Solo admins u owner.');
    const stt = require('../lib/state');
    const chat = db.chat(c.from);

    // Recolectar TODOS los ids de cada bot (numero, lid, jid) — WhatsApp a veces menciona con @lid
    const bots = [];
    const pushBot = (sock, label, preferNum) => {
      if (!sock || !sock.user) return;
      const ids = new Set();
      const add = (j) => {
        if (!j) return;
        const raw = String(j);
        const d = digits(raw.split('@')[0]);
        if (d) ids.add(d);
        ids.add(raw.split('@')[0].split(':')[0]);
      };
      add(sock.user.id);
      add(sock.user.lid);
      add(preferNum);
      if (sock.subNumber) add(sock.subNumber);
      if (Array.isArray(sock.subEntry?.ids)) sock.subEntry.ids.forEach(add);
      // ids del contexto actual si este sock es el que responde
      if (c.sock === sock && Array.isArray(c.ids)) c.ids.forEach(add);
      const num = preferNum || digits(String(sock.user.id || '').split('@')[0]) || [...ids][0];
      bots.push({ num: String(num), label, sock, ids: [...ids].map(String) });
    };

    if (stt.mainSock?.user) {
      pushBot(stt.mainSock, 'principal', stt.mainSock.user?.id ? digits(String(stt.mainSock.user.id).split('@')[0]) : '');
    }
    for (const s of subbots.list()) {
      if (s.status !== 'online') continue;
      pushBot(subbots.sockOf(s.num), 'sub bot', s.num);
    }

    const mentioned = (c.mentioned && c.mentioned[0]) || (c.quoted && c.quoted.sender);
    if (!mentioned) {
      const lista = bots.map((b, i) => (i + 1) + '. +' + b.num + ' (' + b.label + ')').join('\n') || '(ninguno online)';
      return c.reply([
        '   ❀ 𓆩 setprimary 𓆪 ❀',
        'Primario actual: ' + (chat.primary ? ('+' + chat.primary) : 'ninguno (todos)'),
        '',
        'Bots online:',
        lista,
        '',
        'Uso: ' + c.prefix + 'setprimary @bot',
        '   ❀',
      ].join('\n'));
    }

    const mnRaw = String(mentioned).split('@')[0].split(':')[0];
    const mn = digits(mnRaw) || mnRaw;

    // Emparejar por cualquier id conocido del bot
    let target = bots.find((b) =>
      b.ids.some((id) => id === mn || id === mnRaw || String(id).endsWith(mn) || mn.endsWith(String(id)))
      || b.num === mn || String(b.num).endsWith(mn) || mn.endsWith(String(b.num))
    );

    // Si mencionan al bot que esta contestando ahora
    if (!target && c.sock?.user) {
      const selfIds = [c.sock.user.id, c.sock.user.lid, c.sock.subNumber, ...(c.ids || [])]
        .filter(Boolean)
        .map((j) => String(j).split('@')[0].split(':')[0]);
      const hit = selfIds.some((id) => id === mn || id === mnRaw || digits(id) === mn);
      if (hit) {
        const prefer = c.sock.subNumber || digits(String(c.sock.user.id).split('@')[0]);
        target = bots.find((b) => b.sock === c.sock) || {
          num: prefer,
          label: c.isSub ? 'sub bot' : 'principal',
          sock: c.sock,
          ids: selfIds,
        };
      }
    }

    if (!target) {
      return c.reply(
        'Este usuario no es un bot.\n' +
        'Menciona al bot conectado (el que tiene sesion aqui).\n' +
        'Online: ' + (bots.map((b) => '+' + b.num).join(', ') || 'ninguno')
      );
    }

    try {
      await target.sock.groupMetadata(c.from);
    } catch {
      return c.reply('Ese bot no esta en este grupo.');
    }

    chat.primary = String(target.num);
    db.save();
    const tag = mentioned;
    return c.reply(
      'Se ha restablecido @' + target.num + ' como bot primario del grupo.\nSolo ese bot responde aqui.',
      { mentions: [tag] }
    );
  }, ['primary', 'botprincipal', 'primario']),


  mk('logout', 'Cierra la sesion del bot y la desvincula de WhatsApp', '', async (c) => {
    if (!c.isOwner && !(c.isSub && c.sock.subNumber === c.senderNum)) {
      return c.reply('Solo el owner (o el dueño del sub bot) puede hacer logout.');
    }
    await c.reply('Cerrando sesion y desvinculando dispositivo...');
    try {
      if (c.isSub && c.sock.subNumber) {
        const how = await subbots.remove(c.sock.subNumber);
        return; // sub se desconecta
      }
      // principal
      try { await c.sock.logout(); } catch (e) { console.error('logout:', e?.message || e); }
      const fs = require('fs');
      const path = require('path');
      const sessionDir = path.join(process.cwd(), 'session');
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
      await c.reply('Sesion eliminada. Reinicia el bot y vincula de nuevo.');
      setTimeout(() => process.exit(2), 1500);
    } catch (e) {
      return c.reply('Error al cerrar sesion: ' + String(e?.message || e).slice(0, 100));
    }
  }, ['cerrarsesion', 'unpair']),


  mk('subbotmode', 'Activa o apaga que los miembros creen sub bots', 'on|off', (c) => {
    const v = (c.args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(v)) return c.reply(`Sub bots: ${subbots.enabled() ? 'ON' : 'OFF'}\nUso: ${c.prefix}subbotmode on|off`);
    db.data.subbotsOn = v === 'on';
    db.save();
    c.reply(`Sub bots ${v === 'on' ? 'activados' : 'desactivados'}.`);
  }, ['subbotson'], { owner: true }),

  mk('setsubbotname', 'Cambia el nombre de tu sub bot (aparece en el menú)', '<nombre>', async (c) => {
    // El owner puede cambiar el nombre de cualquier sub bot; cada quien el suyo
    let targetNum = c.isSub ? c.sock.subNumber : null;
    if (c.isOwner && c.args[0] && /^\d{8,15}$/.test(c.args[0])) {
      targetNum = c.args[0];
      c.args.shift();
    }
    const name = c.q.replace(/^\d{8,15}\s*/, '').trim();
    if (!name) return c.reply(`Uso: ${c.prefix}setsubbotname <nombre>\nCambia el nombre que aparece en el menú de tu sub bot.`);
    if (name.length > 40) return c.reply('El nombre no puede tener más de 40 caracteres.');
    if (!targetNum) return c.reply('Este comando solo se usa desde un sub bot, o el owner puede usarlo así: .setsubbotname 584121234567 NuevoNombre');
    (db.data.subbots[targetNum] ||= {}).displayName = name;
    db.save();
    c.reply(`✅ Nombre del sub bot +${targetNum} → *${name}*\nSe mostrará en el menú de este bot.`);
  }, ['subbotname', 'nombrebot', 'mybotname']),

  mk('setsubbotbanner', 'Cambia el banner de tu sub bot (envía o responde a una imagen)', '', async (c) => {
    let targetNum = c.isSub ? c.sock.subNumber : null;
    if (c.isOwner && c.args[0] && /^\d{8,15}$/.test(c.args[0])) targetNum = c.args[0];
    if (!targetNum) return c.reply('Úsalo desde un sub bot. El owner puede: .setsubbotbanner 584121234567 (con imagen adjunta)');
    const f = await c.getMedia(['image']).catch(() => null);
    if (!f?.buffer) return c.reply('📎 Responde a una imagen o envíala con el comando.');
    // Guardar en carpeta accesible
    const dirs = [path.join(process.cwd(), 'media'), path.join(process.cwd(), 'tmp'), os.tmpdir()];
    let saved = null;
    for (const d of dirs) {
      try {
        fs.mkdirSync(d, { recursive: true });
        const fp = path.join(d, `banner_sub_${targetNum}.jpg`);
        fs.writeFileSync(fp, f.buffer);
        saved = fp;
        break;
      } catch {}
    }
    if (!saved) return c.reply('No pude guardar el banner. Revisa permisos de escritura.');
    (db.data.subbots[targetNum] ||= {}).bannerFile = saved;
    (db.data.subbots[targetNum]).bannerType = 'image';
    db.save();
    c.reply(`✅ Banner del sub bot +${targetNum} actualizado.\nAparece la próxima vez que alguien use ${c.prefix}menu en este sub bot.`);
  }, ['subbotbanner', 'mybotbanner', 'setbannersub']),

  mk('resetsubbotbanner', 'Quita el banner personalizado de tu sub bot', '', (c) => {
    const targetNum = c.isSub ? c.sock.subNumber : (c.isOwner && c.args[0] ? c.args[0] : null);
    if (!targetNum) return c.reply('Úsalo desde un sub bot.');
    const sub = db.data.subbots?.[targetNum];
    if (sub) { delete sub.bannerFile; delete sub.bannerType; delete sub.displayName; db.save(); }
    c.reply(`✅ Sub bot +${targetNum} usa el banner y nombre del bot principal de nuevo.`);
  }, ['resetbannersub', 'subbotbotdefault']),
];
