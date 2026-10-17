# Administrative Intelligence Workspace: plan

One codebase, many businesses. The core is the workspace itself: chat, Manny, Calendar, Pulse,
shared brain, sign-in, and roles. Everything that belongs to one business (name, logo, colors,
roles, sidebar tools, quick starts, sections, and data) lives in a **client profile**. A new
client is a new profile, not a new copy of the app.

This repo starts as a copy of `macs-workspace` (with the Pulse/Manny date fix). MACS becomes
the first client profile and stays the proof that the core can be resold.

## Steps

1. **Brand layer.** Move the name, logo, colors, tagline, and browser title into `profiles/<id>/profile.ts`.
   Pick the active profile with `WORKSPACE_PROFILE` in `.env.local`.
2. **Roles and tools.** Roles, role areas, sidebar tools, and quick starts come from the profile.
3. **Data and prompt.** The dataset, the "today" date, sections, and the system prompt's
   business description come from the profile. The core keeps the rules (citations, sample-data labels).
4. **Pulse and calendar.** Each profile supplies its own Pulse metrics and calendar sources.
5. **Profile 1: construction / estimating** (the owner's day job: estimator at a commercial GC,
   using Excel, Bluebeam, BuildingConnected, and Outlook). Built in this order, biggest time saver first:
   1. **Bid leveler.** Drop in sub proposals (PDF or email text). The workspace pulls out base
      price, alternates, inclusions, exclusions, and qualifications into one side-by-side sheet per
      trade, flags scope gaps against the bid form, and suggests plugs for missing scope.
   2. **Bid form builder.** Build the trade-by-trade bid form from the spec sections and drawing
      list, so every sub prices the same scope.
   3. **BuildingConnected export.** Write the leveled numbers out in the exact column layout
      BuildingConnected takes, ready to paste or import.
   4. **Sub quote chaser.** Who was invited, who has bid, who to follow up with, and drafted
      follow-up emails (drafts only, never sent automatically).
   5. **Bid calendar and Pulse.** Bid due dates, walkthroughs, pre-bid meetings, addenda received,
      RFI deadlines; Pulse shows bids due this week, trades with fewer than three numbers, and open addenda.
   Sample data only until the employer's data rules are known.
6. **Profile 2: MACS.** The current school setup, unchanged in behavior.
7. **Sources.** Spreadsheets and PDFs first (no accounts needed), then Notion, then
   Microsoft 365 / Outlook (employer accounts usually need IT approval).
8. **New-client command.** `npm run new-client -- <id>` copies a starter profile.

## Ground rules

- No real employer or client data in the repo. Sample data is labeled as sample data.
- Every client's secrets live in that client's `.env.local`, never in git.
- Check the employment agreement before selling anything built during work hours.
