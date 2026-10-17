import raw from "./school-sections.json";

/**
 * Public school information summarized from macschool.us. Unlike lib/macs-data.ts,
 * this is REAL public content, so it can go stale: re-check the live pages and
 * refresh school-sections.json each term.
 */
export const SITE_CHECKED_ON = "2026-10-14";

/** Headline counts from the homepage "At a Glance" panel. Update alongside school-sections.json. */
export const PUBLIC_AT_A_GLANCE = { enrolledStudents: 274, teachersAndStaff: 43 };

export const SECTION_IDS = [
  "about",
  "enrollment",
  "academics",
  "student-life",
  "community",
  "support",
  "parents",
  "calendar",
  "nutrition",
  "donations",
  "employment",
  "after-school",
  "upcoming-events",
  "spotlight",
] as const;

export type SchoolSectionId = (typeof SECTION_IDS)[number];

/** Sidebar labels, matching the macschool.us menu and homepage tiles. */
export const SECTION_TITLES: Record<SchoolSectionId, string> = {
  about: "About MACS",
  enrollment: "Enrollment",
  academics: "Academics",
  "student-life": "Student Life",
  community: "Community",
  support: "Support",
  parents: "Parents",
  calendar: "Calendar",
  nutrition: "Nutrition",
  donations: "Donations",
  employment: "Employment",
  "after-school": "After School",
  "upcoming-events": "Upcoming Events",
  spotlight: "Manatee Spotlight",
};

export interface SchoolSection {
  id: SchoolSectionId;
  title: string;
  url: string;
  summary: string;
  facts: string[];
  links: { label: string; url: string }[];
  events?: { date: string; title: string; time?: string }[];
  notes?: string;
}

/** Starter questions shown on each section page. */
export const SECTION_PROMPTS: Record<SchoolSectionId, string[]> = {
  about: [
    "Draft a one-paragraph About MACS blurb for a grant application.",
    "Summarize our mission and governance for a new board member.",
    "What should a prospective family hear first about MACS?",
  ],
  enrollment: [
    "Summarize the enrollment process for a family calling the front office.",
    "Draft a ParentSquare post announcing enrollment information.",
    "List the enrollment questions the front office should be ready to answer.",
  ],
  academics: [
    "Explain our VPK, elementary, and middle school programs in plain language.",
    "How do FAST and our grading scale fit together for parents?",
    "Draft talking points for an academic open house.",
  ],
  "student-life": [
    "List our clubs and activities for a new-family welcome packet.",
    "Draft a newsletter blurb highlighting student experiences.",
    "Which activities could we promote more this semester?",
  ],
  community: [
    "Draft a thank-you note template for our business partners.",
    "Suggest ways to recognize community partners on ParentSquare.",
    "Summarize our community partnerships for the board.",
  ],
  support: [
    "Summarize the ways families can support MACS.",
    "Draft a volunteer call for the next PTO event.",
    "Outline talking points for the Brick Campaign.",
  ],
  parents: [
    "Which parent resources belong in the new-family packet?",
    "Draft a reminder pointing families to the Parent/Student Handbook.",
    "Summarize the student services available to families.",
  ],
  calendar: [
    "List the key 2026-27 dates families should know this month.",
    "Draft a reminder about the next student holiday.",
    "Which upcoming dates need staff planning?",
  ],
  nutrition: [
    "Summarize meal service and wellness information for families.",
    "Draft a ParentSquare post about school meals.",
    "Answer the nutrition questions the front office hears most.",
  ],
  donations: [
    "Draft a donation appeal for the PTO.",
    "Explain how families can donate and what donations support.",
    "Write a thank-you message for recent donors.",
  ],
  employment: [
    "Draft a job posting introduction that reflects the MACS culture.",
    "Summarize how someone applies to work at MACS.",
    "What should a candidate know about MACS before interviewing?",
  ],
  "after-school": [
    "Summarize the after-school program for a family inquiry.",
    "Draft a reminder about after-school pickup.",
    "List the questions families ask about after school, with answers.",
  ],
  "upcoming-events": [
    "Draft this week's events section for the newsletter.",
    "Which upcoming events need staff coverage or volunteers?",
    "Turn the upcoming events into a ParentSquare reminder.",
  ],
  spotlight: [
    "Draft a Manatee Spotlight post from the latest Manatee Moments.",
    "Summarize recent school news for the board.",
    "Write a short post celebrating a recent student or staff win.",
  ],
};

const byId = new Map((raw as SchoolSection[]).map((s) => [s.id, s]));

export const SCHOOL_SECTIONS: SchoolSection[] = SECTION_IDS.map((id) => ({
  ...(byId.get(id) ?? { id, url: "https://www.macschool.us/", summary: "", facts: [], links: [], notes: "Not loaded yet." }),
  title: SECTION_TITLES[id],
}));

export function getSection(id: string | null | undefined): SchoolSection | null {
  return SCHOOL_SECTIONS.find((s) => s.id === id) ?? null;
}

export function isKnownSection(id: unknown): id is SchoolSectionId {
  return typeof id === "string" && (SECTION_IDS as readonly string[]).includes(id);
}

const formatSection = (s: SchoolSection) =>
  [
    `### ${s.title} (${s.url})`,
    s.summary,
    ...s.facts.map((f) => `- ${f}`),
    ...(s.events?.length ? ["Events:", ...s.events.map((e) => `- ${e.date}${e.time ? ` ${e.time}` : ""}: ${e.title}`)] : []),
    ...(s.links.length ? ["Links:", ...s.links.map((l) => `- ${l.label}: ${l.url}`)] : []),
  ].join("\n");

/** Compact public-site overview included in every system prompt. */
export const schoolSiteContext = () =>
  SCHOOL_SECTIONS.map((s) => `- ${s.title}: ${s.summary}`).join("\n");

/** Full detail for the section a chat was started from. */
export const sectionFocusContext = (s: SchoolSection) => formatSection(s);
