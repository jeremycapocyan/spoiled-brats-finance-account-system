import { emptyState, today, type FinanceState } from "./model";
export function sampleState(): FinanceState {
  const s = emptyState(); const d = today();
  const previous = new Date(d + "T12:00:00Z"); previous.setUTCDate(previous.getUTCDate() - 14); const first = previous.toISOString().slice(0, 10);
  s.items = [
    { id: "beans", name: "Espresso beans", kind: "ingredient", unit: "g", packQty: 1000, dailyTarget: 450, leadDays: 2, safetyDays: 2 },
    { id: "milk", name: "Fresh milk", kind: "ingredient", unit: "ml", packQty: 1000, dailyTarget: 3600, leadDays: 1, safetyDays: 1 },
    { id: "syrup", name: "Vanilla syrup", kind: "ingredient", unit: "ml", packQty: 750, dailyTarget: 150, leadDays: 2, safetyDays: 2 },
    { id: "cups", name: "16 oz cup + lid", kind: "ingredient", unit: "pc", packQty: 50, dailyTarget: 25, leadDays: 2, safetyDays: 2 },
    { id: "water", name: "Bottled water 500 ml", kind: "packaged", unit: "pc", packQty: 24, dailyTarget: 8, leadDays: 1, safetyDays: 2 },
    { id: "soda", name: "Soft drink 330 ml", kind: "packaged", unit: "pc", packQty: 24, dailyTarget: 4, leadDays: 1, safetyDays: 2 },
    { id: "energy", name: "Energy drink 250 ml", kind: "packaged", unit: "pc", packQty: 24, dailyTarget: 3, leadDays: 1, safetyDays: 2 },
  ];
  s.products = [
    { id: "latte", name: "Iced latte", size: "16 oz", kind: "coffee", stockId: "", price: 9500, targetMargin: 65, archived: false },
    { id: "vanilla", name: "Vanilla latte", size: "16 oz", kind: "coffee", stockId: "", price: 11500, targetMargin: 65, archived: false },
    { id: "americano", name: "Iced americano", size: "16 oz", kind: "coffee", stockId: "", price: 7500, targetMargin: 65, archived: false },
    { id: "bottle", name: "Bottled water", size: "500 ml", kind: "packaged", stockId: "water", price: 2000, targetMargin: 40, archived: false },
    { id: "softdrink", name: "Soft drink", size: "330 ml", kind: "packaged", stockId: "soda", price: 3500, targetMargin: 40, archived: false },
    { id: "energydrink", name: "Energy drink", size: "250 ml", kind: "packaged", stockId: "energy", price: 5000, targetMargin: 40, archived: false },
  ];
  s.recipes = [
    { id: "r-latte", productId: "latte", effective: first, lines: [{ itemId: "beans", qty: 18 }, { itemId: "milk", qty: 180 }, { itemId: "cups", qty: 1 }] },
    { id: "r-vanilla", productId: "vanilla", effective: first, lines: [{ itemId: "beans", qty: 18 }, { itemId: "milk", qty: 160 }, { itemId: "syrup", qty: 20 }, { itemId: "cups", qty: 1 }] },
    { id: "r-americano", productId: "americano", effective: first, lines: [{ itemId: "beans", qty: 18 }, { itemId: "cups", qty: 1 }] },
  ];
  s.purchases = s.items.map((i, n) => ({ id: "buy-" + i.id, date: first, itemId: i.id, packs: [8, 36, 3, 4, 4, 2, 2][n], packQty: i.packQty, total: [480000, 324000, 105000, 70000, 96000, 96000, 144000][n], account: "Cash", reference: "SAMPLE RECEIPT" }));
  for (let n = 0; n < 14; n++) {
    const dt = new Date(first + "T12:00:00Z"); dt.setUTCDate(dt.getUTCDate() + n + 1); const date = dt.toISOString().slice(0, 10);
    const lines = ["latte", "vanilla", "americano", "bottle", "softdrink", "energydrink"].map((id, idx) => { const qty = [4 + n % 4, 3 + n % 3, 2 + n % 2, 3 + n % 4, 1 + n % 2, 1][idx]; return { productId: id, qty, amount: qty * s.products.find(p => p.id === id)!.price, recipeId: idx < 3 ? "r-" + id : "" }; });
    const total = lines.reduce((a, x) => a + x.amount, 0); const gcash = Math.floor(total * .4 / 100) * 100;
    s.sales.push({ id: "sale-" + n, date, lines, payments: { Cash: total - gcash, GCash: gcash, Bank: 0 }, note: "Fictional daily sales example" });
  }
  s.expenses = [{ id: "rent", date: first, category: "Rent", description: "Kiosk rent - example", amount: 800000, account: "Bank", reference: "SAMPLE" }, { id: "electric", date: d, category: "Utilities", description: "Electricity - example", amount: 125000, account: "Cash", reference: "SAMPLE" }];
  s.cash = [{ id: "open-cash", date: first, kind: "opening", account: "Cash", destination: "Bank", amount: 2500000, note: "Example opening cash" }, { id: "open-bank", date: first, kind: "opening", account: "Bank", destination: "Cash", amount: 1500000, note: "Example opening bank balance" }];
  return s;
}
