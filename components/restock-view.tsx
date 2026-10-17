"use client";

import { useState } from "react";
import { Copy, Package } from "lucide-react";
import { newId } from "@/lib/chat-utils";
import { DATA_AS_OF } from "@/lib/macs-data";
import {
  computeAll,
  computeItem,
  poDraft,
  SAMPLE_ITEMS,
  SAFETY_DAYS,
  TARGET_DAYS,
  usd,
  type ComputedItem,
  type RestockItem,
  type RestockStatus,
} from "@/lib/restock";
import { restockContext } from "@/lib/tool-pages";
import { logActivityOnce, useShared } from "@/lib/shared-client";
import { copyText } from "./clipboard";
import { SheetGrid, type SheetColumn, type SheetTone } from "./sheet-grid";
import { ToolChat, type ToolDock } from "./tool-dock";

const STATUS_TONE: Record<RestockStatus, SheetTone | undefined> = { critical: "bad", warn: "neutral", good: "good", na: undefined };

const textField = (key: "name" | "vendor" | "note") => ({
  get: (it: RestockItem) => it[key],
  set: (it: RestockItem, v: string | number) => ({ ...it, [key]: String(v) }),
});
const numberField = (key: "count" | "weeklyUse" | "leadDays" | "unitPrice" | "onOrder") => ({
  get: (it: RestockItem) => it[key],
  set: (it: RestockItem, v: string | number) => ({ ...it, [key]: Math.max(0, Number(v)) }),
});

/** The calculated columns follow computeItem in lib/restock.ts; the formulas give Excel the same math. */
const ITEM_COLUMNS: SheetColumn<RestockItem>[] = [
  { key: "name", header: "Item", width: 200, kind: "text", ...textField("name") },
  { key: "vendor", header: "Vendor", width: 160, kind: "text", ...textField("vendor") },
  { key: "count", header: "On hand", width: 70, kind: "number", ...numberField("count") },
  { key: "weekly", header: "Used / week", width: 84, kind: "number", decimals: 1, ...numberField("weeklyUse") },
  { key: "lead", header: "Lead days", width: 74, kind: "number", ...numberField("leadDays") },
  { key: "price", header: "Unit price (USD)", width: 104, kind: "number", fixed: 2, ...numberField("unitPrice") },
  { key: "onOrder", header: "On order", width: 70, kind: "number", ...numberField("onOrder") },
  {
    key: "cover",
    header: "Days of cover",
    width: 92,
    kind: "computed",
    numeric: true,
    get: (it) => computeItem(it).coverDays,
    formula: (r, L) => `=IF(${L("weekly")}${r}<=0,"",${L("count")}${r}/(${L("weekly")}${r}/7))`,
  },
  {
    key: "qty",
    header: "Order qty",
    width: 76,
    kind: "computed",
    numeric: true,
    get: (it) => computeItem(it).orderQty,
    formula: (r, L) => {
      const [c, w, l, o] = [L("count") + r, L("weekly") + r, L("lead") + r, L("onOrder") + r];
      return `=IF(${w}<=0,0,IF((${c}+${o})/(${w}/7)<=${l}+${SAFETY_DAYS},MAX(0,ROUNDUP(${TARGET_DAYS}*${w}/7-${c}-${o},0)),0))`;
    },
  },
  {
    key: "cost",
    header: "Cost (USD)",
    width: 96,
    kind: "computed",
    numeric: true,
    fixed: 2,
    sum: true,
    get: (it) => computeItem(it).cost,
    formula: (r, L) => `=${L("qty")}${r}*${L("price")}${r}`,
  },
  {
    key: "status",
    header: "Status",
    width: 190,
    kind: "computed",
    get: (it) => computeItem(it).label,
    tone: (it) => STATUS_TONE[computeItem(it).status],
    formula: (r, L) => {
      const [c, w, l, o] = [L("count") + r, L("weekly") + r, L("lead") + r, L("onOrder") + r];
      return `=IF(${w}<=0,"No recent use, not reordered",IF(${c}/(${w}/7)<=${l},"Runs out before a new delivery",IF((${c}+${o})/(${w}/7)<=${l}+${SAFETY_DAYS},"Order now","Covered")))`;
    },
  },
  { key: "note", header: "Note", width: 220, kind: "text", ...textField("note") },
];

const newItem = (): RestockItem => ({
  id: newId(),
  name: "",
  vendor: "",
  count: 0,
  weeklyUse: 0,
  leadDays: 7,
  unitPrice: 0,
  onOrder: 0,
  note: "",
});

