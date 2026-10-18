/**
 * The coverage board: who owes what, trade by trade. Built from the portfolio's bid packages.
 *
 * Coverage rule (leveling spec): a bidder stays OPEN until a usable proposal arrives, the bidder
 * declines, or the user drops them. "Bidding" or opening the drawings is not a commitment, so an
 * open bidder still counts toward the chase. The board reads; it never changes a status, and the
 * chase emails are drafts the user sends from Outlook.
 *
 * Server only: the portfolio holds pricing. The board itself carries no amounts.
 */

import { longDate } from "./clarification-email.ts";
import { daysUntil, portfolio, PORTFOLIO_AS_OF, TARGET_BIDS, type BidderStatus } from "./portfolio.ts";

/** A bidder still bidding counts as stale (worth a check-in) after this many days without contact. */
export const STALE_DAYS = 3;

export interface BoardBidder {
  name: string;
  status: BidderStatus;
  lastContact: string;
  daysSinceContact: number;
  /** Still owes a proposal: bidding, or no response yet. */
  open: boolean;
  /** Open and worth a nudge now: no response, or bidding with no contact for STALE_DAYS or more. */
  chase: boolean;
}

export interface BoardTrade {
  package: string;
  project: string;
  projectName: string;
  trade: string;
  bidDue: string;
  daysUntilDue: number;
  closed: boolean;
  coverageStatus: string;
  leveling: string;
  invited: number;
  submitted: number;
  stillBidding: number;
  declined: number;
  noResponse: number;
  /** Bidders to add to reach the target, counting submitted and still-bidding but not silent bidders. */
  needMore: number;
  bidders: BoardBidder[];
  note?: string;
}

export interface ChaseEmail {
  package: string;
  bidder: string;
  subject: string;
  body: string;
}

export interface CallItem {
  rank: number;
  package: string;
  projectName: string;
  trade: string;
  bidder: string;
  status: BidderStatus;
  bidDue: string;
  daysUntilDue: number;
  daysSinceContact: number;
  coverageStatus: string;
  why: string;
}

export interface FindMore {
  package: string;
  projectName: string;
  trade: string;
  bidDue: string;
  daysUntilDue: number;
  needMore: number;
  text: string;
}

export interface CoverageBoard {
  asOf: string;
  target: number;
  projects: { id: string; name: string; stage: string; trades: BoardTrade[] }[];
  summary: { openTrades: number; atRisk: number; watch: number; covered: number; openBidders: number; toChase: number };
  callList: CallItem[];
  chaseEmails: ChaseEmail[];
  findMore: FindMore[];
}

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const projectName = (id: string) => portfolio.projects.find((p) => p.id === id)?.name ?? id;
const soonest = (ts: BoardTrade[]) => Math.min(...ts.filter((t) => !t.closed).map((t) => t.daysUntilDue), Number.MAX_SAFE_INTEGER);
const RISK_ORDER = (s: string) => (s === "AT RISK" ? 0 : s === "WATCH" ? 1 : 2);

/** "Hi [Name]," always: the portfolio has no bidder contacts, and a wrong name is worse than a blank. */
export function chaseEmail(t: BoardTrade, b: BoardBidder): ChaseEmail {
  const addenda = portfolio.addenda.filter((a) => a.project === t.project);
  const latest = addenda[addenda.length - 1];
  const ask =
    b.status === "No response"
      ? "We haven't heard back yet. Are you planning to bid?"
      : "Are you still on track to submit by then? If anything is holding you up, let us know.";
  const body = [
    "Hi [Name],",
    "",
    `Checking in on ${t.projectName}, ${t.trade} (${t.package}). Bids are due ${longDate(t.bidDue)}. ${ask}`,
    ...(latest ? ["", `${latest.number} (issued ${latest.issued}) is out. Please acknowledge it with your bid.`] : []),
    "",
    "If you're not bidding, a quick reply helps us plan coverage. Proposals go through BuildingConnected or by reply email.",
    "",
    "Thanks,",
    "[Your name]",
  ].join("\n");
  return { package: t.package, bidder: b.name, subject: `${t.projectName} ${t.trade}: bids due ${shortDate(t.bidDue)}`, body };
}

