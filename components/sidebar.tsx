"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  Archive,
  Backpack,
  Brain,
  CalendarDays,
  LogOut,
  ScrollText,
  ArchiveRestore,
  ChevronDown,
  Circle,
  Ellipsis,
  Inbox,
  Monitor,
  Banknote,
  Palette,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  Package,
  Receipt,
  Moon,
  PanelLeft,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sun,
  Trash,
  X,
  Scale,
} from "lucide-react";
import { canOpenTool } from "@/lib/access";
import { BRAIN_SEED, type Fact } from "@/lib/brain";
import { groupChats } from "@/lib/chat-utils";
import { signOut, useShared, useTeam, type Person } from "@/lib/shared-client";
import type { ToolId } from "@/lib/tools";
import type { DemoPageId } from "@/lib/demo-pages";
import { SCHOOL_SECTIONS, type SchoolSectionId } from "@/lib/school-sections";
import { getRole, type AdminRoleId } from "@/lib/roles";
import type { Chat, ThemePreference } from "@/lib/types";
import { Mark } from "./mark";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "./menu";
import { SectionIcon } from "./section-icon";
import { profile } from "@/profiles";
import Link from "next/link";

export interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  activeSectionId: SchoolSectionId | null;
  collapsed: boolean;
  mobileOpen: boolean;
  role: AdminRoleId;
  theme: ThemePreference;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onSelectSection: (id: SchoolSectionId) => void;
  activePulse: boolean;
  onOpenPulse: () => void;
  activeInbox: boolean;
  onOpenInbox: () => void;
  activeTax: boolean;
  onOpenTax: () => void;
  activeRestock: boolean;
  onOpenRestock: () => void;
  activeReimb: boolean;
  onOpenReimb: () => void;
  activeDemo: DemoPageId | null;
  onOpenDemo: (id: DemoPageId) => void;
  onRenameChat: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRoleChange: (role: AdminRoleId) => void;
  /** The signed-in person. Their role decides which pages show. */
  me: Person;
  onThemeChange: (theme: ThemePreference) => void;
  onOpenSettings: () => void;
}

export function Sidebar(props: SidebarProps) {
  const { collapsed, mobileOpen, onCloseMobile } = props;
  return (
    <>
      <aside
        className={`hidden h-full shrink-0 border-r border-line bg-sidebar transition-[width] duration-200 ease-out md:flex ${collapsed ? "w-[52px]" : "w-[288px]"}`}
      >
        {collapsed ? <CollapsedRail {...props} /> : <SidebarPanel {...props} />}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close sidebar" onClick={onCloseMobile} className="anim-page-in absolute inset-0 bg-black/25" />
          <aside className="anim-pop-in relative flex h-full w-[288px] max-w-[86vw] border-r border-line bg-sidebar">
            <SidebarPanel {...props} mobile />
          </aside>
        </div>
      )}
    </>
  );
}

