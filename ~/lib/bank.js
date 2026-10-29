const db = require('./db');

// ═══════════════════════════════════════════════
//  Banco: intereses, impuestos y préstamos. Se cobra "perezoso": cada vez que el usuario usa
//  un comando se calculan los días que pasaron (máx. 30) y el banco cobra solo.
// ═══════════════════════════════════════════════
const DAY = 86400000;
const CFG = {
  saveRate: 0.005,      // interés diario sobre lo guardado en el banco
  saveCap: 5000,        // máximo de interés por día
  taxFree: 1000,        // patrimonio libre de impuestos
  taxRate: 0.015,       // impuesto diario sobre lo que pase de taxFree
  withdrawFee: 0.01,    // comisión por retirar
  loanFee: 0.02,        // comisión al pedir un préstamo
  loanRate: 0.05,       // interés diario simple sobre el capital prestado
  loanDays: 7,          // plazo
  loanLate: 0.10,       // recargo único si vence
  maxDays: 30,          // máximo de días que se cobran de golpe
};

const level = (xp) => Math.floor(Math.sqrt((xp || 0) / 20)) + 1;
const R = Math.round;
const coin = (n) => `🪙 ${R(n).toLocaleString('es')}`;

function ensure(u) {
  u.loan ??= 0; u.loanPrincipal ??= 0; u.loanDue ??= 0; u.loanLate ??= false;
  u.taxDue ??= 0; u.lastBank ??= 0; u.bankLog ??= [];
  return u;
}

const log = (u, msg) => { u.bankLog.push({ t: Date.now(), msg }); if (u.bankLog.length > 8) u.bankLog.shift(); };

// Cobra del banco primero y luego de la cartera. Devuelve lo cobrado.
function take(u, amount) {
  let left = Math.max(0, R(amount)), got = 0;
  const b = Math.min(u.bank, left); u.bank -= b; left -= b; got += b;
  const c = Math.min(u.coins, left); u.coins -= c; left -= c; got += c;
  return got;
}

// Límite máximo de préstamo: hasta 90,000 Coins
const loanLimit = (u) => Math.min(90000, 3000 + level(u.xp) * 2000 + Math.floor((u.bank || 0) * 0.6));

// Aplica lo que pasó desde la última vez. Devuelve una lista de textos con lo que hizo el banco (puede ser vacía).
function accrue(u) {
  ensure(u);
  const now = Date.now();
  if (!u.lastBank) { u.lastBank = now; return []; }
  let days = Math.floor((now - u.lastBank) / DAY);
  if (days < 1) return [];
  u.lastBank = days > CFG.maxDays ? now : u.lastBank + days * DAY;
  days = Math.min(days, CFG.maxDays);

  const ev = [];
  let interest = 0, taxAdded = 0, loanInt = 0;
  for (let d = 0; d < days; d++) {
    const g = Math.min(Math.floor(u.bank * CFG.saveRate), CFG.saveCap);
    if (g > 0) { u.bank += g; interest += g; }
    const wealth = u.coins + u.bank;
    if (wealth > CFG.taxFree) { const t = R((wealth - CFG.taxFree) * CFG.taxRate); u.taxDue += t; taxAdded += t; }
    if (u.loan > 0) { const i = R(u.loanPrincipal * CFG.loanRate); u.loan += i; loanInt += i; }
  }
  if (interest) ev.push(`+${coin(interest)} de intereses por tu ahorro`);

  // El banco cobra los impuestos solo
  if (u.taxDue > 0) {
    const paid = take(u, u.taxDue);
    u.taxDue -= paid;
    if (paid) ev.push(`-${coin(paid)} de impuestos cobrados`);
    if (u.taxDue > 0) { u.taxDue = R(u.taxDue * 1.05); ev.push(`te quedaron ${coin(u.taxDue)} de impuestos sin pagar (suben 5% por día)`); }
  }
  if (loanInt) ev.push(`+${coin(loanInt)} de intereses en tu préstamo`);

  // Préstamo vencido: recargo y embargo
  if (u.loan > 0 && now > u.loanDue) {
    if (!u.loanLate) { u.loanLate = true; u.loan += R(u.loan * CFG.loanLate); ev.push(`tu préstamo venció: recargo de ${CFG.loanLate * 100}%`); }
    const paid = take(u, u.loan);
    u.loan -= paid;
    if (paid) ev.push(`el banco embargó ${coin(paid)} para cobrar tu préstamo`);
    if (u.loan <= 0) { u.loan = 0; u.loanPrincipal = 0; u.loanLate = false; u.loanDue = 0; ev.push('préstamo saldado'); }
    else ev.push(`aún debes ${coin(u.loan)}`);
  }
  for (const e of ev) log(u, e);
  if (ev.length) db.save();
  return ev;
}

const net = (u) => ensure(u).coins + u.bank - u.loan - u.taxDue;

module.exports = { CFG, ensure, accrue, take, loanLimit, level, coin, net, log };
