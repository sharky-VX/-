// ═══════════════════════════════════════════════
//  VENEZUELA — Comandos especiales Venezuela:
//  dólar, cultura, comida, chistes criollos,
//  slang venezolano, geografía y más
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const axios = require('axios');
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'venezuela', ...extra, run });

module.exports = [
  mk('dolar2', 'Precio del dólar en Venezuela (BCV + paralelo)', '', async (c) => {
    try {
      const r = await axios.get('https://pydolarve.org/api/v1/dollar?page=criptodolar', { timeout: 10000 });
      const data = r.data?.monitors;
      if (!data) throw new Error('sin datos');
      const bcv = data.bcv?.price;
      const enparalelov2 = data.enparalelov2?.price;
      const binance = data.binance?.price;
      const lines = [
        `💵 *DÓLAR HOY — VENEZUELA*`,
        ``,
        bcv ? `🏦 BCV: Bs. ${parseFloat(bcv).toFixed(2)}` : '',
        enparalelov2 ? `📊 Paralelo: Bs. ${parseFloat(enparalelov2).toFixed(2)}` : '',
        binance ? `🟡 Binance P2P: Bs. ${parseFloat(binance).toFixed(2)}` : '',
        ``,
        `_Fuente: pydolarve.org_`,
      ].filter(Boolean);
      c.reply(lines.join('\n'));
    } catch {
      // Fallback con valores aproximados
      c.reply(`💵 *DÓLAR VENEZUELA*\n\nNo pude obtener el precio en tiempo real ahora.\n\nConsulta:\n• @EnParalelo (Twitter/X)\n• dolartoday.com\n• bcv.org.ve`);
    }
  }, ['dolarve', 'bolivar', 'cambio_ve', 'precio_dolar']),

  mk('slang', 'Diccionario de slang venezolano', '[palabra]', (c) => {
    const dic = {
      'chamo': 'Muchacho, joven. "Ese chamo es muy pana"',
      'pana': 'Amigo, compañero. "Mi pana te ayuda"',
      'chévere': 'Genial, buenísimo. "Eso está chévere"',
      'catire': 'Persona de cabello rubio o claro',
      'coñazo': 'Golpe fuerte. "Se cayó y se dio un coñazo"',
      'arrechera': 'Rabia, molestia. "Me da una arrechera..."',
      'vergación': 'Expresión de magnitud o intensidad',
      'friíto': 'En problemas, comprometido. "Quedé friíto"',
      'joder': 'Molestar o arruinar algo',
      'simón': 'Sí, afirmativo. "¿Vas? - Simón"',
      'bacano': 'Bueno, genial (menos venezolano, más colombiano pero usado)',
      'marico': 'Expresión coloquial, amigo (sin connotación ofensiva entre amigos)',
      'leche': 'Suerte. "¡Qué leche tuvo ese!"',
      'guiso': 'Negocio turbio o ventaja injusta',
      'cola': 'Fila, espera. "La cola del banco está terrible"',
      'pupitre': 'Escritorio escolar',
      'bicho': 'Persona astuta, picara',
      'burundanga': 'Mezcla confusa de cosas',
    };
    if (c.q) {
      const key = c.q.toLowerCase();
      const found = dic[key];
      if (found) return c.reply(`📖 *${c.q.toUpperCase()}*\n\n${found}`);
      const partial = Object.entries(dic).filter(([k]) => k.includes(key));
      if (partial.length) return c.reply(`📖 *Resultados para "${c.q}":*\n\n${partial.map(([k, v]) => `*${k}*: ${v}`).join('\n\n')}`);
      return c.reply(`No encontré "${c.q}" en el diccionario. Palabras disponibles:\n${Object.keys(dic).join(', ')}`);
    }
    const aleatorio = U.pick(Object.entries(dic));
    c.reply(`🇻🇪 *SLANG VENEZOLANO*\n\n*${aleatorio[0]}*: ${aleatorio[1]}\n\nUsa .slang <palabra> para buscar una específica.`);
  }, ['venezolanismo', 'criollo', 'diccionario_ve']),

  mk('comida_ve', 'Platos típicos venezolanos', '', (c) => {
    const platos = [
      { nombre: 'Pabellón Criollo', desc: 'El plato nacional: caraotas negras, carne mechada, arroz blanco y tajadas de plátano' },
      { nombre: 'Arepa', desc: 'Pan de maíz redondo relleno de lo que quieras. Base de la gastronomía venezolana' },
      { nombre: 'Hallaca', desc: 'Masa de maíz rellena con guiso de carne, envuelta en hojas de plátano. Tradición navideña' },
      { nombre: 'Cachapa', desc: 'Tortilla dulce de maíz tierno, generalmente con queso de mano' },
      { nombre: 'Tequeño', desc: 'Palito de queso envuelto en masa de harina de trigo frita u horneada. El favorito de fiestas' },
      { nombre: 'Pepito', desc: 'Pan de perro caliente relleno con carne, papas fritas, queso y salsas. Street food venezolano' },
      { nombre: 'Mandoca', desc: 'Rosquilla de harina de maíz con papelón y anís. Típica del Zulia' },
      { nombre: 'Caraotas Negras', desc: 'Frijoles negros guisados con especias, indispensables en la mesa venezolana' },
    ];
    const p = U.pick(platos);
    c.reply(`🍽️ *PLATO VENEZOLANO*\n\n*${p.nombre}*\n${p.desc}\n\n_¿Antojo? 😋_`);
  }, ['comidavenezolana', 'platos_ve', 'gastronomia']),

  mk('estados', 'Información de los estados venezolanos', '[estado]', (c) => {
    const estados = {
      'zulia': { capital: 'Maracaibo', apodo: 'La Tierra del Sol Amada', dato: 'Tiene el Lago de Maracaibo y la mayor riqueza petrolera del país' },
      'miranda': { capital: 'Los Teques', apodo: 'El Estado Miranda', dato: 'Rodea a Caracas y tiene la mayor densidad poblacional del país' },
      'carabobo': { capital: 'Valencia', apodo: 'El Estado Carabobo', dato: 'Centro industrial de Venezuela, sitio de la Batalla de Carabobo' },
      'aragua': { capital: 'Maracay', apodo: 'El Estado Aragua', dato: 'Conocida como la "Ciudad Jardín de Venezuela"' },
      'bolívar': { capital: 'Ciudad Bolívar', apodo: 'El Estado Bolívar', dato: 'El más grande de Venezuela. Tiene el Salto Ángel, la catarata más alta del mundo' },
      'lara': { capital: 'Barquisimeto', apodo: 'La Ciudad Crepuscular', dato: 'Famosa por sus crepúsculos y la Diócesis de la Divina Pastora' },
      'táchira': { capital: 'San Cristóbal', apodo: 'El Estado Táchira', dato: 'Fronterizo con Colombia, zona andina conocida por su café' },
      'mérida': { capital: 'Mérida', apodo: 'La Ciudad de los Caballeros', dato: 'Tiene la teleférica más alta del mundo y el Pico Bolívar' },
    };
    if (!c.q) {
      c.reply(`🗺️ *ESTADOS DE VENEZUELA*\n\nUsa .estados <nombre> para ver info.\nEjemplo: .estados zulia\n\nEstados disponibles:\n${Object.keys(estados).map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', ')}`);
      return;
    }
    const key = c.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const found = Object.entries(estados).find(([k]) => k.normalize('NFD').replace(/[̀-ͯ]/g, '').includes(key.slice(0, 5)));
    if (!found) return c.reply(`No encontré ese estado. Estados disponibles: ${Object.keys(estados).join(', ')}`);
    const [nombre, info] = found;
    c.reply(`🗺️ *${nombre.toUpperCase()}*\n\n🏛️ Capital: ${info.capital}\n🏷️ Apodo: ${info.apodo}\n📝 ${info.dato}`);
  }, ['estado_ve', 'estadove', 'regionve']),

  mk('chiste_ve', 'Chiste venezolano criollo', '', (c) => {
    const chistes = [
      '¿Por qué los venezolanos no juegan al escondite?\n¡Porque nadie quiere encontrarlos con tantas colas! 😂',
      'Un venezolano llega al cielo y San Pedro le dice:\n"Tienes 3 deseos."\nEl venezolano: "Internet, luz y agua."\nSan Pedro: "Sí eso no lo tengo ni yo aquí." 💀',
      '¿Cómo sabe un venezolano que ya llegó la navidad?\nCuando empieza a escuchar gaitas y a olerse hallacas. ¡Feliz mes! 🎉',
      '¿Por qué en Venezuela no hay buen señal de celular?\nPorque los iones también están emigrando. 🌐',
      'Venezolano en el extranjero en invierno:\n"Chamo, ¿cómo llaman cuando llueve y hace frío al mismo tiempo?"\nRespuesta: "Clima normal."\n"¿Eso existe?" 🥶',
      '¿Qué hace un venezolano cuando tiene luz?\nCarga todos los teléfonos, el Wi-Fi, la nevera y la batería del carro. 🔋',
    ];
    c.reply(`😂 *CHISTE VENEZOLANO*\n\n${U.pick(chistes)}`);
  }, ['chisteve', 'chiste_criollo', 'humor_ve']),

  mk('proverbio_ve', 'Proverbio venezolano popular', '', (c) => {
    const proverbios = [
      '"El que no llora, no mama." — A veces hay que pedir para recibir.',
      '"Camarón que se duerme, se lo lleva la corriente." — Hay que estar siempre alerta.',
      '"El que parte y reparte, se queda con la mejor parte." — Clásico del que distribuye.',
      '"A caballo regalado no se le miran los dientes." — No critiques lo que te dan gratis.',
      '"Más se perdió en la guerra." — Las cosas siempre pueden estar peor.',
      '"El pez grande se come al chico." — Los poderosos siempre se imponen.',
      '"Ojos que no ven, corazón que no siente." — Lo que no sabes no duele.',
    ];
    c.reply(`📜 *PROVERBIO VENEZOLANO*\n\n${U.pick(proverbios)}`);
  }, ['dichos_ve', 'refranes_ve', 'sabiduria_ve']),

  mk('musica_ve', 'Géneros y artistas musicales venezolanos', '', (c) => {
    const artistas = [
      { g: 'Joropo', a: 'Simón Díaz, Lilia Vera, Los Hermanos Morillo' },
      { g: 'Salsa', a: 'Oscar D\'León, Maracaibo 15, Dimensión Latina' },
      { g: 'Merengue', a: 'Los Amigos Invisibles, Chino & Nacho' },
      { g: 'Gaita Zuliana', a: 'Guaco, Maracaibo 15, Lila Morillo' },
      { g: 'Pop venezolano', a: 'Franco De Vita, Karina, Ricardo Montaner' },
      { g: 'Reggaeton VE', a: 'Jhay Cortez (VE), Wolfine, Micro TDH' },
      { g: 'Rock venezolano', a: 'Desorden Público, Témpano, Los Amigos Invisibles' },
    ];
    const a = U.pick(artistas);
    c.reply(`🎵 *MÚSICA VENEZOLANA*\n\n*Género: ${a.g}*\nArtistas: ${a.a}\n\n🇻🇪 ¡Orgullo nacional!`);
  }, ['artistas_ve', 'generos_ve', 'musica_venezolana']),

  mk('historia_ve', 'Dato histórico de Venezuela', '', (c) => {
    const datos = [
      '🇻🇪 Venezuela declaró su independencia el *5 de julio de 1811*, siendo una de las primeras repúblicas de América del Sur.',
      '⚔️ La *Batalla de Carabobo* (1821) fue decisiva para la independencia. Simón Bolívar lideró la victoria contra las fuerzas realistas.',
      '💧 El *Salto Ángel* (Kerepakupai Vená) es la catarata más alta del mundo con 979 metros, ubicada en el Parque Nacional Canaima.',
      '🛢️ Venezuela posee las *mayores reservas probadas de petróleo* del mundo según la OPEC.',
      '🏛️ *Simón Bolívar* nació en Caracas el 24 de julio de 1783. Liberó a Venezuela, Colombia, Ecuador, Perú y Bolivia.',
      '🎓 La *Universidad Central de Venezuela* (UCV), fundada en 1721, es Patrimonio de la Humanidad por la UNESCO.',
      '🌿 Venezuela tiene 43 *parques nacionales*, que representan más del 15% del territorio nacional.',
    ];
    c.reply(`📚 *DATO HISTÓRICO DE VENEZUELA*\n\n${U.pick(datos)}`);
  }, ['historia_venezuela', 'datove', 've_historia']),

  mk('personaje_ve', 'Personaje histórico venezolano', '', (c) => {
    const personajes = [
      { n: 'Simón Bolívar', d: 'El Libertador. Nació en Caracas (1783). Independizó Venezuela, Colombia, Ecuador, Perú y Bolivia.' },
      { n: 'Francisco Miranda', d: 'Precursor de la independencia. Fue el primer venezolano que usó la bandera tricolor.' },
      { n: 'Andrés Bello', d: 'Poeta, filósofo y jurista. Fundador de la Universidad de Chile. Padre de la gramática hispanoamericana.' },
      { n: 'Romulo Gallegos', d: 'Escritor y político. Autor de "Doña Bárbara", primera novela latinoamericana de fama mundial.' },
      { n: 'Teresa Carreño', d: 'Pianista de clase mundial, llamada "La Valquiria del Piano". Nació en 1853 en Caracas.' },
      { n: 'José Gregorio Hernández', d: 'Médico y beato. "El médico de los pobres". Canonizado en proceso ante el Vaticano.' },
    ];
    const p = U.pick(personajes);
    c.reply(`🏅 *PERSONAJE VENEZOLANO*\n\n*${p.n}*\n${p.d}`);
  }, ['figura_ve', 'heroe_ve', 'venezolano_famoso']),

  mk('animales_ve', 'Animales endémicos o icónicos de Venezuela', '', (c) => {
    const animales = [
      { n: 'Turpial', d: 'Ave nacional de Venezuela. Pecho amarillo brillante, negro y blanco. Canta hermosamente.' },
      { n: 'Araguato', d: 'Mono aullador venezolano. Su rugido se escucha a kilómetros en la selva.' },
      { n: 'Danta', d: 'El tapir venezolano. Mamífero acuático que vive en selvas y ríos.' },
      { n: 'Tonina del Orinoco', d: 'Delfín de río rosado que habita el Orinoco. Especie en peligro crítico.' },
      { n: 'Caimán del Orinoco', d: 'Uno de los cocodrilianos más grandes del mundo. Casi extinto, en recuperación.' },
      { n: 'Oso Frontino', d: 'El único oso de Sudamérica. Habita los Andes venezolanos. En peligro.' },
    ];
    const a = U.pick(animales);
    c.reply(`🦜 *ANIMAL DE VENEZUELA*\n\n*${a.n}*\n${a.d}`);
  }, ['fauna_ve', 'animales_venezolanos', 'biodiversidad_ve']),

  mk('gaita', 'Una gaita zuliana para el grupo', '', (c) => {
    const gaitas = [
      { n: 'Llegó la Navidad', a: 'Guaco', letra: '"¡Llegó la Navidad!\n¡Y hay que celebrar!\nQue la familia está reunida\ny hay que disfrutar!"' },
      { n: 'Noches de Caracas', a: 'Maracaibo 15', letra: '"Caracas, ciudad de contrastes\ndonde el barrio sube al cerro\ny el amor no tiene precio..."' },
      { n: 'La Gaita del Solar', a: 'Tradicional', letra: '"Ay, ¡qué gaita tan bonita!\nla que vino del solar,\ncon su ritmo y con su fuerza\nnos invita a celebrar!"' },
    ];
    const g = U.pick(gaitas);
    c.reply(`🎺 *GAITA ZULIANA*\n\n*${g.n}* — ${g.a}\n\n${g.letra}\n\n_¡Que viva la gaita, chamo! 🎶_`);
  }, ['gaitazuliana', 'gaitanavidad', 'musica_navidad']),

  mk('navidad_ve', 'Tradiciones navideñas venezolanas', '', (c) => {
    const tradiciones = [
      '🎄 *Hallacas*: Cada familia tiene su receta secreta. Se hacen en grupo (la "hallacada") como tradición familiar.',
      '🎺 *Gaitas Zulianas*: La música navideña venezolana. Empieza a sonar desde octubre/noviembre.',
      '⛸️ *Patinatas en Caracas*: En diciembre, la gente patina hacia la misa de Aguinaldo (5am).',
      '🍽️ *Pan de Jamón*: Pan enrollado relleno de jamón, aceitunas y pasas. Infaltable en Navidad.',
      '🎁 *Pesebre*: Escenas del nacimiento de Jesús que se arman con figuras de barro.',
      '🥂 *Ponche Crema*: Bebida alcohólica cremosa venezolana, la del brindis navideño.',
    ];
    c.reply(`🎄 *NAVIDAD VENEZOLANA*\n\n${U.pick(tradiciones)}`);
  }, ['navidad_venezuela', 'diciembre_ve', 'tradiciones_ve']),

  mk('futbol_ve', 'Datos del fútbol venezolano', '', (c) => {
    const datos = [
      '⚽ La Vinotinto logró su primera clasificación a una Copa América Sub-20 en 2017, ganando el torneo.',
      '🏆 El Caracas FC es el club más ganador de Venezuela. Ha ganado más de 15 títulos nacionales.',
      '⭐ Salomón Rondón es el máximo goleador histórico de la selección venezolana de fútbol.',
      '🌟 Josef Martínez ganó el récord de goles en una temporada de la MLS con 31 goles en 2018.',
      '🏟️ El Estadio Olímpico de la UCV en Caracas es el principal recinto del fútbol venezolano.',
    ];
    c.reply(`⚽ *FÚTBOL VENEZOLANO*\n\n${U.pick(datos)}\n\n🇻🇪 ¡Arriba la Vinotinto!`);
  }, ['vinotinto', 'football_ve', 'deporte_ve']),

  mk('venezuela_curiosa', 'Dato curioso poco conocido de Venezuela', '', (c) => {
    const datos = [
      '🌍 Venezuela fue el primer país latinoamericano en abolir la pena de muerte, en 1863.',
      '🛢️ El nombre "Venezuela" significa "pequeña Venecia" — los exploradores vieron las casas palafíticas del Lago de Maracaibo.',
      '🌊 El Lago de Maracaibo tiene un fenómeno único: el *Relámpago del Catatumbo*, que ocurre hasta 260 noches al año.',
      '🦆 Venezuela tiene la mayor diversidad de aves del mundo por área: más de 1,400 especies.',
      '🎓 Venezuela fue el primer país del mundo en eliminar completamente el analfabetismo en 2005 (según la UNESCO).',
      '🌿 El Tepuy Roraima inspiró el libro "El Mundo Perdido" de Arthur Conan Doyle (el autor de Sherlock Holmes).',
      '🍫 El mejor cacao del mundo es venezolano — el "Chuao" es considerado el chocolate más fino del planeta.',
    ];
    c.reply(`🇻🇪 *DATO CURIOSO DE VENEZUELA*\n\n${U.pick(datos)}`);
  }, ['curiosidad_ve', 'dato_ve', 'venezuela_fact']),

  mk('cocina_ve', 'Receta rápida de un plato venezolano', '', (c) => {
    const recetas = [
      { n: 'Caraotas Negras', ing: 'Frijoles negros, ajo, cebolla, pimentón, sal, comino', pasos: '1. Remojar las caraotas. 2. Cocinar en agua. 3. Sofreír los aliños. 4. Mezclar. Servir con arroz.' },
      { n: 'Tequeños', ing: 'Harina de trigo, mantequilla, queso blanco duro, huevo, sal', pasos: '1. Hacer masa con harina+mantequilla. 2. Envolver queso. 3. Freír hasta dorar.' },
      { n: 'Cachapas', ing: 'Maíz tierno, azúcar, sal, mantequilla, queso de mano', pasos: '1. Licuar el maíz. 2. Cocinar en budare o sartén. 3. Doblar con queso adentro.' },
    ];
    const r = U.pick(recetas);
    c.reply(`👨‍🍳 *RECETA VENEZOLANA: ${r.n}*\n\n🧂 Ingredientes: ${r.ing}\n\n📋 Pasos: ${r.pasos}`);
  }, ['receta_ve', 'cocinave', 'plato_receta']),
];
