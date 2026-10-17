import {
  Apple,
  Briefcase,
  CalendarClock,
  CalendarDays,
  GraduationCap,
  HandCoins,
  Handshake,
  HeartHandshake,
  Info,
  Sparkles,
  Sunset,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { SchoolSectionId } from "@/lib/school-sections";

const ICONS: Record<SchoolSectionId, LucideIcon> = {
  about: Info,
  enrollment: UserPlus,
  academics: GraduationCap,
  "student-life": Users,
  community: Handshake,
  support: HeartHandshake,
  parents: UsersRound,
  calendar: CalendarDays,
  nutrition: Apple,
  donations: HandCoins,
  employment: Briefcase,
  "after-school": Sunset,
  "upcoming-events": CalendarClock,
  spotlight: Sparkles,
};

export function SectionIcon({ id, className = "size-4" }: { id: SchoolSectionId; className?: string }) {
  const Icon = ICONS[id];
  return <Icon className={className} strokeWidth={1.75} />;
}
