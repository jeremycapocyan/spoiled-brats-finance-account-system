export type Account = "Cash" | "GCash" | "Bank";
export const accounts: Account[] = ["Cash", "GCash", "Bank"];
export type StockItem = { id: string; name: string; kind: "ingredient" | "packaged"; unit: "g" | "ml" | "pc"; packQty: number; dailyTarget: number; leadDays: number; safetyDays: number };
export type Product = { id: string; name: string; size: string; kind: "coffee" | "packaged"; stockId: string; price: number; targetMargin: number; archived: boolean };
export type Recipe = { id: string; productId: string; effective: string; lines: { itemId: string; qty: number }[] };
export type Purchase = { id: string; date: string; itemId: string; packs: number; packQty: number; total: number; account: Account; reference: string };
export type Sale = { id: string; date: string; lines: { productId: string; qty: number; amount: number; recipeId: string }[]; payments: Record<Account, number>; note: string };
export type Expense = { id: string; date: string; category: string; description: string; amount: number; account: Account; reference: string };
export type Adjustment = { id: string; date: string; itemId: string; qty: number; value: number; kind: "opening" | "count" | "waste" | "complimentary"; reason: string };
export type CashMovement = { id: string; date: string; kind: "opening" | "contribution" | "withdrawal" | "transfer" | "equipment"; account: Account; destination: Account; amount: number; note: string };
export type Reconciliation = { id: string; date: string; counted: Record<Account, number>; note: string };
export type Settings = { name: string; targetMargin: number; categories: string[] };
export type FinanceState = { settings: Settings; items: StockItem[]; products: Product[]; recipes: Recipe[]; purchases: Purchase[]; sales: Sale[]; expenses: Expense[]; adjustments: Adjustment[]; cash: CashMovement[]; reconciliations: Reconciliation[] };
export type Collection = Exclude<keyof FinanceState, "settings">;
export type Mutation = { collection: Collection; record?: unknown; deleteId?: string } | { collection: "settings"; record: Settings } | { collection: "restore"; record: FinanceState };
export type Employee = { id: string; name: string; email: string; code: string; active: boolean; start_date: string; schedule_start: string; schedule_end: string; workdays: number[]; user_id?: string | null };
export type Attendance = { id: string; employee_id: string; clock_in: string; clock_out: string | null; break_minutes: number; reason: string; voided: boolean; employee_name?: string };
export type Role = "admin" | "cashier" | "viewer" | "employee";
export type Profile = { id: string; name: string; role: Role; active: boolean; is_owner?: boolean; email?: string };
export const emptyState = (): FinanceState => ({ settings: { name: "Spoiled Brats", targetMargin: 65, categories: ["Rent", "Utilities", "Wages", "Transport", "Repairs", "Payment fees", "Other"] }, items: [], products: [], recipes: [], purchases: [], sales: [], expenses: [], adjustments: [], cash: [], reconciliations: [] });
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const money = (centavos: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(centavos / 100);
export const quantity = (n: number) => new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 }).format(n);
export const uid = () => crypto.randomUUID();
export const cents = (value: FormDataEntryValue | string | null) => Math.round(Number(value || 0) * 100);
export function monthRange(date = today()) { return { start: date.slice(0, 7) + "-01", end: date }; }
export function rangeFor(period: string, date: string) {
  const d = new Date(date + "T12:00:00+08:00");
  if (period === "day") return { start: date, end: date };
  if (period === "week") {
    const day = new Date(date + "T12:00:00Z").getUTCDay();
    const offset = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - offset);
    const start = d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 6);
    return { start, end: d.toISOString().slice(0, 10) };
  }
  return { start: date.slice(0, 7) + "-01", end: new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10) };
}
