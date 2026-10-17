# Construction profile: preconstruction leveling spec

The rules the bid leveler, bid form builder, and BuildingConnected plug table must follow. Distilled
from the owner's documented workflow, with every company, project, person, and dollar figure
removed. Examples use invented names and numbers.

> Do not make the proposal fit the spreadsheet. Understand the proposal, then the project scope, then
> build the cleanest structure that lets the bids be compared. Preserve vendor intent, expose missing
> scope, never fabricate precision, and make every dollar tie.

## Who this is for

A preconstruction lead at a multifamily (and some industrial) developer-builder who prices projects at
SD, DD, Permit, and GMP; packages trades; solicits subs through BuildingConnected and Outlook; levels
proposals; and explains cost to Development. Tools: Excel, BuildingConnected (BC), Outlook, Bluebeam,
a takeoff tool, a prequalification tool, Teams, and SharePoint/OneDrive.

## Workflow

Coverage -> proposal intake -> proposal audit -> bid form -> BC plug -> scope leveling ->
clarifications/RFIs -> estimate carry -> final review. Iterative, not a waterfall.

Trade deliverables, in this order:

| | Deliverable |
|---|---|
| A | Bid form |
| B | Bidders plugged into the form |
| C | Alternates / VE / adders |
| D | Scope matrix |
| E | Tie-out to source proposals |
| F | Adjusted / normalized comparison |
| G | Statuses and unresolved issues |
| H | Bidder-specific clarifications |
| I | Development bottom line |

## Proposal intake

1. Confirm project -> trade -> vendor -> proposal date -> revision -> drawing basis before any math.
2. Read every page. Capture base, breakouts, quantities, unit prices, alternates, allowances, tax, bond,
   OCIP/CCIP, install/delivery, engineering/shop drawings, permits, exclusions, commercial terms
   (deposit, mobilization, payment, suspension), validity/escalation, drawing basis.
3. Recalculate the proposal. Show vendor total, calculated total, and variance; never repair it silently.
4. Missing fields are `NOT STATED`. Preserve cents and vendor wording. Keep superseded revisions for
   history, never level them.
5. Text extraction first (`pdftotext -layout`); OCR only for image-only pages, flagged for a spot check.

Proposal record fields: Project, Package (exact BC number and name), Vendor, Vendor contact, Proposal
date, Revision, Drawing/spec basis, Base bid, Alternates, Allowances, Unit prices,
Exclusions/qualifications, Validity/escalation/deposit terms, Source file and pages, Vendor wording,
AI findings and open checks (kept separate).

## Bid form (BuildingConnected native)

Three sections:

- **Line Items**: section headers, then required lump-sum price rows by building / area / material
  (Residential, Amenity, Site, Garage, Additional Items...). Quantity and unit cost only when useful.
- **Alternates**: separate `ADD - ...` / `DEDUCT - ...` rows. Never hidden base breakouts.
- **Inclusions**: required Yes/No questions for real issues (tax, permits, bond, OCIP/CCIP,
  engineering, delivery, install, specific known gaps).

Rules:

- Build around the project and estimate, not one bidder. Use the project's package numbers and labels.
- Keep good vendor breakouts; do not dumb the form down to the weakest bidder.
- A line earns its place if it is a cost driver, ownership seam, known risk, Development decision,
  estimate row, or useful vendor breakout.
- `Complete Scope - Combined` is an optional fallback, never required, never populated alongside the
  detailed lines for the same bidder.
- No parent and child lines that can both be filled. No second summable "total" row.
- Do not overbuild. Do not add scope nobody bid unless it is a real risk or ownership item.
- If the user supplies a form, use it; do not redesign it.
- Show the form inline as directly enterable rows, not only as a file.

## Leveling

**Orientation:** companies across columns, bid-form lines down rows.

**Scope status (per bidder, per item), source-locked to that bidder's proposal:**
Vendor Confirmed - Included / Vendor Confirmed - Excluded / Partial / Conflicting Language / Not Stated.
Other bidders can raise a question but are never evidence of this bidder's scope.

**Evidence status:** VENDOR CONFIRMED / DOCUMENT INFERRED / ESTIMATOR ALLOCATION / UNRESOLVED.

**Cell meaning:**

| Value | Meaning |
|---|---|
| Dollar amount | Vendor gave a supported price |
| Blank | No breakout, unknown, or unresolved |
| $0 | Explicitly included at no separate cost, or properly included elsewhere |
| Excluded | Proposal explicitly excludes it |
| Included elsewhere | In the vendor base, no breakout; name the containing row |

**Rules:**

- Blank is never $0 and never an automatic "No".
- Count bundled dollars once. Combined OR split, never both.
- Base line item vs additional base item vs alternate: a separate breakout is not automatically an
  alternate.
- Unmapped vendor dollars stay visible: `Mapped + Unmapped = Vendor base, variance $0`.
- Estimating allocations only when asked, required by the estimate, or the only way BC can hold the
  proposal, with a defensible basis (drawings -> project scope records -> the vendor's own proposal ->
  other bidders as corroboration only -> estimator judgment last). Label:
  `ESTIMATING ALLOCATION - NOT VENDOR BREAKOUT`.
