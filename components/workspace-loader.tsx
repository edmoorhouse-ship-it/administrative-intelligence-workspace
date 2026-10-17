"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchSession, onSignedOut, type Person, type SessionInfo } from "@/lib/shared-client";

const Workspace = dynamic(() => import("./workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => <div className="h-full bg-page" aria-busy="true" />,
});
const SignInScreen = dynamic(() => import("./sign-in-screen").then((m) => m.SignInScreen), { ssr: false });

/** Shows the workspace to someone signed in, and the sign-in (or first-time setup) screen to everyone else. */
export function WorkspaceLoader() {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    const check = () =>
      fetchSession()
        .then(setInfo)
        .catch(() => setInfo({ user: null, setupNeeded: false, setupNeedsCode: false, setupBlocked: false }));
    void check();
    onSignedOut(() => void check());
  }, []);

  if (!info) return <div className="h-dvh bg-page" aria-busy="true" />;
  if (!info.user) return <SignInScreen info={info} onSignedIn={(user: Person) => setInfo({ ...info, user, setupNeeded: false })} />;
  return <Workspace key={info.user.id} me={info.user} />;
}
