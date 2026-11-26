# Deployment: new Supabase project + Vercel

This application is separate from Gardens. Do not use Gardens' database, Vercel project, credentials, or production records.

## 1. Install independently

Node.js 24 is required. Dependencies and build artifacts are excluded from the source archive and Git. Install them in a fresh checkout:

```powershell
npm ci
```

## 2. Create the database

Create a **new dedicated Supabase project**. In its SQL Editor, run `supabase/migrations/202611260001_coffee_shop.sql` once. It creates the empty finance workspace, employee/attendance tables, database policies, and service functions. Future migrations must be additive; do not modify an already-applied migration.

In Authentication, create/invite your own administrator user using your real email privately. After that user exists, run this bootstrap SQL with its actual Authentication UUID:

```sql
insert into public.shop_profiles(id,name,role,active)
values ('YOUR_AUTH_USER_UUID','Jeremy','admin',true);
```

No public signup grants access. Additional administrators can be provisioned deliberately using the same process. Employees are registered in the app and then invited from the employee register; they choose their own passwords. Do not create fictional live employees for testing.

## 3. Configure environment

Copy `.env.example` to private `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`: the new project's URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: its publishable/anon key; not its service-role key.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role key.
- `ATTENDANCE_RATE_LIMIT_SECRET`: at least 32 random bytes, encoded as hex. Generate privately with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste it directly into local/Vercel secrets. Never commit it or place it in a `NEXT_PUBLIC_` variable.
- `APP_URL`: the canonical production HTTPS URL, without a trailing slash. Locally use `http://127.0.0.1:3100`.

Configure Supabase Authentication Site URL to `APP_URL`, and add `APP_URL/account` to allowed redirect URLs. Add the localhost account URL only if you need local account-setup testing. Use the password-setup flow for the owner. The `/account` page accepts invited/recovery sessions and lets each user choose their own password.

## 4. Deploy Next.js to Vercel

Create a new repository from this workspace excluding ignored files, and import it as a **new Vercel project**.

- Framework: Next.js.
- Root: repository root.
- Node: 24.x.
- Install: `npm ci`.
- Build: `npm test && npm run build`.
- Output directory: leave the Next.js default.
- Add all five environment variables above to production (and separate values if you use a preview environment).

Deploy, then set the final `APP_URL` and Supabase redirect allowlist together if the URL changed. Redeploy after changing public environment variables because they are compiled into browser code. Keep `/api/attendance/clock` reachable for the QR clock; the endpoint authenticates employee code/PIN and cannot read finance. Other app APIs require an active signed-in account and role checks.

Do not use static export: attendance, authentication checks, transaction validation, and PDF generation require the Next.js server runtime.

## 5. Acceptance and backups

1. Sign in as the administrator; verify all live business records are empty.
2. Check the separate sample workspace and PDF downloads without writing fictional live records.
3. With real owner-supplied records, verify one purchase, one daily sales sheet, and one expense across two devices. The purchase payment must appear once, recipe stock must deduct once, and a stale edit must request refresh.
4. Register actual employees, invite them explicitly, and verify that employee accounts cannot open financial APIs or another employee's records. Set their PIN on their own device and print the new kiosk QR.
5. Check Time In, Time Out, overnight timesheets, and a reasoned attendance correction with actual authorized test users in a dedicated test database.
6. Download and visually review a financial PDF and timesheet. Test mobile navigation.
7. Schedule provider-level database backups according to the Supabase plan you choose. Finance JSON exports do not include employee credentials, accounts, audit snapshots, or attendance; CSV and PDF exports are not complete restore sources.
8. Rehearse restoring a provider backup into a separate test project before relying on it. Finance JSON restores require the app's format and cannot mix sample and live backups.

Monitor Vercel function errors, Supabase database/storage usage, PIN failure rates, unresolved open shifts, unexplained reconciliation differences, and owner-configured low stock. Finance audit snapshots retain historical states, so review database growth as your record count increases.

## Current delivery status

Production application: https://spoiled-brats-finance-account-syste.vercel.app/

The Vercel project `spoiled-brats-finance-account-system` is deployed under Coach Jeremy. A separate Supabase project, `spoiled-brats-db` (`ldvyipqyqtebvzgblhir`, Tokyo), contains the applied coffee shop schema. Gardens is unchanged.

All five application environment variables are configured in Vercel Production. The Supabase URL and publishable key are browser-safe configuration; the server key and attendance rate-limit secret are private Production secrets. No private values are committed to this repository. `APP_URL` uses the production application origin above.

Supabase's default Site URL and allowed account redirect point to the production `/account` page, so invitations and recovery links can open password setup. The approved owner invitation was sent and the matching profile has active administrator access. Additional accounts are not seeded.

Verified on November 27, 2026: the configured production deployment is Ready; one empty finance workspace exists; sales, expenses, stock items, and employee records start empty; every app table has row-level security; the anonymous database role has no SELECT privilege on the finance table. The initial source passed 28 automated tests and the production build.

The owner accepted the invitation, privately set a password, and signed in successfully. Production browser checks confirmed the administrator profile, Shared workspace status, refreshed financial records, zero dashboard totals, the empty attendance workspace, and an authenticated financial PDF download (November 1-27, 2026, 21.8 KB). No sample transactions, stock, employees, or attendance were inserted into the live database during verification.

Loyverse is used by the owner for sales. A proposed one-way sales import would keep recipes, ingredient inventory, expenses, financial reports, and attendance here. That connector has not been implemented or authorized against a live Loyverse account; manual sales entry remains the current application workflow.