export function RestockView({ dock }: { dock: ToolDock }) {
  const [items, changeItems] = useShared<RestockItem[]>("restock", SAMPLE_ITEMS);
  const [approved, setApproved] = useState(false);
  const setItems = (next: RestockItem[]) => {
    changeItems(() => next);
    logActivityOnce("restock-sheet", "updated the Supplies sheet", "finance", "Restock");
  };

  const summary = computeAll(items);
  const isSample = items.some((it) => SAMPLE_ITEMS.some((s) => s.id === it.id));

  return (
    <div className="w-full pb-16 pt-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
            <Package className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[13px] text-muted">Micanopy Area Cooperative School</p>
            <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Restock</h1>
          </div>
        </div>

        <p className="mt-5 font-serif text-[17px] leading-7 text-fg">
          Enter what is on the shelf and how fast it goes. The page works out what to order, sized to {TARGET_DAYS} days of use, and drafts the purchase orders. Nothing is sent or paid.
        </p>

        {isSample && (
          <div className="mt-5 rounded-xl bg-bubble px-4 py-3 text-[13px] leading-5 text-secondary">
            <span className="font-medium text-fg">Sample counts. </span>
            These starter items are illustrative. Replace them with your shelf counts, or paste them in from Excel. Everyone with finance access sees the same sheet.
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
          <p className="text-[13px] text-muted">To order now</p>
          <p className="mt-1 font-serif text-[30px] leading-tight tabular-nums text-fg">{usd(summary.committed)}</p>
          <p className="mt-1 text-[13px] text-muted">
            {summary.toOrder.length} item{summary.toOrder.length === 1 ? "" : "s"} across {summary.vendors.length} vendor{summary.vendors.length === 1 ? "" : "s"}. Items with no recent use are never reordered.
          </p>
          {summary.needsBoard && (
            <p className="mt-3 rounded-lg bg-[#fbf0cf] px-3 py-2 text-[13px] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]">
              This order is above the USD 5,000 board approval line in the sample fiscal policy. Route it to the board before sending.
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl px-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[20px] text-fg">Supplies</h2>
          {isSample && (
            <button type="button" onClick={() => setItems([])} className="text-[13px] text-muted hover:text-fg">
              Clear sample items
            </button>
          )}
        </div>
        <SheetGrid
          sheetName="Supplies"
          columns={ITEM_COLUMNS}
          rows={items}
          onChange={setItems}
          makeRow={newItem}
          rowKey={(it) => it.id}
          fileName={`MACS restock ${DATA_AS_OF}`}
        />
        <p className="mt-2 text-[12px] text-muted">
          Reorder point is lead time plus {SAFETY_DAYS} safety days. Orders are sized to {TARGET_DAYS} days of use, less what is on hand and on order.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4">
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-serif text-[20px] text-fg">Purchase orders</h2>
          {summary.toOrder.length === 0 ? (
            <p className="mt-2 text-[14px] text-muted">Nothing needs ordering right now.</p>
          ) : !approved ? (
            <div className="mt-3">
              <p className="text-[14px] leading-6 text-secondary">
                Approve the order list to see the drafts. Approving only agrees on what to buy. You still review and send each order yourself.
              </p>
              <button
                type="button"
                onClick={() => setApproved(true)}
                className="mt-3 h-9 rounded-lg bg-fg px-4 text-sm text-page hover:opacity-90"
              >
                Approve order list
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <p className="text-[13px] text-muted">
                Drafts only. Send each one yourself after review. When the invoice arrives, it should match the PO.
              </p>
              {summary.vendors.map((vendor) => (
                <PoDraftBlock
                  key={vendor}
                  vendor={vendor}
                  lines={summary.toOrder.filter((r) => r.item.vendor === vendor)}
                />
              ))}
              <button type="button" onClick={() => setApproved(false)} className="text-[13px] text-muted hover:text-fg">
                Hide drafts
              </button>
            </div>
          )}
        </section>

        <ToolChat tool="restock" onAsk={(text) => dock.onAsk("restock", text, restockContext(items))} composer={dock.composer} />
      </div>
    </div>
  );
}

function PoDraftBlock({ vendor, lines }: { vendor: string; lines: ComputedItem[] }) {
  const text = poDraft(vendor, lines, DATA_AS_OF);
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl bg-page shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-sm font-medium text-fg">{vendor || "No vendor named"}</p>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-secondary hover:bg-hover hover:text-fg"
        >
          <Copy className="size-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-mono text-[12px] leading-5 text-fg">{text}</pre>
    </div>
  );
}
