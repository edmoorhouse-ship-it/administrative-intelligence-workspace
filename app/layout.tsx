import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { profile, profileCss } from "@/profiles";

// Claude's sans falls back to the system UI font; the serif is the closest open match.
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: profile.workspaceName,
  description: profile.description,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
};

// Applies the saved theme before first paint so dark mode doesn't flash. Light is the default.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem("macs.settings.v1")||"{}");var t=s.theme||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning data-profile={profile.id} className={`${sourceSerif.variable} h-full antialiased`}>
      <head>
        {/* The active profile's accent colors (profiles/), over the defaults in globals.css. */}
        <style dangerouslySetInnerHTML={{ __html: profileCss() }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
