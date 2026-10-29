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
  mk('code', 'Vincula TU numero como sub bot: te llega un codigo de 8 letras (sesion propia)', '[tu numero con codigo de pais]', async (c) => {
    // Sub bots también pueden crear otros (mismo sistema de pairing)
    // Sin numero: se usa el de quien escribe (si WhatsApp muestra un ID interno, hay que escribir el numero)
    let n = digits(c.args.join(''));
    if (!n && /^\d{8,13}$/.test(c.senderNum)) n = c.senderNum;
    if (!c.isOwner && /^\d{8,13}$/.test(c.senderNum) && n !== c.senderNum) return c.reply('Solo puedes vincular tu propio numero.');
    if (!/^\d{8,15}$/.test(n)) return c.reply(`Escribe tu numero con codigo de pais, sin + ni espacios.\nEjemplo: ${c.prefix}code 584121234567`);
    // Todo se responde en el mismo chat (el bot nunca escribe al privado de nadie)
    const dest = c.from;
    await c.reply(`Pidiendo tu codigo para +${n}... (unos segundos)`);
    const notify = (t) => c.sock.sendMessage(dest, { text: decor.wrap(t, 'code') });
    let code;
    try { code = await subbots.create(n, notify); }
    catch (e) { return c.sock.sendMessage(dest, { text: decor.wrap(`No se pudo crear el sub bot: ${String(e?.message || e).slice(0, 200)}`, 'code') }); }
    await c.sock.sendMessage(dest, { text: decor.wrap(
      `Tu codigo para +${n}:\n\n*${code}*\n\n` +
      '1. Abre WhatsApp en ESE numero\n2. Dispositivos vinculados\n3. Vincular con el numero de telefono\n4. Escribe el codigo (tienes 3 minutos)\n\n' +
      'Cuando conecte te aviso. Tu sesion es independiente: el bot principal no te afecta.', 'code') });
    await c.sock.sendMessage(dest, { text: code }); // solo el codigo, facil de copiar
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

  mk('setprimary', 'Elige que bot contesta en este grupo', '@bot | main | off', async (c) => {
    if (!c.isGroup) return c.reply('Esto se usa dentro de un grupo.');
    if (!(await c.isAdmin()) && !c.isOwner) return c.reply('Solo los admins del grupo (o el owner) pueden elegir el bot primario.');
    const st = require('../lib/state');
    const chat = db.chat(c.from);
    const mainN = st.mainSock?.user ? subbots.num(st.mainSock.user.id) : '';
    const bots = [];
    if (mainN) bots.push({ num: mainN, label: 'principal', sock: st.mainSock });
    for (const s of subbots.list()) if (s.status === 'online') bots.push({ num: s.num, label: 'sub bot', sock: subbots.sockOf(s.num) });

    const mentioned = (c.mentioned && c.mentioned[0]) || (c.quoted && c.quoted.sender);
    const a = (c.args[0] || '').toLowerCase();

    if (!a && !mentioned) {
      const lista = bots.map((b, i) => (i + 1) + '. +' + b.num + ' (' + b.label + ')').join('\n') || '(ninguno en linea)';
      return c.reply([
        'Primario actual: ' + (chat.primary ? '+' + chat.primary : 'todos'),
        '',
        'Bots en linea:',
        lista,
        '',
        'Uso:',
        c.prefix + 'setprimary @bot',
        c.prefix + 'setprimary main',
        c.prefix + 'setprimary 58412...',
        c.prefix + 'setprimary off',
      ].join('\n'));
    }
    if (['off', 'none', 'todos', 'all', 'quitar', 'reset', 'ninguno'].includes(a)) {
      delete chat.primary;
      db.save();
      return c.reply('Listo: ahora contestan TODOS los bots de este grupo.');
    }

    let target = null;
    if (mentioned) {
      const mn = digits(String(mentioned).split('@')[0]);
      target = bots.find((b) => b.num === mn || mn.endsWith(b.num) || b.num.endsWith(mn));
      if (!target) return c.reply('Este usuario no es un bot.\nMenciona un bot conectado (principal o sub bot) o usa el numero.');
    } else if (['main', 'principal'].includes(a)) {
      target = bots.find((b) => b.label === 'principal');
    } else {
      const d = digits(c.args.join(''));
      target = bots.find((b) => b.num === d) || (d.length <= 2 ? bots[Number(d) - 1] : null);
      if (!target && d) return c.reply('Este usuario no es un bot.\nNo hay ningun bot en linea con ese numero.');
    }
    if (!target) return c.reply('No encontre ese bot en linea. Mira la lista con ' + c.prefix + 'setprimary');
    try { await target.sock.groupMetadata(c.from); }
    catch { return c.reply('El bot +' + target.num + ' no esta en este grupo. Agregalo y vuelve a intentar.'); }
    chat.primary = target.num;
    db.save();
    return c.reply('Bot primario: +' + target.num + ' (' + target.label + ').\nSolo ese bot contesta aqui. Para todos: ' + c.prefix + 'setprimary off');
  }, ['primary', 'botprincipal', 'primario']),

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