- Money not in the vendor bid is labeled `ESTIMATING ALLOWANCE - NOT IN VENDOR BID` with a type:
  Vendor Allowance / Owner Allowance / Estimating Allowance / Uncovered Exposure.
- Deducts: positive magnitude on a clearly labeled deduct row, subtracted in the formula; keep the
  source sign/text separately.
- Voluntary VE credits are memo only until accepted. Never net them into the carry.
- Trade ownership is project-specific; moving scope between packages needs a project decision, and the
  scope must not stay priced in both.

**Three comparisons:**

- **Headline:** raw vendor base vs raw vendor base.
- **Adjusted:** known required adds/deducts applied.
- **Normalized:** material scope differences reconciled. If material scope is still unpriced, the
  result is `TRUE NORMALIZED DELTA: UNKNOWN PENDING CLARIFICATION`.

`Normalized = quoted base + required adders + scope plugs + allowance adjustments - confirmed deducts`.
A scope question on the form (as opposed to a commercial one like tax or bond) that a bidder leaves not
stated, answers both ways, or excludes without a plug priced for it, is unpriced material scope: that
bidder's normalized total is unknown and it is not eligible to rank until the gap is priced or answered.
Every adjustment carries a reason and a source/status. Explain the spread: missing scope, bundles,
quantities, assemblies, exclusions, allowances, alternates, commercial terms, unresolved basis.

**Status model:**

| Status | Values |
|---|---|
| Source integrity | VERIFIED / SOURCE ISSUE / MATH ISSUE |
| BC plug | READY TO PLUG / HOLD |
| Leveling completeness | COMPLETE / READY WITH FLAGS / CLARIFICATION REQUIRED / INCOMPLETE |
| Ranking eligibility | ELIGIBLE / NOT ELIGIBLE |
| Estimate carry | CARRY RECOMMENDED / CARRY WITH ALLOWANCE / CARRY CANDIDATE / DO NOT CARRY / NOT EVALUATED |

A bid can be READY TO PLUG while NOT ELIGIBLE to rank. The carry is never "lowest" by default; it
weighs basis, completeness, alternates, allowances, exclusions, commercial terms, validity, schedule,
bond/insurance, coverage, vendor quality, and Development direction. The final carry is the user's call.

**Red flags:** stale drawing set; budget (not firm) proposal; short validity; escalation clause; large
deposit or mobilization; no bond or high bond add; OCIP/CCIP or tax ambiguity; wrong unit count; options
or conditional delivery inside the base total; exclusions hidden in general terms; parent and child both
priced; included in one section and excluded in another; project add buried in Misc; cross-trade scope
carried by nobody or by two trades.

## BuildingConnected plug table

Live BC entry is manual and there is no verified import format. The workspace produces a plug table
the user types in, and says `READY TO PLUG`, never `ENTERED`, unless the user confirms entry.

Internal record per cell: Project | Round | Package | Bidder | Proposal date/revision | Source file/page
| Form row | Quoted amount | Included-in row / scope status | Adjustment type | Adjustment amount |
Basis/status | Clarification.

Entry sequence: match project and round -> confirm row names and order -> map source prices -> hold
unsupported splits -> record supported inclusion answers -> separate alternates -> reconcile base totals
-> reconcile internal adjustments -> review the carry -> verify what was saved.

## Clarifications

Read each proposal before writing its email. Questions are specific to that bidder's actual gaps; never
the same list for everyone, never asking for scope the bidder already included. Ask what is included,
what changes the price, and the revised total. Drafts only; the user sends.

## Coverage

Every bidder stays OPEN until a usable proposal arrives, the bidder declines, or the user drops them.
"Bidding" or drawing opens are not a commitment. Check Outlook as well as BC for proposals.

## Acceptance tests (must hold in code)

1. A bundled $100,000 item never becomes $200,000 because it appears on two rows.
2. An unpriced item never becomes a confirmed $0 inclusion.
3. A source vs BC mismatch stays open until resolved.
4. A voluntary deduct never reduces the carry without an accepted decision.
5. A revised proposal never erases its predecessor; only the latest is leveled.
6. Scope moved between packages is never priced in both.
7. A draft email, form, or carry is never reported as sent, published, entered, or approved.
8. Mapped + unmapped dollars equal the vendor base to the cent, or the variance is shown.
9. A comparison with unpriced material scope is never labeled normalized.

## Definition of done (per trade)

Every proposal audited; every base ties; the form holds all bidders without fake breakouts; scope
coverage visible; alternates separate; ownership checked; required adds/deducts identified; ranking
eligibility and carry stated; clarifications drafted; Development can follow the result without opening
every proposal.

## Output style

Useful, not performative; no filler. Primary deliverable inline in clear tables. Simple Excel (columns:
Description, Area, Notes, Sub, Qty, UOM, Unit Cost, Total), trade hard costs first, room for the user's
comps, green = included. Short, direct construction emails. Keep moving on non-blocking uncertainty;
stop only when a material decision or source gap prevents a defensible answer. Never send email or
change live systems without explicit approval.
