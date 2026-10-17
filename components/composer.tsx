"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Plus, SlidersHorizontal, Square } from "lucide-react";
import { PROMPT_STARTERS, type PromptStarter } from "@/lib/starters";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "./menu";
import { ModelPicker } from "./model-picker";
import { STARTER_ICONS } from "./prompt-starters";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  onPickStarter: (starter: PromptStarter) => void;
  onOpenSettings: () => void;
  isStreaming: boolean;
  placeholder: string;
  model: string;
  onModelChange: (id: string) => void;
  focusKey?: string;
}

export function Composer({
  onSend,
  onStop,
  onPickStarter,
  onOpenSettings,
  isStreaming,
  placeholder,
  model,
  onModelChange,
  focusKey,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [plusAnchor, setPlusAnchor] = useState<HTMLElement | null>(null);
  const closePlus = useCallback(() => setPlusAnchor(null), []);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Don't scroll the page to reach the composer (section pages start at the top).
    ref.current?.focus({ preventScroll: true });
  }, [focusKey]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 384)}px`;
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setDraft("");
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = "auto";
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = draft.trim().length > 0 && !isStreaming;

  return (
    <div className="composer-shell flex cursor-text flex-col rounded-[20px] bg-surface" onClick={() => ref.current?.focus()}>
      <div className="m-3.5 flex flex-col gap-3">
        <textarea
          ref={ref}
          value={draft}
          rows={1}
          onChange={(e) => {
            setDraft(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Message"
          className="block max-h-96 min-h-6 w-full resize-none bg-transparent pl-1.5 pt-1.5 text-[15px] leading-5 text-fg outline-none placeholder:text-muted"
        />
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Quick starts"
            aria-haspopup="menu"
            onClick={(e) => setPlusAnchor(plusAnchor ? null : e.currentTarget)}
            className={`flex size-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-hover hover:text-fg ${plusAnchor ? "bg-hover text-fg" : ""}`}
          >
            <Plus className="size-[18px]" strokeWidth={1.75} />
          </button>
          <div className="flex-1" />
          <ModelPicker value={model} onChange={onModelChange} />
          {isStreaming && (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop response"
              title="Stop response"
              className="flex size-8 items-center justify-center rounded-lg text-fg transition-colors hover:bg-hover"
            >
              <Square className="size-4" strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className="flex size-8 items-center justify-center rounded-lg bg-send text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <Menu anchor={plusAnchor} onClose={closePlus} width={340}>
        <MenuLabel>Quick starts</MenuLabel>
        {PROMPT_STARTERS.map((starter) => {
          const Icon = STARTER_ICONS[starter.icon];
          return (
            <MenuItem
              key={starter.id}
              icon={<Icon className="size-4" strokeWidth={1.75} />}
              onSelect={() => {
                closePlus();
                if (!isStreaming) onPickStarter(starter);
              }}
            >
              {starter.title}
            </MenuItem>
          );
        })}
        <MenuDivider />
        <MenuItem
          icon={<SlidersHorizontal className="size-4" strokeWidth={1.75} />}
          onSelect={() => {
            closePlus();
            onOpenSettings();
          }}
        >
          Custom instructions
        </MenuItem>
      </Menu>
    </div>
  );
}
