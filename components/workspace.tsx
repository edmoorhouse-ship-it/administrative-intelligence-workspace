"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FlaskConical, PanelLeft, PlugZap } from "lucide-react";
import { deriveTitle, greetingFor, newId } from "@/lib/chat-utils";
import { SAMPLE_DATA_NOTICE } from "@/lib/data-notice";
import { getRole, type AdminRoleId } from "@/lib/roles";
import { getSection, type SchoolSectionId } from "@/lib/school-sections";
import type { PromptStarter } from "@/lib/starters";
import {
  loadActiveChatId,
  loadChats,
  loadSettings,
  saveActiveChatId,
  saveChats,
  saveSettings,
} from "@/lib/storage";
import type { Chat, ChatMessage, ThemePreference, WorkspaceSettings } from "@/lib/types";
import { Composer } from "./composer";
import { Mark } from "./mark";
import { Menu } from "./menu";
import { MessageList } from "./message-list";
import { PromptStarters } from "./prompt-starters";
import { SectionIcon } from "./section-icon";
import { InboxView } from "./inbox-view";
import { PulseView } from "./pulse-view";
import { RestockView } from "./restock-view";
import { ReimbursementsView } from "./reimbursements-view";
import { DemoPageView } from "./demo-page-view";
import { OnboardingView } from "./onboarding-view";
import { StudentsView } from "./students-view";
import { BrainView } from "./brain-view";
import { VendorsView } from "./vendors-view";
import { CalendarView } from "./calendar-view";
import { Manny } from "./manny";
import { TOOL_AREA } from "@/lib/access";
import { suggestedFact } from "@/lib/brain";
import { brainAction, calendarAction, logActivity, type Person } from "@/lib/shared-client";
import { suggestedCalendarEvent } from "@/lib/calendar";
import { DEMO_PAGES, type DemoPageId } from "@/lib/demo-pages";
import { TaxChecklistView } from "./tax-checklist-view";
import { SectionView } from "./section-view";
import { SettingsDialog } from "./settings-dialog";
import type { ToolDock } from "./tool-dock";
import { isKnownTool, TOOL_TITLES, type ToolId } from "@/lib/tools";
import { ChatActions, Sidebar, TitleInput } from "./sidebar";
import { profile } from "@/profiles";

type ApiMode = "unknown" | "live" | "demo";

const updateChat = (chats: Chat[], id: string, fn: (chat: Chat) => Chat) =>
  chats.map((c) => (c.id === id ? fn(c) : c));

/** The tool page a chat started from, with the page snapshot taken then. */
type PageTool = { id?: string; context?: string };
const chatPageTool = (chat: Chat): PageTool => ({ id: chat.toolId, context: chat.toolContext });

/** Messages worth sending back to the model: drop failed and empty replies. */
const toApiMessages = (messages: ChatMessage[]) =>
  messages
    .filter((m) => m.status !== "error" && m.content.trim().length > 0)
    .map(({ role, content }) => ({ role, content }));

