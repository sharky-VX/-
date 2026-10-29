const fs = require('fs');
const FILE = './database.json';

const USER_DEFAULTS = { commands: 0, coins: 200, bank: 0, xp: 0, lastDaily: 0, lastWork: 0, lastRob: 0, lastCrime: 0, lastMine: 0 };
const CHAT_DEFAULTS = () => ({ antilink: false, welcome: false, bye: false, welcomeMsg: '', byeMsg: '', muted: [], warns: {}, msgs: {} });

let data = { users: {}, chats: {}, banned: [], bannedChats: [], stats: { commands: 0 }, mode: null };
try {
  data = { ...data, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch {}
data.bannedChats ||= [];

let timer;
const save = () => {
  clearTimeout(timer);
  timer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(data), () => {}), 3000);
};
process.on('exit', () => { try { fs.writeFileSync(FILE, JSON.stringify(data)); } catch {} });

const fill = (obj, defaults) => {
  for (const k of Object.keys(defaults)) if (obj[k] === undefined) obj[k] = defaults[k];
  return obj;
};

module.exports = {
  data,
  save,
  chat: (id) => fill((data.chats[id] ??= {}), CHAT_DEFAULTS()),
  user: (id) => fill((data.users[id] ??= {}), USER_DEFAULTS),
};
