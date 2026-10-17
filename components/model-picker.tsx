"use client";

import { useCallback, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { MODELS, getModel } from "@/lib/models";
import { Menu, MenuLabel } from "./menu";

export function ModelPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const current = getModel(value);

  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        className={`flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-fg transition-colors hover:bg-hover ${anchor ? "bg-hover" : ""}`}
      >
        {current.label}
        <span className="text-muted max-sm:hidden">{current.provider}</span>
        <ChevronDown className="size-3.5 text-muted" />
      </button>
      <Menu anchor={anchor} onClose={close} align="end" width={290}>
        <MenuLabel>Model · via OpenRouter</MenuLabel>
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="menuitemradio"
            aria-checked={m.id === current.id}
            onClick={() => {
              onChange(m.id);
              close();
            }}
            className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-hover"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-fg">
                {m.label} <span className="text-muted">{m.provider}</span>
              </span>
              <span className="block text-xs text-muted">{m.description}</span>
            </span>
            {m.id === current.id && <Check className="mt-0.5 size-4 text-fg" />}
          </button>
        ))}
      </Menu>
    </>
  );
}
