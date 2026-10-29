const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'plugins');
const registry = { list: [], map: new Map() };

// Carga (o recarga) todos los archivos de /plugins
function load() {
  registry.list = [];
  registry.map.clear();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const file = path.join(dir, f);
    delete require.cache[require.resolve(file)];
    try {
      let mod = require(file);
      if (typeof mod === 'function') mod = mod();
      for (const p of [].concat(mod)) {
        if (!p || !p.name || !p.run) continue;
        p.category = p.category || f.replace('.js', '');
        registry.list.push(p);
        for (const n of [p.name, ...(p.aliases || [])]) registry.map.set(n, p);
      }
    } catch (e) {
      console.error(`❌ Error en plugin ${f}:`, e.message);
    }
  }
  return registry.list.length;
}

module.exports = { registry, load, find: (n) => registry.map.get(n) };
