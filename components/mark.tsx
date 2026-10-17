import Image from "next/image";
import { profile } from "@/profiles";

interface MarkProps {
  size?: number;
  working?: boolean;
  className?: string;
}

/**
 * The profile's logo: its image, or its letters on a brand-colored badge. While the assistant works it
 * breathes, and larger sizes get a stepping accent ring.
 */
export function Mark({ size = 32, working = false, className = "" }: MarkProps) {
  const logo = profile.logo;
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 ${working ? "mark-working" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      {"image" in logo ? (
        <Image src={logo.image} alt="" width={size} height={size} className="size-full rounded-full object-cover" />
      ) : (
        <span
          className="flex size-full items-center justify-center rounded-full bg-brand-deep font-semibold tracking-[0.02em] text-white shadow-[inset_0_0_0_2px_var(--gold)]"
          style={{ fontSize: Math.max(9, Math.round(size * (logo.monogram.length > 2 ? 0.3 : 0.38))) }}
        >
          {logo.monogram}
        </span>
      )}
      {working && size >= 24 && <span className="mark-ring pointer-events-none absolute -inset-[3px] rounded-full" />}
    </span>
  );
}
