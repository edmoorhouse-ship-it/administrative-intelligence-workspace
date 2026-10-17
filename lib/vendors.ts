import { DATA_AS_OF } from "./data-notice";
import type { DecisionCard } from "./tool-pages";
import { MAX_TOOL_CONTEXT } from "./tools";

/**
 * Vendor agreements: SAMPLE DATA ONLY. Each vendor is a generic stand-in tied to something already
 * in the sample dataset (the roof quote, the HVAC repair, the custodial bid, contracted services),
 * never a real company with invented terms. No contract system, CRM, email, or document store is
 * connected, so this is not a search of MACS records. Not legal advice: verify against the
 * executed documents.
 */

export type AgreementType =
  | "License"
  | "Service agreement"
  | "DPA"
  | "Insurance certificate"
  | "Background screening"
  | "W-9"
  | "Quote"
  | "Engagement letter"
  | "Purchasing terms";

export type AgreementStatus = "active" | "expired" | "pending" | "negotiation" | "received" | "fulfilled" | "missing";

export interface Agreement {
  type: AgreementType;
  status: AgreementStatus;
  effectiveIso?: string;
  expiresIso?: string;
  autoRenew?: { months: number; noticeDays: number };
  terms?: string;
  location?: string;
  note?: string;
}

export type VendorKind = "software" | "service" | "contractor" | "supplier" | "professional";

export interface Vendor {
  id: string;
  name: string;
  kind: VendorKind;
  relationship: string;
  /** Holds or sees student or family records. */
  studentData: boolean;
  /** Works on campus around students. */
  onCampus: boolean;
  /** Ties to the rest of the sample dataset. */
  link?: string;
  agreements: Agreement[];
}

export const STATUS_LABEL: Record<AgreementStatus, string> = {
  active: "Active",
  expired: "Expired",
  pending: "Pending signature",
  negotiation: "In negotiation",
  received: "Received",
  fulfilled: "Fulfilled",
  missing: "Not on file",
};

export const KIND_LABEL: Record<VendorKind, string> = {
  software: "Software",
  service: "Contracted service",
  contractor: "Contractor",
  supplier: "Supplier",
  professional: "Professional services",
};

const DRIVE = "Finance shared drive › Contracts (sample)";
const BINDER = "Front office contracts binder (sample)";

