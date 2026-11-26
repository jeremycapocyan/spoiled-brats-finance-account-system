import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { money, quantity, type FinanceState, type Employee, type Attendance } from "./model";
import { report } from "./finance";
import { attendanceDays, hours, manilaTime, manilaDate, type Schedule } from "./attendance";
type Column = { label: string; width: number; align?: "right" };
class ReportWriter {
  doc!: PDFDocument; regular!: PDFFont; bold!: PDFFont; page!: PDFPage; y = 0; width = 595.28; height = 841.89;
  title: string; subtitle: string;
  constructor(title: string, subtitle: string, landscape = false) { this.title = title; this.subtitle = subtitle; if (landscape) { this.width = 841.89; this.height = 595.28; } }
  async init() {
    this.doc = await PDFDocument.create(); this.doc.registerFontkit(fontkit);
    const dir = path.join(process.cwd(), "public", "fonts");
    this.regular = await this.doc.embedFont(await readFile(path.join(dir, "NotoSerif-Regular.ttf")), { subset: true });
    this.bold = await this.doc.embedFont(await readFile(path.join(dir, "NotoSerif-Bold.ttf")), { subset: true });
    this.doc.setTitle(this.title); this.doc.setAuthor("Spoiled Brats finance tracker"); this.newPage(); return this;
  }
  newPage() {
    this.page = this.doc.addPage([this.width, this.height]); this.y = this.height - 44;
    this.page.drawRectangle({ x: 0, y: this.height - 8, width: this.width, height: 8, color: rgb(.12, .29, .24) });
    this.write(this.title, 18, true); this.write(this.subtitle, 9); this.y -= 14;
  }
  write(text: string, size = 10, bold = false, x = 40) {
    const font = bold ? this.bold : this.regular;
    for (const line of this.wrap(text, this.width - x - 40, font, size)) {
      if (this.y < 55) this.newPage();
      this.page.drawText(line, { x, y: this.y, size, font, color: rgb(.12, .16, .14) }); this.y -= size + 8;
    }
  }
  section(title: string) { if (this.y < 110) this.newPage(); this.y -= 8; this.write(title, 12, true); }
  wrap(text: string, maxWidth: number, font = this.regular, size = 9) {
    const lines: string[] = []; let line = "";
    for (const word of String(text).replace(/[\r\n]+/g, " ").split(" ")) {
      if (font.widthOfTextAtSize((line ? line + " " : "") + word, size) <= maxWidth) line += (line ? " " : "") + word;
      else {
        if (line) lines.push(line); line = "";
        for (const char of word) { if (font.widthOfTextAtSize(line + char, size) > maxWidth) { lines.push(line); line = ""; } line += char; }
      }
    }
    if (line) lines.push(line); return lines.length ? lines : [""];
  }
  table(columns: Column[], rows: string[][]) {
    const header = () => {
      this.page.drawRectangle({ x: 40, y: this.y - 7, width: this.width - 80, height: 25, color: rgb(.91, .94, .92) });
      let x = 46; for (const c of columns) { this.page.drawText(c.label, { x, y: this.y, size: 9, font: this.bold }); x += c.width; } this.y -= 26;
    };
    if (this.y < 100) this.newPage(); header();
    for (const row of rows.length ? rows : [columns.map((_, i) => i ? "-" : "No records in this period")]) {
      const cells = columns.map((c, i) => this.wrap(row[i] || "", c.width - 12)); const h = Math.max(...cells.map(c => c.length)) * 13 + 12;
      if (this.y - h < 45) { this.newPage(); header(); }
      let x = 46;
      cells.forEach((lines, i) => { lines.forEach((text, n) => { const offset = columns[i].align === "right" ? columns[i].width - 14 - this.regular.widthOfTextAtSize(text, 9) : 0; this.page.drawText(text, { x: x + offset, y: this.y - n * 13, size: 9, font: this.regular }); }); x += columns[i].width; });
      this.y -= h; this.page.drawLine({ start: { x: 40, y: this.y + 12 }, end: { x: this.width - 40, y: this.y + 12 }, thickness: .5, color: rgb(.86, .89, .87) });
    }
    this.y -= 8;
  }
  async finish() {
    const pages = this.doc.getPages(); const generated = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date());
    pages.forEach((p, i) => { p.drawText(`Generated ${generated} Manila | ${i + 1} / ${pages.length}`, { x: 40, y: 22, size: 8, font: this.regular, color: rgb(.4, .44, .42) }); });
    return this.doc.save();
  }
}
export async function financialPdf(s: FinanceState, start: string, end: string, sample = false) {
  const r = report(s, start, end); const w = await new ReportWriter(`${sample ? "SAMPLE - " : ""}${s.settings.name}`, `Financial management report | ${start} to ${end}`).init();
  w.section("Performance");
  w.table([{ label: "Measure", width: 335 }, { label: "Amount", width: 180, align: "right" }], [
    ["Sales after discounts", money(r.revenue)], ["Cost of goods sold", money(r.cogs)], ["Gross profit", money(r.gross)], ["Operating expenses", money(r.expenses)], ["Waste / stock reductions", money(r.waste)], ["Estimated operating profit", money(r.profit)],
  ]);
  w.section("Cash movement");
  w.table([{ label: "Measure", width: 335 }, { label: "Amount", width: 180, align: "right" }], [["Sales receipts", money(r.revenue)], ["Inventory purchases paid", money(r.purchases)], ["Operating payments", money(r.expenses)], ["Equipment purchases", money(r.equipment)], ["Owner contributions", money(r.funding)], ["Owner withdrawals", money(r.withdrawals)], ["Net cash movement (excluding opening balances)", money(r.netCash)], ...Object.entries(r.balances).map(([a, n]) => [`${a} expected balance as of ${end}`, money(n)]), ["Stock value as of report end", money(r.stockValue)]]);
  w.section("Product sales and gross profit");
  const products = s.products.map(p => { const rows = r.sales.filter(x => x.productId === p.id); return [p.name + (p.size ? " / " + p.size : ""), String(rows.reduce((n, x) => n + x.qty, 0)), money(rows.reduce((n, x) => n + x.revenue, 0)), money(rows.reduce((n, x) => n + x.cost, 0)), money(rows.reduce((n, x) => n + x.revenue - x.cost, 0))]; }).filter(x => x[1] !== "0");
  w.table([{ label: "Product", width: 195 }, { label: "Qty", width: 40 }, { label: "Sales", width: 95, align: "right" }, { label: "Cost", width: 90, align: "right" }, { label: "Gross profit", width: 95, align: "right" }], products);
  w.section("Expenses");
  w.table([{ label: "Date", width: 80 }, { label: "Category / description", width: 260 }, { label: "Account", width: 65 }, { label: "Amount", width: 110, align: "right" }], s.expenses.filter(x => x.date >= start && x.date <= end).map(x => [x.date, `${x.category}: ${x.description}`, x.account, money(x.amount)]));
  w.section("Inventory valuation");
  w.table([{ label: "Item", width: 275 }, { label: "Stock", width: 120, align: "right" }, { label: "Value", width: 120, align: "right" }], s.items.map(i => [i.name, `${quantity(r.stock[i.id].qty)} ${i.unit}`, money(r.stock[i.id].value)]));
  w.section("Report basis");
  for (const line of w.wrap("Management figures use daily weighted-average stock costs. Purchases are cash outflows; stock cost is charged as items are sold or used. Owner funding and withdrawals do not affect profit. Equipment payments affect cash; depreciation and tax calculations are excluded. Historical corrections can change later reports.", 510)) w.write(line, 9);
  return w.finish();
}
export async function timesheetPdf(employees: Employee[], rows: Attendance[], schedules: Schedule[], start: string, end: string, sample = false) {
  const w = await new ReportWriter(`${sample ? "SAMPLE - " : ""}Employee timesheets`, `${start} to ${end} | Asia/Manila | Recorded hours; no payroll calculation`, true).init();
  for (const [index, employee] of employees.entries()) {
    if (index) w.newPage();
    w.section(`${employee.name} | ${employee.code}`);
    const days = attendanceDays(employee, rows, schedules, start, end);
    w.table([{ label: "Date", width: 77 }, { label: "Schedule", width: 95 }, { label: "Time in", width: 105 }, { label: "Time out", width: 105 }, { label: "Break", width: 49 }, { label: "Worked", width: 70 }, { label: "Late / short", width: 82 }, { label: "Status", width: 98 }], days.map(d => [d.date, d.schedule, d.clockIn ? manilaTime(d.clockIn) : "-", d.clockOut ? manilaTime(d.clockOut) + (manilaDate(d.clockOut) !== d.date ? ` (${manilaDate(d.clockOut)})` : "") : "-", `${d.breakMinutes}m`, hours(d.minutes), `${d.late}m / ${d.under}m`, d.status]));
    w.write(`Total worked: ${hours(days.reduce((n, d) => n + d.minutes, 0))}`, 12, true);
    const corrections = days.filter(d => d.reason); if (corrections.length) { w.section("Correction notes"); for (const d of corrections) for (const line of w.wrap(`${d.date}: ${d.reason}`, 750)) w.write(line, 9); }
  }
  if (!employees.length) w.write("No employees selected.");
  return w.finish();
}
