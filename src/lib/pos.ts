import { accounts, type Account, type FinanceState, type Sale, today } from "./model";
import { ledger, mutate, productStats, recipeFor } from "./finance";
export type CartLine = { productId: string; qty: number };
export type Receipt = { id: string; date: string; lines: { productId: string; name: string; size: string; qty: number; price: number; amount: number }[]; payments: Record<Account, number>; total: number; sample?: boolean };
export function catalog(s: FinanceState) {
  const stock = ledger(s).stock;
  return s.products.filter(p => !p.archived).map(p => { const stats = productStats(s, p, stock); return { id: p.id, name: p.name, size: p.size, kind: p.kind, price: p.price, capacity: stats.ready ? stats.capacity : 0 }; });
}
export function checkout(s: FinanceState, cart: CartLine[], payments: Record<Account, number>, id: string, date = today()) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 100 || new Set(cart.map(l => l.productId)).size !== cart.length) throw new Error("Add distinct products to your order.");
  if (date !== today()) throw new Error("POS sales use today's Manila business date.");
  const receipt: Receipt = { id, date, lines: [], payments, total: 0 };
  const lines: Sale["lines"] = cart.map(l => {
    const p = s.products.find(p => p.id === l.productId && !p.archived);
    if (!p || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 9999) throw new Error("Invalid product or quantity. Refresh the menu.");
    const recipe = p.kind === "coffee" ? recipeFor(s, p.id, date) : null;
    if (p.kind === "coffee" && !recipe) throw new Error(`${p.name} needs a recipe before it can be sold.`);
    const amount = p.price * l.qty;
    receipt.lines.push({ productId: p.id, name: p.name, size: p.size, qty: l.qty, price: p.price, amount }); receipt.total += amount;
    return { productId: p.id, qty: l.qty, amount, recipeId: recipe?.id || "" };
  });
  if (!payments || accounts.some(a => !Number.isSafeInteger(payments[a]) || payments[a] < 0) || accounts.reduce((n,a) => n + payments[a],0) !== receipt.total || receipt.total <= 0) throw new Error("Payments must exactly match the order total.");
  const old = s.sales.find(x => x.date === date);
  const sale: Sale = old ? structuredClone(old) : { id: crypto.randomUUID(), date, lines: [], payments: { Cash: 0, GCash: 0, Bank: 0 }, note: "POS daily totals · see POS receipts" };
  for (const l of lines) { const existing = sale.lines.find(x => x.productId === l.productId && x.recipeId === l.recipeId); if (existing) { existing.qty += l.qty; existing.amount += l.amount; } else sale.lines.push(l); }
  for (const a of accounts) sale.payments[a] += payments[a];
  // The finance validator checks shared ingredients together and rejects insufficient stock.
  return { state: mutate(s, { collection: "sales", record: sale }), receipt };
}
export type DisplaySnapshot = { lines: { name: string; qty: number; amount: number }[]; total: number; status: "order" | "paid" | "welcome"; sample: boolean };
export function sanitizeDisplay(input: unknown): DisplaySnapshot {
  const x = input as DisplaySnapshot;
  if (!x || !Array.isArray(x.lines) || x.lines.length > 100 || !["order","paid","welcome"].includes(x.status) || !Number.isSafeInteger(x.total) || x.total < 0) throw new Error("Invalid display order.");
  const lines = x.lines.map(l => {
    if (typeof l.name !== "string" || l.name.length > 200 || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 9999 || !Number.isSafeInteger(l.amount) || l.amount < 0) throw new Error("Invalid display line.");
    return { name: l.name, qty: l.qty, amount: l.amount };
  });
  if (lines.reduce((n,l) => n + l.amount,0) !== x.total) throw new Error("Invalid display total.");
  return { lines, total: x.total, status: x.status, sample: x.sample === true };
}
