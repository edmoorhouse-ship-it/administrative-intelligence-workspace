import Image from "next/image";
import badge from "@/public/brand/macs-manatees.png";

interface MarkProps {
  size?: number;
  working?: boolean;
  className?: string;
}

/** MACS Manatees badge. While the assistant works it breathes, and larger sizes get a stepping gold ring. */
export function Mark({ size = 32, working = false, className = "" }: MarkProps) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 ${working ? "mark-working" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src={badge} alt="" width={size} height={size} className="size-full rounded-full object-cover" />
      {working && size >= 24 && <span className="mark-ring pointer-events-none absolute -inset-[3px] rounded-full" />}
    </span>
  );
}