export const SAMPLE_VENDORS: Vendor[] = [
  {
    id: "v-messaging",
    name: "Family messaging platform (sample)",
    kind: "software",
    relationship: "Weekly newsletter and family messages",
    studentData: true,
    onCampus: false,
    link: "ParentSquare is named as the platform in the sample dataset; these terms are illustrative, not that company's.",
    agreements: [
      {
        type: "License",
        status: "active",
        effectiveIso: "2025-11-01",
        expiresIso: "2026-10-31",
        autoRenew: { months: 12, noticeDays: 30 },
        terms: "Liability capped at 12 months of fees. Vendor's home-state law. Either side may end it at renewal with notice.",
        location: DRIVE,
      },
      { type: "DPA", status: "missing", note: "The platform holds family contact details and student names." },
    ],
  },
  {
    id: "v-diagnostic",
    name: "Diagnostic & instruction software (sample)",
    kind: "software",
    relationship: "K-7 diagnostic and practice lessons",
    studentData: true,
    onCampus: false,
    link: "Stands in for the i-Ready line in the curriculum budget.",
    agreements: [
      { type: "License", status: "active", effectiveIso: "2026-07-01", expiresIso: "2027-06-30", terms: "Annual license, paid up front. No auto-renewal.", location: DRIVE },
      { type: "DPA", status: "active", effectiveIso: "2024-07-15", expiresIso: "2027-06-30", terms: "Student data used only to provide the service; deleted within 60 days of the license ending.", location: DRIVE },
    ],
  },
  {
    id: "v-slp",
    name: "Contracted speech-language services (sample)",
    kind: "service",
    relationship: "Speech-language therapy, Tuesdays and Thursdays (C-SLP)",
    studentData: true,
    onCampus: true,
    link: "C-SLP in the staffing roster; three sessions missed in October.",
    agreements: [
      {
        type: "Service agreement",
        status: "active",
        effectiveIso: "2026-08-01",
        expiresIso: "2027-05-31",
        terms: "Hourly rate; either side may end it with 30 days' notice. Confidentiality clause covers student records. Make-up sessions owed for provider absences.",
        location: DRIVE,
      },
      { type: "DPA", status: "active", effectiveIso: "2026-08-01", expiresIso: "2027-05-31", terms: "Included as an exhibit to the service agreement.", location: DRIVE },
      { type: "Insurance certificate", status: "expired", expiresIso: "2026-09-30", note: "Professional liability certificate lapsed; a renewed certificate hasn't come in." },
      { type: "Background screening", status: "active", effectiveIso: "2026-07-20", location: BINDER },
    ],
  },
  {
    id: "v-counseling",
    name: "Contracted counseling services (sample)",
    kind: "service",
    relationship: "School counselor, Mon/Wed/Fri (C-COUN)",
    studentData: true,
    onCampus: true,
    link: "C-COUN in the staffing roster.",
    agreements: [
      {
        type: "Service agreement",
        status: "pending",
        effectiveIso: "2026-07-01",
        expiresIso: "2027-06-30",
        terms: "Renewal draft sent to the provider 2026-10-02. The prior agreement ended 2026-06-30, so services since July have run without a signed agreement.",
        location: DRIVE,
      },
      { type: "DPA", status: "pending", note: "Exhibit to the pending service agreement." },
      { type: "Insurance certificate", status: "active", expiresIso: "2027-03-31", location: BINDER },
      { type: "Background screening", status: "active", effectiveIso: "2025-07-10", location: BINDER },
    ],
  },
  {
    id: "v-roof",
    name: "Roofing contractor (sample)",
    kind: "contractor",
    relationship: "Roof flashing repair above Room 4 (FAC-041)",
    studentData: false,
    onCampus: true,
    link: "FAC-041: quote of $6,800 awaiting board approval on Nov 10.",
    agreements: [
      {
        type: "Quote",
        status: "received",
        effectiveIso: "2026-09-25",
        expiresIso: "2026-10-25",
        terms: "$6,800 fixed price, valid 30 days. Over the $5,000 line, so it needs board approval before signing.",
        location: DRIVE,
      },
      { type: "Service agreement", status: "missing", note: "Not drafted until the board approves the quote." },
      { type: "Insurance certificate", status: "missing" },
      { type: "W-9", status: "active", effectiveIso: "2026-09-25", location: DRIVE },
      { type: "Background screening", status: "missing", note: "Needed if crews work while students are on campus." },
    ],
  },
  {
    id: "v-hvac",
    name: "HVAC contractor (sample)",
    kind: "contractor",
    relationship: "Preventive maintenance; Modular B compressor (FAC-044)",
    studentData: false,
    onCampus: true,
    link: "FAC-044: temporary repair done; replacement quote of $9,400 pending.",
    agreements: [
      {
        type: "Service agreement",
        status: "active",
        effectiveIso: "2025-12-01",
        expiresIso: "2026-11-30",
        autoRenew: { months: 12, noticeDays: 60 },
        terms: "Quarterly maintenance visits; repairs billed separately. Liability capped at the contract value.",
        location: DRIVE,
      },
      { type: "Quote", status: "negotiation", note: "Compressor replacement, about $9,400. Needs board approval." },
      { type: "Insurance certificate", status: "active", expiresIso: "2027-01-31", location: BINDER },
      { type: "W-9", status: "active", effectiveIso: "2025-11-20", location: DRIVE },
      { type: "Background screening", status: "active", effectiveIso: "2025-11-20", location: BINDER },
    ],
  },
  {
    id: "v-custodial",
    name: "Custodial services (sample)",
    kind: "service",
    relationship: "After-hours cleaning, modular buildings",
    studentData: false,
    onCampus: true,
    link: "The custodial RFP scoring sheets are the subject of an open public records request (PRR-2026-09).",
    agreements: [
      {
        type: "Service agreement",
        status: "active",
        effectiveIso: "2024-11-01",
        expiresIso: "2026-12-31",
        terms: "Monthly fee; 60 days' notice to end early. Does not renew. Replacement RFP scored 2026-10-06; award goes to the board Nov 10.",
        location: DRIVE,
      },
      { type: "Insurance certificate", status: "active", expiresIso: "2026-12-31", location: BINDER },
      { type: "Background screening", status: "active", effectiveIso: "2024-10-15", location: BINDER },
      { type: "W-9", status: "active", effectiveIso: "2024-10-15", location: DRIVE },
    ],
  },
  {
    id: "v-fire",
    name: "Fire & life-safety inspections (sample)",
    kind: "contractor",
    relationship: "Annual extinguisher inspection (FAC-046)",
    studentData: false,
    onCampus: true,
    link: "FAC-046: inspection due in November; vendor not yet booked.",
    agreements: [
      { type: "Service agreement", status: "expired", effectiveIso: "2025-07-01", expiresIso: "2026-06-30", terms: "Annual inspection and tagging. Not renewed.", location: DRIVE },
      { type: "Insurance certificate", status: "expired", expiresIso: "2026-06-30" },
      { type: "W-9", status: "active", effectiveIso: "2025-06-20", location: DRIVE },
      { type: "Background screening", status: "missing" },
    ],
  },
  {
    id: "v-office",
    name: "Office supply vendor (sample)",
    kind: "supplier",
    relationship: "Paper, pencils, markers (Restock)",
    studentData: false,
    onCampus: false,
    agreements: [
      { type: "Purchasing terms", status: "active", effectiveIso: "2023-08-01", terms: "Net 30; ordered by purchase order. No end date.", location: DRIVE },
      { type: "W-9", status: "active", effectiveIso: "2023-08-01", location: DRIVE },
    ],
  },
  {
    id: "v-audit",
    name: "Independent auditor (sample)",
    kind: "professional",
    relationship: "Annual financial audit",
    studentData: false,
    onCampus: false,
    link: "FY2025-26 audit submitted to ACPS on 2026-09-28.",
    agreements: [
      { type: "Engagement letter", status: "fulfilled", effectiveIso: "2026-05-01", expiresIso: "2026-09-30", terms: "FY2025-26 audit, fixed fee.", location: DRIVE, note: "Confidentiality duties continue after the engagement ends." },
      { type: "W-9", status: "active", effectiveIso: "2026-05-01", location: DRIVE },
    ],
  },
];

