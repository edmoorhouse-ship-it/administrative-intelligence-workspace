"use client";

import { useEffect, useState } from "react";
import { profile } from "@/profiles";
import { CALENDAR_EVENTS, type CalEvent } from "./calendar";
import type { Pulse } from "./construction/pulse";

/**
 * Built-in calendar events and the Pulse for the active profile. MACS builds them in the page; the
 * construction profile asks the server, which filters them to the person's role first.
 */

const NONE: CalEvent[] = [];
const fromServer = profile.id !== "macs";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The calendar's built-in events (shared events are added by the caller). */
export function useBaseEvents(): CalEvent[] {
  const [events, setEvents] = useState<CalEvent[]>(fromServer ? NONE : CALENDAR_EVENTS);
  useEffect(() => {
    if (!fromServer) return;
    let live = true;
    void getJson<{ events: CalEvent[] }>("/api/calendar/base").then((data) => {
      if (live && data) setEvents(data.events);
    });
    return () => {
      live = false;
    };
  }, []);
  return events;
}

/** The construction Pulse for this person's role: null while loading, "error" if it couldn't load. */
export function useServerPulse(): Pulse | null | "error" {
  const [pulse, setPulse] = useState<Pulse | null | "error">(null);
  useEffect(() => {
    let live = true;
    void getJson<Pulse>("/api/pulse").then((data) => {
      if (live) setPulse(data ?? "error");
    });
    return () => {
      live = false;
    };
  }, []);
  return pulse;
}
