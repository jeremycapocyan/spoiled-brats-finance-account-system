import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { financialPdf, timesheetPdf } from "../src/lib/pdf";
import { sampleState } from "../src/lib/sample";
import { emptyState, today, type Employee } from "../src/lib/model";
test("financial reports generate embedded-font multipage and empty PDFs", async () => {
  await mkdir("output/pdf",{recursive:true}); const s=sampleState();
  for(let i=0;i<80;i++) s.expenses.push({id:"pdf-"+i,date:today(),category:"Utilities",description:"Fictional expense for PDF pagination and wrapping, including peso amounts and a longer description "+i,amount:12345,account:"Cash",reference:""});
  const bytes=await financialPdf(s,s.purchases[0].date,today(),true); const doc=await PDFDocument.load(bytes); assert(doc.getPageCount()>=3); await writeFile("output/pdf/sample-financial-report.pdf",bytes);
  const blank=await financialPdf(emptyState(),today(),today()); assert((await PDFDocument.load(blank)).getPageCount()>=1); await writeFile("output/pdf/blank-financial-report.pdf",blank);
});
test("timesheet PDFs handle overnight dates and 31-day pagination", async () => {
  const e:Employee={id:"e",name:"Sample Employee - María Santos",email:"example@example.com",code:"SAMPLE0001",active:true,start_date:"2026-10-01",schedule_start:"22:00",schedule_end:"06:00",workdays:[1,2,3,4,5,6]};
  const bytes=await timesheetPdf([e],[{id:"a",employee_id:"e",clock_in:"2026-10-02T22:00:00+08:00",clock_out:"2026-10-03T06:00:00+08:00",break_minutes:0,reason:"Example correction with original work date preserved.",voided:false}],[{employee_id:"e",effective:"2026-10-01",schedule_start:"22:00",schedule_end:"06:00",workdays:e.workdays}],"2026-10-01","2026-10-31",true);
  assert((await PDFDocument.load(bytes)).getPageCount()>=2); await mkdir("output/pdf",{recursive:true}); await writeFile("output/pdf/sample-timesheets.pdf",bytes);
});
