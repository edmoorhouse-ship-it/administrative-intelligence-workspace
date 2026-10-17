"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Download, Rows3, Trash2, Undo2 } from "lucide-react";

/**
 * A small spreadsheet for list pages, built to feel like Excel: a formula bar, column letters,
 * row numbers, keyboard movement, paste from Excel, undo, a totals row, Excel's own conditional
 * format colors, and a download that opens in Excel with live formulas. Rows live with the page;
 * this component only edits them.
 */

export type SheetKind = "text" | "number" | "date" | "computed";
export type SheetTone = "bad" | "neutral" | "good";

/** Column letter lookup for formulas, e.g. L("expected") -> "E". */
export type ColumnLetter = (key: string) => string;

export interface SheetColumn<Row> {
  key: string;
  header: string;
  width: number;
  kind: SheetKind;
  /** Digits always shown after the decimal point. */
  fixed?: number;
  /** Most digits shown after the decimal point (defaults to `fixed`, or 0). */
  decimals?: number;
  get: (row: Row) => string | number | null;
  /** Applies an edit. Number cells get a number, date cells an ISO date or "". Absent means read-only. */
  set?: (row: Row, value: string | number) => Row;
  /** Excel formula for a computed cell, shown in the formula bar and written to the download. */
  formula?: (sheetRow: number, L: ColumnLetter) => string;
  tone?: (row: Row) => SheetTone | undefined;
  /** Adds a SUM to the totals row. */
  sum?: boolean;
  /** Right-aligns a calculated column that holds numbers. */
  numeric?: boolean;
}

interface SheetGridProps<Row> {
  sheetName: string;
  columns: SheetColumn<Row>[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  makeRow: () => Row;
  rowKey: (row: Row) => string;
  /** Download name, without extension. */
  fileName: string;
  /** View only: no typing, pasting, or row changes. Download for Excel still works. */
  readOnly?: boolean;
  /** Called with the row under the selected cell, or null on the totals or blank row. */
  onSelect?: (row: Row | null) => void;
  /** Scroll the rows inside the sheet past this height, with the column headers pinned. */
  maxHeight?: number;
}

const TONE: Record<SheetTone, string> = {
  bad: "bg-[var(--sheet-bad-bg)] text-[var(--sheet-bad-fg)]",
  neutral: "bg-[var(--sheet-neutral-bg)] text-[var(--sheet-neutral-fg)]",
  good: "bg-[var(--sheet-good-bg)] text-[var(--sheet-good-fg)]",
};

const SHEET_FONT = { fontFamily: 'Aptos, "Aptos Narrow", Calibri, "Segoe UI", system-ui, sans-serif' };

const letter = (index: number) => {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const isoToUs = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : iso;
};

/** Accepts 9/30/2026, 9/30/26, 2026-09-30, or blank. Returns null when it can't read a date. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  if (!s) return "";
  let y: number, m: number, d: number;
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(s);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (us) {
    m = Number(us[1]);
    d = Number(us[2]);
    y = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
  } else if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** Accepts 14900, 14,900.00, $14,900, USD 14,900, (120), or blank (0). Returns null when it can't read a number. */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/^USD\s*/i, "").replace(/[$,\s]/g, "");
  if (!s) return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function formatNumber(n: number, col: { fixed?: number; decimals?: number }) {
  const min = col.fixed ?? 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: Math.max(min, col.decimals ?? min) });
}

function display<Row>(col: SheetColumn<Row>, row: Row): string {
  const v = col.get(row);
  if (v === null || v === "") return "";
  if (typeof v === "number") return Number.isFinite(v) ? formatNumber(v, col) : "";
  return col.kind === "date" ? isoToUs(v) : v;
}

