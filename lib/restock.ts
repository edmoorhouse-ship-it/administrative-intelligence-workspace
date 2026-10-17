import { DATA_AS_OF } from "./macs-data";

/**
 * Restock math for MACS supplies. Follows the restock chain's rules: size each order to a
 * fixed number of days of cover, never reorder an item with no recent use, and show dollars
 * next to units. Nothing here sends a purchase order or pays anyone.
 *
 * Every count, use rate, lead time, and price the staff enter is the source of truth. The
 * starter items are SAMPLE values so the page has something to show before real counts exist.
 */

export interface RestockItem {
  id: string;
  name: string;
  vendor: string;
  count: number; // units on hand
  weeklyUse: number; // units used per week, from recent history
  leadDays: number; // days from order to delivery
  unitPrice: number; // USD per unit
  onOrder: number; // units ordered and not yet received
  note: string;
}

export type RestockStatus = "good" | "warn" | "critical" | "na";

/** Order size: buy enough for this many days of use. MACS default, matching the skill's 60-day sizing. */
export const TARGET_DAYS = 60;
/** Safety days added to lead time to set the reorder point. MACS default. */
export const SAFETY_DAYS = 7;
/** Board approval threshold from the dataset's fiscal policy (sample). */
export const BOARD_APPROVAL_ABOVE = 5000;

export const SCHOOL_SHIP_TO =
  "Micanopy Area Cooperative School, 802 NW Seminary Ave., Micanopy, FL 32667";

export const SAMPLE_ITEMS: RestockItem[] = [
  { id: "s1", name: "Copy paper, 8.5 x 11 (case)", vendor: "Office supply vendor", count: 6, weeklyUse: 3, leadDays: 7, unitPrice: 42, onOrder: 0, note: "" },
  { id: "s2", name: "Disinfectant wipes (canister)", vendor: "Janitorial supplier", count: 4, weeklyUse: 1.5, leadDays: 10, unitPrice: 18, onOrder: 0, note: "" },
  { id: "s3", name: "Hand soap refill (gallon)", vendor: "Janitorial supplier", count: 3, weeklyUse: 1, leadDays: 7, unitPrice: 11, onOrder: 1, note: "One case already ordered" },
  { id: "s4", name: "Bandages, assorted (box)", vendor: "Medical supply vendor", count: 2, weeklyUse: 0.5, leadDays: 14, unitPrice: 9, onOrder: 0, note: "" },
  { id: "s5", name: "Pencils, #2 (box of 12)", vendor: "Office supply vendor", count: 15, weeklyUse: 4, leadDays: 7, unitPrice: 6, onOrder: 0, note: "" },
  { id: "s6", name: "Expo markers (pack of 4)", vendor: "Office supply vendor", count: 0, weeklyUse: 1, leadDays: 7, unitPrice: 14, onOrder: 0, note: "Out of stock last week, so recent use is understated" },
  { id: "s7", name: "Tissues (box)", vendor: "Janitorial supplier", count: 12, weeklyUse: 0, leadDays: 7, unitPrice: 4, onOrder: 0, note: "No use recorded this term" },
];

export interface ComputedItem {
  item: RestockItem;
  dailyUse: number;
  coverDays: number | null; // on hand only; null when the item has no recent use
  stockoutIso: string | null;
  orderNow: boolean;
  orderQty: number;
  cost: number;
  status: RestockStatus;
  label: string;
}

const DAY_MS = 86_400_000;

const isoPlusDays = (days: number) => new Date(Date.parse(`${DATA_AS_OF}T12:00:00`) + days * DAY_MS).toISOString().slice(0, 10);

export function computeItem(item: RestockItem): ComputedItem {
  const dailyUse = item.weeklyUse / 7;
  if (dailyUse <= 0) {
    return {
      item,
      dailyUse,
      coverDays: null,
      stockoutIso: null,
      orderNow: false,
      orderQty: 0,
      cost: 0,
      status: "na",
      label: "No recent use, not reordered",
    };
  }

  const coverDays = item.count / dailyUse;
  const effectiveCover = (item.count + item.onOrder) / dailyUse;
  const reorderPointDays = item.leadDays + SAFETY_DAYS;
  const orderNow = effectiveCover <= reorderPointDays;
  const orderQty = orderNow ? Math.max(0, Math.ceil(TARGET_DAYS * dailyUse - item.count - item.onOrder)) : 0;

  // Critical: the shelf runs out before a new order could be delivered.
  const status: RestockStatus = coverDays <= item.leadDays ? "critical" : orderNow ? "warn" : "good";
  const label =
    status === "critical"
      ? "Runs out before a new delivery"
      : status === "warn"
        ? "Order now"
        : "Covered";

  return {
    item,
    dailyUse,
    coverDays,
    stockoutIso: isoPlusDays(Math.floor(coverDays)),
    orderNow,
    orderQty,
    cost: orderQty * item.unitPrice,
    status,
    label,
  };
}

export function computeAll(items: RestockItem[]) {
  const rows = items.map(computeItem);
  const toOrder = rows.filter((r) => r.orderNow && r.orderQty > 0);
  const committed = toOrder.reduce((sum, r) => sum + r.cost, 0);
  const vendors = [...new Set(toOrder.map((r) => r.item.vendor))];
  return {
    rows,
    toOrder,
    committed,
    vendors,
    needsBoard: committed > BOARD_APPROVAL_ABOVE,
  };
}

export const usd = (n: number) => `USD ${Math.round(n).toLocaleString("en-US")}`;

/** Purchase-order draft for one vendor. Marked as a draft: it is not sent, and nothing is paid. */
export function poDraft(vendor: string, lines: ComputedItem[], dateIso: string): string {
  const total = lines.reduce((sum, r) => sum + r.cost, 0);
  const body = lines.map(
    (r) => `- ${r.item.name}: ${r.orderQty} x ${usd(r.item.unitPrice)} = ${usd(r.cost)}`,
  );
  return [
    "PURCHASE ORDER: DRAFT, NOT SENT",
    `Vendor: ${vendor}`,
    `Date: ${dateIso}`,
    `Ship to: ${SCHOOL_SHIP_TO}`,
    "",
    ...body,
    "",
    `Total: ${usd(total)}`,
    "Approved by: [name and date, after owner approval]",
  ].join("\n");
}
