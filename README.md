# Novem ERP — Phases 1 & 2 (Front Office · Billing · Mushak-6.3 · Restaurant POS)

Custom resort ERP for **Novem Eco Resort, Sreemangal** — built on React + Supabase + Vercel.

- **Phase 1** — the guest revenue cycle: Reservation Query → Quotation (WhatsApp/Email) →
  Advance & Confirmation → Check-In + printable Guest Registration Card → Folio & Payments
  (automatic ADVANCE/REGULAR classification) → Check-out generating **two invoices**
  (branded Guest Bill + NBR **Mushak-6.3**) with an auto-fed **Mushak-6.2 sales register**.
- **Phase 2** — Restaurant POS: menu management, fast order entry, KOT printing,
  in-house guest linkage, and three settlement paths that keep VAT clean.

---

## Database — ALREADY LIVE ✅

Supabase project **Novem ERP** (`gwllsoembqacolzfrquu`, region `ap-south-1` Mumbai).
Migrations `phase1_resort_erp_core` and `phase2_restaurant_pos` are applied — 16 tables, nothing to run.

- URL: `https://gwllsoembqacolzfrquu.supabase.co`
- The app ships with the project URL + anon key pre-filled in `src/supabase.js`.
  (The anon key is safe in client code; Row Level Security restricts data to signed-in staff.)
- Optional Vercel env-var overrides: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Deploy / redeploy (GitHub → Vercel, no local tooling)

- **First time:** create a GitHub repo → Upload files → drag this folder's contents → Commit.
  Then Vercel → Add New → Project → import the repo (Vite auto-detected) → Deploy.
- **Updating an existing deployment:** in the GitHub repo, **Upload files** → drag the updated
  files over the old ones → Commit. Vercel redeploys automatically.

## First-run checklist

1. **Staff logins** — Supabase Dashboard → *Novem ERP* → Authentication → Add user (auto-confirm).
2. **Settings → Company** — enter your **BIN** (prints on every Mushak-6.3).
3. **Settings → Tax rates** — verify VAT/SD/SC % with your VAT consultant
   (seeded: ROOM 15/0/10, RESTAURANT 5/0/10 — editable, effective-dated).
4. **Settings → Rooms** — add room numbers and base rates.
5. **Restaurant POS → Menu** — add categories and dishes with prices.

## Restaurant settlement logic (how VAT stays correct)

| Situation | What happens | Mushak-6.3 |
|---|---|---|
| In-house guest **pays now** | Folio line `RESTAURANT — PAID` + payment record (REGULAR) | Included in the consolidated 6.3 at check-out |
| In-house guest **charges to room** | Folio line `RESTAURANT — DUE`, settles at check-out | Included in the consolidated 6.3 at check-out |
| **Walk-in** customer pays | Order settled at the till | Own 6.3 issued immediately → enters the 6.2 register |

One sale = one tax invoice, never two. Open orders ("tabs") are supported: save → print KOT → resume → settle.

## Roadmap

Phase 3 Inventory + approval workflows + Mushak-6.1 → Phase 4 VAT suite (9.1, 6.6 VDS, 6.10 flags) →
Phase 5 HR & office management (Labour Law registers, docket numbers) → Phase 6 IFRS GL + Fixed Assets.
