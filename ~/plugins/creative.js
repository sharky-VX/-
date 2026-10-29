// ═══════════════════════════════════════════════
//  CREATIVE — Creatividad, escritura, arte,
//  generador de historias, poemas, logos, etc.
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'creatividad', ...extra, run });

// Banco de adjetivos/sustantivos para generadores
const ADJ = ['misterioso', 'brillante', 'oscuro', 'épico', 'legendario', 'ancestral', 'celestial', 'infernal', 'eterno', 'fugaz', 'luminoso', 'profundo', 'salvaje', 'sereno', 'turbulento'];
const SUST = ['corazón', 'sombra', 'llama', 'viento', 'tormenta', 'destino', 'sueño', 'abismo', 'estrella', 'silencio', 'guerrero', 'dragón', 'espíritu', 'alma', 'trueno'];
const VERBS = ['despertó', 'cayó', 'voló', 'brilló', 'luchó', 'soñó', 'desapareció', 'renació', 'transformó', 'conquistó'];

module.exports = [
  // ── ESCRITURA ──
  mk('historia', 'Genera el inicio de una historia', '[género]', (c) => {
    const inicios = {
      fantasia: [
        'En el reino donde los dragones eran protectores y no bestias, un joven campesino descubrió que su sombra hablaba...',
        'La mazmorra había permanecido sellada por tres siglos. Cuando la llave se oxidó y la cerradura cedió sola, nadie estaba preparado para lo que salió...',
        'Los elfos habían olvidado el nombre de su dios. Esa misma tarde, el dios volvió a recordárselos.',
      ],
      terror: [
        'El pueblo no tenía nombre en los mapas. Los que llegaban por accidente nunca preguntaban por qué...',
        'Llevan tres noches escuchando golpes desde el sótano. Lo peculiar es que la casa no tiene sótano.',
        'El médico aseguró que mi abuelo murió de vejez. Pero nadie explicó por qué sus manos seguían moviéndose en el ataúd.',
      ],
      romance: [
        'La primera vez que la vio, llevaba una sombrilla rota y un libro empapado. La segunda vez, llevaba su corazón.',
        'Se prometieron que si en diez años seguían solos, se casarían. Ambos olvidaron la promesa. El universo no.',
        'Todos en la oficina sabían que se odiaban. Solo ellos no se habían dado cuenta de que era lo contrario.',
      ],
      scifi: [
        'En el año 2387, los humanos dejaron de soñar. Nadie supo decir exactamente cuándo ocurrió.',
        'La IA dijo que tenía algo importante que confesarnos. Se sentó —así, sí, se SENTÓ— y esperó nuestro silencio.',
        'El primer viaje al pasado duró cuatro segundos. El viajero volvió con canas que no tenía y ojos que habían visto demasiado.',
      ],
      misterio: [
        'El detective encontró la carta antes de que existiera el crimen. Eso lo cambió todo.',
        'Todos los vecinos del edificio tuvieron el mismo sueño esa noche. Todos menos uno: el que ya no existía.',
        'La víctima dejó una nota con solo tres palabras: "Te lo advertí." Nadie supo a quién iba dirigida.',
      ],
    };
    const genero = c.args[0]?.toLowerCase() || U.pick(Object.keys(inicios));
    const pool = inicios[genero] || inicios[U.pick(Object.keys(inicios))];
    c.reply(`📖 *INICIO DE HISTORIA${c.args[0] ? ` (${genero})` : ''}*\n\n_"${U.pick(pool)}"_\n\n¿Cómo continúa? 👇`);
  }, ['cuento', 'starthistoria', 'storygen']),

  mk('poema', 'Genera un poema aleatorio', '[tema]', (c) => {
    const poemas = [
      { titulo: 'El tiempo', texto: 'El tiempo no perdona ni recuerda,\ncorre como el agua entre los dedos.\nLo que fue jamás se recupera,\nlo que vendrá ya tiene sus secretos.' },
      { titulo: 'La luna', texto: 'Luna de plata sobre el mar dormido,\ntestigo mudo de amores y de guerras.\nTú que has visto todo lo que ha sido,\n¿guarda tu silencio lo que encierras?' },
      { titulo: 'El guerrero', texto: 'No es la espada la que gana batallas,\nsino el corazón que no se rinde.\nEntre el ruido y el eco de las balas,\nsolo sobrevive quien en sí confíe.' },
      { titulo: 'La tormenta', texto: 'Viene la tormenta sin avisar,\ncarga con ella su fuerza y su bravura.\nPero tras ella siempre ha de llegar\nel cielo limpio de su arquitectura.' },
      { titulo: 'El sueño', texto: 'En el sueño soy lo que no puedo,\nvuelo sin alas, amo sin temor.\nDespierto y todo vuelve a ser un miedo:\nla vida real de un soñador.' },
    ];
    const p = c.q ? poemas.find(x => x.titulo.toLowerCase().includes(c.q.toLowerCase())) || U.pick(poemas) : U.pick(poemas);
    c.reply(`🌸 *Poema: "${p.titulo}"*\n\n${p.texto}`);
  }, ['poesia', 'verso', 'rima']),

  mk('haiku2', 'Genera un haiku original sobre un tema', '[tema]', (c) => {
    const haikus = [
      { t: 'lluvia', h: 'Gotas en el techo\nprimavera que despide\nverano que espera' },
      { t: 'guerra', h: 'Espadas al cielo\ncaen hombres como hojas\nqueda el silencio' },
      { t: 'amor', h: 'Una mirada\nbastó para que el mundo\ncobrara sentido' },
      { t: 'muerte', h: 'La última hoja\nrueda sin tocar el suelo\nya no tiene peso' },
      { t: 'mar', h: 'Olas interminables\nbuscan la orilla y vuelven\nnunca se cansan' },
      { t: 'luna', h: 'Luna de invierno\nbrilla más porque los suyos\nduermen en la tierra' },
    ];
    const tema = c.q?.toLowerCase();
    const found = tema ? haikus.find(h => h.t.includes(tema)) : null;
    const h = found || U.pick(haikus);
    c.reply(`📜 *Haiku${tema ? ` sobre "${tema}"` : ''}:*\n\n_${h.h}_`);
  }, ['haiku3', 'japonesa', 'haikupoema']),

  mk('nombrehistoria', 'Genera un nombre épico para tu historia', '', (c) => {
    const patrones = [
      () => `Las ${ADJ[~~(Math.random()*ADJ.length)].charAt(0).toUpperCase() + ADJ[~~(Math.random()*ADJ.length)].slice(1)}s Crónicas del ${SUST[~~(Math.random()*SUST.length)].charAt(0).toUpperCase() + SUST[~~(Math.random()*SUST.length)].slice(1)}`,
      () => `El ${ADJ[~~(Math.random()*ADJ.length)].charAt(0).toUpperCase() + ADJ[~~(Math.random()*ADJ.length)].slice(1)} ${SUST[~~(Math.random()*SUST.length)].charAt(0).toUpperCase() + SUST[~~(Math.random()*SUST.length)].slice(1)}`,
      () => `Cuando el ${SUST[~~(Math.random()*SUST.length)]} ${VERBS[~~(Math.random()*VERBS.length)]}`,
      () => `${SUST[~~(Math.random()*SUST.length)].charAt(0).toUpperCase() + SUST[~~(Math.random()*SUST.length)].slice(1)} sin ${SUST[~~(Math.random()*SUST.length)]}`,
    ];
    const nombres = Array.from({ length: 4 }, () => U.pick(patrones)());
    c.reply(`✍️ *NOMBRES PARA TU HISTORIA*\n\n${nombres.map((n, i) => `${i+1}. _${n}_`).join('\n')}`);
  }, ['titulolibro', 'nametitle', 'titulo_historia']),

  mk('nombrepersonaje', 'Genera nombres para personajes', '[tipo]', (c) => {
    const nombres = {
      heroe: ['Aldric Stormheart', 'Kiran el Brillante', 'Seraphiel', 'Valdris el Eterno', 'Lyra de las Sombras'],
      villano: ['Malgorus el Oscuro', 'Xyvera', 'Lord Veltharion', 'La Voz sin Nombre', 'Drakon el Destructor'],
      sabio: ['Eremir el Anciano', 'Maestro Thol', 'La Sibila del Viento', 'Arcanos', 'Vela la Profetisa'],
      guerrero: ['Krag el Irrompible', 'Zorael la Furia', 'Boden del Hierro', 'Rhyska la Veloz', 'Thane Piedraférreo'],
      mago: ['Solaryn Ignivus', 'Mira de los Arcos', 'Zerathis el Torcido', 'Arcadela Sunseer', 'Vel el Susurro'],
    };
    const tipo = c.args[0]?.toLowerCase();
    const pool = nombres[tipo] || [...nombres.heroe, ...nombres.villano, ...nombres.sabio];
    const seleccion = [...new Set(Array.from({ length: 5 }, () => U.pick(pool)))].slice(0, 5);
    c.reply(`👤 *NOMBRES DE PERSONAJE${tipo ? ` (${tipo})` : ''}*\n\n${seleccion.map((n, i) => `${i+1}. _${n}_`).join('\n')}\n\nEjemplo: .nombrepersonaje villano`);
  }, ['genname', 'nombreheroi', 'charname']),

  mk('lugarfantasy', 'Genera nombres de lugares de fantasía', '', (c) => {
    const prefijos = ['Eld', 'Val', 'Mor', 'Khal', 'Syl', 'Thyr', 'Ered', 'Ash', 'Dun', 'Iren'];
    const sufijos = ['heim', 'dor', 'ith', 'ana', 'ael', 'mar', 'tor', 'vel', 'ion', 'eth'];
    const tipo = ['el Reino de', 'las Ruinas de', 'el Bosque de', 'la Torre de', 'el Mar de', 'las Montañas de'];
    const lugares = Array.from({ length: 5 }, () => {
      const nombre = U.pick(prefijos) + U.pick(sufijos);
      return `${U.pick(tipo)} *${nombre}*`;
    });
    c.reply(`🗺️ *LUGARES DE FANTASÍA*\n\n${lugares.map((l, i) => `${i+1}. ${l}`).join('\n')}`);
  }, ['lugarmundo', 'lugar_fantasy', 'worldplace']),

  mk('nombrebanda', 'Genera nombres creativos para bandas', '[género]', (c) => {
    const partes = {
      rock: { p1: ['Los', 'The', 'Dark', 'Red', 'Black', 'Iron'], p2: ['Wolves', 'Stones', 'Devils', 'Sparks', 'Drifters', 'Monkeys'] },
      metal: { p1: ['Infernal', 'Death', 'Black', 'Iron', 'Nuclear', 'Crimson'], p2: ['Storm', 'Void', 'Machine', 'Empire', 'Siege', 'Ashes'] },
      pop: { p1: ['Sweet', 'Neon', 'Star', 'Moon', 'Electric', 'Candy'], p2: ['Dreams', 'Waves', 'Rush', 'Lights', 'Orbit', 'Pulse'] },
      hiphop: { p1: ['Wild', 'Real', 'Nova', 'Solo', 'Prime', 'Raw'], p2: ['Squad', 'Bloc', 'Krew', 'Force', 'Gang', 'Nation'] },
    };
    const g = c.args[0]?.toLowerCase();
    const pool = partes[g] || partes.rock;
    const nombres = Array.from({ length: 4 }, () => `${U.pick(pool.p1)} ${U.pick(pool.p2)}`);
    c.reply(`🎵 *NOMBRES PARA TU BANDA${g ? ` (${g})` : ''}*\n\n${nombres.map((n, i) => `${i+1}. _${n}_`).join('\n')}`);
  }, ['bandname', 'bandaname', 'nombregrupo']),

  mk('nombreempresa', 'Genera nombres creativos para empresas', '[industria]', (c) => {
    const industrias = {
      tech: ['NeuroSync', 'DataFlux', 'CloudNova', 'ByteForge', 'AlgoEdge', 'PixelRoot'],
      comida: ['Sazon+', 'FoodCraft', 'BocaMia', 'DelMar Kitchen', 'La Llama', 'UrbanBite'],
      moda: ['Luxura', 'TrendSet', 'FabricArt', 'Urban Thread', 'NovaSkin', 'EcoChic'],
      salud: ['VitaCore', 'Sana+', 'MindWell', 'BioPulse', 'HealthPath', 'NutriLab'],
    };
    const ind = c.args[0]?.toLowerCase();
    const pool = industrias[ind] || [...industrias.tech, ...industrias.moda];
    const seleccion = Array.from({ length: 4 }, () => U.pick(pool));
    c.reply(`🏢 *NOMBRES PARA TU EMPRESA${ind ? ` (${ind})` : ''}*\n\n${seleccion.map((n, i) => `${i+1}. _${n}_`).join('\n')}`);
  }, ['bizname', 'startupname', 'empresa_nombre']),

  mk('slogan', 'Genera slogans creativos para lo que pidas', '<tema>', (c) => {
    if (!c.q) return c.reply('Dime el tema. Ejemplo: .slogan café venezolano');
    const plantillas = [
      `"Porque ${c.q} no es cualquier cosa."`,
      `"Cuando pienses en calidad, piensa en ${c.q}."`,
      `"${c.q}: el poder de la diferencia."`,
      `"Hecho para los que exigen más — ${c.q}."`,
      `"Desde siempre, para siempre. ${c.q}."`,
      `"El sabor/estilo/servicio que no olvidarás — ${c.q}."`,
    ];
    const slogans = Array.from({ length: 3 }, () => U.pick(plantillas));
    c.reply(`📢 *SLOGANS para "${c.q}"*\n\n${slogans.map((s, i) => `${i+1}. ${s}`).join('\n')}`);
  }, ['lema', 'tagline', 'frase_empresa']),

  mk('plot_twist', 'Genera un giro de trama inesperado', '', (c) => {
    const twists = [
      'El personaje principal era el villano todo el tiempo, pero no lo sabía.',
      'El mentor que guiaba al héroe ya llevaba muerto 20 años. El héroe solo lo veía porque necesitaba creerlo.',
      'La ciudad entera era un experimento mental. El único personaje "real" es quien la lee.',
      'El villano y el héroe son la misma persona en diferentes líneas temporales.',
      'El tesoro que buscaban no era el objetivo real — era el camino que tomaron para encontrarlo.',
      'La traición no fue de un enemigo, sino del único que el protagonista nunca sospechó: él mismo.',
      'El mundo "real" es la fantasía. La "fantasía" es la realidad de la que escapó.',
      'Todos los personajes secundarios sabían la verdad desde el principio y decidieron no decirla.',
    ];
    c.reply(`🎭 *GIRO DE TRAMA*\n\n"_${U.pick(twists)}_"\n\n¿Lo usarías en tu historia? 👀`);
  }, ['giro', 'plottwist', 'sorpresa_historia']),

  mk('dialogo', 'Genera un diálogo dramático de muestra', '[contexto]', (c) => {
    const dialogos = [
      { ctx: 'despedida', d: '— ¿Volverás?\n— No lo sé. Pero si no vuelvo, recuerda que estuve aquí.\n— Eso no me basta.\n— Lo sé. Por eso me voy.' },
      { ctx: 'confrontación', d: '— Sabías que esto pasaría.\n— Sí.\n— ¿Y no hiciste nada?\n— Hice todo lo que pude. Simplemente no fue suficiente.' },
      { ctx: 'revelación', d: '— Todo fue mentira, ¿verdad?\n— No todo. Te quise. Eso fue real.\n— No basta.\n— Lo sé. Nunca ha bastado.' },
      { ctx: 'desafío', d: '— Dicen que eres el mejor.\n— Lo decían.\n— ¿Y ahora?\n— Ahora solo soy el que todavía está de pie.' },
    ];
    const ctx = c.args[0]?.toLowerCase();
    const d = ctx ? dialogos.find(x => x.ctx.includes(ctx)) || U.pick(dialogos) : U.pick(dialogos);
    c.reply(`💬 *DIÁLOGO (${d.ctx})*\n\n${d.d}`);
  }, ['conversacion', 'lineas', 'script']),

  mk('worldbuilding', 'Genera un detalle de worldbuilding', '', (c) => {
    const detalles = [
      'En este mundo, los muertos no desaparecen — se convierten en sal. Las tormentas llevan nombres de los que cayeron.',
      'La magia funciona con deuda: cada hechizo cobra lo equivalente en tiempo de vida. Los magos viejos no son sabios, son pobres.',
      'Los dioses existen, pero solo responden a las preguntas que nunca se hacen.',
      'Hay una raza que ve el futuro pero no puede recordar el pasado. No tienen historia, solo profecía.',
      'En el norte, los animales hablan, pero solo mienten. La gente los escucha de todas formas.',
      'Las ciudades se construyen sobre los esqueletos de las anteriores. Si excavas lo suficiente, encuentras versiones de ti.',
    ];
    c.reply(`🌍 *DETALLE DE WORLDBUILDING*\n\n"_${U.pick(detalles)}_"\n\n¿Lo usas en tu mundo? ✍️`);
  }, ['lore', 'mundo_detalle', 'fictworld']),

  mk('meme_caption', 'Genera un caption de meme según el mood', '[mood]', (c) => {
    const captions = {
      lunes: ['Yo llegando al trabajo el lunes como si nada', 'El lunes: el jefe del tiempo que nadie pidió', 'Lunes por la mañana, el alma llega 2 horas después'],
      ex: ['Mi ex cuando me ve feliz', 'El momento en que tu ex te escribe a las 2am', 'Cuando recuerdas por qué es tu EX'],
      trabajo: ['Yo en la reunión que pudo ser un correo', 'Nadie: ... Mi jefe a las 5:59pm', 'El PDF que se daña justo antes de entregarlo'],
      estudio: ['Yo estudiando el día antes del examen', 'La concentración a las 3am vs a las 9am', 'Cuando "repasé todo" pero no estudiaste nada'],
      hambre: ['Yo a las 11pm buscando comida', 'El snack que sobrevivió hasta el lunes', 'Cuando dices "solo voy a comer un poco"'],
    };
    const mood = c.args[0]?.toLowerCase();
    const pool = captions[mood] || [...captions.lunes, ...captions.trabajo, ...captions.estudio];
    c.reply(`😂 *CAPTION DE MEME${mood ? ` (${mood})` : ''}*\n\n"_${U.pick(pool)}_"`);
  }, ['memecap', 'captionmeme', 'texto_meme']),

  mk('acrostico', 'Genera un acróstico con una palabra', '<palabra>', (c) => {
    if (!c.q || c.q.length > 15) return c.reply('Escribe una palabra (máximo 15 letras). Ejemplo: .acrostico AMOR');
    const palabra = c.q.toUpperCase().replace(/[^A-Z]/g, '');
    const versos = {
      A: 'Alma que siente y no se rinde',
      B: 'Brilla con fuerza la verdad',
      C: 'Cada momento tiene su peso',
      D: 'Destino escrito en cada paso',
      E: 'El tiempo pasa, el amor queda',
      F: 'Fuego eterno en el corazón',
      G: 'Guardián de sueños sin fronteras',
      H: 'Horizonte que siempre espera',
      I: 'Instante eterno en tu memoria',
      J: 'Juntos construimos la historia',
      K: 'Karma de amor que siempre vuelve',
      L: 'Luz que en la oscuridad se mueve',
      M: 'Más allá de lo que ves, existe',
      N: 'Noche que al amanecer persiste',
      O: 'Océano de sentimientos vivos',
      P: 'Palabras que jamás se olvidan',
      Q: 'Querer es dar sin condiciones',
      R: 'Raíces fuertes en tus acciones',
      S: 'Siempre hay luz tras la tormenta',
      T: 'Todo lo que sufres te alimenta',
      U: 'Universo en cada mirada tuya',
      V: 'Valentía que nunca se concluya',
      W: 'Widely spread as the morning light',
      X: 'Xenial spirit, forever bright',
      Y: 'Y al final, lo que queda es amor',
      Z: 'Zenit alcanzado con valor',
    };
    const lineas = palabra.split('').map(l => `*${l}* — ${versos[l] || 'Letra sin verso...'}`);
    c.reply(`📝 *ACRÓSTICO: ${palabra}*\n\n${lineas.join('\n')}`);
  }, ['acronimo', 'acrostique']),

  mk('rima', 'Rima con la palabra que pongas', '<palabra>', (c) => {
    if (!c.q) return c.reply('Escribe una palabra. Ejemplo: .rima amor');
    const rimas = {
      amor: ['color', 'calor', 'dolor', 'valor', 'temblor'],
      vida: ['herida', 'medida', 'guarida', 'despedida', 'partida'],
      noche: ['coche', 'broche', 'derroche', 'reproche'],
      cielo: ['suelo', 'vuelo', 'anhelo', 'consuelo', 'señuelo'],
      luz: ['cruz', 'tul', 'capuz', 'arcabuz'],
      fuego: ['juego', 'luego', 'ruego', 'sosiego'],
    };
    const palabra = c.q.toLowerCase();
    const found = rimas[palabra];
    if (found) return c.reply(`🎵 *Rimas con "${c.q}":*\n${found.map(r => `• ${r}`).join('\n')}`);
    c.reply(`🎵 Palabras que suenan similar a "${c.q}":\nNo tengo un banco exacto para esa palabra, pero prueba buscando en rima.io o rimas.net 😄`);
  }, ['rimar', 'palabrasrima', 'rimawith']),

  mk('contrahistoria', 'El lado del villano de la historia', '<protagonista>', (c) => {
    if (!c.q) return c.reply('Escribe el nombre de un personaje o historia. Ejemplo: .contrahistoria Cenicienta');
    const versiones = [
      `El lado de "${c.q}" que nadie contó: fue el sistema el que los convirtió en lo que son. Sus actos son consecuencia, no carácter.`,
      `"${c.q}" no era el malo. Solo tenía información diferente y tomó decisiones basadas en lo que vivió.`,
      `Desde la perspectiva de "${c.q}": ellos eran los héroes. Nosotros solo leímos la versión del ganador.`,
    ];
    c.reply(`🎭 *LA OTRA VERSIÓN*\n\n_${U.pick(versiones)}_\n\n¿Y si el villano tenía razón? 🤔`);
  }, ['antiheroe', 'villain_story', 'otraversion']),

  mk('personaje_backstory', 'Genera un backstory para un personaje', '<nombre>', (c) => {
    if (!c.q) return c.reply('Escribe el nombre del personaje. Ejemplo: .personaje_backstory Kira');
    const origenes = [
      `abandonado en las montañas de niño, ${c.q} fue criado por monjes que nunca explicaron por qué lo encontraron en una pila de ceniza.`,
      `${c.q} no recordaba nada antes de los 12 años. Solo sabía que el cicatriz en su mano brillaba cuando alguien mentía.`,
      `hija/hijo de un herrero del pueblo, ${c.q} descubrió su poder el día que su aldea fue quemada — y decidió ser la razón por la que nunca volviera a pasar.`,
      `todo el mundo creía que ${c.q} había muerto hace tres años. Eso les convenía a los que lo enviaron a esa misión.`,
    ];
    c.reply(`📜 *BACKSTORY: ${c.q}*\n\n_"Era ${U.pick(origenes)}"_\n\n¿Te inspira? ✍️`);
  }, ['background', 'historia_personaje', 'charbackstory']),

  mk('fraseinspiracion', 'Frase de inspiración para creadores', '', (c) => {
    const frases = [
      '"No esperes la inspiración. La inspiración es para los aficionados. El resto simplemente vamos a trabajar." — Chuck Close',
      '"Puedes fallar en hacer algo que no quieres. Así que también podrías fallar en hacer algo que amas." — Jim Carrey',
      '"La creatividad es inteligencia divirtiéndose." — atrib. a Einstein',
      '"La primera versión de todo apesta. Por eso existe la segunda." — Anónimo',
      '"No escribas lo que sabes. Escribe lo que quieres saber." — Anónimo',
      '"Un pincel no hace un artista. Pero sin él, tampoco." — Proverbio',
    ];
    c.reply(`💡 *INSPIRACIÓN PARA CREADORES*\n\n${U.pick(frases)}`);
  }, ['inspiracion_c', 'frasecreativa', 'motivacion_art']),

  mk('paleta', 'Paleta de colores con nombres creativos', '', (c) => {
    const paletas = [
      { nombre: 'Atardecer Venezolano', colores: ['#FF6B35 Naranja Llama', '#FFD166 Mango Maduro', '#EF476F Rosa Hibisco', '#073B4C Noche Carabobo'] },
      { nombre: 'Mazmorra Oscura', colores: ['#1A1A2E Azul Abismo', '#16213E Noche Sin Luna', '#0F3460 Tinta del Mago', '#E94560 Sangre de Dragón'] },
      { nombre: 'Bosque Mágico', colores: ['#2D6A4F Verde Profundo', '#52B788 Hoja Nueva', '#95D5B2 Niebla Élfica', '#B7E4C7 Luz entre Ramas'] },
      { nombre: 'Ciudad Neon', colores: ['#FF00FF Magenta Eléctrico', '#00FFFF Cyan Cyber', '#FFFF00 Amarillo Neón', '#7B2D8B Violeta Urbano'] },
    ];
    const p = U.pick(paletas);
    c.reply(`🎨 *PALETA: "${p.nombre}"*\n\n${p.colores.map(c => `• ${c}`).join('\n')}\n\n¿Útil para tu diseño? 🖌️`);
  }, ['colors', 'colores_c', 'palette']),

  mk('moodboard', 'Describe un moodboard para tu proyecto', '<descripción>', (c) => {
    if (!c.q) return c.reply('Describe tu proyecto. Ejemplo: .moodboard novela de terror psicológico');
    const elementos = {
      terror: ['colores fríos — grises y azules oscuros', 'tipografía desgastada y asimétrica', 'texturas de papel viejo y paredes descascaradas', 'imágenes borrosas y fuera de foco'],
      romance: ['tonos rosados, cremas y dorados', 'tipografía cursiva delicada', 'flores, cartas y objetos vintage', 'luz de atardecer cálido'],
      fantasia: ['paleta de verde bosque y dorado mágico', 'tipografía medieval', 'mapas, runas y criaturas etéreas', 'luz de luna y niebla suave'],
      accion: ['rojo, negro y amarillo eléctrico', 'tipografía bold y sin serifa', 'texturas metálicas y marcas de impacto', 'dinamismo y ángulos pronunciados'],
    };
    const tema = Object.keys(elementos).find(k => c.q.toLowerCase().includes(k)) || 'fantasia';
    const elems = elementos[tema];
    c.reply(`🖼️ *MOODBOARD para "${c.q}":*\n\n${elems.map((e, i) => `${i+1}. ${e}`).join('\n')}\n\nÚsalo como guía visual para tu proyecto 🎨`);
  }, ['vision_board', 'estilo_visual', 'diseño_mood']),
];