export function coverageBoard(asOf: string = PORTFOLIO_AS_OF): CoverageBoard {
  const trades: BoardTrade[] = portfolio.coverage.map((c) => {
    const daysUntilDue = daysUntil(c.bidDue, asOf);
    const closed = daysUntilDue < 0;
    const bidders = c.bidders.map((b) => {
      const daysSinceContact = -daysUntil(b.lastContact, asOf);
      const open = b.status === "Bidding" || b.status === "No response";
      return {
        name: b.name,
        status: b.status,
        lastContact: b.lastContact,
        daysSinceContact,
        open,
        chase: !closed && (b.status === "No response" || (b.status === "Bidding" && daysSinceContact >= STALE_DAYS)),
      };
    });
    return {
      package: c.package,
      project: c.project,
      projectName: projectName(c.project),
      trade: c.trade,
      bidDue: c.bidDue,
      daysUntilDue,
      closed,
      coverageStatus: closed && c.submitted < TARGET_BIDS ? `CLOSED WITH ${c.submitted} BID${c.submitted === 1 ? "" : "S"}` : c.coverageStatus,
      leveling: c.leveling,
      invited: c.invited,
      submitted: c.submitted,
      stillBidding: c.stillBidding,
      declined: c.declined,
      noResponse: c.noResponse,
      // Silent bidders don't count: they may never answer.
      needMore: closed ? 0 : Math.max(0, TARGET_BIDS - (c.submitted + c.stillBidding)),
      bidders,
      ...(c.note ? { note: c.note } : {}),
    };
  });

  const open = trades.filter((t) => !t.closed);
  const toChase = open.flatMap((t) => t.bidders.filter((b) => b.chase).map((b) => ({ t, b })));

  const callList: CallItem[] = toChase
    .sort(
      (x, y) =>
        RISK_ORDER(x.t.coverageStatus) - RISK_ORDER(y.t.coverageStatus) ||
        x.t.daysUntilDue - y.t.daysUntilDue ||
        y.b.daysSinceContact - x.b.daysSinceContact ||
        x.b.name.localeCompare(y.b.name),
    )
    .map(({ t, b }, i) => ({
      rank: i + 1,
      package: t.package,
      projectName: t.projectName,
      trade: t.trade,
      bidder: b.name,
      status: b.status,
      bidDue: t.bidDue,
      daysUntilDue: t.daysUntilDue,
      daysSinceContact: b.daysSinceContact,
      coverageStatus: t.coverageStatus,
      why: `${b.status === "No response" ? "No response" : "Bidding, quiet"} ${plural(b.daysSinceContact, "day")}; bids due in ${plural(t.daysUntilDue, "day")}; trade ${t.coverageStatus.toLowerCase()}.`,
    }));

  // Even if every bidder still bidding submits, these trades fall short of the target.
  const findMore: FindMore[] = open
    .filter((t) => t.needMore > 0)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .map((t) => {
      const short = t.needMore;
      return {
        package: t.package,
        projectName: t.projectName,
        trade: t.trade,
        bidDue: t.bidDue,
        daysUntilDue: t.daysUntilDue,
        needMore: short,
        text: `${t.projectName} ${t.trade}: ${t.submitted} in and ${t.stillBidding} still bidding against a target of ${TARGET_BIDS}. Invite ${plural(short, "more bidder")} from BuildingConnected${t.noResponse ? ` (the ${plural(t.noResponse, "silent bidder")} may never answer)` : ""}, ${t.daysUntilDue <= 7 ? "today" : "this week"}.`,
      };
    });

  return {
    asOf,
    target: TARGET_BIDS,
    projects: portfolio.projects
      .map((p) => ({
        id: p.id,
        name: p.name,
        stage: p.stage,
        trades: trades.filter((t) => t.project === p.id).sort((a, b) => Number(a.closed) - Number(b.closed) || a.daysUntilDue - b.daysUntilDue || RISK_ORDER(a.coverageStatus) - RISK_ORDER(b.coverageStatus)),
      }))
      .filter((p) => p.trades.length > 0)
      // Most urgent project first: the soonest open due date; projects with nothing open go last.
      .sort((a, b) => soonest(a.trades) - soonest(b.trades)),
    summary: {
      openTrades: open.length,
      atRisk: open.filter((t) => t.coverageStatus === "AT RISK").length,
      watch: open.filter((t) => t.coverageStatus === "WATCH").length,
      covered: open.filter((t) => t.coverageStatus === "COVERED").length,
      openBidders: open.reduce((n, t) => n + t.bidders.filter((b) => b.open).length, 0),
      toChase: toChase.length,
    },
    callList,
    chaseEmails: toChase.map(({ t, b }) => chaseEmail(t, b)),
    findMore,
  };
}
