// ═══════════════════════════════════════════════
//  MISC — Comandos varios, clima, noticias, crypto,
//  horóscopo, recetas, frases, etc.
//  SHARKNEX v4
// ═══════════════════════════════════════════════
const axios = require('axios');
const db = require('../lib/db');
const U = require('../lib/utils');
const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'info', ...extra, run });
const mkf = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'fun', ...extra, run });
const mkt = (name, desc, usage, run, aliases = [], extra = {}) => ({ name, aliases, desc, usage, category: 'tools', ...extra, run });

module.exports = [
  // ══ INFO / UTILIDADES ══
  mk('clima', 'Clima de una ciudad', '<ciudad>', async (c) => {
    const city = c.q;
    if (!city) return c.reply('Escribe una ciudad. Ejemplo: .clima Caracas');
    try {
      const r = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 15000 });
      const d = r.data;
      const cur = d.current_condition[0];
      const area = d.nearest_area[0];
      const name = area.areaName[0].value;
      const country = area.country[0].value;
      const temp = cur.temp_C;
      const feels = cur.FeelsLikeC;
      const desc = cur.lang_es?.[0]?.value || cur.weatherDesc[0].value;
      const hum = cur.humidity;
      const wind = cur.windspeedKmph;
      c.reply([
        `🌤️ *CLIMA — ${name}, ${country}*`,
        ``,
        `🌡️ Temperatura: *${temp}°C* (sensación: ${feels}°C)`,
        `☁️ Condición: ${desc}`,
        `💧 Humedad: ${hum}%`,
        `💨 Viento: ${wind} km/h`,
      ].join('\n'));
    } catch (e) {
      c.reply('No pude obtener el clima. Revisa el nombre de la ciudad.');
    }
  }, ['weather', 'tiempo', 'temperatura']),

  mk('crypto', 'Precio de una criptomoneda', '<símbolo>', async (c) => {
    const sym = (c.args[0] || 'BTC').toUpperCase();
    try {
      const r = await U.getJson(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`);
      const price = parseFloat(r?.data?.amount);
      if (!price) throw new Error('no data');
      c.reply(`💰 *${sym}/USD*: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`);
    } catch {
      try {
        const r = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${sym.toLowerCase()}&vs_currencies=usd`, { timeout: 10000 });
        const price = r.data?.[sym.toLowerCase()]?.usd;
        if (!price) return c.reply(`No encontré el precio de ${sym}. Usa el símbolo o nombre (BTC, ETH, SOL...)`);
        c.reply(`💰 *${sym.toUpperCase()}/USD*: $${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      } catch {
        c.reply('No pude obtener el precio. Intenta con BTC, ETH, SOL, ADA...');
      }
    }
  }, ['coin', 'btc', 'eth', 'precio']),

  mk('dolar', 'Precio del dólar paralelo en Venezuela', '', async (c) => {
    try {
      const r = await axios.get('https://s3.amazonaws.com/dolartoday/data.json', { timeout: 10000 });
      const d = r.data;
      const usd = d?.USD?.transferencia || d?.USD?.promedio;
      const eur = d?.EUR?.transferencia || d?.EUR?.promedio;
      c.reply([
        `💵 *DÓLAR HOY (Venezuela)*`,
        ``,
        usd ? `USD: Bs. ${parseFloat(usd).toFixed(2)}` : '',
        eur ? `EUR: Bs. ${parseFloat(eur).toFixed(2)}` : '',
        ``,
        `Fuente: DolarToday`,
      ].filter(Boolean).join('\n'));
    } catch {
      try {
        const r = await axios.get('https://pydolarve.org/api/v1/dollar?monitor=enparalelovzla', { timeout: 10000 });
        const p = r.data?.price;
        c.reply(p ? `💵 *DÓLAR PARALELO*: Bs. ${p}` : 'No pude obtener el precio del dólar ahora mismo.');
      } catch {
        c.reply('No pude obtener el precio del dólar. Intenta más tarde.');
      }
    }
  }, ['bs', 'bolivar', 'dolarparalelo', 'tasadolar']),

  mk('wiki', 'Busca en Wikipedia', '<búsqueda>', async (c) => {
    if (!c.q) return c.reply('Escribe algo para buscar. Ejemplo: .wiki One Piece');
    try {
      const search = await U.getJson(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(c.q)}`);
      if (!search?.extract) return c.reply('No encontré esa página en Wikipedia.');
      const text = search.extract.slice(0, 800);
      c.reply(`📖 *${search.title}*\n\n${text}${search.extract.length > 800 ? '...' : ''}\n\n🔗 ${search.content_urls?.mobile?.page || ''}`);
    } catch {
      c.reply('No encontré esa búsqueda en Wikipedia.');
    }
  }, ['wikipedia', 'buscarwiki']),

  mk('defin', 'Definición de una palabra', '<palabra>', async (c) => {
    if (!c.q) return c.reply('Escribe una palabra. Ejemplo: .defin efímero');
    try {
      const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/es/${encodeURIComponent(c.q)}`, { timeout: 10000 });
      const entry = r.data[0];
      const def = entry?.meanings?.[0]?.definitions?.[0]?.definition;
      if (!def) throw new Error('no def');
      c.reply(`📚 *${entry.word}*\n\n${def}`);
    } catch {
      // fallback: Wikipedia
      c.reply(`No encontré definición de "${c.q}" en el diccionario.`);
    }
  }, ['definicion', 'define', 'significado', 'rae']),

  mk('traducir', 'Traduce un texto', '<idioma> <texto>', async (c) => {
    const lang = c.args[0] || 'en';
    const text = c.args.slice(1).join(' ');
    if (!text) return c.reply(`Uso: .traducir <idioma> <texto>\nEjemplos:\n.traducir en Hola mundo\n.traducir ja Bienvenido`);
    try {
      const r = await axios.get(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`,
        { timeout: 15000 }
      );
      const translated = r.data?.[0]?.map(x => x?.[0]).filter(Boolean).join('');
      if (!translated) throw new Error('vacío');
      c.reply(`🌍 *Traducción (→${lang}):*\n\n${translated}`);
    } catch {
      c.reply('No pude traducir. Intenta de nuevo.');
    }
  }, ['translate', 'trad', 'trans']),

  mk('noticias', 'Últimas noticias de actualidad', '[tema]', async (c) => {
    const q = c.q || 'venezuela';
    try {
      const r = await axios.get(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=es&max=5&apikey=demo`, { timeout: 12000 });
      const arts = r.data?.articles?.slice(0, 5);
      if (!arts?.length) throw new Error('sin datos');
      const lines = arts.map((a, i) => `${i + 1}. *${a.title}*\n   ${a.source?.name} — ${a.url?.slice(0, 60)}...`);
      c.reply(`📰 *NOTICIAS — ${q.toUpperCase()}*\n\n${lines.join('\n\n')}`);
    } catch {
      c.reply('No pude obtener noticias ahora mismo. Intenta con otro término.');
    }
  }, ['news', 'noticias2']),

  mk('chiste', 'Un chiste aleatorio', '', async (c) => {
    const chistes = [
      '¿Por qué los pájaros vuelan hacia el sur en invierno?\nPorque caminar tardaría demasiado 🐦',
      '¿Cuántos programadores hacen falta para cambiar una bombilla?\nNinguno, es un problema de hardware 💡',
      '¿Qué le dice un bit al otro?\nNos vemos en el bus 🚌',
      '¿Por qué el libro de matemáticas siempre está triste?\nPorque tiene muchos problemas 📚',
      '¿Qué hace un pirata en la computadora?\nNavega por internet 🏴‍☠️',
      '¿Cuál es el colmo de un músico?\nQue le pidan que toque y tocar no pueda 🎵',
      '¿Qué le dijo el 0 al 8?\nBonito cinturón 👔',
      '¿Por qué el espantapájaros ganó un premio?\nEra sobresaliente en su campo 🌾',
      '¿Cómo llamas a un perro sin patas?\nNo importa, no va a venir igual 🐾',
      '¿Qué le dijo la luna al sol?\nTanto brillar y ni gafas tienes ☀️',
    ];
    c.reply(`😂 *CHISTE*\n\n${U.pick(chistes)}`);
  }, ['joke', 'humor', 'chiste2']),

  mkf('frasemotiv', 'Una frase motivacional', '', (c) => {
    const frases = [
      '"El único modo de hacer un gran trabajo es amar lo que haces." — Steve Jobs',
      '"La vida es lo que pasa mientras estás ocupado haciendo otros planes." — John Lennon',
      '"No cuentes los días, haz que los días cuenten." — Muhammad Ali',
      '"La creatividad es la inteligencia divirtiéndose." — Albert Einstein',
      '"Lo que no te mata, te hace más fuerte." — Nietzsche',
      '"Sé el cambio que quieres ver en el mundo." — Gandhi',
      '"El éxito no es definitivo, el fracaso no es fatal: lo que cuenta es el coraje de continuar." — Churchill',
      '"La única forma de hacer un trabajo excelente es amar lo que haces."',
      '"Hoy es un buen día para tener un buen día." — Anónimo',
      '"Cae siete veces, levántate ocho." — Proverbio japonés',
      '"El futuro pertenece a quienes creen en la belleza de sus sueños." — Eleanor Roosevelt',
    ];
    c.reply(`✨ *FRASE DEL DÍA*\n\n${U.pick(frases)}`);
  }, ['motivacion', 'inspire', 'frase2']),

  mkf('copypasta', 'Una copypasta famosa de internet', '', (c) => {
    const pastas = [
      'Imagínate que yo soy el tipo más importante del mundo...',
      'ARRIBA ARRIBA ARRIBA QUE LA VIDA ES UNA SOLA 🚀🚀🚀',
      'No soy como los demás bots, yo soy especial ✨',
      'Si no me respondes en 10 segundos asumo que... (timer no incluido 😂)',
      'Mi IQ es demasiado alto para procesar este meme 🧠',
      'Skill issue 💀',
      'Nadie:\nAbsolutamente nadie:\nYo a las 3am: ¿y si me pongo a pensar en cosas random?',
    ];
    c.reply(U.pick(pastas));
  }, ['pasta', 'meme']),

  mk('feriados', 'Próximos feriados en Venezuela', '', (c) => {
    const feriados = [
      { fecha: '01/01', nombre: 'Año Nuevo' },
      { fecha: '19/04', nombre: 'Declaración de Independencia' },
      { fecha: '01/05', nombre: 'Día del Trabajador' },
      { fecha: '24/06', nombre: 'Batalla de Carabobo' },
      { fecha: '05/07', nombre: 'Día de la Independencia' },
      { fecha: '24/07', nombre: 'Natalicio de Simón Bolívar' },
      { fecha: '12/10', nombre: 'Día de la Resistencia Indígena' },
      { fecha: '01/11', nombre: 'Día de Todos los Santos' },
      { fecha: '25/12', nombre: 'Navidad' },
    ];
    const now = new Date();
    const upcoming = feriados.filter(f => {
      const [d, m] = f.fecha.split('/').map(Number);
      const date = new Date(now.getFullYear(), m - 1, d);
      if (date < now) date.setFullYear(now.getFullYear() + 1);
      return date >= now;
    }).slice(0, 5);
    c.reply(`🗓️ *FERIADOS VENEZUELA*\n\n${upcoming.map(f => `📅 ${f.fecha} — ${f.nombre}`).join('\n')}`);
  }, ['holidays', 'feriadosve']),

  mkt('timestamp2', 'Convierte fecha a timestamp Unix', '<DD/MM/AAAA>', (c) => {
    if (!c.q) return c.reply(`Uso: .timestamp2 15/03/2025\nO sin argumentos para ver el timestamp actual.`);
    const parts = c.q.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      const date = new Date(y, m - 1, d);
      return c.reply(`📅 *${c.q}* = \`${Math.floor(date.getTime() / 1000)}\` (Unix timestamp)`);
    }
    c.reply(`⏱️ Timestamp actual: \`${Math.floor(Date.now() / 1000)}\`\nMilisegundos: \`${Date.now()}\``);
  }, ['unix', 'epoch', 'unixtime']),

  mkt('convertir', 'Convierte unidades (temperatura, longitud, peso)', '<valor> <unidad> <a>', (c) => {
    const [val, from, , to] = c.args;
    const v = parseFloat(val);
    if (isNaN(v)) return c.reply('Uso: .convertir 100 km a millas\n.convertir 37 C a F\n.convertir 5 kg a lb');
    const fromU = (from || '').toLowerCase();
    const toU = (to || '').toLowerCase();
    let result, unit;
    // Temperatura
    if (['c', 'celsius'].includes(fromU) && ['f', 'fahrenheit'].includes(toU)) { result = v * 9/5 + 32; unit = '°F'; }
    else if (['f', 'fahrenheit'].includes(fromU) && ['c', 'celsius'].includes(toU)) { result = (v - 32) * 5/9; unit = '°C'; }
    else if (['c', 'celsius'].includes(fromU) && ['k', 'kelvin'].includes(toU)) { result = v + 273.15; unit = 'K'; }
    // Longitud
    else if (['km'].includes(fromU) && ['mi', 'millas'].includes(toU)) { result = v * 0.621371; unit = 'mi'; }
    else if (['mi', 'millas'].includes(fromU) && ['km'].includes(toU)) { result = v * 1.60934; unit = 'km'; }
    else if (['m', 'metros'].includes(fromU) && ['ft', 'pies', 'feet'].includes(toU)) { result = v * 3.28084; unit = 'ft'; }
    else if (['ft', 'pies'].includes(fromU) && ['m', 'metros'].includes(toU)) { result = v / 3.28084; unit = 'm'; }
    else if (['cm'].includes(fromU) && ['in', 'pulgadas'].includes(toU)) { result = v * 0.393701; unit = 'in'; }
    // Peso
    else if (['kg'].includes(fromU) && ['lb', 'libras'].includes(toU)) { result = v * 2.20462; unit = 'lb'; }
    else if (['lb', 'libras'].includes(fromU) && ['kg'].includes(toU)) { result = v / 2.20462; unit = 'kg'; }
    else if (['g', 'gramos'].includes(fromU) && ['oz', 'onzas'].includes(toU)) { result = v * 0.035274; unit = 'oz'; }
    else return c.reply('Conversiones disponibles:\n• C↔F↔K (temperatura)\n• km↔mi, m↔ft, cm↔in (longitud)\n• kg↔lb, g↔oz (peso)\nEjemplo: .convertir 100 km a mi');
    c.reply(`📐 *${v} ${fromU}* = *${result.toFixed(4)} ${unit}*`);
  }, ['convert', 'conv', 'unidades']),

  mkt('calcular', 'Calculadora avanzada', '<expresión>', (c) => {
    if (!c.q) return c.reply('Escribe una expresión. Ejemplo: .calcular 2^10 + 50 * 3');
    try {
      const expr = c.q
        .replace(/\^/g, '**')
        .replace(/[^0-9+\-*/.() %]/g, '');
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr})`)();
      if (!isFinite(result)) throw new Error('inf');
      c.reply(`🧮 \`${c.q}\` = *${result.toLocaleString('es', { maximumFractionDigits: 10 })}*`);
    } catch {
      c.reply('Expresión inválida. Ejemplo: .calcular (2 + 3) * 4 / 2');
    }
  }, ['calc', 'calculo', 'math2']),

  mkt('acortarurl', 'Acorta una URL', '<url>', async (c) => {
    const url = c.args[0] || '';
    if (!url.startsWith('http')) return c.reply('Escribe una URL. Ejemplo: .acortarurl https://ejemplo.com/muy/larga/ruta');
    try {
      const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
      c.reply(`🔗 URL acortada:\n${r.data}`);
    } catch {
      c.reply('No pude acortar la URL. Intenta más tarde.');
    }
  }, ['shorturl', 'tinyurl', 'acortar2']),

  mkt('genpass', 'Genera una contraseña segura', '[longitud]', (c) => {
    const len = Math.min(Math.max(parseInt(c.args[0]) || 16, 8), 64);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const pass = Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    c.reply(`🔑 *Contraseña generada (${len} chars):*\n\`${pass}\`\n\n_No la compartas con nadie_`);
  }, ['password2', 'clave', 'passgen']),

  mkt('ipinfo2', 'Información de una IP', '<ip>', async (c) => {
    const ip = c.args[0] || '';
    if (!ip) return c.reply('Escribe una IP. Ejemplo: .ipinfo2 8.8.8.8');
    try {
      const r = await U.getJson(`https://ipapi.co/${ip}/json/`);
      if (r.error) return c.reply(`IP inválida o no encontrada: ${r.reason}`);
      c.reply([
        `🌐 *IP: ${r.ip}*`,
        `📍 Ciudad: ${r.city}, ${r.region}`,
        `🌎 País: ${r.country_name} (${r.country_code})`,
        `🌐 ISP: ${r.org}`,
        `📡 ASN: ${r.asn}`,
        `🗺️ Coords: ${r.latitude}, ${r.longitude}`,
      ].join('\n'));
    } catch {
      c.reply('No pude obtener info de esa IP.');
    }
  }, ['ip2', 'lookup', 'ipcheck']),

  mkf('horoscopo2', 'Horóscopo del día por signo', '<signo>', async (c) => {
    const signos = ['aries','tauro','geminis','cancer','leo','virgo','libra','escorpio','sagitario','capricornio','acuario','piscis'];
    const sign = (c.args[0] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!sign || !signos.some(s => s.includes(sign.slice(0, 4)))) {
      return c.reply(`Signos disponibles:\n${signos.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}\n\nEjemplo: .horoscopo2 leo`);
    }
    const found = signos.find(s => s.includes(sign.slice(0, 4)));
    const predicciones = [
      'Los astros te sonríen hoy. Aprovecha la energía positiva.',
      'Un cambio inesperado llegará. Mantente flexible.',
      'Es momento de enfocarte en tus metas personales.',
      'Una conversación importante definirá tu próxima semana.',
      'Tu intuición estará muy afinada hoy. Confía en ella.',
      'El trabajo en equipo te traerá grandes resultados.',
      'Evita tomar decisiones impulsivas esta semana.',
      'Una nueva oportunidad se presenta en el horizonte.',
      'El amor y la amistad serán tu mayor fortaleza hoy.',
    ];
    c.reply(`♈ *HORÓSCOPO — ${found.toUpperCase()}*\n\n${U.pick(predicciones)}\n\n💫 Consejo: ${U.pick(['Sé paciente', 'Confía en ti mismo', 'Habla con claridad', 'Descansa', 'Actúa ya'])}.`);
  }, ['signo2', 'astros']),





  mkf('simularchat', 'Simula una conversación épica', '', (c) => {
    const personas = ['tu ex', 'tu jefe', 'tu mamá', 'Naruto', 'Goku', 'el bot', 'tu yo del futuro', 'un alien', 'un pingüino filósofo'];
    const situaciones = [
      `${U.pick(personas)}: "Necesitamos hablar..."\nTú: "¿Ahora?"`,
      `${U.pick(personas)}: "¿Me estás ignorando?"\nTú: "No, solo estoy ocupado. (mentira)"`,
      `${U.pick(personas)}: "Te tengo una sorpresa"\nTú: "¿Es dinero?" "${U.pick(['No', 'Puede ser...', 'Mejor'])}"`,
    ];
    c.reply(`💬 *SIMULACIÓN DE CHAT*\n\n${U.pick(situaciones)}`);
  }, ['fakechat', 'simchat']),

  mk('color', 'Info de un color en HEX', '<#hex o nombre>', async (c) => {
    const input = (c.args[0] || '').replace('#', '');
    if (!input) return c.reply('Escribe un color hex o nombre. Ejemplo: .color #ff5733 o .color rojo');
    try {
      const r = await axios.get(`https://www.thecolorapi.com/id?hex=${input}&format=json`, { timeout: 10000 });
      const d = r.data;
      c.reply([
        `🎨 *Color: ${d.name?.value}*`,
        `HEX: #${d.hex?.clean}`,
        `RGB: ${d.rgb?.r}, ${d.rgb?.g}, ${d.rgb?.b}`,
        `HSL: ${d.hsl?.h}°, ${d.hsl?.s}%, ${d.hsl?.l}%`,
      ].join('\n'));
    } catch {
      c.reply('No reconocí ese color. Usa hex (#ff5733) o nombre en inglés.');
    }
  }, ['colorinfo', 'hex2', 'colorhex2']),

  mk('numerologia', 'Tu número de la numerología', '[nombre o número]', (c) => {
    const input = c.q || c.pushName;
    let num;
    if (/^\d+$/.test(input)) {
      num = [...input].reduce((a, b) => a + parseInt(b), 0);
      while (num > 9 && num !== 11 && num !== 22) num = [...String(num)].reduce((a, b) => a + parseInt(b), 0);
    } else {
      const vals = { a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:1,k:2,l:3,m:4,n:5,o:6,p:7,q:8,r:9,s:1,t:2,u:3,v:4,w:5,x:6,y:7,z:8 };
      let sum = [...input.toLowerCase()].reduce((a, c) => a + (vals[c] || 0), 0);
      while (sum > 9 && sum !== 11 && sum !== 22) sum = [...String(sum)].reduce((a, b) => a + parseInt(b), 0);
      num = sum;
    }
    const significados = {
      1: 'Liderazgo y ambición. Eres independiente y pionero.',
      2: 'Diplomacia y cooperación. Eres sensible y mediador.',
      3: 'Creatividad y expresión. Eres alegre y comunicativo.',
      4: 'Estabilidad y trabajo. Eres responsable y metódico.',
      5: 'Libertad y aventura. Eres curioso y adaptable.',
      6: 'Amor y armonía. Eres protector y cariñoso.',
      7: 'Sabiduría y espiritualidad. Eres analítico y profundo.',
      8: 'Poder y abundancia. Eres ambicioso y ejecutivo.',
      9: 'Compasión y humanismo. Eres generoso y sabio.',
      11: 'Intuición maestra. Tienes percepción espiritual elevada.',
      22: 'Constructor maestro. Capaz de logros extraordinarios.',
    };
    c.reply(`🔢 *NUMEROLOGÍA*\nNombre/número: ${input}\nNúmero: *${num}*\n\n${significados[num] || 'Número especial.'}`);
  }, ['numerology', 'numvida']),

  mk('imc2', 'Calcula tu índice de masa corporal', '<peso_kg> <altura_m>', (c) => {
    const peso = parseFloat(c.args[0]);
    const altura = parseFloat(c.args[1]);
    if (!peso || !altura) return c.reply('Uso: .imc2 70 1.75\n(peso en kg, altura en metros)');
    const imc = peso / (altura * altura);
    let cat;
    if (imc < 18.5) cat = 'Bajo peso 🟡';
    else if (imc < 25) cat = 'Peso normal ✅';
    else if (imc < 30) cat = 'Sobrepeso 🟠';
    else cat = 'Obesidad 🔴';
    c.reply(`⚖️ *IMC*\nPeso: ${peso}kg | Altura: ${altura}m\n\nIMC: *${imc.toFixed(1)}*\nCategoría: ${cat}`);
  }, ['bmi2', 'pesoideal', 'masacorporal']),

  mkf('chistemalo', 'Un chiste malo garantizado', '', (c) => {
    const malos = [
      '¿Qué le dice un jardinero a otro?\nMucho gusto, soy Pedro. 🌱',
      '¿Cómo se llama el campeón de buceo de Japón?\nYa-ma-moto 🏊',
      '¿Cuál es el colmo de un electricista?\nQue su hijo no conduzca corriente ⚡',
      '¿Cuántos músicos necesitas para cambiar un foco?\n¡Uno! Meto, yo lo hago... 🎵',
      '¿Qué hace una abeja en el gimnasio?\n¡Zum-ba! 🐝',
      '¿Cómo se despiden los químicos?\nÁcido un placer 🧪',
    ];
    c.reply(`😬 *CHISTE MALO*\n\n${U.pick(malos)}\n\n_(sí, lo sé, es malísimo)_`);
  }, ['baddad', 'jokemalo']),

  mkf('anonimo', 'Envía un mensaje anónimo al grupo', '<mensaje>', async (c) => {
    if (!c.q) return c.reply('Escribe el mensaje. Ejemplo: .anonimo Hola a todos sin revelar quién soy');
    if (!c.isGroup) return c.reply('Solo funciona en grupos.');
    await c.sock.sendMessage(c.from, { text: `👤 *[ANÓNIMO]*\n\n${c.q}` });
    await c.sock.sendMessage(c.sender, { text: '✅ Mensaje anónimo enviado.' }).catch(() => {});
  }, ['anonymous', 'msganonimo']),

  mk('memegen', 'Genera texto estilo meme', '<texto_arriba | texto_abajo>', (c) => {
    const parts = c.q.split('|');
    const top = (parts[0] || '').trim().toUpperCase();
    const bottom = (parts[1] || '').trim().toUpperCase();
    const line = '═'.repeat(Math.max(top.length, bottom.length, 20));
    c.reply(`╔${line}╗\n║  ${top.padEnd(line.length - 2)}║\n║  ${' '.repeat(line.length - 2)}║\n║  ${bottom.padEnd(line.length - 2)}║\n╚${line}╝`);
  }, ['meme2', 'toptext']),
];
