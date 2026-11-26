# Spoiled Brats - coffee shop finance & inventory

A Next.js application for a single kiosk, built for PHP and Asia/Manila. Real business records start blank. The separate **Explore sample workspace** uses clearly labeled fictional browser-only records.

## Run

Use Node.js 24 and npm.

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3100. Without database configuration, the blank workspace and isolated sample remain available. Live saving requires a configured Supabase project and an administrator account. No live financial records are stored in browser storage.

```powershell
npm test
npm run typecheck
npm run build
npm start
```

This workspace includes its own ignored development dependencies. The source archive includes the package lockfile; run `npm ci` when installing it on another machine. The application does not depend on the Gardens workspace.

## First-time setup

1. Configure the private database and sign-in according to [DEPLOYMENT.md](DEPLOYMENT.md).
2. Settings: enter the shop name, target margin, and expense categories.
3. Daily expenses -> Cash movement: record the opening Cash, GCash, and Bank balances on your starting date. Opening balances are not sales or profit.
4. Inventory: create ingredients/packaging and packaged stock items. Use grams, milliliters, and pieces as base units. A 1 kg bag contains 1,000 g; a case of 24 bottles contains 24 pieces.
5. Stock levels -> Opening stock / adjustment: record the quantities already owned and their total purchase costs. This does not record a new cash payment. For newly bought stock, use **Stock purchase** instead.
6. Create menu products and selling prices. Link each packaged product to its stock item. Add one coffee recipe per flavor/size, including ingredients, cup, lid, and other tracked packaging.
7. Enter daily product quantities, actual sales after discounts, and payment splits. Stock is deducted automatically when saving. Edit the existing sheet to correct it; one sheet is allowed per date.
8. Record operating expenses, wastage, and complimentary usage. Reconcile closing account balances. Use Financial reports for date-filtered PDFs; Settings for CSV and finance backups.
9. Time tracker: register employees and schedules, send invitations when ready, and download the kiosk QR. Employees choose their own password and private six-digit PIN. Scanning alone never punches attendance.

Examples appear in Settings and placeholders. Real menu names, ingredient quantities, balances, staff, and transactions are never preloaded.

## Calculation rules

- Store money in integer centavos. Ingredient quantities use up to six decimal places internally; pieces must be whole numbers.
- Stock uses **daily weighted-average cost**. Positive stock additions and purchases precede consumption on their business date. Each sale uses its saved recipe version. Product prices and new recipes do not rewrite old sales amounts or recipe usage.
- Cost of goods sold includes ingredients and packaging consumed by recorded sales. Unsold purchases remain in inventory. Negative count adjustments, waste, and complimentary stock movements reduce operating profit separately at their calculated stock cost.
- Sales - cost of goods sold = gross profit. Gross profit - operating expenses - stock reductions = estimated operating profit. Equipment payments, owner funding, withdrawals, and account transfers stay outside operating profit. Depreciation and tax calculations are excluded.
- Zero-revenue coffee sale lines can record complimentary cups with automatic recipe deductions; their cost is then included in cost of goods sold. Do not also record their ingredient usage as a stock adjustment.
- Potential sales and profit on product cards are projections from unsold stock, not actual income. Markup = profit / cost; margin = profit / selling price. Suggested price rounds up to a whole peso using the chosen target margin.
- Individual coffee capacities share the same ingredients. Use the combined Cup Planner for a mixed flavor plan. Restock target = owner-entered daily usage × (lead days + safety days), rounded up to whole purchase packs after subtracting stock on hand. No demand is invented.
- Corrections replay inventory through later days. A save that creates any negative stock is rejected entirely. Enter opening stock/purchases before sales and never remove a purchase still needed by later usage.
- Finance is stored as a versioned JSON document in PostgreSQL. The server validates the whole proposed state and replays its inventory, then a service-only database function commits the state, operation identifier, revision, and audit snapshot atomically. Optimistic revision checks prevent lost updates across devices. Small-shop scope is intentional; this is not a general-purpose ledger or high-volume POS.
- Financial PDFs are generated from the current report state, not immutable closed accounts. Later corrections can change future exports. Reconciliation differences are recomputed against the current ledger.

## Attendance rules

- Official clock timestamps come from PostgreSQL, not device time. One shift per employee per Manila start date; one open shift at a time. Time Out closes the open shift even after midnight.
- Timesheets support up to 31 days, count completed elapsed minutes less manually entered unpaid breaks, and flag open shifts, missing attendance, late arrival, and undertime. They do not calculate pay, leave entitlements, or overtime compensation.
- Admin corrections require reasons, reject overlapping/future punches, and create audit entries. Voiding retains the record. Schedule versions preserve earlier dates; changes to existing employees take effect today or later. Same-day corrections replace that day's schedule version.
- Employees access only their own attendance. Their portal can record Time In/Out or set/change their private PIN. The public QR clock authenticates code/PIN without issuing a sign-in session. A QR identifies the kiosk but does not prove physical presence.
- PINs use salted scrypt; database tables and service functions are inaccessible to browser roles. Rate reservations cap failed/in-flight attempts at five per code and twenty per trusted Vercel-provided IP per 15 minutes. Outside Vercel, requests share one fallback IP bucket.

## Monitoring practices

Close and reconcile every trading day. Count high-use ingredients frequently and conduct a weekly full stock count. Review recipes and supplier prices weekly. Review profitability and cash together monthly, keep receipts by reference, separate owner money from business accounts, and download backups regularly. Restock using actual demand, supplier lead time, and a small safety allowance rather than tying up cash in excess inventory.

## Boundaries

Single kiosk; fully paid sales and purchases; owner/admin finance entry; employee-only attendance access. No food recipes, supplier/customer credit, tax filing, payroll, statutory calculations, bank/GCash integrations, or payment transfers. All payment entries are manual records of money already paid or received.

## Validation

The automated suite covers finance calculations, unit conversion, shared ingredients, date validation, stock shortages, historical edits, PostgreSQL row policies, service function permissions, retry/revision handling, PIN rate reservations, attendance corrections, overnight shifts, and embedded-font PDF pagination. PDF fixtures are written to ignored `output/pdf/`. Browser QA covers blank/sample separation, a saved sales correction, coffee costing, mixed-cup shortages, attendance preview, and a 390-pixel mobile layout.
