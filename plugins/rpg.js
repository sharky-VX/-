// ═══════════════════════════════════════════════
//  RPG — Sistema RPG completo: clases, misiones,
//  inventario, raids, duelos, crafteo
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const db = require('../lib/db');
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'rpg', ...extra, run });

function rpgUser(num) {
  if (!db.data.rpg) db.data.rpg = {};
  if (!db.data.rpg[num]) {
    db.data.rpg[num] = {
      clase: null, nivel: 1, exp: 0, hp: 100, maxHp: 100,
      ataque: 10, defensa: 5, mana: 50, maxMana: 50,
      oro: 0, inventario: [], misiones: [], logros: [],
      victorias: 0, derrotas: 0, raid: null, racha: 0,
    };
  }
  return db.data.rpg[num];
}

const CLASES = {
  guerrero: { emoji: '⚔️', hp: 150, ataque: 15, defensa: 12, mana: 30, desc: 'Alto daño físico y resistencia' },
  mago:     { emoji: '🧙', hp: 80,  ataque: 25, defensa: 4,  mana: 120, desc: 'Máximo daño mágico, frágil' },
  asesino:  { emoji: '🗡️', hp: 100, ataque: 20, defensa: 6,  mana: 50,  desc: 'Críticos frecuentes y evasión' },
  curandero: { emoji: '💚', hp: 110, ataque: 8,  defensa: 8,  mana: 100, desc: 'Cura aliados y soporte' },
  arquero:  { emoji: '🏹', hp: 90,  ataque: 18, defensa: 5,  mana: 60,  desc: 'Daño a distancia preciso' },
  paladin:  { emoji: '🛡️', hp: 130, ataque: 12, defensa: 15, mana: 70,  desc: 'Tanque con habilidades sagradas' },
};

const HABILIDADES = {
  guerrero: ['Golpe Brutal', 'Berserker', 'Escudo Rompe', 'Carga de Guerra'],
  mago:     ['Bola de Fuego', 'Rayo', 'Congelación', 'Meteoro'],
  asesino:  ['Apuñalada', 'Sombras', 'Veneno', 'Ejecución'],
  curandero: ['Curación Mayor', 'Regeneración', 'Resurrección', 'Bendición'],
  arquero:  ['Lluvia de Flechas', 'Tiro Preciso', 'Trampa', 'Flecha Explosiva'],
  paladin:  ['Juicio Divino', 'Aura Sagrada', 'Escudo Divino', 'Consecración'],
};

const MONSTRUOS = [
  { nombre: 'Goblin',       hp: 30,  ataque: 8,  exp: 20, oro: 5   },
  { nombre: 'Orco',         hp: 60,  ataque: 14, exp: 45, oro: 12  },
  { nombre: 'Esqueleto',    hp: 50,  ataque: 12, exp: 35, oro: 8   },
  { nombre: 'Troll',        hp: 90,  ataque: 18, exp: 70, oro: 20  },
  { nombre: 'Vampiro',      hp: 80,  ataque: 20, exp: 80, oro: 25  },
  { nombre: 'Dragón Joven', hp: 150, ataque: 28, exp: 150, oro: 50 },
  { nombre: 'Lich',         hp: 120, ataque: 25, exp: 130, oro: 40 },
  { nombre: 'Demonio',      hp: 200, ataque: 35, exp: 250, oro: 80 },
];

const ITEMS = {
  pocion_hp:    { nombre: '🧪 Poción HP',    precio: 20, desc: 'Restaura 50 HP' },
  pocion_mana:  { nombre: '💙 Poción Mana',  precio: 25, desc: 'Restaura 40 mana' },
  espada_hierro:{ nombre: '⚔️ Espada Hierro', precio: 80, desc: '+5 ataque' },
  escudo_madera:{ nombre: '🛡️ Escudo Madera', precio: 60, desc: '+3 defensa' },
  baston_roble: { nombre: '🪄 Bastón Roble',  precio: 70, desc: '+6 ataque mágico' },
  amuleto_vida: { nombre: '📿 Amuleto Vida',  precio: 120, desc: '+20 maxHP' },
  botas_rapidas:{ nombre: '👟 Botas Rápidas', precio: 90, desc: '+10% evasión' },
  armadura_cuero:{ nombre: '🥋 Armadura Cuero',precio: 100,desc: '+5 defensa' },
};

