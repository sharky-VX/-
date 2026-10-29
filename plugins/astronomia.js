// ═══════════════════════════════════════════════
//  ASTRONOMIA + CIENCIA — Espacio, planetas,
//  física, datos científicos curiosos
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'ciencia', ...extra, run });

module.exports = [
  mk('planeta', 'Info de un planeta del sistema solar', '<nombre>', (c) => {
    const planetas = {
      mercurio: { d: '🌑 El planeta más cercano al Sol. Un año dura 88 días terrestres. Sin atmósfera significativa.', datos: 'Diámetro: 4,879 km | Lunas: 0 | Temp: -180°C a 430°C' },
      venus: { d: '🌕 El más caliente del sistema solar a pesar de no ser el más cercano al Sol. Rotación inversa.', datos: 'Diámetro: 12,104 km | Lunas: 0 | Temp: ~465°C' },
      tierra: { d: '🌍 El único planeta conocido con vida. 71% de superficie cubierta de agua.', datos: 'Diámetro: 12,742 km | Lunas: 1 | Temp promedio: 15°C' },
      marte: { d: '🔴 El Planeta Rojo. Tiene el volcán más alto del sistema solar: Olympus Mons.', datos: 'Diámetro: 6,779 km | Lunas: 2 | Temp: -153°C a 20°C' },
      jupiter: { d: '🪐 El planeta más grande. Su Gran Mancha Roja es una tormenta más grande que la Tierra.', datos: 'Diámetro: 139,820 km | Lunas: 95+ | No tiene superficie sólida' },
      saturno: { d: '💫 Conocido por sus espectaculares anillos de hielo y roca. Menos denso que el agua.', datos: 'Diámetro: 116,460 km | Lunas: 146+ | Anillos: sí' },
      urano: { d: '🔵 Rota de lado — su eje está inclinado casi 98°. Planetas de hielo.', datos: 'Diámetro: 50,724 km | Lunas: 27 | Temp: -224°C' },
      neptuno: { d: '🌊 El planeta más lejano. Vientos de hasta 2,100 km/h, los más fuertes del sistema solar.', datos: 'Diámetro: 49,244 km | Lunas: 16 | Un año: 165 años terrestres' },
    };
    if (!c.q) return c.reply(`🪐 Planetas disponibles:\n${Object.keys(planetas).join(', ')}\n\nUsa .planeta <nombre>`);
    const key = c.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const p = Object.entries(planetas).find(([k]) => k.startsWith(key.slice(0, 4)));
    if (!p) return c.reply(`No encontré ese planeta. Disponibles: ${Object.keys(planetas).join(', ')}`);
    c.reply(`🌌 *${p[0].toUpperCase()}*\n\n${p[1].d}\n\n📊 ${p[1].datos}`);
  }, ['planetainfo', 'system_solar', 'solarsys']),

  mk('estrella', 'Información sobre una estrella famosa', '[nombre]', (c) => {
    const estrellas = [
      { n: 'Betelgeuse', d: 'Supergigante roja en Orión. Tan grande que si reemplazara al Sol, llegaría hasta Júpiter. Se espera que explote como supernova.' },
      { n: 'Sirio', d: 'La estrella más brillante del cielo nocturno. A solo 8.6 años luz. En realidad son dos estrellas (Sirio A y B).' },
      { n: 'Proxima Centauri', d: 'La estrella más cercana al Sol, a 4.24 años luz. Una enana roja con un planeta potencialmente habitable.' },
      { n: 'Rigel', d: 'Supergigante azul blanca, también en Orión. 120,000 veces más luminosa que el Sol.' },
      { n: 'Vega', d: 'Estrella brillante a 25 años luz. Fue la Estrella Polar hace 14,000 años y lo será de nuevo.' },
      { n: 'Antares', d: 'Supergigante roja en Escorpión. Tiene ~700 veces el diámetro del Sol.' },
    ];
    const e = c.q ? estrellas.find(x => x.n.toLowerCase().includes(c.q.toLowerCase())) || U.pick(estrellas) : U.pick(estrellas);
    c.reply(`⭐ *${e.n}*\n\n${e.d}`);
  }, ['estrellainfo', 'starinfo', 'astro_star']),

  mk('galaxia', 'Información sobre galaxias', '[nombre]', (c) => {
    const galaxias = [
      { n: 'Vía Láctea', d: 'Nuestra galaxia. ~200-400 mil millones de estrellas. El Sol está a 26,000 años luz del centro.' },
      { n: 'Andrómeda (M31)', d: 'La galaxia espiral más cercana, a 2.5 millones de años luz. Chocará con la Vía Láctea en ~4,500 millones de años.' },
      { n: 'Gran Nube de Magallanes', d: 'Galaxia satélite de la Vía Láctea visible a ojo desnudo desde el hemisferio sur. A 160,000 años luz.' },
      { n: 'El Sombrero (M104)', d: 'Galaxia con forma de sombrero. Tiene un núcleo brillante y un anillo de polvo prominente.' },
    ];
    const g = c.q ? galaxias.find(x => x.n.toLowerCase().includes(c.q.toLowerCase())) || U.pick(galaxias) : U.pick(galaxias);
    c.reply(`🌌 *GALAXIA: ${g.n}*\n\n${g.d}`);
  }, ['galaxiainfo', 'cosmos', 'universo_galaxia']),

  mk('hoyo_negro', 'Información sobre agujeros negros', '', (c) => {
    const datos = [
      'Un agujero negro tiene gravedad tan intensa que nada, ni la luz, puede escapar de él una vez cruzado el horizonte de eventos.',
      'El agujero negro Sagitario A* está en el centro de la Vía Láctea y tiene masa de ~4 millones de soles.',
      'M87*, el primer agujero negro fotografiado (2019), tiene masa equivalente a 6,500 millones de soles.',
      'El tiempo se dilata cerca de un agujero negro — pasar tiempo cerca de uno haría que envejecieras más lento que el resto del universo.',
      'Los "espaguetis" es como los científicos llaman al efecto que tendría un agujero negro en tu cuerpo: te estiraría literalmente.',
    ];
    c.reply(`🕳️ *AGUJERO NEGRO*\n\n${U.pick(datos)}`);
  }, ['blackhole', 'agujero_negro', 'hoyo_negro_info']),

  mk('espacio_curiosa', 'Dato curioso del espacio', '', (c) => {
    const datos = [
      '🌙 Si pudieras conducir un coche hacia el espacio a 100 km/h, llegarías a la Luna en unos 160 días.',
      '☀️ La luz del Sol tarda ~8 minutos en llegar a la Tierra, pero ~100,000 años en llegar desde el núcleo del Sol hasta su superficie.',
      '🌌 Hay más estrellas en el universo observable que granos de arena en todas las playas de la Tierra.',
      '🚀 El espacio comienza oficialmente a 100 km de altura (Línea de Kármán). Puedes llegar en teoría en un cohete en minutos.',
      '🌠 El ruido no existe en el espacio — no hay moléculas de aire que transmitan el sonido.',
      '🪐 Un día en Saturno dura solo ~10.7 horas, aunque su año tiene 29 años terrestres.',
      '🌑 La Luna se aleja de la Tierra ~3.8 cm cada año.',
    ];
    c.reply(`🔭 *DATO CURIOSO DEL ESPACIO*\n\n${U.pick(datos)}`);
  }, ['dato_espacio', 'space_fact', 'universo_dato']),

  mk('cohete', 'Historia de los cohetes y exploración espacial', '', (c) => {
    const hitos = [
      '1957: Sputnik 1 — primer satélite artificial en órbita (URSS)',
      '1961: Yuri Gagarin — primer humano en el espacio (URSS)',
      '1969: Apollo 11 — primeros humanos en la Luna (EE.UU.)',
      '1971: Primera estación espacial — Salyut 1 (URSS)',
      '1990: Telescopio Hubble lanzado — reveló el universo profundo',
      '1998: Inicio de la Estación Espacial Internacional (ISS)',
      '2012: Rover Curiosity llega a Marte (NASA)',
      '2021: Primer vuelo controlado en Marte — dron Ingenuity',
      '2022: Telescopio James Webb — imágenes más profundas del universo',
    ];
    c.reply(`🚀 *HITO ESPACIAL*\n\n🗓️ ${U.pick(hitos)}`);
  }, ['espaciohistoria', 'rocket', 'nasa_historia']),

  mk('atom', 'Información sobre la estructura del átomo', '', (c) => {
    c.reply(`⚛️ *EL ÁTOMO*\n\nEl átomo es la unidad básica de la materia. Tiene tres partes:\n\n• 🔴 *Protones* (+): en el núcleo, determinan el elemento\n• ⚪ *Neutrones* (0): en el núcleo, dan estabilidad\n• 🔵 *Electrones* (-): en la nube electrónica, determinan los enlaces\n\n💡 Si el átomo fuera del tamaño de un estadio de fútbol, el núcleo sería del tamaño de un guisante — el resto es vacío.\n\n_La mayoría de la materia es espacio vacío._`);
  }, ['atomo', 'particula', 'quimica_basica']),

  mk('elemento', 'Información de un elemento químico', '<símbolo o nombre>', (c) => {
    const elementos = {
      h: { n: 'Hidrógeno', s: 'H', na: 1, d: 'El elemento más abundante del universo. Combustible de las estrellas.' },
      he: { n: 'Helio', s: 'He', na: 2, d: 'Gas noble inerte. Hace que tu voz suene aguda si lo inhalas (¡no recomendado!).' },
      c: { n: 'Carbono', s: 'C', na: 6, d: 'Base de toda la vida conocida. El diamante y el grafito son formas puras de carbono.' },
      o: { n: 'Oxígeno', s: 'O', na: 8, d: 'Esencial para la vida. 21% de la atmósfera terrestre.' },
      n: { n: 'Nitrógeno', s: 'N', na: 7, d: '78% de la atmósfera. Esencial en proteínas y ADN.' },
      fe: { n: 'Hierro', s: 'Fe', na: 26, d: 'El metal más usado. Núcleo de la Tierra. Pigmento de la sangre (hemoglobina).' },
      au: { n: 'Oro', s: 'Au', na: 79, d: 'Metal precioso que no se oxida. Se forma en explosiones de supernovas y colisiones de estrellas de neutrones.' },
      ag: { n: 'Plata', s: 'Ag', na: 47, d: 'El mejor conductor eléctrico y térmico de todos los metales.' },
    };
    if (!c.q) return c.reply(`⚗️ Elementos disponibles: ${Object.values(elementos).map(e => `${e.s} (${e.n})`).join(', ')}\n\nEjemplo: .elemento Fe`);
    const key = c.q.toLowerCase();
    const e = elementos[key] || Object.values(elementos).find(x => x.n.toLowerCase().includes(key));
    if (!e) return c.reply('Elemento no encontrado. Prueba con: H, He, C, O, N, Fe, Au, Ag');
    c.reply(`⚗️ *${e.n} (${e.s})*\n\n🔢 Número atómico: ${e.na}\n📝 ${e.d}`);
  }, ['elementoquimico', 'quimica', 'periodica']),

  mk('fuerza', 'Las 4 fuerzas fundamentales de la física', '', (c) => {
    const fuerzas = [
      { n: 'Fuerza Gravitacional', d: 'La más débil pero de alcance infinito. Mantiene planetas en órbita y galaxias unidas.' },
      { n: 'Fuerza Electromagnética', d: 'Responsable de la electricidad, magnetismo y la luz. 10^36 veces más fuerte que la gravedad.' },
      { n: 'Fuerza Nuclear Fuerte', d: 'La más poderosa. Mantiene unido el núcleo atómico. Solo actúa a escala subatómica.' },
      { n: 'Fuerza Nuclear Débil', d: 'Responsable de la desintegración radioactiva. Convierte neutrones en protones.' },
    ];
    const f = U.pick(fuerzas);
    c.reply(`⚡ *FUERZA FUNDAMENTAL: ${f.n}*\n\n${f.d}`);
  }, ['fuerzas_fisicas', 'fisica_basica', 'fisica_fuerza']),

  mk('luz', 'Datos sobre la luz y el espectro electromagnético', '', (c) => {
    c.reply(`💡 *LA LUZ*\n\n🚀 Velocidad: 299,792,458 m/s (186,000 millas/segundo)\n\n🌈 El espectro visible es solo una pequeña parte:\nRadio → Microondas → Infrarrojo → *Visible* → UV → Rayos X → Gamma\n\n💡 Datos curiosos:\n• La luz del Sol tiene 8 min de viaje hasta la Tierra\n• La luz viaja más lento en el agua y cristal\n• Nada conocido viaja más rápido que la luz en el vacío\n• Un año luz = 9.46 billones de km`);
  }, ['velocidad_luz', 'optica', 'espectro']),

  mk('adn', 'Información sobre el ADN', '', (c) => {
    c.reply(`🧬 *ADN — ÁCIDO DESOXIRRIBONUCLEICO*\n\nEl ADN es el manual de instrucciones de todos los seres vivos.\n\n📊 Datos:\n• El ADN humano tiene ~3,000 millones de pares de bases\n• Si extendieras todo el ADN de una célula, mediría ~2 metros\n• El ADN humano y el de un chimpancé son 98.7% idénticos\n• El 99.9% del ADN es igual en todos los humanos\n• Solo el 1.5% del ADN codifica proteínas\n\n🔬 La doble hélice fue descubierta por Watson y Crick en 1953 (con datos clave de Rosalind Franklin).`);
  }, ['genes', 'genetica', 'adn_info']),

  mk('dinosaurio', 'Información sobre dinosaurios', '[especie]', (c) => {
    const dinos = [
      { n: 'Tyrannosaurus Rex', d: 'El rey de los dinosaurios carnívoros. ~13m de largo, 9 toneladas. Sus brazos eran diminutos pero su mordida era devastadora.' },
      { n: 'Velociraptor', d: 'Era en realidad del tamaño de un pavo y tenía plumas. Los raptores de Jurassic Park son Deinonychus, no Velociraptors reales.' },
      { n: 'Brachiosaurus', d: 'Uno de los dinosaurios más grandes. Comía exclusivamente plantas. Cuello de 9 metros para llegar a copas de árboles.' },
      { n: 'Triceratops', d: 'Herbívoro con tres cuernos. Su cráneo y gorguera eran posiblemente para comunicación y reconocimiento social.' },
      { n: 'Pterodactyl (Pterodáctilo)', d: 'No era un dinosaurio sino un reptil volador (pterosaurio). Los más grandes tenían envergadura de hasta 12 metros.' },
    ];
    const d = c.q ? dinos.find(x => x.n.toLowerCase().includes(c.q.toLowerCase())) || U.pick(dinos) : U.pick(dinos);
    c.reply(`🦕 *${d.n}*\n\n${d.d}`);
  }, ['dino', 'dinosaurioinfo', 'prehistoric']),

  mk('evolucion', 'Datos sobre la evolución de las especies', '', (c) => {
    const datos = [
      'La vida en la Tierra lleva ~3,800 millones de años. Los primeros organismos eran bacterias simples.',
      'Los seres humanos modernos (Homo sapiens) llevan ~300,000 años en la Tierra. El universo tiene 13,800 millones de años.',
      'El 99% de todas las especies que han existido en la Tierra están extintas.',
      'Las aves son los únicos dinosaurios que sobrevivieron la extinción masiva hace 66 millones de años.',
      'Los pulpos desarrollaron ojos similares a los humanos de forma completamente independiente — convergencia evolutiva.',
      'El ancestro común más reciente entre humanos y hongos vivió hace unos 1,000 millones de años.',
    ];
    c.reply(`🐟 *EVOLUCIÓN*\n\n${U.pick(datos)}`);
  }, ['darwinismo', 'biologia_evolucion', 'species']),

  mk('clima_ciencia', 'La ciencia detrás del clima y el cambio climático', '', (c) => {
    c.reply(`🌡️ *CAMBIO CLIMÁTICO — LA CIENCIA*\n\n🔬 Qué es el efecto invernadero:\nCiertos gases (CO₂, metano, vapor de agua) atrapan el calor del Sol en la atmósfera como un invernadero.\n\n📊 Datos actuales:\n• La temperatura global ha aumentado ~1.1°C desde la era preindustrial\n• El CO₂ atmosférico es el más alto en 800,000 años\n• El nivel del mar sube ~3.3mm por año\n\n🌱 Principales causas antropogénicas:\n• Combustibles fósiles (75% emisiones)\n• Deforestación\n• Ganadería industrial\n\n_Fuente: IPCC, NASA, NOAA_`);
  }, ['calentamiento_global', 'cambio_climatico', 'efectoinvernadero']),

  mk('quantum', 'Introducción a la física cuántica', '', (c) => {
    const conceptos = [
      '⚛️ *Superposición*: Un objeto cuántico puede estar en múltiples estados a la vez hasta que es observado. Como el Gato de Schrödinger.',
      '🔗 *Entrelazamiento*: Dos partículas pueden estar "conectadas" de tal forma que al medir una, instantáneamente sabes el estado de la otra, sin importar la distancia.',
      '🌊 *Dualidad onda-partícula*: La luz y los electrones se comportan como onda O como partícula dependiendo de cómo los midas. Nunca los dos a la vez.',
      '🎲 *Principio de Incertidumbre (Heisenberg)*: No puedes conocer con precisión la posición y la velocidad de una partícula al mismo tiempo.',
    ];
    c.reply(`⚛️ *FÍSICA CUÁNTICA*\n\n${U.pick(conceptos)}`);
  }, ['cuantica', 'quantumphysics', 'fisica_cuantica']),

  mk('matematica_curiosa', 'Un dato curioso de matemáticas', '', (c) => {
    const datos = [
      '🔢 El número 0.999... (con infinitos 9) es exactamente igual a 1. No "casi" 1 — es literalmente 1.',
      '♾️ Hay diferentes tamaños de infinito. El infinito de los números reales es "más grande" que el de los enteros.',
      '🌀 Los números de Fibonacci aparecen en caracoles, flores, piñas y muchos patrones de la naturaleza.',
      '🎲 Si tienes un grupo de 23 personas, hay más del 50% de probabilidad de que dos compartan el mismo cumpleaños (Paradoja del cumpleaños).',
      '🔢 El número Pi (π) no termina nunca y no tiene patrón repetible. En sus primeros 31 billones de decimales no se ha encontrado ningún ciclo.',
      '🧮 El número primo más grande conocido tiene más de 24 millones de dígitos.',
    ];
    c.reply(`🔢 *DATO CURIOSO — MATEMÁTICAS*\n\n${U.pick(datos)}`);
  }, ['math_curiosa', 'matematica_dato', 'numero_curioso']),
];