export function Workspace({ me }: { me: Person }) {
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(loadActiveChatId);
  const [activeSectionId, setActiveSectionId] = useState<SchoolSectionId | null>(null);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [reimbOpen, setReimbOpen] = useState(false);
  const [demoPage, setDemoPage] = useState<DemoPageId | null>(null);
  // The account's role is the lens; the server uses it too, whatever the page sends.
  const [settings, setSettings] = useState<WorkspaceSettings>(() => ({ ...loadSettings(), role: me.role }));
  const [streaming, setStreaming] = useState<{ chatId: string; messageId: string } | null>(null);
  const [apiMode, setApiMode] = useState<ApiMode>("unknown");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleAnchor, setTitleAnchor] = useState<HTMLElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const chatsRef = useRef(chats);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const activeSection = activeChat ? null : getSection(activeSectionId);
  const chatSection = activeChat ? getSection(activeChat.sectionId) : null;
  const chatTool = activeChat && isKnownTool(activeChat.toolId) ? activeChat.toolId : null;
  const role = getRole(settings.role);
  const isStreaming = streaming !== null;

  // ---- persistence -------------------------------------------------------
  useEffect(() => {
    chatsRef.current = chats;
    const t = setTimeout(() => saveChats(chats), 250);
    return () => clearTimeout(t);
  }, [chats]);

  useEffect(() => {
    const flush = () => saveChats(chatsRef.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  useEffect(() => saveActiveChatId(activeChat ? activeChat.id : null), [activeChat]);
  useEffect(() => saveSettings(settings), [settings]);

  // ---- theme, title, status, shortcuts -------------------------------------
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        settings.theme === "dark" || (settings.theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);

  useEffect(() => {
    const page = activeChat
      ? activeChat.title
      : activeSection
        ? activeSection.title
        : pulseOpen
          ? "Business pulse"
          : inboxOpen
            ? "Inbox triage"
            : taxOpen
              ? "Tax checklist"
              : restockOpen
                ? "Restock"
                : reimbOpen
                  ? "Reimbursements"
                  : demoPage
                    ? DEMO_PAGES[demoPage].title
                    : profile.org;
    document.title = `${page} - ${profile.workspaceName}`;
  }, [activeChat, activeSection, pulseOpen, inboxOpen, taxOpen, restockOpen, reimbOpen, demoPage]);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: { openRouterConfigured?: boolean }) => setApiMode(d.openRouterConfigured ? "live" : "demo"))
      .catch(() => setApiMode("unknown"));
  }, []);

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
    setActiveSectionId(null);
    setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startNewChat]);

  const patchSettings = useCallback((patch: Partial<WorkspaceSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const closeTitleMenu = useCallback(() => {
    setTitleAnchor(null);
    setConfirmDelete(false);
  }, []);

  // ---- streaming -----------------------------------------------------------
  const streamReply = async (chatId: string, history: ChatMessage[], sectionId?: string, mode?: "inbox", tool?: PageTool) => {
    const assistantId = newId();
    const model = settings.model;
    const controller = new AbortController();
    abortRef.current = controller;

    const patchReply = (fn: (m: ChatMessage) => ChatMessage) =>
      setChats((prev) =>
        updateChat(prev, chatId, (c) => ({
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) => (m.id === assistantId ? fn(m) : m)),
        })),
      );

    setChats((prev) =>
      updateChat(prev, chatId, (c) => ({
        ...c,
        messages: [...c.messages, { id: assistantId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", model }],
      })),
    );
    setStreaming({ chatId, messageId: assistantId });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: toApiMessages(history),
          model,
          role: settings.role,
          customInstructions: settings.customInstructions,
          sectionId,
          mode,
          toolId: tool?.id,
          toolContext: tool?.context,
        }),
      });

      const serverMode = res.headers.get("X-MACS-Mode");
      if (serverMode === "live" || serverMode === "demo") setApiMode(serverMode);

      if (!res.ok || !res.body) {
        let message = `Request failed (${res.status}).`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // keep the status message
        }
        patchReply((m) => ({ ...m, content: message, status: "error" }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        if (chunk) patchReply((m) => ({ ...m, content: m.content + chunk }));
      }
      if (full.trim()) void afterReply(full, tool);
      patchReply((m) =>
        m.content.trim()
          ? { ...m, status: "done" }
          : { ...m, status: "error", content: "The model returned an empty response. Try again or switch models." },
      );
    } catch (err) {
      if (controller.signal.aborted) {
        patchReply((m) => (m.content.trim() ? { ...m, status: "stopped" } : { ...m, status: "error", content: "Response stopped before any text arrived." }));
      } else {
        const detail = err instanceof Error ? err.message : "Unknown error";
        patchReply((m) =>
          m.content.trim()
            ? { ...m, status: "stopped", content: `${m.content}\n\n> **Connection lost:** ${detail}` }
            : { ...m, status: "error", content: `Connection error: ${detail}` },
        );
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(null);
    }
  };

  /** After a finished reply: log a page draft to the shared feed, and file any fact Mac suggested for approval. */
  const afterReply = async (reply: string, tool?: PageTool) => {
    const toolId = isKnownTool(tool?.id) ? tool.id : null;
    const area = toolId ? TOOL_AREA[toolId] : "general";
    const page = toolId ? TOOL_TITLES[toolId] : "Chat";
    if (toolId) await logActivity(`drafted a reply on ${page}`, area, page, "Mac");
    const fact = suggestedFact(reply);
    if (fact) await brainAction({ action: "propose", text: fact, area, origin: page, agent: "Mac" });
    if (toolId === "calendar") {
      const event = suggestedCalendarEvent(reply);
      if (event) await calendarAction({ action: "propose", date: event.date, time: event.time, title: event.title, area: event.area, agent: "Manny" });
    }
  };

  const send = (text: string, title?: string, sectionId?: SchoolSectionId, mode?: "inbox", tool?: PageTool) => {
    const content = text.trim();
    if (!content || abortRef.current) return;

    const now = Date.now();
    const userMessage: ChatMessage = { id: newId(), role: "user", content, createdAt: now, status: "done" };

    if (!activeChat) {
      const chat: Chat = {
        id: newId(),
        title: title ?? deriveTitle(content),
        messages: [userMessage],
        createdAt: now,
        updatedAt: now,
        pinned: false,
        archived: false,
        sectionId,
        mode,
        toolId: tool?.id,
        toolContext: tool?.context,
      };
      setChats((prev) => [chat, ...prev]);
      setActiveChatId(chat.id);
      setActiveSectionId(null);
      setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(null);
      void streamReply(chat.id, [userMessage], sectionId, mode, tool);
      return;
    }

    setChats((prev) =>
      updateChat(prev, activeChat.id, (c) => ({ ...c, archived: false, updatedAt: now, messages: [...c.messages, userMessage] })),
    );
    void streamReply(activeChat.id, [...activeChat.messages, userMessage], activeChat.sectionId, activeChat.mode, chatPageTool(activeChat));
  };

  const stop = () => abortRef.current?.abort();

  const regenerate = (messageId: string) => {
    if (!activeChat || abortRef.current) return;
    const index = activeChat.messages.findIndex((m) => m.id === messageId);
    if (index < 1) return;
    const history = activeChat.messages.slice(0, index);
    setChats((prev) => updateChat(prev, activeChat.id, (c) => ({ ...c, messages: history })));
    void streamReply(activeChat.id, history, activeChat.sectionId, activeChat.mode, chatPageTool(activeChat));
  };

  const fork = (messageId: string) => {
    if (!activeChat) return;
    const index = activeChat.messages.findIndex((m) => m.id === messageId);
    if (index < 0) return;
    const now = Date.now();
    const forked: Chat = {
      id: newId(),
      title: `${activeChat.title} (fork)`,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      forkedFrom: activeChat.id,
      sectionId: activeChat.sectionId,
      mode: activeChat.mode,
      toolId: activeChat.toolId,
      toolContext: activeChat.toolContext,
      messages: activeChat.messages.slice(0, index + 1).map((m) => ({
        ...m,
        id: newId(),
        status: m.status === "streaming" ? "stopped" : m.status,
      })),
    };
    setChats((prev) => [forked, ...prev]);
    setActiveChatId(forked.id);
  };

  // ---- chat management -----------------------------------------------------
  const renameChat = (id: string, title: string) =>
    setChats((prev) => updateChat(prev, id, (c) => ({ ...c, title: title.slice(0, 120) })));

  const togglePin = (id: string) => setChats((prev) => updateChat(prev, id, (c) => ({ ...c, pinned: !c.pinned })));

  const toggleArchive = (id: string) => {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    if (!chat.archived && streaming?.chatId === id) stop();
    setChats((prev) => updateChat(prev, id, (c) => ({ ...c, archived: !c.archived, pinned: c.archived ? c.pinned : false })));
    if (!chat.archived && id === activeChatId) setActiveChatId(null);
  };

  const deleteChat = (id: string) => {
    if (streaming?.chatId === id) stop();
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (id === activeChatId) setActiveChatId(null);
  };

  const deleteAllChats = () => {
    stop();
    setChats([]);
    setActiveChatId(null);
  };

  const selectChat = (id: string) => {
    setActiveChatId(id);
    setActiveSectionId(null);
    setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const selectSection = (id: SchoolSectionId) => {
    setActiveChatId(null);
    setActiveSectionId(id);
    setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const openPulse = () => {
    setActiveChatId(null);
    setActiveSectionId(null);
    setPulseOpen(true);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const openInbox = () => {
    setActiveChatId(null);
    setActiveSectionId(null);
    setPulseOpen(false);
    setInboxOpen(true);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const openTax = () => {
    setActiveChatId(null);
    setActiveSectionId(null);
    setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(true);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const openRestock = () => {
    setActiveChatId(null);
    setActiveSectionId(null);
    setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(true);
    setReimbOpen(false);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const openReimb = () => {
    setActiveChatId(null);
    setActiveSectionId(null);
    setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(true);
    setDemoPage(null);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const openDemo = (id: DemoPageId) => {
    setActiveChatId(null);
    setActiveSectionId(null);
    setPulseOpen(false);
    setInboxOpen(false);
    setTaxOpen(false);
    setRestockOpen(false);
    setReimbOpen(false);
    setDemoPage(id);
    setEditingTitle(false);
    setMobileSidebarOpen(false);
  };

  const triageInbox = (message: string) => {
    const day = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    send(message, `Inbox triage, ${day}`, undefined, "inbox");
  };

  const pickStarter = (starter: PromptStarter) => send(starter.prompt, starter.title);

  const openTool = (id: ToolId) => {
    if (id === "pulse") openPulse();
    else if (id === "inbox") openInbox();
    else if (id === "tax") openTax();
    else if (id === "restock") openRestock();
    else if (id === "reimb") openReimb();
    else openDemo(id);
  };

  const composerProps = {
    onSend: (text: string) => send(text),
    onStop: stop,
    onPickStarter: pickStarter,
    onOpenSettings: () => setSettingsOpen(true),
    isStreaming,
    model: settings.model,
    onModelChange: (id: string) => patchSettings({ model: id }),
  };

  const dock: ToolDock = {
    onAsk: (tool, text, context) => send(text, undefined, undefined, undefined, { id: tool, context }),
    composer: composerProps,
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-page text-fg">
      <Sidebar
        chats={chats}
        activeChatId={activeChat?.id ?? null}
        activeSectionId={activeSection?.id ?? null}
        collapsed={settings.sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        role={settings.role}
        theme={settings.theme}
        onToggleCollapsed={() => patchSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        onSelectSection={selectSection}
        activePulse={pulseOpen}
        onOpenPulse={openPulse}
        activeInbox={inboxOpen}
        onOpenInbox={openInbox}
        activeTax={taxOpen}
        onOpenTax={openTax}
        activeRestock={restockOpen}
        onOpenRestock={openRestock}
        activeReimb={reimbOpen}
        onOpenReimb={openReimb}
        activeDemo={demoPage}
        onOpenDemo={openDemo}
        onRenameChat={renameChat}
        onTogglePin={togglePin}
        onToggleArchive={toggleArchive}
        onDeleteChat={deleteChat}
        onRoleChange={(r: AdminRoleId) => patchSettings({ role: r })}
        me={me}
        onThemeChange={(t: ThemePreference) => patchSettings({ theme: t })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
            className="flex size-8 items-center justify-center rounded-lg text-secondary hover:bg-hover hover:text-fg md:hidden"
          >
            <PanelLeft className="size-[18px]" strokeWidth={1.75} />
          </button>
          {demoPage && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="truncate text-muted">{profile.org}</span>
              <span className="text-muted">/</span>
              <span className="text-fg">{DEMO_PAGES[demoPage].title}</span>
            </div>
          )}
          {reimbOpen && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="truncate text-muted">{profile.org}</span>
              <span className="text-muted">/</span>
              <span className="text-fg">Reimbursements</span>
            </div>
          )}
          {restockOpen && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="truncate text-muted">{profile.org}</span>
              <span className="text-muted">/</span>
              <span className="text-fg">Restock</span>
            </div>
          )}
          {taxOpen && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="truncate text-muted">{profile.org}</span>
              <span className="text-muted">/</span>
              <span className="text-fg">Tax checklist</span>
            </div>
          )}
          {inboxOpen && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="truncate text-muted">{profile.org}</span>
              <span className="text-muted">/</span>
              <span className="text-fg">Inbox triage</span>
            </div>
          )}
          {pulseOpen && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="truncate text-muted">{profile.org}</span>
              <span className="text-muted">/</span>
              <span className="text-fg">Business pulse</span>
            </div>
          )}
          {activeSection && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
              <span className="truncate text-muted">{profile.org}</span>
              <span className="text-muted">/</span>
              <span className="flex items-center gap-1.5 text-fg">
                <SectionIcon id={activeSection.id} className="size-3.5 text-brand" />
                {activeSection.title}
              </span>
            </div>
          )}
          {activeChat && (
            <div className="flex min-w-0 max-w-md items-center gap-1">
              {chatTool && (
                <button
                  type="button"
                  onClick={() => openTool(chatTool)}
                  title={`Open ${TOOL_TITLES[chatTool]}`}
                  className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2 text-sm text-secondary hover:bg-hover hover:text-fg"
                >
                  {TOOL_TITLES[chatTool]}
                  <span className="text-muted">/</span>
                </button>
              )}
              {chatSection && (
                <button
                  type="button"
                  onClick={() => selectSection(chatSection.id)}
                  title={`Open ${chatSection.title}`}
                  className="flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2 text-sm text-secondary hover:bg-hover hover:text-fg"
                >
                  <SectionIcon id={chatSection.id} className="size-3.5 text-brand" />
                  {chatSection.title}
                  <span className="text-muted">/</span>
                </button>
              )}
              {editingTitle ? (
                <TitleInput
                  initial={activeChat.title}
                  onDone={(title) => {
                    setEditingTitle(false);
                    if (title) renameChat(activeChat.id, title);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => (titleAnchor ? closeTitleMenu() : setTitleAnchor(e.currentTarget))}
                  aria-haspopup="menu"
                  className={`flex h-7 max-w-full items-center gap-1.5 rounded-[7px] px-2.5 text-sm text-fg transition-colors hover:bg-hover ${titleAnchor ? "bg-hover" : ""}`}
                >
                  <span className="truncate">{activeChat.title}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted" />
                </button>
              )}
              <Menu anchor={titleAnchor} onClose={closeTitleMenu} width={200}>
                <ChatActions
                  chat={activeChat}
                  confirmDelete={confirmDelete}
                  onRename={() => {
                    closeTitleMenu();
                    setEditingTitle(true);
                  }}
                  onPin={() => {
                    closeTitleMenu();
                    togglePin(activeChat.id);
                  }}
                  onArchive={() => {
                    closeTitleMenu();
                    toggleArchive(activeChat.id);
                  }}
                  onDelete={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    closeTitleMenu();
                    deleteChat(activeChat.id);
                  }}
                />
              </Menu>
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pr-1">
            {apiMode === "demo" && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="No OPENROUTER_API_KEY set — replies are generated locally from the sample dataset."
                className="flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-sm text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover"
              >
                <PlugZap className="size-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Demo mode</span>
              </button>
            )}
            <span
              title={SAMPLE_DATA_NOTICE}
              className="flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-sm text-fg shadow-[0_0_0_1px_var(--line)]"
            >
              <FlaskConical className="size-3.5 text-brand" strokeWidth={1.75} />
              Sample data
            </span>
          </div>
        </header>

        {activeChat ? (
          <div key={activeChat.id} className="anim-page-in flex min-h-0 flex-1 flex-col">
            <MessageList
              messages={activeChat.messages}
              streamingMessageId={streaming?.chatId === activeChat.id ? streaming.messageId : null}
              onRegenerate={regenerate}
              onFork={fork}
            />
            <div className="shrink-0 bg-page px-2 pb-2 md:px-4">
              <div className="mx-auto w-full max-w-3xl">
                {activeChat.archived && (
                  <p className="mb-2 text-center text-xs text-muted">This chat is archived. Sending a message will restore it.</p>
                )}
                <Composer {...composerProps} placeholder="Write a message…" focusKey={activeChat.id} />
                <p className="pt-2 text-center text-xs text-muted">
                  {profile.workspaceName} is AI and can make mistakes. Figures are sample data — verify against official records.
                </p>
              </div>
            </div>
          </div>
        ) : activeSection ? (
          <div key={`section-${activeSection.id}`} className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <SectionView
              section={activeSection}
              onAsk={(text) => send(text, undefined, activeSection.id)}
              composer={composerProps}
            />
          </div>
        ) : pulseOpen ? (
          <div key="pulse" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <PulseView dock={dock} />
          </div>
        ) : demoPage === "calendar" ? (
          <div key="calendar" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <CalendarView dock={dock} role={me.role} />
          </div>
        ) : demoPage === "vendors" ? (
          <div key="vendors" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <VendorsView dock={dock} />
          </div>
        ) : demoPage === "brain" ? (
          <div key="brain" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <BrainView me={me} />
          </div>
        ) : demoPage === "students" ? (
          <div key="students" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <StudentsView dock={dock} />
          </div>
        ) : demoPage === "onboarding" ? (
          <div key="onboarding" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <OnboardingView
              dock={dock}
              customInstructions={settings.customInstructions}
              onSaveInstructions={(text) => patchSettings({ customInstructions: text })}
              onOpen={openTool}
            />
          </div>
        ) : demoPage ? (
          <div key={`demo-${demoPage}`} className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <DemoPageView id={demoPage} dock={dock} live={{ model: settings.model, role: settings.role, customInstructions: settings.customInstructions }} />
          </div>
        ) : reimbOpen ? (
          <div key="reimb" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <ReimbursementsView dock={dock} />
          </div>
        ) : restockOpen ? (
          <div key="restock" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <RestockView dock={dock} />
          </div>
        ) : taxOpen ? (
          <div key="tax" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <TaxChecklistView dock={dock} />
          </div>
        ) : inboxOpen ? (
          <div key="inbox" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <InboxView disabled={isStreaming} onTriage={triageInbox} />
          </div>
        ) : (
          <div key="home" className="anim-page-in min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-stretch px-2 pb-24 pt-[max(2.5rem,calc(50dvh-20rem))] md:px-0">
              <div className="mb-7 flex flex-col items-center text-center">
                <Mark size={120} className="rounded-full shadow-[0_10px_30px_-10px_color-mix(in_srgb,var(--brand)_55%,transparent)]" />
                <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">{profile.org}</p>
                <h1 className="mt-1.5 font-serif text-[32px] font-[330] leading-tight tracking-[-0.01em] text-fg sm:text-[38px]">
                  {greetingFor()}, {role.greetingName}
                </h1>
              </div>
              <Composer {...composerProps} placeholder="How can I help you today?" focusKey="home" />
              <div className="mt-4">
                <PromptStarters onPick={pickStarter} disabled={isStreaming} />
              </div>
              <p className="mt-5 text-center text-xs text-muted">
                Answers draw on an illustrative sample dataset for {profile.shortName}, not real records.
              </p>
            </div>
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          apiMode={apiMode}
          chatCount={chats.length}
          onSave={patchSettings}
          onDeleteAllChats={deleteAllChats}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {profile.features.manny && <Manny me={me} model={settings.model} customInstructions={settings.customInstructions} onOpenCalendar={() => openDemo("calendar")} />}
    </div>
  );
}