/** The value as typed: no thousands separators, dates as m/d/yyyy. */
function rawValue<Row>(col: SheetColumn<Row>, row: Row): string {
  const v = col.get(row);
  if (v === null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return col.kind === "date" ? isoToUs(v) : v;
}

const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** A typed value. Text that starts like a formula is written as text, so it can't run in Excel. */
const csvCell = (value: string) => quote(/^[=+\-@]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value);

/** A formula this sheet wrote itself, kept live for Excel. */
const csvFormula = (formula: string) => `"${formula.replace(/"/g, '""')}"`;

export function SheetGrid<Row>({ sheetName, columns, rows, onChange, makeRow, rowKey, fileName, readOnly = false, onSelect, maxHeight }: SheetGridProps<Row>) {
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [edit, setEditState] = useState<string | null>(null);
  const [editInBar, setEditInBar] = useState(false);
  const editRef = useRef<string | null>(null);
  const setEdit = (value: string | null, inBar = false) => {
    editRef.current = value;
    setEditState(value);
    setEditInBar(value !== null && inBar);
  };
  const [message, setMessage] = useState<string | null>(null);
  const history = useRef<Row[][]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasTotals = columns.some((c) => c.sum);
  // A read-only sheet has no blank row for typing new entries.
  const blankRow = readOnly ? -1 : rows.length;
  const totalsRow = rows.length + (readOnly ? 0 : 1);
  const lastRow = hasTotals ? totalsRow : readOnly ? Math.max(0, rows.length - 1) : blankRow;
  // Keep the selection on the sheet when rows are removed.
  const r = Math.min(sel.r, lastRow);
  const c = Math.min(sel.c, columns.length - 1);
  const col = columns[c];
  const L: ColumnLetter = (key) => letter(Math.max(0, columns.findIndex((x) => x.key === key)));
  const sheetRow = (index: number) => index + 2; // row 1 holds the headers
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const selectedRow = r < rows.length ? rows[r] : null;
  // Report a selection only once someone has clicked or moved into the sheet.
  useEffect(() => {
    if (gridRef.current?.contains(document.activeElement)) onSelect?.(selectedRow);
  }, [selectedRow, onSelect]);

  // Keep the selected cell in view, but only while someone is working in the sheet: on first
  // render the page must not jump to it.
  useEffect(() => {
    const grid = gridRef.current;
    const cell = grid?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`);
    if (!grid || !cell || !grid.contains(document.activeElement)) return;
    if (!maxHeight) {
      cell.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }
    // Scroll only the sheet itself, clear of the pinned header rows and row numbers.
    const g = grid.getBoundingClientRect();
    const b = cell.getBoundingClientRect();
    const top = g.top + 48;
    const left = g.left + 44;
    if (b.top < top) grid.scrollTop -= top - b.top;
    else if (b.bottom > g.bottom) grid.scrollTop += b.bottom - g.bottom;
    if (b.left < left) grid.scrollLeft -= left - b.left;
    else if (b.right > g.right) grid.scrollLeft += b.right - g.right;
  }, [r, c, maxHeight]);

  useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  const sumOf = (column: SheetColumn<Row>) =>
    rows.reduce((total, row) => {
      const v = column.get(row);
      return typeof v === "number" && Number.isFinite(v) ? total + v : total;
    }, 0);

  const flash = (text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 2600);
  };

  const commitRows = (next: Row[]) => {
    history.current = [...history.current.slice(-49), rows];
    onChange(next);
  };

  const canEdit = (rowIndex: number, column: SheetColumn<Row>) => !readOnly && Boolean(column.set) && rowIndex <= blankRow;

  const parse = (column: SheetColumn<Row>, text: string): string | number | null => {
    if (column.kind === "number") return parseNumber(text);
    if (column.kind === "date") return parseDate(text);
    return text;
  };

  const focusGrid = () => requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));

  const move = (dr: number, dc: number) => {
    setSel({ r: Math.max(0, Math.min(lastRow, r + dr)), c: Math.max(0, Math.min(columns.length - 1, c + dc)) });
  };

  /** Writes the draft into the selected cell. Returns false when the value can't be read. */
  const commit = (text: string) => {
    if (!col.set || !canEdit(r, col)) return true;
    const value = parse(col, text);
    if (value === null) {
      flash(col.kind === "date" ? "Enter a date like 9/30/2026." : "Enter a number.");
      return false;
    }
    if (r === blankRow) {
      if (text.trim() === "") return true;
      commitRows([...rows, col.set(makeRow(), value)]);
    } else {
      commitRows(rows.map((row, i) => (i === r ? col.set!(row, value) : row)));
    }
    return true;
  };

  const finishEdit = (dr: number, dc: number) => {
    const draft = editRef.current;
    if (draft === null) return;
    if (!commit(draft)) return;
    setEdit(null);
    move(dr, dc);
    focusGrid();
  };

  const startEdit = (initial?: string) => {
    if (readOnly) {
      flash("This sheet is view only.");
      return;
    }
    if (!canEdit(r, col)) {
      flash(col.kind === "computed" ? "This cell is calculated. Change the cells it uses." : "This cell can't be edited.");
      return;
    }
    setEdit(initial ?? (r < rows.length ? rawValue(col, rows[r]) : ""));
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) {
      flash("Nothing to undo.");
      return;
    }
    onChange(prev);
  };

  const clearCell = () => {
    if (r >= rows.length || !col.set) return;
    const empty = col.kind === "number" ? 0 : "";
    commitRows(rows.map((row, i) => (i === r ? col.set!(row, empty) : row)));
  };

  const insertRow = () => {
    const at = Math.min(r, rows.length);
    commitRows([...rows.slice(0, at), makeRow(), ...rows.slice(at)]);
    setSel({ r: at, c: 0 });
  };

  const deleteRow = () => {
    if (r >= rows.length) {
      flash("Select a row with data to delete it.");
      return;
    }
    commitRows(rows.filter((_, i) => i !== r));
    flash(`Deleted row ${sheetRow(r)}. ${isMac ? "⌘Z" : "Ctrl+Z"} brings it back.`);
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editRef.current !== null) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (mod) return; // let copy and paste through
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      Enter: [e.shiftKey ? -1 : 1, 0],
      Tab: [0, e.shiftKey ? -1 : 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      move(...moves[e.key]);
    } else if (e.key === "F2") {
      e.preventDefault();
      startEdit();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      clearCell();
    } else if (e.key.length === 1 && !e.altKey) {
      e.preventDefault();
      startEdit(e.key);
    }
  };

  const onCopy = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editRef.current !== null) return;
    const text = r < rows.length ? (col.kind === "computed" ? display(col, rows[r]) : rawValue(col, rows[r])) : r === totalsRow && col.sum ? formatNumber(sumOf(col), col) : "";
    e.clipboardData.setData("text/plain", text);
    e.preventDefault();
    flash("Copied.");
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editRef.current !== null) return;
    e.preventDefault();
    if (readOnly) {
      flash("This sheet is view only.");
      return;
    }
    const lines = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
    if (lines.length === 0 || lines[0] === "") return;
    let grid = lines.map((l) => l.split("\t"));
    // Skip a header row copied along with the data.
    const first = grid[0].filter((v) => v.trim());
    if (first.length && first.every((v) => columns.some((x) => x.header.toLowerCase() === v.trim().toLowerCase()))) grid = grid.slice(1);
    if (grid.length === 0) return;

    const startRow = Math.min(r, rows.length);
    const next = [...rows];
    let skipped = 0;
    grid.forEach((cells, i) => {
      const target = startRow + i;
      let row = target < next.length ? next[target] : makeRow();
      cells.forEach((text, j) => {
        const column = columns[c + j];
        if (!column?.set) return;
        const value = parse(column, text);
        if (value === null) skipped++;
        else row = column.set(row, value);
      });
      if (target < next.length) next[target] = row;
      else next.push(row);
    });
    commitRows(next);
    const unread = skipped === 1 ? " 1 cell couldn't be read and kept its old value." : skipped ? ` ${skipped} cells couldn't be read and kept their old values.` : "";
    flash(`Pasted ${grid.length} row${grid.length === 1 ? "" : "s"}.${unread}`);
  };

  const download = () => {
    const header = columns.map((x) => csvCell(x.header)).join(",");
    const body = rows.map((row, i) =>
      columns
        .map((x) => {
          if (x.kind === "computed" && x.formula) return csvFormula(x.formula(sheetRow(i), L));
          return csvCell(x.kind === "number" ? rawValue(x, row) : display(x, row));
        })
        .join(","),
    );
    const totals = hasTotals
      ? [columns.map((x, i) => (i === 0 ? "Total" : x.sum ? csvFormula(`=SUM(${letter(i)}2:${letter(i)}${rows.length + 1})`) : "")).join(",")]
      : [];
    const csv = `﻿${[header, ...body, ...totals].join("\r\n")}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Downloaded. It opens in Excel with the formulas live.");
  };

  // Formula bar content for the selected cell.
  const formulaText = (() => {
    if (r === totalsRow) return c === 0 ? "Total" : col.sum ? `=SUM(${letter(c)}2:${letter(c)}${rows.length + 1})` : "";
    if (r === blankRow) return "";
    if (col.kind === "computed") return col.formula ? col.formula(sheetRow(r), L) : display(col, rows[r]);
    return rawValue(col, rows[r]);
  })();

  // Status bar figures for a numeric column, over the rows with data.
  const numbers = rows.map((row) => col.get(row)).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const numericColumn = col.kind === "number" || (col.kind === "computed" && numbers.length > 0);
  const columnSum = numbers.reduce((a, b) => a + b, 0);

  const cellBase = "relative h-[26px] border-b border-r border-[var(--sheet-grid)] px-1.5 align-middle";
  const selectedCell =
    "z-[1] outline outline-2 -outline-offset-1 outline-[var(--sheet-accent)] after:absolute after:-bottom-[4px] after:-right-[4px] after:size-[7px] after:border after:border-surface after:bg-[var(--sheet-accent)]";
  const headCell = "h-[22px] border-b border-r border-[var(--sheet-grid)] bg-[var(--sheet-head)] text-[11px] font-normal text-secondary";
  const headSel = "bg-[var(--sheet-head-sel)] font-semibold text-[var(--sheet-accent)]";
  const totalWidth = 44 + columns.reduce((w, x) => w + x.width, 0);

  const renderCell = (rowIndex: number, ci: number) => {
    const column = columns[ci];
    const selected = rowIndex === r && ci === c;
    const row = rowIndex < rows.length ? rows[rowIndex] : null;
    const isTotals = rowIndex === totalsRow;
    const numeric = column.kind === "number" || column.numeric || column.sum;
    const tone = row && column.tone ? column.tone(row) : undefined;
    const text = row
      ? display(column, row)
      : isTotals
        ? ci === 0
          ? "Total"
          : column.sum
            ? formatNumber(sumOf(column), column)
            : ""
        : "";
    return (
      <td
        key={column.key}
        role="gridcell"
        aria-selected={selected}
        data-cell={`${rowIndex}-${ci}`}
        onMouseDown={(e) => {
          const draft = editRef.current;
          if (draft !== null && !selected) {
            if (!commit(draft)) {
              e.preventDefault();
              return;
            }
            setEdit(null);
          }
          setSel({ r: rowIndex, c: ci });
        }}
        onDoubleClick={() => {
          setSel({ r: rowIndex, c: ci });
          if (canEdit(rowIndex, column)) setEdit(row ? rawValue(column, row) : "");
        }}
        className={`${cellBase} ${tone ? TONE[tone] : ""} ${isTotals ? "border-t-[3px] border-t-[var(--sheet-grid)] border-double font-semibold" : ""} ${selected ? selectedCell : ""}`}
      >
        {selected && edit !== null && !editInBar ? (
          <input
            autoFocus
            onBlur={(e) => {
              // Clicking outside the sheet keeps the typed value, as in Excel.
              const draft = editRef.current;
              if (draft === null || gridRef.current?.contains(e.relatedTarget as Node)) return;
              if (commit(draft)) setEdit(null);
            }}
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                finishEdit(e.shiftKey ? -1 : 1, 0);
              } else if (e.key === "Tab") {
                e.preventDefault();
                finishEdit(0, e.shiftKey ? -1 : 1);
              } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                finishEdit(e.key === "ArrowUp" ? -1 : 1, 0);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEdit(null);
                focusGrid();
              }
            }}
            aria-label={`${column.header}, row ${sheetRow(rowIndex)}`}
            style={SHEET_FONT}
            className={`absolute inset-0 z-[2] w-full bg-surface px-1.5 text-[13px] text-fg outline outline-2 -outline-offset-1 outline-[var(--sheet-accent)] ${numeric ? "text-right" : ""}`}
          />
        ) : (
          <span className={`block truncate ${numeric ? "text-right tabular-nums" : ""}`}>{selected && edit !== null ? edit : text}</span>
        )}
      </td>
    );
  };

  const toolButton =
    "flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-secondary transition-colors hover:bg-hover hover:text-fg disabled:opacity-40";

  return (
    <div className="overflow-hidden rounded-lg bg-surface shadow-[0_0_0_1px_var(--line)]" style={SHEET_FONT}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--sheet-grid)] px-2 py-1">
        {!readOnly && (
          <>
            <button type="button" onClick={insertRow} className={toolButton}>
              <Rows3 className="size-3.5" strokeWidth={1.75} />
              Insert row
            </button>
            <button type="button" onClick={deleteRow} className={toolButton}>
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Delete row
            </button>
            <button type="button" onClick={undo} className={toolButton}>
              <Undo2 className="size-3.5" strokeWidth={1.75} />
              Undo
            </button>
            <span className="mx-1 h-4 w-px bg-[var(--sheet-grid)]" />
          </>
        )}
        <button type="button" onClick={download} className={toolButton}>
          <Download className="size-3.5" strokeWidth={1.75} />
          Download for Excel
        </button>
        <span className="ml-auto hidden text-[11px] text-muted sm:inline">
          {readOnly ? `${rows.length} row${rows.length === 1 ? "" : "s"} · view only` : `Paste from Excel: click a cell, then ${isMac ? "⌘V" : "Ctrl+V"}`}
        </span>
      </div>

      <div className="flex items-stretch border-b border-[var(--sheet-grid)] text-[13px]">
        <div className="flex w-[72px] shrink-0 items-center border-r border-[var(--sheet-grid)] px-2 text-secondary" aria-label="Name box">
          {letter(c)}
          {r + 2}
        </div>
        <div className="flex shrink-0 items-center border-r border-[var(--sheet-grid)] px-2.5 font-serif text-[13px] italic text-muted">fx</div>
        <input
          value={edit ?? formulaText}
          readOnly={!canEdit(r, col)}
          onFocus={() => {
            if (edit === null && canEdit(r, col)) setEdit(r < rows.length ? rawValue(col, rows[r]) : "", true);
          }}
          onChange={(e) => setEdit(e.target.value, true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finishEdit(1, 0);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEdit(null);
              focusGrid();
            }
          }}
          aria-label="Formula bar"
          className="h-7 min-w-0 flex-1 bg-transparent px-2 text-fg outline-none"
        />
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        role="grid"
        aria-label={sheetName}
        onKeyDown={onGridKey}
        onCopy={onCopy}
        onPaste={onPaste}
        className={`${maxHeight ? "overflow-auto" : "overflow-x-auto"} outline-none`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className="table-fixed border-separate border-spacing-0 text-[13px] text-fg" style={{ width: totalWidth }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {columns.map((x) => (
              <col key={x.key} style={{ width: x.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={`${headCell} sticky left-0 top-0 z-[5]`} aria-hidden />
              {columns.map((x, ci) => (
                <th key={x.key} role="columnheader" className={`${headCell} sticky top-0 z-[3] ${ci === c ? `${headSel} shadow-[inset_0_-2px_0_var(--sheet-accent)]` : ""}`}>
                  {letter(ci)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${headCell} sticky left-0 top-[22px] z-[4] text-center`}>1</td>
              {columns.map((x) => (
                <td key={x.key} className={`${cellBase} sticky top-[22px] z-[2] bg-surface font-semibold`}>
                  <span className={`block truncate ${x.kind === "number" || x.sum || x.numeric ? "text-right" : ""}`}>{x.header}</span>
                </td>
              ))}
            </tr>
            {[...rows.map((row, i) => ({ key: rowKey(row), index: i })), ...(readOnly ? [] : [{ key: "__blank", index: blankRow }]), ...(hasTotals ? [{ key: "__totals", index: totalsRow }] : [])].map(
              ({ key, index }) => (
                <tr key={key} role="row">
                  <td
                    onMouseDown={() => {
                      setSel({ r: index, c: 0 });
                      focusGrid();
                    }}
                    className={`${headCell} sticky left-0 z-[2] cursor-default text-center ${index === r ? `${headSel} shadow-[inset_-2px_0_0_var(--sheet-accent)]` : ""}`}
                  >
                    {sheetRow(index)}
                  </td>
                  {columns.map((_, ci) => renderCell(index, ci))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--sheet-grid)] bg-[var(--sheet-head)] text-[11px] text-secondary">
        <span className="border-b-2 border-[var(--sheet-accent)] bg-surface px-3 py-1 font-semibold text-[var(--sheet-accent)]">{sheetName}</span>
        <span className="min-w-0 truncate" role="status">
          {message ?? (edit !== null ? "Edit" : "Ready")}
        </span>
        {numericColumn && numbers.length > 0 && (
          <span className="ml-auto hidden shrink-0 pr-3 tabular-nums sm:inline">
            {col.header}: Average {formatNumber(columnSum / numbers.length, { fixed: col.fixed, decimals: Math.max(2, col.decimals ?? 0) })}
            <span className="mx-2">Count {numbers.length}</span>
            Sum {formatNumber(columnSum, col)}
          </span>
        )}
      </div>
    </div>
  );
}
