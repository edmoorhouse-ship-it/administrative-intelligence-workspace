# Administrative Intelligence Workspace: plan

One codebase, many businesses. The core is the workspace itself: chat, Manny, Calendar, Pulse,
shared brain, sign-in, and roles. Everything that belongs to one business (name, logo, colors,
roles, sidebar tools, quick starts, sections, and data) lives in a **client profile**. A new
client is a new profile, not a new copy of the app.

This repo starts as a copy of `macs-workspace` (with the Pulse/Manny date fix). MACS becomes
the first client profile and stays the proof that the core can be resold.

## Steps

1. **Brand layer.** (Done) Move the name, logo, colors, tagline, and browser title into `profiles/<id>/profile.ts`.
   Pick the active profile with `WORKSPACE_PROFILE` in `.env.local`.
2. **Roles and tools.** Roles, role areas, sidebar tools, and quick starts come from the profile.
3. **Data and prompt.** The dataset, the "today" date, sections, and the system prompt's
   business description come from the profile. The core keeps the rules (citations, sample-data labels).
4. **Pulse and calendar.** Each profile supplies its own Pulse metrics and calendar sources.
5. **Profile 1: construction / preconstruction** (the owner's day job: preconstruction lead at a
   multifamily developer-builder, pricing SD/DD/Permit/GMP with Excel, BuildingConnected, Outlook,
   Bluebeam, and a takeoff tool). Rules: `docs/construction/leveling-spec.md`. Built in this order:
   1. **Leveling engine.** (Done) Pure, tested code for the spec's math and rules: tie-outs, blank vs $0,
      combined-or-split, unmapped dollars, headline / adjusted / normalized, status model, and the
      nine acceptance tests. Everything else sits on top of it.
   2. **Proposal intake.** (Done) Drop in proposal PDFs or email text; get a source-locked record (base,
      breakouts, alternates, allowances, exclusions, terms, drawing basis), a math audit, revision
      tracking, and `NOT STATED` for anything missing.
   3. **Bid form builder.** (Done) Native BC Line Items / Alternates / Inclusions, built around the project,
      tested so every bidder maps without fake breakouts.
   4. **Leveling sheet + BC plug table.** (Done) Companies across, form lines down, A-I deliverables, and a
      `READY TO PLUG` table to type into BC (no import format exists; entry stays manual).
   5. **Bidder-specific clarifications.** Drafted per bidder from that bidder's actual gaps.
   6. **Coverage board and bid calendar.** Who owes what; bids due, addenda, RFIs; Pulse shows
      trades not yet leveled, open clarifications, and bids due this week.
   Sample data only. No employer, project, vendor, or people names in the repo.
6. **Profile 2: MACS.** The current school setup, unchanged in behavior.
7. **Sources.** Spreadsheets and PDFs first (no accounts needed), then Notion, then
   Microsoft 365 / Outlook (employer accounts usually need IT approval).
8. **New-client command.** `npm run new-client -- <id>` copies a starter profile.

## Ground rules

- No real employer or client data in the repo. Sample data is labeled as sample data.
- Every client's secrets live in that client's `.env.local`, never in git.
- Check the employment agreement before selling anything built during work hours.
