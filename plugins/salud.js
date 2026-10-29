// ═══════════════════════════════════════════════
//  SALUD — Bienestar, fitness, meditación,
//  recetas saludables, consejos médicos básicos
//  SHARKNEX v4  (solo información, no diagnóstico)
// ═══════════════════════════════════════════════
const U = require('../lib/utils');
const db = require('../lib/db');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'salud', ...extra, run });

module.exports = [
  mk('imc', 'Calcula tu Índice de Masa Corporal', '<peso_kg> <altura_cm>', (c) => {
    const [pesoS, altS] = c.args;
    const peso = parseFloat(pesoS), alt = parseFloat(altS);
    if (!peso || !alt || peso < 20 || peso > 300 || alt < 100 || alt > 250) {
      return c.reply('Uso: .imc <peso_kg> <altura_cm>\nEjemplo: .imc 70 175');
    }
    const altM = alt / 100;
    const imc = peso / (altM * altM);
    let cat, consejo;
    if (imc < 18.5) { cat = '⚠️ Bajo peso'; consejo = 'Considera aumentar tu ingesta calórica con alimentos nutritivos.'; }
    else if (imc < 25) { cat = '✅ Normal'; consejo = '¡Mantén tus hábitos saludables!'; }
    else if (imc < 30) { cat = '⚠️ Sobrepeso'; consejo = 'Pequeños cambios en la dieta y ejercicio regular pueden ayudar.'; }
    else { cat = '🔴 Obesidad'; consejo = 'Consulta con un médico o nutricionista para una guía personalizada.'; }
    c.reply(`⚖️ *ÍNDICE DE MASA CORPORAL*\n\nPeso: ${peso} kg | Altura: ${alt} cm\nIMC: *${imc.toFixed(1)}*\nCategoría: ${cat}\n\n💡 ${consejo}\n\n_ℹ️ El IMC es solo una referencia, consulta a un profesional._`);
  }, ['bmi', 'índice_masa', 'calcularimc']),

  mk('calorias', 'Calorías aproximadas de alimentos comunes', '<alimento>', (c) => {
    const base = {
      'arepa': 220, 'arroz': 130, 'pollo': 165, 'carne': 250,
      'huevo': 75, 'queso': 100, 'pan': 70, 'platano': 90,
      'caraotas': 110, 'pasta': 220, 'ensalada': 30, 'manzana': 80,
      'banana': 90, 'naranja': 60, 'leche': 150, 'yogurt': 100,
      'papa': 130, 'batata': 115, 'pescado': 140, 'atun': 130,
    };
    if (!c.q) {
      return c.reply(`🍽️ Alimentos con datos disponibles:\n${Object.keys(base).join(', ')}\n\nEjemplo: .calorias arepa`);
    }
    const key = c.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const cal = base[key];
    if (!cal) return c.reply(`No tengo datos para "${c.q}". Alimentos disponibles:\n${Object.keys(base).join(', ')}`);
    c.reply(`🔥 *${c.q.toUpperCase()}*\n\n~${cal} kcal por 100g\n\n_Los valores son aproximados. Para dietas específicas, consulta un nutricionista._`);
  }, ['kcal', 'calorías', 'nutricion']),

  mk('agua', 'Cuánta agua debes tomar al día', '<peso_kg>', (c) => {
    const peso = parseFloat(c.args[0]);
    if (!peso || peso < 20 || peso > 300) return c.reply('Uso: .agua <peso_kg>\nEjemplo: .agua 70');
    const litros = (peso * 0.033).toFixed(1);
    const vasos = Math.round(litros * 4);
    c.reply(`💧 *HIDRATACIÓN DIARIA*\n\nPeso: ${peso} kg\nAgua recomendada: *${litros}L* (~${vasos} vasos)\n\n💡 Aumenta si haces ejercicio, clima caliente o estás enfermo.\n\n_Bebe agua regularmente durante el día, no toda de una vez._`);
  }, ['hidratacion', 'litros_agua', 'agua_diaria']),

  mk('ejercicio', 'Rutina de ejercicio por objetivo', '<objetivo>', (c) => {
    const rutinas = {
      'perder_peso': {
        titulo: 'Pérdida de Peso',
        rutina: ['30-45 min cardio (caminata rápida, trote, saltar lazo)', '3 series de sentadillas x 15 reps', '3 series de burpees x 10 reps', '2 series de plancha 30 seg', 'Estiramientos 10 min'],
        dias: '4-5 veces por semana',
      },
      'ganar_musculo': {
        titulo: 'Ganar Músculo',
        rutina: ['Calentamiento 10 min', '4 series de press banca/flexiones x 10', '4 series de dominadas/remo x 8', '4 series de sentadillas x 12', '3 series de bíceps/tríceps x 12', 'Proteína después'],
        dias: '3-4 veces por semana con descanso entre días',
      },
      'flexibilidad': {
        titulo: 'Flexibilidad',
        rutina: ['Calentamiento suave 5 min', 'Estiramiento de isquiotibiales 30 seg c/lado', 'Postura del guerrero yoga 30 seg', 'Rotación de caderas', 'Estiramiento de espalda', 'Postura del niño yoga 1 min'],
        dias: 'Diario',
      },
      'tonificar': {
        titulo: 'Tonificación',
        rutina: ['3 series x 20 sentadillas', '3 series x 15 lunges', '3 series x 12 pushups', '3 series x 20 abdominales', '2 series de plancha lateral 20 seg', 'Cardio suave 15 min'],
        dias: '3-4 veces por semana',
      },
    };
    if (!c.q || !rutinas[c.q.replace(/\s/g,'_').toLowerCase()]) {
      return c.reply(`💪 Objetivos disponibles:\n${Object.keys(rutinas).map(k => `• .ejercicio ${k}`).join('\n')}`);
    }
    const r = rutinas[c.q.replace(/\s/g,'_').toLowerCase()];
    c.reply(`💪 *RUTINA: ${r.titulo}*\n\n${r.rutina.map((e, i) => `${i+1}. ${e}`).join('\n')}\n\n📅 Frecuencia: ${r.dias}\n\n_⚠️ Consulta a un médico antes de iniciar una rutina nueva._`);
  }, ['rutina', 'workout', 'entrenamiento']),

  mk('meditacion', 'Guía de meditación rápida', '[minutos]', (c) => {
    const min = parseInt(c.args[0]) || 5;
    const guias = [
      `🧘 *MEDITACIÓN ${min} MINUTOS*\n\n1. Siéntate en posición cómoda, espalda recta.\n2. Cierra los ojos y respira profundo 3 veces.\n3. Enfócate solo en tu respiración: inhala 4 seg, sostén 2, exhala 6.\n4. Cuando la mente divague, vuelve suavemente a la respiración.\n5. Repite durante ${min} minutos.\n6. Al terminar, abre los ojos lentamente.\n\n💡 Constancia > duración. 5 min diarios son mejores que 1 hora al mes.`,
    ];
    c.reply(U.pick(guias));
  }, ['mindfulness', 'meditar', 'relajacion']),

  mk('dormir', 'Horas de sueño recomendadas por edad', '<edad>', (c) => {
    const edad = parseInt(c.args[0]);
    if (!edad || edad < 1) return c.reply('Uso: .dormir <edad>\nEjemplo: .dormir 25');
    let rango;
    if (edad <= 3) rango = '12-15 horas (incluye siestas)';
    else if (edad <= 5) rango = '11-14 horas';
    else if (edad <= 12) rango = '10-12 horas';
    else if (edad <= 18) rango = '9-10 horas';
    else if (edad <= 64) rango = '7-9 horas';
    else rango = '7-8 horas';
    c.reply(`😴 *SUEÑO RECOMENDADO*\n\nEdad: ${edad} años\nHoras: *${rango}*\n\n💡 Tips para dormir mejor:\n• Misma hora siempre\n• Oscuridad y silencio\n• Sin pantallas 1h antes\n• No cafeína después del mediodía`);
  }, ['sueno', 'horas_dormir', 'sleep_rec']),

  mk('vitaminas', 'Información sobre vitaminas esenciales', '[vitamina]', (c) => {
    const vits = {
      'a': { n: 'Vitamina A', f: 'Vista, piel, sistema inmune', f2: 'Zanahoria, batata, hígado, huevo' },
      'b12': { n: 'Vitamina B12', f: 'Sistema nervioso, glóbulos rojos', f2: 'Carne, pescado, huevo, lácteos' },
      'c': { n: 'Vitamina C', f: 'Sistema inmune, colágeno, antioxidante', f2: 'Naranja, limón, pimentón, fresa' },
      'd': { n: 'Vitamina D', f: 'Huesos, sistema inmune, estado de ánimo', f2: 'Sol, salmón, huevo, leche fortificada' },
      'e': { n: 'Vitamina E', f: 'Antioxidante, piel, sistema inmune', f2: 'Almendras, aceite de oliva, espinaca' },
      'k': { n: 'Vitamina K', f: 'Coagulación, salud ósea', f2: 'Espinaca, brócoli, repollo' },
    };
    if (!c.q) {
      return c.reply(`💊 Vitaminas disponibles: ${Object.keys(vits).join(', ')}\nEjemplo: .vitaminas c`);
    }
    const key = c.q.toLowerCase().replace('vitamina ', '').trim();
    const v = vits[key];
    if (!v) return c.reply(`No tengo info de esa vitamina. Disponibles: ${Object.keys(vits).join(', ')}`);
    c.reply(`💊 *${v.n}*\n\n🎯 Función: ${v.f}\n🥗 Fuentes: ${v.f2}\n\n_Consulta con un médico antes de tomar suplementos._`);
  }, ['vitamin', 'suplemento', 'nutrientes']),

  mk('respirar', 'Técnica de respiración para calmarse', '', (c) => {
    const tecnicas = [
      { n: 'Respiración 4-7-8', p: '1. Inhala por la nariz durante 4 segundos.\n2. Sostén el aire 7 segundos.\n3. Exhala por la boca durante 8 segundos.\n4. Repite 4 veces.\n\n✅ Ideal para ansiedad o antes de dormir.' },
      { n: 'Respiración de Caja', p: '1. Inhala 4 segundos.\n2. Sostén 4 segundos.\n3. Exhala 4 segundos.\n4. Sostén 4 segundos.\n5. Repite.\n\n✅ Usada por militares para calma bajo presión.' },
      { n: 'Respiración Diafragmática', p: '1. Pon una mano en el pecho y otra en el estómago.\n2. Inhala profundo — debe moverse el estómago, no el pecho.\n3. Exhala lentamente.\n4. Repite 5-10 veces.\n\n✅ Reduce el estrés y mejora el oxígeno.' },
    ];
    const t = U.pick(tecnicas);
    c.reply(`🌬️ *${t.n}*\n\n${t.p}`);
  }, ['tecnica_respirar', 'respira', 'breathe']),

  mk('pasos', 'Cuántos pasos deberías caminar al día', '<edad>', (c) => {
    const edad = parseInt(c.args[0]) || 30;
    const rec = edad < 18 ? 10000 : edad < 60 ? 7500 : 6000;
    c.reply(`👟 *PASOS DIARIOS*\n\nEdad: ${edad} años\nMeta recomendada: *${rec.toLocaleString('es')} pasos/día*\n\n💡 Equivale a ~${(rec * 0.0007).toFixed(1)} km\n\nEmpieza con lo que puedas y aumenta gradualmente.`);
  }, ['pasos_diarios', 'steps', 'caminar']),

  mk('estres', 'Síntomas del estrés y cómo manejarlo', '', (c) => {
    const sintomas = ['Dificultad para concentrarse', 'Tensión muscular (especialmente cuello/espalda)', 'Problemas de sueño', 'Irritabilidad sin razón aparente', 'Dolores de cabeza frecuentes'];
    const tecnicas = ['Respiración profunda (5 min)', 'Caminar al aire libre', 'Hablar con alguien de confianza', 'Poner música relajante', 'Escribir lo que te preocupa (journaling)', 'Reducir cafeína y azúcar', 'Establecer límites con el trabajo'];
    c.reply(`😓 *MANEJO DEL ESTRÉS*\n\n🚩 Síntomas comunes:\n${sintomas.map(s => `• ${s}`).join('\n')}\n\n✅ Técnicas efectivas:\n${tecnicas.map(t => `• ${t}`).join('\n')}\n\n_Si el estrés es crónico, consulta a un profesional de salud mental._`);
  }, ['ansiedad', 'stress', 'manejo_estres']),

  mk('suplementos', 'Suplementos populares y para qué sirven', '', (c) => {
    const sups = [
      { n: 'Creatina', u: 'Aumentar fuerza y masa muscular en deportes de alta intensidad', s: 'Veganos y atletas' },
      { n: 'Omega-3', u: 'Salud cardiovascular, cerebro, reducción de inflamación', s: 'Personas que no comen pescado' },
      { n: 'Vitamina D3', u: 'Huesos, sistema inmune, estado de ánimo', s: 'Personas con poca exposición al sol' },
      { n: 'Magnesio', u: 'Sueño, reducción de calambres, regulación del azúcar', s: 'Personas con insomnio o estrés' },
      { n: 'Proteína Whey', u: 'Recuperación muscular post-entrenamiento', s: 'Personas que hacen pesas' },
    ];
    const s = U.pick(sups);
    c.reply(`💊 *SUPLEMENTO: ${s.n}*\n\nUso: ${s.u}\n¿Quién se beneficia? ${s.s}\n\n_Siempre consulta con un médico antes de tomar suplementos._`);
  }, ['supplement', 'suplementacion', 'proteina_info']),

  mk('colesterol', 'Información sobre el colesterol', '', (c) => {
    c.reply(`🫀 *COLESTEROL — GUÍA BÁSICA*\n\n📊 Valores de referencia:\n• Total: <200 mg/dL ideal\n• LDL (malo): <100 ideal, <130 aceptable\n• HDL (bueno): >60 óptimo\n• Triglicéridos: <150 normal\n\n✅ Para mejorar:\n• Reduce grasas saturadas y trans\n• Come más fibra (avena, legumbres)\n• Haz ejercicio aeróbico\n• Evita el tabaco\n• Controla el estrés\n\n_⚠️ Solo un médico puede interpretarlo en tu contexto._`);
  }, ['colesterol_info', 'lipidos', 'trigliceridos']),

  mk('azucar', 'Niveles de azúcar en sangre', '', (c) => {
    c.reply(`🩸 *GLUCOSA EN SANGRE*\n\n📊 Valores normales:\n• En ayunas: 70-99 mg/dL\n• 2h después de comer: <140 mg/dL\n• Prediabetes ayunas: 100-125 mg/dL\n• Diabetes: ≥126 mg/dL en ayunas\n\n✅ Para mantener niveles sanos:\n• Reduce azúcares simples y harinas refinadas\n• Come fibra con cada comida\n• Ejercicio regular\n• Mantén peso saludable\n\n_⚠️ Consulta a tu médico para diagnóstico._`);
  }, ['glucosa', 'diabetes_info', 'azucar_sangre']),

  mk('postura', 'Corrección de postura y ejercicios', '', (c) => {
    const tips = [
      'Cuando uses el celular, llévalo al nivel de los ojos. "Text neck" causa dolor cervical crónico.',
      'Siéntate con la espalda apoyada, caderas al fondo de la silla. Rodillas a 90°, pies planos en el suelo.',
      'Haz la prueba de la pared: párate pegado a la pared. Cabeza, hombros, glúteos y talones deben tocarla.',
      'Ejercicio de gato-vaca (yoga): en 4 patas, alterna arqueando y hundiendo la espalda. 10 repeticiones mañana y noche.',
      'Fortalece el core (abdomen) — es el pilar de la postura. Planchas y abdominales suaves 3 veces/semana.',
    ];
    c.reply(`🦴 *POSTURA — TIP DEL DÍA*\n\n${U.pick(tips)}`);
  }, ['espalda', 'dolor_espalda', 'postura_correcta']),

  mk('presion', 'Información sobre presión arterial', '', (c) => {
    c.reply(`💉 *PRESIÓN ARTERIAL*\n\n📊 Categorías:\n• Normal: <120/80 mmHg ✅\n• Elevada: 120-129 / <80\n• Alta grado 1: 130-139 / 80-89 ⚠️\n• Alta grado 2: ≥140 / ≥90 🔴\n• Crisis: >180 / >120 🚨 (emergencia)\n\n✅ Para presión saludable:\n• Reduce la sal (<5g/día)\n• Ejercicio aeróbico regular\n• Mantén peso saludable\n• Reduce el estrés\n• Evita tabaco y exceso de alcohol\n\n_Toma con brazo en reposo, sentado 5 min antes._`);
  }, ['tension_arterial', 'hipertension_info', 'pressión']),

  mk('habitos', 'Hábitos saludables para empezar hoy', '', (c) => {
    const habitos = [
      '💧 Bebe un vaso de agua al despertar, antes del café',
      '🛏️ Duerme y despierta a la misma hora todos los días',
      '🚶 Camina al menos 20 minutos diarios, aunque sea en partes',
      '📱 Evita el celular los primeros 30 minutos del día',
      '🥗 Agrega una verdura a cada comida principal',
      '🧘 5 minutos de respiración profunda antes de dormir',
      '📵 Sin pantallas 1 hora antes de dormir',
      '🙏 Escribe 3 cosas por las que estar agradecido cada mañana',
    ];
    c.reply(`🌿 *HÁBITO SALUDABLE*\n\n${U.pick(habitos)}\n\n_Un pequeño cambio consistente supera a los grandes cambios esporádicos._`);
  }, ['habito_sano', 'rutina_salud', 'bienestar']),
];
