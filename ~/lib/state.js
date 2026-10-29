// Estado en memoria compartido (juegos, etc.)
module.exports = {
  games: new Map(),
  startTime: Date.now(),
  mainSock: null, // socket del bot principal (para .bots)
};
