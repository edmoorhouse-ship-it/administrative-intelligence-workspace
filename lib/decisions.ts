import { currentPerson, getShared, subscribeShared, updateShared } from "./shared-client";

/**
 * Choices made on decision cards, shared by everyone signed in to the workspace. Recording a
 * choice sends, orders, or pays nothing; a choice that needs a draft opens a chat that writes it.
 */

export interface Decision {
  choice: string;
  at: number;
  /** Who made the choice. */
  by?: string;
}

export type Decisions = Record<string, Decision>;

const EMPTY: Decisions = {};

export const getDecisions = () => (getShared("decisions") as Decisions | undefined) ?? EMPTY;
export const getServerDecisions = () => EMPTY;

export function subscribeDecisions(listener: () => void) {
  return subscribeShared("decisions", listener);
}

/** Records a choice, or clears it when choice is null. */
export function setDecision(id: string, choice: string | null) {
  void updateShared<Decisions>("decisions", EMPTY, (current) => {
    const next = { ...current };
    if (choice === null) delete next[id];
    else next[id] = { choice, at: Date.now(), by: currentPerson()?.name };
    return next;
  });
}
