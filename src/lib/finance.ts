import { accounts, emptyState, type Account, type FinanceState, type Mutation, type Product, type Recipe, today } from "./model";

function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const validDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e12;
const amount = (n: unknown) => finite(n) && Number.isSafeInteger(n) && Number(n) >= 0;
const positive = (n: unknown) => finite(n) && Number(n) > 0;
const text = (s: unknown, max = 500) => typeof s === "string" && s.length <= max;
const named = (s: unknown) => text(s, 150) && String(s).trim().length > 0;
const account = (a: unknown) => accounts.includes(a as Account);
export function validateState(s: FinanceState) {
  check(s && typeof s === "object", "Invalid workspace.");
  const base = emptyState();
  check(Object.keys(s).length === Object.keys(base).length && Object.keys(base).every(k => k in s), "Invalid workspace structure.");
  check(s.settings && named(s.settings.name) && finite(s.settings.targetMargin) && s.settings.targetMargin >= 0 && s.settings.targetMargin < 100 && Array.isArray(s.settings.categories) && s.settings.categories.length > 0 && s.settings.categories.length <= 100 && s.settings.categories.every(named), "Check the business settings.");
  for (const key of Object.keys(base).filter(k => k !== "settings") as Exclude<keyof FinanceState, "settings">[]) {
    check(Array.isArray(s[key]) && s[key].length <= 20000, "Invalid or oversized record collection.");
    const ids = new Set<string>();
    for (const r of s[key]) {
      check(r && text(r.id, 100) && r.id.length > 0 && !ids.has(r.id), "Every record needs a unique ID."); ids.add(r.id);
      if ("date" in r) check(validDate(r.date) && r.date <= today(), "Use a valid date on or before today.");
    }
  }
  const items = new Map(s.items.map(i => [i.id, i])); const products = new Map(s.products.map(i => [i.id, i]));
  for (const i of s.items) check(named(i.name) && ["ingredient", "packaged"].includes(i.kind) && ["g", "ml", "pc"].includes(i.unit) && (i.kind !== "packaged" || i.unit === "pc") && positive(i.packQty) && [i.dailyTarget, i.leadDays, i.safetyDays].every(n => finite(n) && n >= 0) && (i.unit !== "pc" || Number.isInteger(i.packQty)), "Check stock name, units, pack size, and stock targets.");
  for (const p of s.products) check(named(p.name) && text(p.size, 100) && ["coffee", "packaged"].includes(p.kind) && amount(p.price) && finite(p.targetMargin) && p.targetMargin >= 0 && p.targetMargin < 100 && typeof p.archived === "boolean" && (p.kind !== "packaged" || items.get(p.stockId)?.kind === "packaged"), "Check the product and its linked stock item.");
  const effective = new Set<string>();
  for (const r of s.recipes) {
    check(products.get(r.productId)?.kind === "coffee" && validDate(r.effective) && Array.isArray(r.lines) && r.lines.length > 0 && r.lines.length <= 100, "A coffee recipe needs a product, effective date, and ingredients.");
    const key = r.productId + r.effective; check(!effective.has(key), "Only one recipe version per product and effective date is allowed."); effective.add(key);
    const used = new Set<string>();
    for (const l of r.lines) { check(items.get(l.itemId)?.kind === "ingredient" && positive(l.qty) && !used.has(l.itemId) && (items.get(l.itemId)?.unit !== "pc" || Number.isInteger(l.qty)), "Use unique ingredients and valid per-cup quantities."); used.add(l.itemId); }
  }
  for (const p of s.purchases) check(items.has(p.itemId) && positive(p.packs) && positive(p.packQty) && amount(p.total) && account(p.account) && text(p.reference) && (items.get(p.itemId)?.unit !== "pc" || Number.isInteger(p.packs * p.packQty)), "Check purchase quantity, total cost, and payment account.");
  const dates = new Set<string>();
  for (const sale of s.sales) {
    check(!dates.has(sale.date), "A sales sheet already exists for this date. Edit that sheet."); dates.add(sale.date);
    check(Array.isArray(sale.lines) && sale.lines.length > 0 && sale.lines.length <= 1000 && text(sale.note), "Add at least one product sold.");
    const seen = new Set<string>();
    for (const l of sale.lines) {
      const p = products.get(l.productId); check(p && Number.isInteger(l.qty) && positive(l.qty) && amount(l.amount) && !seen.has(l.productId), "Use each product once, with whole quantities and valid sales amounts."); seen.add(l.productId);
      if (p.kind === "coffee") check(s.recipes.some(r => r.id === l.recipeId && r.productId === p.id && r.effective <= sale.date), "Choose a recipe effective on or before the sale date.");
    }
    check(sale.payments && accounts.every(a => amount(sale.payments[a])), "Enter valid payment totals.");
    check(sale.lines.reduce((n, l) => n + l.amount, 0) === accounts.reduce((n, a) => n + sale.payments[a], 0), "Cash, GCash, and Bank totals must equal sales.");
  }
  for (const e of s.expenses) check(named(e.category) && named(e.description) && amount(e.amount) && e.amount > 0 && account(e.account) && text(e.reference), "Complete the expense category, description, amount, and payment account.");
  for (const a of s.adjustments) check(items.has(a.itemId) && finite(a.qty) && a.qty !== 0 && amount(a.value) && ["opening", "count", "waste", "complimentary"].includes(a.kind) && named(a.reason) && (a.qty > 0 || a.value === 0) && (!["waste", "complimentary"].includes(a.kind) || a.qty < 0) && (a.kind !== "opening" || a.qty > 0) && (items.get(a.itemId)?.unit !== "pc" || Number.isInteger(a.qty)), "Check stock adjustment quantity, value, and reason.");
  for (const m of s.cash) check(["opening", "contribution", "withdrawal", "transfer", "equipment"].includes(m.kind) && account(m.account) && amount(m.amount) && m.amount > 0 && named(m.note) && (m.kind !== "transfer" || (account(m.destination) && m.destination !== m.account)), "Check the cash movement and its accounts.");
  const recDates = new Set<string>();
  for (const r of s.reconciliations) { check(!recDates.has(r.date) && r.counted && accounts.every(a => amount(r.counted[a])) && text(r.note), "One reconciliation per date is allowed. Enter valid counted balances."); recDates.add(r.date); }
}