const DAY = 86_400_000;
export const daysUntil = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${DATA_AS_OF}T12:00:00`)) / DAY);
const minusDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00`) - days * DAY).toISOString().slice(0, 10);
export const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** What a relationship like this one should have on file. */
export function expectedTypes(v: Vendor): AgreementType[] {
  const primary: Record<VendorKind, AgreementType> = {
    software: "License",
    service: "Service agreement",
    contractor: "Service agreement",
    supplier: "Purchasing terms",
    professional: "Engagement letter",
  };
  return [
    primary[v.kind],
    ...(v.studentData ? (["DPA"] as AgreementType[]) : []),
    ...(v.onCampus ? (["Insurance certificate", "Background screening"] as AgreementType[]) : []),
    ...(v.kind === "contractor" || v.kind === "supplier" || v.kind === "professional" ? (["W-9"] as AgreementType[]) : []),
  ];
}

const OK: AgreementStatus[] = ["active", "fulfilled"];

export interface Coverage {
  type: AgreementType;
  ok: boolean;
  status: AgreementStatus;
  why: string;
}

/** Each expected document and whether a current one is on file, with why it's expected. */
export function coverage(v: Vendor): Coverage[] {
  return expectedTypes(v).map((type) => {
    const found = v.agreements.filter((a) => a.type === type);
    const best = found.find((a) => OK.includes(a.status)) ?? found[0];
    const why =
      type === "DPA"
        ? "Holds student or family records"
        : type === "Insurance certificate"
          ? "Works on campus"
          : type === "Background screening"
            ? "Around students (Level 2 screening; verify with ACPS)"
            : type === "W-9"
              ? "Paid vendor"
              : "Main agreement";
    return { type, ok: Boolean(best && OK.includes(best.status)), status: best?.status ?? "missing", why };
  });
}

export interface Upcoming {
  vendor: Vendor;
  text: string;
  dueIso: string;
  days: number;
  urgent: boolean;
}

/** Expirations and renewal-notice deadlines in the next 90 days, and notice windows that just closed. */
export function upcoming(vendors: Vendor[]): Upcoming[] {
  const items: Upcoming[] = [];
  for (const v of vendors) {
    for (const a of v.agreements) {
      if (!a.expiresIso || a.status === "fulfilled" || a.status === "missing") continue;
      const days = daysUntil(a.expiresIso);
      if (a.autoRenew) {
        const noticeBy = minusDays(a.expiresIso, a.autoRenew.noticeDays);
        const noticeDays = daysUntil(noticeBy);
        if (noticeDays < 0 && days >= 0) {
          items.push({ vendor: v, dueIso: a.expiresIso, days, urgent: true, text: `${a.type} renews on its own for ${a.autoRenew.months} months when it ends ${shortDate(a.expiresIso)}. The ${a.autoRenew.noticeDays}-day notice window closed ${shortDate(noticeBy)}.` });
        } else if (noticeDays <= 90) {
          items.push({ vendor: v, dueIso: noticeBy, days: noticeDays, urgent: noticeDays <= 30, text: `Decide on renewal: notice due ${shortDate(noticeBy)}, or the ${a.type.toLowerCase()} renews ${shortDate(a.expiresIso)}.` });
        }
      } else if (days >= 0 && days <= 90) {
        const text =
          a.type === "Quote"
            ? `Quote stops being valid ${shortDate(a.expiresIso)}.`
            : a.type === "Insurance certificate"
              ? `Insurance certificate runs out ${shortDate(a.expiresIso)}. Ask for the new one before then.`
              : `${a.type} ends ${shortDate(a.expiresIso)} and doesn't renew.`;
        items.push({ vendor: v, dueIso: a.expiresIso, days, urgent: days <= 30, text });
      } else if (days < 0 && a.status !== "expired" && a.status !== "pending") {
        items.push({ vendor: v, dueIso: a.expiresIso, days, urgent: true, text: `${a.type} ran out ${shortDate(a.expiresIso)}.` });
      }
    }
  }
  return items.sort((x, y) => x.days - y.days);
}

