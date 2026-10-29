// Prefijos del bot. Por defecto se usan todos los de config.prefixes.
// Con .setprefix queda guardado en database.json y SOLO sirven los que elijas.
const config = require('../config');
const db = require('./db');

const list = () => (Array.isArray(db.data.prefixes) && db.data.prefixes.length ? db.data.prefixes : config.prefixes);
const set = (arr) => { db.data.prefixes = arr; db.save(); };
const reset = () => { delete db.data.prefixes; db.save(); };

module.exports = { list, set, reset };