export type StockBalance = { qty: number; value: number; unitCost: number };
export type CostEntry = { date: string; productId: string; qty: number; revenue: number; cost: number };
export type Ledger = { stock: Record<string, StockBalance>; costs: CostEntry[]; waste: { date: string; cost: number; kind: string }[] };
export function ledger(s: FinanceState, asOf = "9999-12-31"): Ledger {
  const result: Ledger = { stock: Object.fromEntries(s.items.map(i => [i.id, { qty: 0, value: 0, unitCost: 0 }])), costs: [], waste: [] };
  const dates = [...new Set([...s.purchases, ...s.adjustments, ...s.sales].map(x => x.date))].filter(d => d <= asOf).sort();
  function add(id: string, qty: number, value: number) { const b = result.stock[id]; b.qty = Math.round((b.qty + qty) * 1e6) / 1e6; b.value += value; b.unitCost = b.qty ? b.value / b.qty : 0; }
  function use(id: string, qty: number, date: string) {
    const b = result.stock[id]; check(b && b.qty + 0.000001 >= qty, `Insufficient stock: ${s.items.find(i => i.id === id)?.name || id} on ${date}. Enter opening stock or a purchase first.`);
    const cost = Math.min(b.value, Math.round(qty * b.unitCost)); b.qty = Math.max(0, Math.round((b.qty - qty) * 1e6) / 1e6); b.value -= cost;
    if (b.qty === 0) { const remainder = b.value; b.value = 0; return cost + remainder; }
    return cost;
  }
  for (const date of dates) {
    for (const a of s.adjustments.filter(x => x.date === date && x.qty > 0).sort((a, b) => a.id.localeCompare(b.id))) add(a.itemId, a.qty, a.value);
    for (const p of s.purchases.filter(x => x.date === date).sort((a, b) => a.id.localeCompare(b.id))) add(p.itemId, p.packs * p.packQty, p.total);
    for (const sale of s.sales.filter(x => x.date === date)) for (const l of sale.lines) {
      const product = s.products.find(p => p.id === l.productId)!;
      let cost = 0;
      if (product.kind === "packaged") cost = use(product.stockId, l.qty, date);
      else for (const ingredient of s.recipes.find(r => r.id === l.recipeId)!.lines) cost += use(ingredient.itemId, l.qty * ingredient.qty, date);
      result.costs.push({ date, productId: product.id, qty: l.qty, revenue: l.amount, cost });
    }
    for (const a of s.adjustments.filter(x => x.date === date && x.qty < 0).sort((a, b) => a.id.localeCompare(b.id))) result.waste.push({ date, cost: use(a.itemId, -a.qty, date), kind: a.kind });
  }
  return result;
}
export function recipeFor(s: FinanceState, productId: string, date = today()) { return s.recipes.filter(r => r.productId === productId && r.effective <= date).sort((a, b) => b.effective.localeCompare(a.effective))[0]; }
export function productStats(s: FinanceState, p: Product, stock = ledger(s).stock) {
  const recipe = recipeFor(s, p.id);
  const ready = p.kind === "packaged" || !!recipe;
  const priced = (id: string) => s.purchases.some(x => x.itemId === id) || s.adjustments.some(x => x.itemId === id && x.qty > 0);
  const costKnown = p.kind === "packaged" ? priced(p.stockId) : !!recipe && recipe.lines.every(l => priced(l.itemId));
  const cost = p.kind === "packaged" ? stock[p.stockId]?.unitCost || 0 : (recipe?.lines.reduce((n, l) => n + (stock[l.itemId]?.unitCost || 0) * l.qty, 0) || 0);
  let capacity = p.kind === "packaged" ? Math.floor(stock[p.stockId]?.qty || 0) : 0;
  let limiting = "";
  if (recipe) {
    const limits = recipe.lines.map(l => ({ qty: Math.floor(((stock[l.itemId]?.qty || 0) + 1e-6) / l.qty), name: s.items.find(i => i.id === l.itemId)?.name || "" })).sort((a, b) => a.qty - b.qty);
    capacity = limits[0]?.qty || 0; limiting = limits[0]?.name || "";
  }
  const margin = p.price ? (p.price - cost) / p.price * 100 : 0;
  return { ready, costKnown, cost: Math.round(cost), capacity, limiting, profit: Math.round(p.price - cost), margin, markup: cost ? (p.price - cost) / cost * 100 : null, suggested: Math.ceil(cost / (1 - p.targetMargin / 100) / 100) * 100 };
}
export function planProduction(s: FinanceState, planned: Record<string, number>) {
  const stock = ledger(s).stock; const needed: Record<string, number> = {};
  for (const [id, qty] of Object.entries(planned)) {
    check(Number.isInteger(qty) && qty >= 0, "Planned cups must be whole non-negative quantities.");
    const r = recipeFor(s, id); if (qty > 0) check(r, "Set a recipe before planning cups.");
    for (const l of r?.lines || []) needed[l.itemId] = (needed[l.itemId] || 0) + l.qty * qty;
  }
  return s.items.filter(i => i.kind === "ingredient").map(i => {
    const required = needed[i.id] || 0; const shortage = Math.max(0, required - stock[i.id].qty);
    return { ...i, available: stock[i.id].qty, required, shortage, packs: Math.ceil(shortage / i.packQty) };
  });
}
export function report(s: FinanceState, start: string, end: string) {
  check(validDate(start) && validDate(end) && start <= end, "Choose a valid report date range.");
  const l = ledger(s, end); const inside = (x: { date: string }) => x.date >= start && x.date <= end;
  const sales = l.costs.filter(inside); const revenue = sales.reduce((n, x) => n + x.revenue, 0); const cogs = sales.reduce((n, x) => n + x.cost, 0);
  const expenses = s.expenses.filter(inside).reduce((n, x) => n + x.amount, 0); const waste = l.waste.filter(inside).reduce((n, x) => n + x.cost, 0);
  const purchases = s.purchases.filter(inside).reduce((n, x) => n + x.total, 0);
  const equipment = s.cash.filter(x => inside(x) && x.kind === "equipment").reduce((n, x) => n + x.amount, 0);
  const balances = Object.fromEntries(accounts.map(a => [a, 0])) as Record<Account, number>;
  const receipts = s.sales.filter(x => x.date <= end); for (const x of receipts) for (const a of accounts) balances[a] += x.payments[a];
  for (const x of [...s.expenses.map(x => ({ ...x, total: x.amount })), ...s.purchases].filter(x => x.date <= end)) balances[x.account] -= x.total;
  for (const x of s.cash.filter(x => x.date <= end)) {
    if (["opening", "contribution"].includes(x.kind)) balances[x.account] += x.amount;
    else { balances[x.account] -= x.amount; if (x.kind === "transfer") balances[x.destination] += x.amount; }
  }
  const funding = s.cash.filter(x => inside(x) && x.kind === "contribution").reduce((n, x) => n + x.amount, 0);
  const withdrawals = s.cash.filter(x => inside(x) && x.kind === "withdrawal").reduce((n, x) => n + x.amount, 0);
  return { start, end, revenue, cogs, gross: revenue - cogs, expenses, waste, profit: revenue - cogs - expenses - waste, purchases, equipment, funding, withdrawals, netCash: revenue - purchases - expenses - equipment + funding - withdrawals, balances, stock: l.stock, stockValue: Object.values(l.stock).reduce((n, x) => n + x.value, 0), sales, cups: sales.filter(x => s.products.find(p => p.id === x.productId)?.kind === "coffee").reduce((n, x) => n + x.qty, 0) };
}
export function mutate(s: FinanceState, action: Mutation): FinanceState {
  const next = structuredClone(s);
  if (action.collection === "restore") { validateState(action.record); ledger(action.record); return structuredClone(action.record); }
  if (action.collection === "settings") next.settings = action.record;
  else {
    check(action.collection in next && action.collection !== ("settings" as string), "Unknown record collection.");
    const rows = next[action.collection] as { id: string }[];
    if (action.deleteId) {
      check(action.collection !== "recipes", "Recipe history cannot be deleted.");
      const index = rows.findIndex(x => x.id === action.deleteId); check(index >= 0, "Record not found."); rows.splice(index, 1);
    } else {
      const record = action.record as { id: string }; check(record && record.id, "Missing record.");
      const index = rows.findIndex(x => x.id === record.id);
      if (index >= 0) {
        check(action.collection !== "recipes", "Add a new effective-dated recipe version instead of changing history.");
        if (action.collection === "items") { const old = next.items[index]; const item = record as typeof old; check(old.kind === item.kind && old.unit === item.unit, "Stock type and base units cannot change after creation. Add a new stock item."); }
        if (action.collection === "products") { const old = next.products[index]; const p = record as typeof old; check(old.kind === p.kind && old.stockId === p.stockId, "Product type and linked stock cannot change. Archive this product and add a new one."); }
        rows[index] = record;
      }
      else rows.push(record);
    }
  }
  validateState(next); ledger(next); return next;
}