export function vendorLine(v: Vendor) {
  const cov = coverage(v);
  return [
    `${v.name} (${KIND_LABEL[v.kind]}; ${v.relationship}${v.studentData ? "; holds student/family data" : ""}${v.onCampus ? "; on campus" : ""}).`,
    ...v.agreements.map(
      (a) =>
        `  - ${a.type}: ${STATUS_LABEL[a.status]}${a.effectiveIso ? `, from ${a.effectiveIso}` : ""}${a.expiresIso ? `, ends ${a.expiresIso}` : ""}${a.autoRenew ? `, auto-renews ${a.autoRenew.months} months with ${a.autoRenew.noticeDays} days' notice` : ""}${a.terms ? `. ${a.terms}` : ""}${a.note ? ` ${a.note}` : ""}`,
    ),
    `  Missing or not current: ${cov.filter((c) => !c.ok).map((c) => `${c.type} (${STATUS_LABEL[c.status]})`).join(", ") || "none"}.`,
    v.link ? `  Link to the dataset: ${v.link}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function vendorsContext(vendors: Vendor[], selected: Vendor | null) {
  const text = [
    `Vendor agreements (SAMPLE: generic stand-ins, not MACS records). As of ${DATA_AS_OF}. Sources checked: this sample list only. Not connected: contract system (CLM), CRM, email, document storage, chat. Not legal advice; verify against executed documents.`,
    "Coming up in 90 days:",
    ...upcoming(vendors).map((u) => `- ${u.vendor.name}: ${u.text}`),
    selected ? `Selected vendor:\n${vendorLine(selected)}` : "",
    "All vendors:",
    ...vendors.map(vendorLine),
  ]
    .filter(Boolean)
    .join("\n");
  return text.length > MAX_TOOL_CONTEXT ? `${text.slice(0, MAX_TOOL_CONTEXT - 1)}…` : text;
}

const find = (id: string) => SAMPLE_VENDORS.find((v) => v.id === id)!;

/** The three gaps worth a decision this week. */
export const VENDOR_CARDS: DecisionCard[] = [
  {
    id: "vendor-counseling-unsigned",
    title: "Counseling has run since July without a signed agreement",
    detail: `${find("v-counseling").name}: the renewal draft went out Oct 2 and isn't signed. The prior agreement ended June 30.`,
    urgency: "critical",
    options: [
      {
        id: "draft",
        label: "Draft a follow-up to the provider",
        ask: "Draft a short, friendly note to our contracted counseling provider asking them to sign and return the renewal service agreement (with its data protection exhibit) sent Oct 2, noting the prior agreement ended June 30. Mark it as a draft for me to send.",
      },
      { id: "call", label: "I'll call them" },
      { id: "later", label: "Not now" },
    ],
  },
  {
    id: "vendor-roof-quote",
    title: "The roof quote runs out before the board meets",
    detail: "The $6,800 roofing quote is valid through Oct 25. The board can't approve it until Nov 10.",
    urgency: "warn",
    options: [
      {
        id: "draft",
        label: "Ask the contractor to extend it",
        ask: "Draft a short note to our roofing contractor asking them to hold their $6,800 quote for the Room 4 flashing repair (FAC-041) through our Nov 10 board meeting, and to send a current insurance certificate. Mark it as a draft for me to send.",
      },
      { id: "special", label: "Ask the chair about a special meeting" },
      { id: "later", label: "Not now" },
    ],
  },
  {
    id: "vendor-messaging-dpa",
    title: "The family messaging platform has no DPA on file",
    detail: "It holds family contact details and student names. Its license renews on its own Oct 31; the notice window closed Oct 1.",
    urgency: "warn",
    options: [
      {
        id: "draft",
        label: "Draft a DPA request",
        ask: "Draft a short email to our family messaging platform's account contact asking for their standard student data privacy agreement (DPA) for a Florida public charter school, before the license renews at the end of October. Mark it as a draft for me to send.",
      },
      { id: "onfile", label: "We have one somewhere" },
      { id: "later", label: "Not now" },
    ],
  },
];
