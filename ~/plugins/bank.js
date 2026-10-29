const db = require('../lib/db');
const bank = require('../lib/bank');
const U = require('../lib/utils');

const { CFG, coin } = bank;
const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'economy', run });
const acct = (c) => { const u = db.user(c.senderNum); bank.accrue(u); return u; };
const left = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; };
// cantidad: número, "all"/"todo"; null si es inválida
const amount = (raw, max) => {
  const r = String(raw || '').toLowerCase();
  const n = r === 'all' || r === 'todo' ? max : Math.floor(Number(r.replace(/[,._]/g, '')));
  return Number.isFinite(n) && n > 0 ? n : null;
};

module.exports = [
  mk('banco', 'Tu cuenta del banco: ahorro, deudas, impuestos y últimos movimientos', '', (c) => {
    const u = acct(c);
    const mov = u.bankLog.slice(-5).map((e) => `- ${e.msg}`).join('\n') || '- (sin movimientos todavía)';
    c.reply(
      `BANCO DE MIKU - ${c.pushName}\n\n` +
      `Cartera: ${coin(u.coins)}\nBanco: ${coin(u.bank)}  (interés ${CFG.saveRate * 100}% diario, máx ${coin(CFG.saveCap)})\n` +
      `Préstamo: ${u.loan > 0 ? `${coin(u.loan)} (vence en ${left(u.loanDue - Date.now())})` : 'ninguno'}\n` +
      `Impuestos pendientes: ${u.taxDue > 0 ? coin(u.taxDue) : 'al día'}\n` +
      `Patrimonio neto: ${coin(bank.net(u))}\n\n` +
      `Puedes pedir hasta: ${coin(bank.loanLimit(u))}\n` +
      `Comisiones: retirar ${CFG.withdrawFee * 100}% | préstamo ${CFG.loanFee * 100}%\n\n` +
      `Últimos movimientos:\n${mov}\n\n` +
      `${c.prefix}prestamo · ${c.prefix}pagarprestamo · ${c.prefix}impuestos · ${c.prefix}pagarimpuestos · ${c.prefix}deuda`
    );
  }, ['bank', 'cuenta', 'micuenta']),

  mk('impuestos', 'Mira tus impuestos: el banco cobra solo cada día', '', (c) => {
    const u = acct(c);
    const w = u.coins + u.bank;
    const next = w > CFG.taxFree ? R2((w - CFG.taxFree) * CFG.taxRate) : 0;
    c.reply(
      `IMPUESTOS\n\nPatrimonio: ${coin(w)}\nLibre de impuestos: hasta ${coin(CFG.taxFree)}\n` +
      `Tasa: ${CFG.taxRate * 100}% diario sobre lo que pase de eso\nPróximo cobro (aprox. por día): ${coin(next)}\n` +
      `Pendiente de pago: ${u.taxDue > 0 ? coin(u.taxDue) + ' (sube 5% por día)' : 'nada, estás al día'}\n\n` +
      `El banco los cobra solo de tu banco y luego de tu cartera. Pagar a mano: ${c.prefix}pagarimpuestos`
    );
  }, ['impuesto', 'tax', 'taxes']),

  mk('pagarimpuestos', 'Paga tus impuestos pendientes', '[cantidad|all]', (c) => {
    const u = acct(c);
    if (u.taxDue <= 0) return c.reply('No debes impuestos. Qué buen ciudadano~');
    const want = amount(c.args[0] || 'all', u.taxDue);
    if (!want) return c.reply(`Escribe una cantidad o "all". Debes ${coin(u.taxDue)}`);
    const n = Math.min(want, u.taxDue);
    const paid = bank.take(u, n);
    if (!paid) return c.reply(`No tienes con qué pagar. Debes ${coin(u.taxDue)}`);
    u.taxDue -= paid;
    bank.log(u, `pagaste ${coin(paid)} de impuestos`);
    db.save();
    c.reply(`Pagaste ${coin(paid)} de impuestos.\nPendiente: ${u.taxDue > 0 ? coin(u.taxDue) : 'nada'}\nCartera: ${coin(u.coins)} | Banco: ${coin(u.bank)}`);
  }, ['pagartax', 'pagarimpuesto', 'payttax', 'paytax']),

  mk('prestamo', 'Pide un préstamo al banco (interés diario, plazo 7 días)', '<cantidad>', (c) => {
    const u = acct(c);
    if (u.loan > 0) return c.reply(`Ya tienes un préstamo de ${coin(u.loan)}. Págalo primero con ${c.prefix}pagarprestamo`);
    if (u.taxDue > 0) return c.reply(`Tienes impuestos sin pagar (${coin(u.taxDue)}). Págalos con ${c.prefix}pagarimpuestos y vuelves.`);
    const lim = bank.loanLimit(u);
    const n = amount(c.args[0], lim);
    if (!n) return c.reply(`Cuánto necesitas? Ejemplo: ${c.prefix}prestamo 500\nTu límite: ${coin(lim)} (sube con tu nivel y tu ahorro).\nInterés: ${CFG.loanRate * 100}% diario sobre lo prestado, comisión ${CFG.loanFee * 100}%, plazo ${CFG.loanDays} días.`);
    if (n < 100) return c.reply('El mínimo es 100.');
    if (n > lim) return c.reply(`Tu límite es ${coin(lim)}.`);
    const fee = R2(n * CFG.loanFee);
    u.loan = n;
    u.loanPrincipal = n;
    u.loanDue = Date.now() + CFG.loanDays * 86400000;
    u.loanLate = false;
    u.coins += n - fee;
    bank.log(u, `préstamo de ${coin(n)} (comisión ${coin(fee)})`);
    db.save();
    c.reply(
      `Préstamo aprobado: ${coin(n)}\nComisión: ${coin(fee)}  ->  recibes ${coin(n - fee)}\n` +
      `Interés: ${coin(R2(n * CFG.loanRate))} por día | Vence en ${CFG.loanDays} días\n` +
      `Si no pagas a tiempo: recargo ${CFG.loanLate * 100}% y el banco te embarga.\nPagar: ${c.prefix}pagarprestamo`
    );
  }, ['loan', 'prestar', 'pedirprestamo']),

  mk('pagarprestamo', 'Paga (o abona a) tu préstamo', '[cantidad|all]', (c) => {
    const u = acct(c);
    if (u.loan <= 0) return c.reply('No tienes préstamos. Libre como el viento~');
    const want = amount(c.args[0] || 'all', u.loan);
    if (!want) return c.reply(`Escribe una cantidad o "all". Debes ${coin(u.loan)}`);
    const n = Math.min(want, u.loan);
    const paid = Math.min(n, u.coins);
    if (paid < 1) return c.reply(`No tienes monedas en la cartera. Retira del banco con ${c.prefix}withdraw. Debes ${coin(u.loan)}`);
    u.coins -= paid;
    u.loan -= paid;
    if (u.loan <= 0) { u.loan = 0; u.loanPrincipal = 0; u.loanDue = 0; u.loanLate = false; }
    else u.loanPrincipal = Math.min(u.loanPrincipal, u.loan);
    bank.log(u, u.loan > 0 ? `abonaste ${coin(paid)} al préstamo` : 'préstamo saldado');
    db.save();
    c.reply(u.loan > 0 ? `Abonaste ${coin(paid)}. Todavía debes ${coin(u.loan)}.` : `Préstamo saldado con ${coin(paid)}. El banco te quiere~`);
  }, ['payloan', 'abonar', 'pagardeuda']),

  mk('deuda', 'Resumen de lo que debes: préstamo e impuestos', '', (c) => {
    const u = acct(c);
    const total = u.loan + u.taxDue;
    c.reply(
      `TUS DEUDAS\n\nPréstamo: ${u.loan > 0 ? `${coin(u.loan)} (vence en ${left(u.loanDue - Date.now())}${u.loanLate ? ', VENCIDO' : ''})` : 'ninguno'}\n` +
      `Impuestos: ${u.taxDue > 0 ? coin(u.taxDue) : 'al día'}\n\nTotal: ${coin(total)}\n` +
      (total ? `\n${c.prefix}pagarprestamo · ${c.prefix}pagarimpuestos` : '\nNo debes nada.')
    );
  }, ['deudas', 'debts']),
];

function R2(n) { return Math.round(n); }