function IconButton({ label, onClick, children, className = "" }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex size-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-hover hover:text-fg ${className}`}
    >
      {children}
    </button>
  );
}

function CollapsedRail({ onToggleCollapsed, onNewChat, onOpenSettings, role }: SidebarProps) {
  return (
    <div className="flex w-full flex-col items-center gap-1 py-2">
      <button type="button" onClick={onToggleCollapsed} title={profile.org} className="mb-1 rounded-full">
        <Mark size={36} />
      </button>
      <IconButton label="Open sidebar" onClick={onToggleCollapsed}>
        <PanelLeft className="size-[18px]" strokeWidth={1.75} />
      </IconButton>
      <button
        type="button"
        onClick={onNewChat}
        title="New chat"
        aria-label="New chat"
        className="mt-1 flex size-8 items-center justify-center rounded-full bg-active text-fg transition-colors hover:bg-hover"
      >
        <Plus className="size-4" strokeWidth={2} />
      </button>
      <div className="flex-1" />
      <IconButton label="Customize" onClick={onOpenSettings}>
        <SlidersHorizontal className="size-4" strokeWidth={1.75} />
      </IconButton>
      <button
        type="button"
        onClick={onToggleCollapsed}
        title={getRole(role).label}
        className="mt-1 flex size-6 items-center justify-center rounded-full bg-active text-[11px] font-medium text-secondary"
      >
        {getRole(role).initials.slice(0, 1)}
      </button>
    </div>
  );
}

function SidebarPanel(props: SidebarProps & { mobile?: boolean }) {
  const { chats, activeChatId, activeSectionId, activePulse, activeInbox, activeTax, activeRestock, activeReimb, mobile, onToggleCollapsed, onCloseMobile, onNewChat, onOpenSettings, onSelectSection, onOpenPulse, onOpenInbox, onOpenTax, onOpenRestock, onOpenReimb, activeDemo, onOpenDemo } = props;
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<"chats" | "archived">("chats");
  const searchRef = useRef<HTMLInputElement>(null);

  const { groups, archived } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
    return groupChats(filtered);
  }, [chats, query]);

  const archivedCount = chats.filter((c) => c.archived).length;
  const can = (tool: ToolId) => canOpenTool(props.me.role, tool);
  const [facts] = useShared<Fact[]>("brain", BRAIN_SEED);
  const waitingFacts = facts.filter((f) => f.status === "proposed").length;
  const onHome = activeChatId === null && activeSectionId === null && !activePulse && !activeInbox && !activeTax && !activeRestock && !activeReimb && activeDemo === null;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between pl-3.5 pr-2">
        <span className="text-[13px] text-muted">{profile.kicker}</span>
        <div className="flex items-center">
          <IconButton label={mobile ? "Close sidebar" : "Close sidebar"} onClick={mobile ? onCloseMobile : onToggleCollapsed}>
            {mobile ? <X className="size-[18px]" strokeWidth={1.75} /> : <PanelLeft className="size-[18px]" strokeWidth={1.75} />}
          </IconButton>
          <IconButton
            label="Search chats"
            onClick={() => {
              setSearching((s) => !s);
              setQuery("");
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
          >
            <Search className="size-[17px]" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <div className="px-2 pb-3">
        <BrandCard />
      </div>

      <div className="px-2">
        <div className="flex h-8 rounded-lg bg-active p-px" role="tablist" aria-label="Chat list">
          {(["chats", "archived"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md text-sm transition-colors ${tab === t ? "bg-surface text-fg shadow-[0_0_0_0.5px_var(--line),0_1px_2px_rgb(0_0_0/0.06)]" : "text-muted hover:text-secondary"}`}
            >
              {t === "chats" ? <Circle className="size-3" strokeWidth={2} /> : <Archive className="size-3.5" strokeWidth={1.75} />}
              {t === "chats" ? "Chats" : `Archived${archivedCount ? ` ${archivedCount}` : ""}`}
            </button>
          ))}
        </div>
      </div>

      <nav className="mt-3 space-y-px px-2" aria-label="Workspace">
        <NavRow icon={<Plus className="size-4" strokeWidth={1.75} />} label="New" active={onHome} onClick={onNewChat} />
        <NavRow icon={<SlidersHorizontal className="size-4" strokeWidth={1.75} />} label="Customize" onClick={onOpenSettings} />
        <NavRow
          icon={<Brain className="size-4" strokeWidth={1.75} />}
          label="Shared brain"
          active={activeDemo === "brain"}
          onClick={() => onOpenDemo("brain")}
          badge={waitingFacts}
        />
        {can("pulse") && <NavRow icon={<Activity className="size-4" strokeWidth={1.75} />} label="Business pulse" active={activePulse} onClick={onOpenPulse} />}
        {can("calendar") && <NavRow icon={<CalendarDays className="size-4" strokeWidth={1.75} />} label="Calendar" active={activeDemo === "calendar"} onClick={() => onOpenDemo("calendar")} />}
        {can("students") && <NavRow icon={<Backpack className="size-4" strokeWidth={1.75} />} label="Students" active={activeDemo === "students"} onClick={() => onOpenDemo("students")} />}
        {can("inbox") && <NavRow icon={<Inbox className="size-4" strokeWidth={1.75} />} label="Inbox triage" active={activeInbox} onClick={onOpenInbox} />}
        {can("canva") && <NavRow icon={<Palette className="size-4" strokeWidth={1.75} />} label="Canva" active={activeDemo === "canva"} onClick={() => onOpenDemo("canva")} />}
        {can("tax") && <NavRow icon={<Receipt className="size-4" strokeWidth={1.75} />} label="Tax checklist" active={activeTax} onClick={onOpenTax} />}
        {can("restock") && <NavRow icon={<Package className="size-4" strokeWidth={1.75} />} label="Restock" active={activeRestock} onClick={onOpenRestock} />}
        {can("reimb") && <NavRow icon={<Banknote className="size-4" strokeWidth={1.75} />} label="Reimbursements" active={activeReimb} onClick={onOpenReimb} />}
        {can("vendors") && <NavRow icon={<ScrollText className="size-4" strokeWidth={1.75} />} label="Vendors" active={activeDemo === "vendors"} onClick={() => onOpenDemo("vendors")} />}
        {can("onboarding") && <NavRow icon={<UserPlus className="size-4" strokeWidth={1.75} />} label="Onboarding" active={activeDemo === "onboarding"} onClick={() => onOpenDemo("onboarding")} />}
        {can("security") && <NavRow icon={<ShieldCheck className="size-4" strokeWidth={1.75} />} label="Security check" active={activeDemo === "security"} onClick={() => onOpenDemo("security")} />}
        {can("mac") && <NavRow icon={<MessageSquare className="size-4" strokeWidth={1.75} />} label="Text Mac" active={activeDemo === "mac"} onClick={() => onOpenDemo("mac")} />}
        {profile.features.leveling && (
          <Link href="/leveling" className="flex h-8 w-full items-center gap-2 rounded-lg px-0.5 text-left text-sm text-secondary transition-colors hover:bg-hover hover:text-fg">
            <span className="flex size-7 items-center justify-center">
              <Scale className="size-4" strokeWidth={1.75} />
            </span>
            <span className="flex-1">Bid leveling</span>
          </Link>
        )}
      </nav>

      {searching && (
        <div className="px-2 pt-2">
          <label className="flex h-8 items-center gap-2 rounded-lg bg-surface px-2.5 shadow-[0_0_0_1px_var(--line)] focus-within:shadow-[0_0_0_1px_var(--line-strong)]">
            <Search className="size-3.5 text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearching(false);
                  setQuery("");
                }
              }}
              placeholder="Search chats"
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
            />
          </label>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Chats">
        {tab === "chats" ? (
          <>
            {!query && profile.features.schoolSections && (
              <section>
                <button
                  type="button"
                  onClick={() => setSectionsOpen((v) => !v)}
                  aria-expanded={sectionsOpen}
                  className="flex w-full items-center gap-1 px-1.5 pb-1.5 pt-5 text-left text-[13px] text-muted hover:text-secondary"
                >
                  <span className="flex-1">{profile.org}</span>
                  <ChevronDown className={`size-3.5 transition-transform ${sectionsOpen ? "" : "-rotate-90"}`} />
                </button>
                {sectionsOpen && (
                  <ul className="space-y-px">
                    {SCHOOL_SECTIONS.map((section) => (
                      <li key={section.id}>
                        <NavRow
                          icon={<SectionIcon id={section.id} />}
                          label={section.title}
                          active={section.id === activeSectionId}
                          onClick={() => onSelectSection(section.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {groups.length === 0 && (
              <p className="px-1.5 pt-5 text-[13px] text-muted">{query ? "No chats match that search." : "Your chats will appear here."}</p>
            )}
            {groups.map((group) => (
              <section key={group.label}>
                <h3 className="px-1.5 pb-1.5 pt-5 text-[13px] text-muted">{group.label}</h3>
                <ul className="space-y-px">
                  {group.chats.map((chat) => (
                    <ChatRow key={chat.id} chat={chat} active={chat.id === activeChatId} {...props} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <section>
            <h3 className="px-1.5 pb-1.5 pt-5 text-[13px] text-muted">Archived</h3>
            {archived.length === 0 ? (
              <p className="px-1.5 text-[13px] text-muted">{query ? "No archived chats match." : "Archived chats will appear here."}</p>
            ) : (
              <ul className="space-y-px">
                {archived.map((chat) => (
                  <ChatRow key={chat.id} chat={chat} active={chat.id === activeChatId} {...props} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <SidebarFooter {...props} />
    </div>
  );
}

/** The brand card: makes it obvious who the workspace is built for. Name, tagline, and colors come from the profile. */
function BrandCard() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-deep px-3 py-3 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
      <div className="relative flex items-center gap-3">
        <Mark size={60} className="rounded-full ring-2 ring-white/80" />
        <div className="min-w-0">
          <p className="font-serif text-[17px] font-semibold leading-[1.15] tracking-[-0.01em]">
            {profile.orgLines[0]}
            <br />
            {profile.orgLines[1]}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">{profile.tagline}</p>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-[3px]">
        <span className="h-[3px] w-9 rounded-full bg-gold" />
        <span className="h-[3px] w-6 rounded-full bg-gold" />
        <span className="h-[3px] w-4 rounded-full bg-gold" />
      </div>
    </div>
  );
}

function NavRow({ icon, label, active, onClick, badge }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 w-full items-center gap-2 rounded-lg px-0.5 text-left text-sm transition-colors ${active ? "bg-active text-fg" : "text-secondary hover:bg-hover hover:text-fg"}`}
    >
      <span className="flex size-7 items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="mr-1.5 rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-[18px] text-white" aria-label={`${badge} waiting for approval`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function ChatRow({
  chat,
  active,
  onSelectChat,
  onRenameChat,
  onTogglePin,
  onToggleArchive,
  onDeleteChat,
}: SidebarProps & { chat: Chat; active: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeMenu = useCallback(() => {
    setAnchor(null);
    setConfirmDelete(false);
  }, []);

  return (
    <li className="group relative">
      {editing ? (
        <TitleInput
          initial={chat.title}
          onDone={(title) => {
            setEditing(false);
            if (title) onRenameChat(chat.id, title);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelectChat(chat.id)}
          onDoubleClick={() => setEditing(true)}
          aria-current={active ? "page" : undefined}
          className={`flex h-8 w-full items-center gap-2 rounded-lg px-0.5 pr-8 text-left text-sm transition-colors ${active || anchor ? "bg-active text-fg" : "text-secondary hover:bg-hover hover:text-fg"}`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center text-muted">
            {chat.pinned && !chat.archived ? <Pin className="size-3.5" strokeWidth={1.75} /> : <Circle className="size-2.5" strokeWidth={2} />}
          </span>
          <span className="truncate">{chat.title}</span>
        </button>
      )}
      {!editing && (
        <button
          type="button"
          aria-label={`Options for ${chat.title}`}
          aria-haspopup="menu"
          onClick={(e) => (anchor ? closeMenu() : setAnchor(e.currentTarget))}
          className={`absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-secondary hover:text-fg ${anchor ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
        >
          <Ellipsis className="size-4" />
        </button>
      )}
      <Menu anchor={anchor} onClose={closeMenu} align="start" width={200}>
        <ChatActions
          chat={chat}
          confirmDelete={confirmDelete}
          onRename={() => {
            closeMenu();
            setEditing(true);
          }}
          onPin={() => {
            closeMenu();
            onTogglePin(chat.id);
          }}
          onArchive={() => {
            closeMenu();
            onToggleArchive(chat.id);
          }}
          onDelete={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            closeMenu();
            onDeleteChat(chat.id);
          }}
        />
      </Menu>
    </li>
  );
}

/** Shared by the sidebar row menu and the chat title menu in the header. */
export function ChatActions({
  chat,
  confirmDelete,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  chat: Chat;
  confirmDelete: boolean;
  onRename: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      {!chat.archived && (
        <MenuItem icon={chat.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} onSelect={onPin}>
          {chat.pinned ? "Unpin" : "Pin"}
        </MenuItem>
      )}
      <MenuItem icon={<Pencil className="size-4" />} onSelect={onRename}>
        Rename
      </MenuItem>
      <MenuItem icon={chat.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />} onSelect={onArchive}>
        {chat.archived ? "Unarchive" : "Archive"}
      </MenuItem>
      <MenuDivider />
      <MenuItem danger icon={<Trash className="size-4" />} onSelect={onDelete}>
        {confirmDelete ? "Click again to delete" : "Delete"}
      </MenuItem>
    </>
  );
}

export function TitleInput({ initial, onDone, className = "" }: { initial: string; onDone: (title: string | null) => void; className?: string }) {
  const [value, setValue] = useState(initial);
  const finish = (save: boolean) => onDone(save ? value.trim() || null : null);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      maxLength={120}
      aria-label="Chat title"
      className={`h-8 w-full rounded-lg bg-surface px-2.5 text-sm text-fg shadow-[0_0_0_1px_var(--line-strong)] outline-none ${className}`}
    />
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
  { value: "system", label: "System", icon: <Monitor className="size-3.5" /> },
];

function SidebarFooter({ me, theme, onThemeChange, onOpenSettings }: SidebarProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  const current = getRole(me.role);
  const others = useTeam().here.filter((p) => p.id !== me.id);

  return (
    <div className="flex shrink-0 items-center gap-1 px-2 pb-2 pt-1">
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        aria-haspopup="menu"
        className="flex h-8 min-w-0 items-center gap-2 rounded-lg pl-1 pr-1.5 text-left transition-colors hover:bg-hover"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
          {me.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-sm text-secondary">{me.name}</span>
        <span className="shrink-0 text-xs text-muted">· {current.greetingName}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted" />
      </button>
      <div className="flex-1" />
      {others.length > 0 && (
        <span className="flex -space-x-1.5 pr-1" title={`Here now: ${others.map((p) => p.name).join(", ")}`}>
          {others.slice(0, 3).map((p) => (
            <span key={p.id} className="relative flex size-6 items-center justify-center rounded-full bg-active text-[10px] font-semibold text-secondary ring-2 ring-sidebar">
              {p.name.trim().charAt(0).toUpperCase()}
              <span className="absolute -bottom-px -right-px size-2 rounded-full bg-[#2f8a4f] ring-2 ring-sidebar" />
            </span>
          ))}
        </span>
      )}
      <IconButton label="Settings" onClick={onOpenSettings}>
        <Settings2 className="size-4" strokeWidth={1.75} />
      </IconButton>
      <Menu anchor={anchor} onClose={close} width={260}>
        <MenuLabel>
          Signed in as {me.name} · {current.label}
        </MenuLabel>
        <MenuDivider />
        <div className="flex gap-1 p-1">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onThemeChange(t.value)}
              aria-pressed={theme === t.value}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors ${theme === t.value ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg"}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <MenuDivider />
        <MenuItem
          icon={<SlidersHorizontal className="size-4" />}
          onSelect={() => {
            close();
            onOpenSettings();
          }}
        >
          Settings & custom instructions
        </MenuItem>
        <MenuItem
          icon={<LogOut className="size-4" />}
          onSelect={() => {
            close();
            void signOut();
          }}
        >
          Sign out
        </MenuItem>
      </Menu>
    </div>
  );
}
