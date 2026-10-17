import { macsData } from "./macs-data";

/**
 * Tax and filings checklist for MACS. This is a list of questions for the school's
 * accountant, not tax advice. It gives no due dates, rates, or amounts of tax owed:
 * a public charter school's filing obligations depend on how it is organized, and
 * the accountant decides that first.
 */

export interface ChecklistItem {
  title: string;
  why: string;
  ask: string[];
}

const usd = (n: number) => `USD ${Math.round(n).toLocaleString("en-US")}`;

const contractedServices = macsData.finance.expenses.find((e) => e.line.startsWith("ESE contracted services"));

export const TAX_NOTE =
  "Prepared for review by the school's accountant. This is a list of questions to confirm, not tax advice. No due dates or amounts are given here; the accountant confirms each one.";

export const TAX_CHECKLIST: ChecklistItem[] = [
  {
    title: "Confirm the school's tax status",
    why: "Which federal and state filings apply depends on how the school is organized. Confirm this first, because everything below depends on it.",
    ask: [
      "Does the school file a federal return or Form 990, or is it treated as a government unit?",
      "Which state filings apply to the school?",
    ],
  },
  {
    title: "Payroll filings",
    why: "If the school is the employer for its staff, there is recurring payroll reporting: federal payroll returns, year-end wage forms, and state unemployment reporting.",
    ask: [
      "Which payroll returns and year-end forms apply to the school?",
      "Are the payroll registers for the tax year reconciled to the general ledger?",
    ],
  },
  {
    title: "Contractor payments (1099 question)",
    why: `Payments to individuals or businesses for services can require 1099 reporting. The sample dataset budgets ${contractedServices ? usd(contractedServices.budget) : "an amount"} for contracted ESE services, and its roster lists a contracted speech-language pathologist and a contracted counselor.`,
    ask: [
      "Which contracted providers need a 1099 for the tax year?",
      "Is a current W-9 on file for each contracted provider?",
    ],
  },
  {
    title: "Records to send the accountant",
    why: "Most filings go faster when the same records are ready at the start.",
    ask: [
      "General ledger and vendor detail for the tax year",
      "Board minutes showing approval of major contracts and purchases",
      "Contractor agreements and W-9s",
    ],
  },
];
