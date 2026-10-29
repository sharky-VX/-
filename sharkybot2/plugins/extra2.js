// ═══════════════════════════════════════════════
//  EXTRA2 — Comandos adicionales: productividad,
//  idiomas, humor adulto, personalidad, etc.
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const U = require('../lib/utils');
const db = require('../lib/db');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'fun', ...extra, run });

module.exports = [
  // ── PRODUCTIVIDAD ──
  mk('pomodoro', 'Técnica Pomodoro para productividad', '', (c) => {
    c.reply(`🍅 *TÉCNICA POMODORO*\n\n1. Elige UNA tarea específica\n2. Pon un timer de 25 minutos\n3. Trabaja SIN interrupciones\n4. Descansa 5 minutos\n5. Cada 4 pomodoros: descanso largo de 20-30 min\n\n✅ Reglas:\n• Si te interrumpen, empieza de nuevo\n• Sin redes sociales durante el bloque\n• Anota distracciones para después\n\n_"El secreto de avanzar es empezar."_`);
  }, ['tecnica_pomodoro', 'timer_trabajo', 'productividad_tip']),

  mk('gtd', 'Sistema GTD de organización', '', (c) => {
    c.reply(`📋 *GTD — Getting Things Done*\n\nEl sistema de David Allen en 5 pasos:\n\n1. 📥 *Capturar* — Anota TODO lo que tienes pendiente\n2. 🔍 *Aclarar* — ¿Requiere acción? ¿Cuál es el próximo paso?\n3. 🗂️ *Organizar* — Proyectos, calendarios, listas de acción\n4. 🔄 *Reflexionar* — Revisa tu sistema semanalmente\n5. ✅ *Hacer* — Ejecuta según contexto, energía y tiempo disponible\n\n_Libera tu mente capturando en un sistema confiable._`);
  }, ['gettingthingsdone', 'organizacion', 'sistema_gtd']),

  mk('objetivo', 'Cómo definir objetivos SMART', '<objetivo>', (c) => {
    if (!c.q) return c.reply('Escribe tu objetivo. Ejemplo: .objetivo aprender inglés');
    c.reply(`🎯 *OBJETIVO SMART: "${c.q}"*\n\nDefínelo siendo:\n\n🔹 *S - Específico*: ¿Qué exactamente quieres lograr?\n🔹 *M - Medible*: ¿Cómo sabrás que lo lograste?\n🔹 *A - Alcanzable*: ¿Es realista dado tus recursos?\n🔹 *R - Relevante*: ¿Por qué importa para ti ahora?\n🔹 *T - Temporal*: ¿Cuándo lo lograrás?\n\nEjemplo mejorado:\n_"Practicar inglés 20 min al día con Duolingo durante 90 días"_\n\n¿Puedes redefinirlo así? 💪`);
  }, ['meta_smart', 'meta_definir', 'smart_goal']),

  mk('notas', 'Gestiona notas personales rápidas', '[texto]', (c) => {
    if (!db.data.notas) db.data.notas = {};
    const key = c.senderNum;
    if (!c.q || c.q === 'ver') {
      const notas = db.data.notas[key] || [];
      if (!notas.length) return c.reply('📝 No tienes notas guardadas.\n\nUsa: .notas <texto> para guardar\n.notas borrar para limpiar');
      return c.reply(`📝 *TUS NOTAS*\n\n${notas.map((n, i) => `${i+1}. ${n}`).join('\n')}\n\n_.notas borrar para eliminar todas_`);
    }
    if (c.q === 'borrar') {
      db.data.notas[key] = [];
      db.save();
      return c.reply('🗑️ Notas borradas.');
    }
    if (!db.data.notas[key]) db.data.notas[key] = [];
    if (db.data.notas[key].length >= 10) return c.reply('Máximo 10 notas. Usa .notas borrar para limpiar.');
    db.data.notas[key].push(c.q);
    db.save();
    c.reply(`✅ Nota guardada (${db.data.notas[key].length}/10):\n_"${c.q}"_`);
  }, ['nota', 'recordatorio', 'memo']),

  mk('recordar', 'Guarda algo para recordar luego', '<texto>', (c) => {
    if (!c.q) return c.reply('Escribe qué quieres recordar. Ejemplo: .recordar comprar leche mañana');
    if (!db.data.recordatorios) db.data.recordatorios = {};
    if (!db.data.recordatorios[c.senderNum]) db.data.recordatorios[c.senderNum] = [];
    db.data.recordatorios[c.senderNum].unshift({ texto: c.q, fecha: new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }) });
    if (db.data.recordatorios[c.senderNum].length > 5) db.data.recordatorios[c.senderNum].pop();
    db.save();
    c.reply(`📌 *Recordatorio guardado:*\n_"${c.q}"_\n\nUsa .misrecordatorios para verlos todos.`);
  }, ['reminder', 'guardar_recordatorio', 'apuntar']),

  mk('misrecordatorios', 'Ver tus recordatorios guardados', '', (c) => {
    const recs = db.data.recordatorios?.[c.senderNum] || [];
    if (!recs.length) return c.reply('📌 No tienes recordatorios.\n\nUsa .recordar <texto> para guardar.');
    c.reply(`📌 *TUS RECORDATORIOS*\n\n${recs.map((r, i) => `${i+1}. ${r.texto}\n   _${r.fecha}_`).join('\n\n')}`);
  }, ['ver_recordatorios', 'listar_recordatorios', 'list_reminders']),

  mk('checklist', 'Crea una checklist rápida', '<item1, item2, ...>', (c) => {
    if (!c.q) return c.reply('Escribe los ítems separados por coma.\nEjemplo: .checklist Comprar pan, Llamar a mamá, Pagar factura');
    const items = c.q.split(',').map(s => s.trim()).filter(Boolean);
    const lista = items.map((item, i) => `☐ ${item}`).join('\n');
    c.reply(`✅ *CHECKLIST*\n\n${lista}\n\n_Cópiala y marca los ✅ a mano!_`);
  }, ['lista_tareas', 'todolist', 'to_do']),

  mk('semana', 'Planificación semanal simple', '', (c) => {
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const hoy = new Date().getDay(); // 0=dom, 1=lun...
    const idx = hoy === 0 ? 6 : hoy - 1;
    const diasRestantes = dias.slice(idx);
    c.reply(`📅 *PLANIFICA TU SEMANA*\n\nQuedan ${diasRestantes.length} día(s) esta semana:\n${diasRestantes.map(d => `• ${d}: ___________`).join('\n')}\n\n💡 Tip: Define 3 tareas prioritarias por día, no más.\n_"Lo que se agenda, se hace."_`);
  }, ['planearsemana', 'weekly_plan', 'semana_plan']),

  // ── HUMOR ──
  mk('categoria_humor', 'Chiste por categoría', '<categoria>', (c) => {
    const cats = {
      negro: [
        'Fui al médico y me dijo: "Tiene usted 3 meses de vida." Le pregunté: "¿Y de salud?"',
        'Mi abuelo murió en paz. A diferencia de sus pasajeros.',
      ],
      geek: [
        '¿Por qué los programadores prefieren el modo oscuro?\nPorque la luz atrae a los bugs.',
        'Un SQL query entra a un bar, se acerca a dos tablas y pregunta: "¿Puedo hacer un JOIN?"',
        'Había un programador con miedo a las recursiones. Había un programador con miedo a las recursiones...',
      ],
      trabajo: [
        '"Esta reunión pudo ser un correo." — Todos, en toda reunión, siempre.',
        'El lunes: cuando el Excel tiene más hojas que tu árbol genealógico.',
        'Mi jefe me dijo "Sé proactivo". Así que renuncié antes de que me botaran.',
      ],
      pareja: [
        '"Estoy bien." No está bien.',
        'Pregunta: ¿Qué hace una mujer cuando está aburrida?\nRespuesta: Nada. Simplemente manda: "Hola ¿qué haces?"',
      ],
    };
    const cat = c.args[0]?.toLowerCase();
    if (!cat || !cats[cat]) return c.reply(`😂 Categorías disponibles: ${Object.keys(cats).join(', ')}\n\nEjemplo: .categoria_humor geek`);
    c.reply(`😂 *CHISTE (${cat.toUpperCase()})*\n\n${U.pick(cats[cat])}`);
  }, ['chiste_cat', 'humor_categoria', 'joke_type']),

  mk('refran', 'Refrán popular con explicación', '', (c) => {
    const refranes = [
      { r: 'A quien madruga, Dios le ayuda.', e: 'Las personas que se levantan temprano y trabajan duro tienen más oportunidades.' },
      { r: 'No hay mal que por bien no venga.', e: 'Hasta las situaciones negativas traen algo positivo o una lección.' },
      { r: 'Camarón que se duerme, se lo lleva la corriente.', e: 'Si no estás atento a las oportunidades, otros las aprovecharán.' },
      { r: 'Al mal tiempo, buena cara.', e: 'Ante las dificultades, mantén una actitud positiva.' },
      { r: 'Más vale tarde que nunca.', e: 'Es mejor hacer algo tarde que no hacerlo en absoluto.' },
      { r: 'No por mucho madrugar amanece más temprano.', e: 'Precipitarse no siempre acelera los resultados.' },
      { r: 'A caballo regalado no se le miran los dientes.', e: 'No critiques lo que recibes de gratis.' },
    ];
    const r = U.pick(refranes);
    c.reply(`📜 *REFRÁN*\n\n_"${r.r}"_\n\n💡 Significado: ${r.e}`);
  }, ['refranes', 'proverbio', 'dicho']),

  mk('trabalengua', 'Un trabalenguas para practicar', '', (c) => {
    const trabalenguas = [
      'Tres tristes tigres tragaban trigo en un trigal. ¿Cuántos trigos tragaban los tres tristes tigres?',
      'El hipopótamo Hipo está con hipo. ¿Quién le quita el hipo al hipopótamo Hipo?',
      'Pablito clavó un clavito. Un clavito clavó Pablito.',
      'Parangaricutirimícuaro. El que lo desparangaricutirimicuarare será un buen desparangaricutirimicuarizador.',
      'Como poco coco como, poco coco compro.',
    ];
    c.reply(`👅 *TRABALENGUAS*\n\n_"${U.pick(trabalenguas)}"_\n\n¿Puedes decirlo rápido 3 veces? 😄`);
  }, ['tongue_twister', 'lengua', 'dictado']),

  mk('acertijo2', 'Acertijo inteligente para el grupo', '', (c) => {
    const acertijos = [
      { p: '¿Cuánto más me secas, más mojado estás?', r: 'Una toalla' },
      { p: 'Tengo ciudades pero no casas, montañas pero no árboles, agua pero no peces. ¿Qué soy?', r: 'Un mapa' },
      { p: 'Soy ligero como una pluma, pero el hombre más fuerte no puede sostenerme por 5 minutos. ¿Qué soy?', r: 'El aliento' },
      { p: '¿Qué tiene dientes pero no puede morder?', r: 'Un peine' },
      { p: 'Cuanto más quitas, más grande soy. ¿Qué soy?', r: 'Un hoyo' },
      { p: '¿Qué está delante de ti pero no puedes ver?', r: 'El futuro' },
    ];
    const a = U.pick(acertijos);
    const key = `acertijo2:${c.from}`;
    db.data._acertijos2 ||= {};
    db.data._acertijos2[key] = { r: a.r.toLowerCase(), t: Date.now() };
    db.save();
    c.reply(`🧩 *ACERTIJO*\n\n_"${a.p}"_\n\nResponde con: .responder <tu respuesta>`);
    setTimeout(() => { if (db.data._acertijos2?.[key]) { delete db.data._acertijos2[key]; db.save(); } }, 120000);
  }, ['riddlep', 'acertijo_dificil', 'preguntariddle']),

  mk('verdad_o_reto2', 'Verdad o reto para el grupo', '', (c) => {
    const verdades = [
      '¿Cuál es la cosa más vergonzosa que te ha pasado en público?',
      '¿A quién del grupo le mandarías un mensaje en secreto ahora mismo?',
      '¿Cuál es tu mayor miedo que nadie sabe?',
      '¿Le has mentido a alguien del grupo? ¿Sobre qué?',
    ];
    const retos = [
      'Escribe un mensaje de amor a la última persona que contactaste.',
      'Haz 15 flexiones ahora mismo y manda el video.',
      'Llama a alguien al azar de tus contactos y dile "Te tenía que decir algo importante..."',
      'Cambia tu foto de perfil por la que te pida el grupo durante 1 hora.',
    ];
    const esVerdad = Math.random() < 0.5;
    const tipo = esVerdad ? '🟡 VERDAD' : '🔴 RETO';
    const texto = esVerdad ? U.pick(verdades) : U.pick(retos);
    c.reply(`${tipo}\n\n${c.pushName}, te toca:\n\n_"${texto}"_`);
  }, ['truthordare', 'tod', 'verdadyreto']),

  mk('preguntas_filosoficas', 'Una pregunta filosófica para reflexionar', '', (c) => {
    const preguntas = [
      '¿Si pudieras saber cuándo y cómo vas a morir, querrías saberlo?',
      '¿Eres la misma persona que eras hace 10 años? ¿En qué sentido?',
      '¿Prefieres tener razón o ser feliz? ¿Pueden coexistir?',
      '¿Si te ofrecieran vivir sin dolor físico ni emocional, lo aceptarías? ¿Qué perderías?',
      '¿Qué significa tener éxito para ti, sin usar la definición de otros?',
      '¿Qué harías diferente si supieras que nadie te juzgaría jamás?',
    ];
    c.reply(`🤔 *PREGUNTA FILOSÓFICA*\n\n_"${U.pick(preguntas)}"_\n\nPiénsalo bien antes de responder... 💭`);
  }, ['pregunta_profunda', 'deep_question', 'reflexion_deep']),

  mk('personalidad_test', 'Mini test de personalidad rápido', '', (c) => {
    const tipos = [
      { t: 'El Visionario', d: 'Piensas en grande, te cuesta aterrizar ideas, pero cuando lo haces cambias cosas.' },
      { t: 'El Ejecutor', d: 'Terminas lo que empiezas. Eres confiable pero a veces te falta creatividad.' },
      { t: 'El Conector', d: 'Eres el pegamento del grupo. Todos te quieren pero das demasiado de ti.' },
      { t: 'El Analítico', d: 'Piensas antes de actuar. A veces demasiado. Necesitas perfección.' },
      { t: 'El Rebelde', d: 'Cuestionas todo. No sigues reglas sin entenderlas. Incómodo pero necesario.' },
    ];
    const seed = c.senderNum.split('').reduce((a, b) => a + (parseInt(b) || 0), 0);
    const tipo = tipos[seed % tipos.length];
    c.reply(`🧠 *TU TIPO DE PERSONALIDAD*\n\n*${tipo.t}*\n\n${tipo.d}\n\n_Este es un test de humor, no psicología real 😄_`);
  }, ['tipo_personalidad', 'personality', 'quien_soy']),

  mk('consejo_vida', 'Consejo de vida aleatorio', '', (c) => {
    const consejos = [
      'No respondas mensajes cuando estás enojado. Espera al menos 24 horas.',
      'Aprende a decir "No sé" — es más inteligente que inventar.',
      'Las personas que te dicen la verdad incómoda valen más que las que siempre te dan la razón.',
      'Guarda el 10% de lo que ganas antes de gastar cualquier otra cosa.',
      'Si algo te va a molestar en 5 años, preocúpate. Si no, respira.',
      'Lee 10 páginas al día. En un año habrás leído ~12 libros.',
      'Duerme bien. La mayoría de los problemas se ven peor cuando estás cansado.',
      'Llama a tus padres/abuelos más seguido. El tiempo con ellos es limitado.',
    ];
    c.reply(`💡 *CONSEJO DE VIDA*\n\n_"${U.pick(consejos)}"_`);
  }, ['consejo_dia', 'wisdom', 'tip_vida']),

  mk('quote', 'Frase célebre de alguien famoso', '[persona]', (c) => {
    const quotes = [
      { q: '"El éxito es ir de fracaso en fracaso sin perder el entusiasmo."', a: 'Winston Churchill' },
      { q: '"No cuentes los días; haz que los días cuenten."', a: 'Muhammad Ali' },
      { q: '"La vida es lo que pasa mientras estás ocupado haciendo otros planes."', a: 'John Lennon' },
      { q: '"Si quieres ir rápido, ve solo. Si quieres llegar lejos, ve acompañado."', a: 'Proverbio africano' },
      { q: '"La imaginación es más importante que el conocimiento."', a: 'Albert Einstein' },
      { q: '"No te compares con los demás. Compárate con quien eras ayer."', a: 'Jordan B. Peterson' },
      { q: '"El que no arriesga no gana."', a: 'Refrán popular' },
      { q: '"Sé el cambio que quieres ver en el mundo."', a: 'Mahatma Gandhi' },
    ];
    const found = c.q ? quotes.find(q => q.a.toLowerCase().includes(c.q.toLowerCase())) : null;
    const q = found || U.pick(quotes);
    c.reply(`✨ *FRASE CÉLEBRE*\n\n${q.q}\n\n— ${q.a}`);
  }, ['frase_celebre', 'cita', 'quotedel_dia']),

  mk('challenge', 'Un reto personal de desarrollo', '', (c) => {
    const challenges = [
      { n: '30 días sin redes sociales', d: 'Elimina Instagram, TikTok, Twitter por 30 días. Nota la diferencia en tu atención.' },
      { n: 'Levántate a las 5am por una semana', d: 'Prueba la "madrugada productiva". Una hora extra al día = 7 horas a la semana.' },
      { n: 'Lee 10 min antes de dormir por 21 días', d: 'Reemplaza el celular por un libro. El sueño mejorará también.' },
      { n: 'Un galón de agua al día por 30 días', d: '~3.7 litros. Observa cambios en piel, energía y concentración.' },
      { n: 'Sin quejarte por 24 horas', d: 'Cada vez que notes una queja, reemplázala por una solución o silencio.' },
    ];
    const ch = U.pick(challenges);
    c.reply(`💪 *CHALLENGE PERSONAL*\n\n*${ch.n}*\n\n${ch.d}\n\n¿Lo intentas? 🎯`);
  }, ['reto_personal', 'personal_challenge', 'desafio_vida']),
];