const MISIONES_POOL = [
  { id: 'm1', titulo: 'Caza de Goblins', desc: 'Derrota 3 goblins en la mazmorra', recompensa: { exp: 60, oro: 30 } },
  { id: 'm2', titulo: 'Colecta de Hierbas', desc: 'Recoge 5 hierbas curativas', recompensa: { exp: 40, oro: 20 } },
  { id: 'm3', titulo: 'Escolta al Mercader', desc: 'Protege al mercader hasta la ciudad', recompensa: { exp: 80, oro: 50 } },
  { id: 'm4', titulo: 'Exterminación de Ratas', desc: 'Limpia la bodega del posadero', recompensa: { exp: 30, oro: 15 } },
  { id: 'm5', titulo: 'Tesoro Perdido', desc: 'Encuentra el tesoro en la cueva', recompensa: { exp: 120, oro: 70 } },
  { id: 'm6', titulo: 'El Dragón del Norte', desc: 'Enfrenta al dragón joven', recompensa: { exp: 200, oro: 100 } },
];

function calcNivel(exp) { return Math.floor(Math.sqrt(exp / 50)) + 1; }
function expParaSiguiente(nivel) { return ((nivel) ** 2) * 50; }

module.exports = [
  mk('clase', 'Elige o ve tu clase RPG', '[clase]', (c) => {
    const u = rpgUser(c.senderNum);
    if (!c.args[0]) {
      if (u.clase) {
        const cl = CLASES[u.clase];
        return c.reply(`${cl.emoji} *Tu clase: ${u.clase.toUpperCase()}*\n\n⚔️ ATK: ${u.ataque} | 🛡️ DEF: ${u.defensa}\n❤️ HP: ${u.hp}/${u.maxHp} | 🔵 Mana: ${u.mana}/${u.maxMana}\n📊 Nivel: ${u.nivel} | ⭐ EXP: ${u.exp}\n💰 Oro: ${u.oro}`);
      }
      const lista = Object.entries(CLASES).map(([k, v]) => `${v.emoji} *${k}* — ${v.desc}`).join('\n');
      return c.reply(`⚔️ *ELIGE TU CLASE RPG*\n\n${lista}\n\nUsa: .clase <nombre>`);
    }
    const nombre = c.args[0].toLowerCase();
    if (!CLASES[nombre]) return c.reply(`Clase no válida. Opciones: ${Object.keys(CLASES).join(', ')}`);
    if (u.clase) return c.reply(`Ya tienes la clase *${u.clase}*. Una vez elegida no puede cambiarse.`);
    const cl = CLASES[nombre];
    Object.assign(u, { clase: nombre, hp: cl.hp, maxHp: cl.hp, ataque: cl.ataque, defensa: cl.defensa, mana: cl.mana, maxMana: cl.mana });
    db.save();
    c.reply(`${cl.emoji} *¡${c.pushName} ahora es ${nombre.toUpperCase()}!*\n\n${cl.desc}\n\nHP: ${cl.hp} | ATK: ${cl.ataque} | DEF: ${cl.defensa}\n\nUsa .misiones para empezar tu aventura.`);
  }, ['seleccionarclase', 'miclase', 'rolclase']),

  mk('stats', 'Muestra tus estadísticas RPG', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const cl = CLASES[u.clase];
    const habs = HABILIDADES[u.clase];
    const barra = (cur, max) => {
      const pct = Math.round((cur / max) * 10);
      return '█'.repeat(pct) + '░'.repeat(10 - pct) + ` ${cur}/${max}`;
    };
    c.reply([
      `${cl.emoji} *${c.pushName} — ${u.clase.toUpperCase()}*`,
      `📊 Nivel ${u.nivel} | ${u.exp}/${expParaSiguiente(u.nivel)} EXP`,
      '',
      `❤️ HP:   ${barra(u.hp, u.maxHp)}`,
      `🔵 Mana: ${barra(u.mana, u.maxMana)}`,
      '',
      `⚔️ ATK: ${u.ataque}  🛡️ DEF: ${u.defensa}`,
      `💰 Oro: ${u.oro}`,
      `🏆 V/D: ${u.victorias}/${u.derrotas}`,
      '',
      `✨ Habilidades: ${habs.join(', ')}`,
    ].join('\n'));
  }, ['estadisticas', 'rpgstats', 'mispoderes']),

  mk('pelear', 'Combate contra un monstruo aleatorio', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    if (u.hp <= 0) return c.reply('❤️ Estás derrotado. Usa .curar para recuperarte.');
    const mob = { ...U.pick(MONSTRUOS) };
    const cl = CLASES[u.clase];
    let log = [], userHp = u.hp, mobHp = mob.hp, turno = 0;
    while (userHp > 0 && mobHp > 0 && turno < 10) {
      turno++;
      const critico = Math.random() < 0.15;
      const dmgUser = Math.max(1, u.ataque - Math.floor(Math.random() * 5) + (critico ? 8 : 0));
      mobHp -= dmgUser;
      if (turno <= 3) log.push(`T${turno}: Atacas al ${mob.nombre} por *${dmgUser}* dmg${critico ? ' 💥CRÍTICO' : ''}`);
      if (mobHp <= 0) break;
      const dmgMob = Math.max(1, mob.ataque - u.defensa + Math.floor(Math.random() * 5));
      userHp -= dmgMob;
      if (turno <= 3) log.push(`T${turno}: ${mob.nombre} te golpea por *${dmgMob}* dmg`);
    }
    const gano = mobHp <= 0;
    u.hp = Math.max(0, Math.min(u.maxHp, userHp));
    if (gano) {
      u.exp += mob.exp; u.oro += mob.oro; u.victorias++;
      const nuevoNivel = calcNivel(u.exp);
      let levelUpMsg = '';
      if (nuevoNivel > u.nivel) { u.nivel = nuevoNivel; levelUpMsg = `\n🆙 ¡Subiste al nivel *${u.nivel}*!`; }
      db.save();
      c.reply(`⚔️ *COMBATE vs ${mob.nombre.toUpperCase()}*\n\n${log.join('\n')}\n${turno > 3 ? `... (${turno - 3} turnos más)` : ''}\n\n✅ *¡Ganaste!* +${mob.exp} EXP, +${mob.oro} oro${levelUpMsg}\nHP restante: ${u.hp}/${u.maxHp}`);
    } else {
      u.derrotas++; u.hp = Math.floor(u.maxHp * 0.1); db.save();
      c.reply(`⚔️ *COMBATE vs ${mob.nombre.toUpperCase()}*\n\n${log.join('\n')}\n\n💀 *¡Fuiste derrotado!* Quedas con ${u.hp} HP.\nUsa .curar para recuperarte.`);
    }
  }, ['luchar', 'combatir', 'atacar', 'battle2']),

  mk('curar', 'Cura tu HP (cuesta maná)', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    if (u.mana < 10) return c.reply('🔵 No tienes suficiente maná (necesitas 10). Espera o usa una poción.');
    const curado = Math.floor(u.maxHp * 0.4);
    u.hp = Math.min(u.maxHp, u.hp + curado);
    u.mana -= 10;
    db.save();
    c.reply(`💚 *CURACIÓN*\n\n+${curado} HP → ${u.hp}/${u.maxHp}\n🔵 Maná: ${u.mana}/${u.maxMana}`);
  }, ['heal', 'sanar', 'regenerar']),

  mk('descansar', 'Descansa para recuperar HP y maná completo', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const cd = db.data._rpgRest ||= {};
    const last = cd[c.senderNum] || 0;
    const wait = 3600000; // 1 hora
    if (Date.now() - last < wait) {
      const min = Math.ceil((wait - (Date.now() - last)) / 60000);
      return c.reply(`😴 Ya descansaste recientemente. Espera ${min} minutos más.`);
    }
    u.hp = u.maxHp; u.mana = u.maxMana;
    cd[c.senderNum] = Date.now();
    db.save();
    c.reply(`😴 *DESCANSASTE*\n\nHP restaurado: ${u.maxHp}/${u.maxHp}\nManá restaurado: ${u.maxMana}/${u.maxMana}\n\n¡Listo para la batalla!`);
  }, ['rest', 'dormir', 'recuperar']),

  mk('misiones', 'Ver misiones disponibles', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const lines = MISIONES_POOL.map((m, i) => `${i+1}. *${m.titulo}*\n   ${m.desc}\n   Recompensa: ${m.recompensa.exp} EXP, ${m.recompensa.oro} oro`);
    c.reply(`📜 *MISIONES DISPONIBLES*\n\n${lines.join('\n\n')}\n\nUsa .aceptarmision <número> para aceptar.`);
  }, ['quests', 'tareas', 'misiones_rpg']),

  mk('aceptarmision', 'Acepta una misión por número', '<número>', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const idx = parseInt(c.args[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= MISIONES_POOL.length) return c.reply('Número de misión inválido. Usa .misiones para ver la lista.');
    const mision = MISIONES_POOL[idx];
    if (u.misiones.includes(mision.id)) return c.reply('Ya tienes esa misión activa.');
    u.misiones.push(mision.id);
    db.save();
    c.reply(`📜 *Misión aceptada: ${mision.titulo}*\n\n${mision.desc}\nRecompensa: ${mision.recompensa.exp} EXP, ${mision.recompensa.oro} oro\n\nUsa .completarmision ${idx + 1} cuando termines.`);
  }, ['tomarmision', 'quest_accept']),

  mk('completarmision', 'Completa una misión activa', '<número>', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const idx = parseInt(c.args[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= MISIONES_POOL.length) return c.reply('Número inválido.');
    const mision = MISIONES_POOL[idx];
    if (!u.misiones.includes(mision.id)) return c.reply('No tienes esa misión activa. Acéptala primero con .aceptarmision');
    // 70% chance de éxito
    if (Math.random() < 0.3) {
      c.reply(`❌ *Misión fallida: ${mision.titulo}*\n\nNo pudiste completarla a tiempo. La misión se cancela.`);
      u.misiones = u.misiones.filter(id => id !== mision.id);
      return db.save();
    }
    u.exp += mision.recompensa.exp;
    u.oro += mision.recompensa.oro;
    u.misiones = u.misiones.filter(id => id !== mision.id);
    const nuevoNivel = calcNivel(u.exp);
    let levelUp = '';
    if (nuevoNivel > u.nivel) { u.nivel = nuevoNivel; levelUp = `\n🆙 ¡Subiste al nivel *${u.nivel}*!`; }
    db.save();
    c.reply(`✅ *¡Misión completada: ${mision.titulo}!*\n\n+${mision.recompensa.exp} EXP\n+${mision.recompensa.oro} oro${levelUp}`);
  }, ['terminar_mision', 'quest_done', 'entregar']),

  mk('tienda', 'Tienda de objetos RPG', '', (c) => {
    const lines = Object.entries(ITEMS).map(([k, v]) => `• *${v.nombre}* — ${v.precio} oro\n  ${v.desc}`);
    c.reply(`🏪 *TIENDA DE OBJETOS*\n\n${lines.join('\n')}\n\nUsa .comprar <nombre_item> para comprar.\nEjemplo: .comprar pocion_hp`);
  }, ['shop', 'mercado', 'itemshop']),

  mk('comprar', 'Compra un objeto en la tienda', '<item>', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const itemKey = c.args[0]?.toLowerCase();
    const item = ITEMS[itemKey];
    if (!item) return c.reply(`Item no encontrado. Usa .tienda para ver los disponibles.`);
    if (u.oro < item.precio) return c.reply(`💰 No tienes suficiente oro. Necesitas ${item.precio}, tienes ${u.oro}.`);
    u.oro -= item.precio;
    u.inventario.push(itemKey);
    db.save();
    c.reply(`✅ *Compraste ${item.nombre}* por ${item.precio} oro\nOro restante: ${u.oro}`);
  }, ['buy', 'adquirir']),

  mk('usar', 'Usa un objeto de tu inventario', '<item>', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const itemKey = c.args[0]?.toLowerCase();
    if (!u.inventario.includes(itemKey)) return c.reply(`No tienes ese item. Usa .inventario para ver los que tienes.`);
    const item = ITEMS[itemKey];
    u.inventario.splice(u.inventario.indexOf(itemKey), 1);
    let efecto = '';
    if (itemKey === 'pocion_hp') { u.hp = Math.min(u.maxHp, u.hp + 50); efecto = `+50 HP → ${u.hp}/${u.maxHp}`; }
    else if (itemKey === 'pocion_mana') { u.mana = Math.min(u.maxMana, u.mana + 40); efecto = `+40 Mana → ${u.mana}/${u.maxMana}`; }
    else if (itemKey === 'espada_hierro') { u.ataque += 5; efecto = `+5 ATK → ${u.ataque}`; }
    else if (itemKey === 'escudo_madera') { u.defensa += 3; efecto = `+3 DEF → ${u.defensa}`; }
    else if (itemKey === 'baston_roble') { u.ataque += 6; efecto = `+6 ATK → ${u.ataque}`; }
    else if (itemKey === 'amuleto_vida') { u.maxHp += 20; u.hp += 20; efecto = `+20 maxHP → ${u.maxHp}`; }
    else if (itemKey === 'armadura_cuero') { u.defensa += 5; efecto = `+5 DEF → ${u.defensa}`; }
    else efecto = 'Equipado permanentemente.';
    db.save();
    c.reply(`✅ *Usaste ${item.nombre}*\n${efecto}`);
  }, ['use', 'equipar', 'utilizar']),

  mk('inventario', 'Ver tu inventario RPG', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    if (!u.inventario.length) return c.reply('🎒 Tu inventario está vacío. Compra items con .comprar');
    const cuenta = {};
    u.inventario.forEach(k => { cuenta[k] = (cuenta[k] || 0) + 1; });
    const lines = Object.entries(cuenta).map(([k, n]) => `• ${ITEMS[k]?.nombre || k} x${n}`);
    c.reply(`🎒 *INVENTARIO*\n\n${lines.join('\n')}\n\n💰 Oro: ${u.oro}`);
  }, ['mochila', 'items', 'equipamiento']),

  mk('duelo', 'Desafía a otro jugador a un duelo RPG', '@usuario', async (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const mentioned = c.m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                   || c.m?.message?.imageMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) return c.reply('Menciona a alguien para duelo. Ejemplo: .duelo @usuario');
    const oNum = mentioned.split('@')[0];
    const o = rpgUser(oNum);
    if (!o.clase) return c.reply('Ese usuario no tiene clase RPG todavía.');
    // Combate simplificado entre dos jugadores
    let uHp = u.hp, oHp = o.hp, log = [], turno = 0;
    while (uHp > 0 && oHp > 0 && turno < 15) {
      turno++;
      const dmgU = Math.max(1, u.ataque - o.defensa + Math.floor(Math.random() * 8) - 3);
      oHp -= dmgU;
      if (turno <= 3) log.push(`T${turno}: ${c.pushName} → ${dmgU} dmg`);
      if (oHp <= 0) break;
      const dmgO = Math.max(1, o.ataque - u.defensa + Math.floor(Math.random() * 8) - 3);
      uHp -= dmgO;
      if (turno <= 3) log.push(`T${turno}: Rival → ${dmgO} dmg`);
    }
    const ganadorNum = uHp > 0 ? c.senderNum : oNum;
    const ganador = uHp > 0 ? c.pushName : 'Rival';
    const recompensa = 30;
    if (uHp > 0) { u.victorias++; u.oro += recompensa; u.exp += 50; o.derrotas++; }
    else { o.victorias++; o.oro += recompensa; o.exp += 50; u.derrotas++; }
    db.save();
    c.reply(`⚔️ *DUELO RPG*\n\n${log.join('\n')}\n${turno > 3 ? `... (${turno - 3} turnos más)` : ''}\n\n🏆 *¡${ganador} ganó el duelo!*\n+${recompensa} oro, +50 EXP`);
  }, ['reto_rpg', 'rpgduelo', 'pvp']),

  mk('habilidades', 'Ver tus habilidades de clase', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const cl = CLASES[u.clase];
    const habs = HABILIDADES[u.clase];
    const desblq = habs.slice(0, Math.min(habs.length, Math.ceil(u.nivel / 3)));
    const locked = habs.slice(desblq.length).map(h => `🔒 ${h} (nivel ${desblq.length * 3 + 3}+)`);
    c.reply([
      `${cl.emoji} *HABILIDADES — ${u.clase.toUpperCase()}*`,
      `Nivel: ${u.nivel}`,
      '',
      '✅ Desbloqueadas:',
      ...desblq.map(h => `⚡ ${h}`),
      locked.length ? '\n🔒 Bloqueadas:' : '',
      ...locked,
    ].filter(Boolean).join('\n'));
  }, ['skills', 'poderes_rpg', 'abilities']),

  mk('rpg_top', 'Ranking de jugadores RPG por nivel', '', (c) => {
    const jugadores = Object.entries(db.data.rpg || {})
      .filter(([, u]) => u.clase)
      .sort(([,a],[,b]) => b.nivel - a.nivel || b.exp - a.exp)
      .slice(0, 10);
    if (!jugadores.length) return c.reply('Nadie ha elegido clase RPG aún. Usa .clase para empezar.');
    const medals = ['🥇', '🥈', '🥉'];
    const lines = jugadores.map(([num, u], i) => `${medals[i] || `${i+1}.`} ${CLASES[u.clase]?.emoji} +${num.slice(-4)} — Nv.${u.nivel} (${u.exp} EXP)`);
    c.reply(`🏆 *RANKING RPG*\n\n${lines.join('\n')}`);
  }, ['topRpg', 'rankrpg', 'mejoresrpg']),

  mk('mazmorra', 'Entra a la mazmorra para conseguir recompensas', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    if (u.hp < u.maxHp * 0.3) return c.reply('❤️ Tienes muy poco HP para entrar a la mazmorra. Descansa primero.');
    const cd = db.data._mazmorraCD ||= {};
    const last = cd[c.senderNum] || 0;
    const wait = 7200000; // 2 horas
    if (Date.now() - last < wait) {
      const min = Math.ceil((wait - (Date.now() - last)) / 60000);
      return c.reply(`🏰 Ya exploraste la mazmorra. Espera ${min} minutos más.`);
    }
    cd[c.senderNum] = Date.now();
    const resultado = Math.random();
    let msg;
    if (resultado < 0.4) {
      const exp = 100 + Math.floor(Math.random() * 100);
      const oro = 40 + Math.floor(Math.random() * 60);
      u.exp += exp; u.oro += oro;
      msg = `✅ *¡Mazmorra completada!*\n\nDestruiste a todos los monstruos.\n+${exp} EXP, +${oro} oro`;
    } else if (resultado < 0.7) {
      const exp = 50 + Math.floor(Math.random() * 50);
      const oro = 20 + Math.floor(Math.random() * 30);
      const dmg = Math.floor(u.maxHp * 0.25);
      u.exp += exp; u.oro += oro; u.hp = Math.max(1, u.hp - dmg);
      msg = `⚠️ *Mazmorra parcial*\n\nSobreviviste con dificultad.\n+${exp} EXP, +${oro} oro, -${dmg} HP`;
    } else {
      const dmg = Math.floor(u.maxHp * 0.4);
      u.hp = Math.max(1, u.hp - dmg);
      msg = `💀 *¡Derrotado en la mazmorra!*\n\nHuiste con vida...\n-${dmg} HP. Descansa antes de intentarlo de nuevo.`;
    }
    const nuevoNivel = calcNivel(u.exp);
    if (nuevoNivel > u.nivel) { u.nivel = nuevoNivel; msg += `\n\n🆙 ¡Subiste al nivel *${u.nivel}*!`; }
    db.save();
    c.reply(`🏰 *MAZMORRA*\n\n${msg}`);
  }, ['dungeon', 'cueva', 'explorar']),

  mk('crafting', 'Fabrica objetos combinando materiales', '[receta]', (c) => {
    const recetas = {
      'espada_elfica': { materiales: ['espada_hierro', 'baston_roble'], resultado: '⚔️✨ Espada Élfica (+12 ATK total)', atk: 7 },
      'armadura_sagrada': { materiales: ['escudo_madera', 'armadura_cuero'], resultado: '🛡️✨ Armadura Sagrada (+9 DEF total)', def: 4 },
    };
    if (!c.q || !recetas[c.q]) {
      const lista = Object.entries(recetas).map(([k, v]) => `• *${k}*: ${v.materiales.join(' + ')}`).join('\n');
      return c.reply(`🔨 *CRAFTEO*\n\nRecetas disponibles:\n${lista}\n\nUsa .crafting <receta>`);
    }
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    const receta = recetas[c.q];
    for (const mat of receta.materiales) {
      if (!u.inventario.includes(mat)) return c.reply(`❌ Te falta: *${ITEMS[mat]?.nombre || mat}*`);
    }
    receta.materiales.forEach(m => { u.inventario.splice(u.inventario.indexOf(m), 1); });
    if (receta.atk) u.ataque += receta.atk;
    if (receta.def) u.defensa += receta.def;
    db.save();
    c.reply(`🔨 *¡CRAFTEO EXITOSO!*\n\n${receta.resultado}\nATK: ${u.ataque} | DEF: ${u.defensa}`);
  }, ['fabricar', 'craft', 'combinar']),

  mk('monstruos', 'Lista de monstruos que puedes enfrentar', '', (c) => {
    const lines = MONSTRUOS.map((m, i) => `${i+1}. *${m.nombre}* — HP:${m.hp} | ATK:${m.ataque} | +${m.exp}EXP,${m.oro}oro`);
    c.reply(`👹 *BESTIARIO*\n\n${lines.join('\n')}\n\nUsa .pelear para combatir un monstruo aleatorio.`);
  }, ['bestiario', 'enemigos', 'mobs']),

  mk('oro', 'Ver tu cantidad de oro RPG', '', (c) => {
    const u = rpgUser(c.senderNum);
    if (!u.clase) return c.reply('Primero elige una clase con .clase');
    c.reply(`💰 *Oro de ${c.pushName}:* ${u.oro}\n\n_Gana oro derrotando monstruos, completando misiones o ganando duelos._`);
  }, ['mioro', 'gold', 'dinero_rpg']),
];
