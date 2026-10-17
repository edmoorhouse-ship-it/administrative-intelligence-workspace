/**
 * Demo pages for the MACS workspace. Each one states what is real today. Nothing here claims a
 * check passed or a feature runs when it doesn't. Items marked "open" or "before real use" are
 * the honest gaps.
 */

export type DemoPageId = "canva" | "onboarding" | "security" | "mac" | "students" | "brain" | "vendors" | "calendar";

export type ItemState = "pass" | "open" | "blocker" | "info";

export interface DemoItem {
  label: string;
  text: string;
  state?: ItemState;
}

export interface DemoSection {
  heading: string;
  items: DemoItem[];
}

export interface DemoThreadMessage {
  from: "mac" | "you";
  text: string;
  time?: string;
}

export interface DemoThread {
  dayLabel: string;
  messages: DemoThreadMessage[];
}

export interface DemoPage {
  id: DemoPageId;
  title: string;
  subtitle: string;
  intro: string;
  image?: { src: string; alt: string; width: number; height: number };
  link?: { label: string; href: string };
  sections: DemoSection[];
  footnote?: string;
  thread?: DemoThread;
}

export const DEMO_PAGES: Record<DemoPageId, DemoPage> = {
  canva: {
    id: "canva",
    title: "Canva designs",
    subtitle: "Drafts made in Canva for the school. Nothing is published.",
    intro:
      "Describe what you need in plain words, and Canva drafts it. You review, make changes, and print or post it yourself.",
    image: {
      src: "/demo/fall-family-night-draft.png",
      alt: "Fall Family Night flyer draft, showing the date, time, and place",
      width: 816,
      height: 1056,
    },
    link: { label: "Open the draft in Canva", href: "https://canva.link/rcqsrlv5v4hyan1" },
    sections: [
      {
        heading: "Fall Family Night flyer (draft)",
        items: [
          { label: "Status", text: "Draft in your Canva account. Not published.", state: "info" },
          {
            label: "Confirm before printing",
            text: "Friday, Oct 30, 5:30 to 7:00 PM, cafeteria. The public calendar lists the Halloween Parade the same day.",
            state: "open",
          },
          {
            label: "Badge",
            text: "Canva drew its own manatee illustration. The official Manatees badge isn't on it yet.",
            state: "open",
          },
        ],
      },
      {
        heading: "What works today",
        items: [
          { label: "Drafts", text: "A design can be drafted from a written description.", state: "pass" },
          { label: "Export", text: "Designs export as PDF or PNG for printing.", state: "pass" },
          {
            label: "Button in this app",
            text: "Not built yet. Today the draft is made in Canva directly, not from this page.",
            state: "open",
          },
        ],
      },
    ],
  },

  // The Vendors page is components/vendors-view.tsx; only its title is read from here.
  vendors: {
    id: "vendors",
    title: "Vendors",
    subtitle: "Vendor agreements: what's on file, what's missing, and what comes due.",
    intro: "Sample agreements for generic stand-in vendors. No contract system is connected.",
    sections: [],
  },

  // The Calendar page is components/calendar-view.tsx; only its title is read from here.
  calendar: {
    id: "calendar",
    title: "Calendar",
    subtitle: "Deadlines, board meetings, testing windows, and school events, filtered to your role.",
    intro: "Public dates come from macschool.us. Everything else is sample data.",
    sections: [],
  },

  // The Brain page is components/brain-view.tsx; only its title is read from here.
  brain: {
    id: "brain",
    title: "Shared brain",
    subtitle: "Sourced facts, approvals, the activity feed, and the team.",
    intro: "One memory for the whole team. Agents propose; a person approves.",
    sections: [],
  },

  // The Students page is components/students-view.tsx; only its title is read from here.
  students: {
    id: "students",
    title: "Students",
    subtitle: "The 300-student sample roster: attendance, supports, and FAST levels.",
    intro: "Filters, charts, decisions, and the roster as a sheet. Students are codes only.",
    sections: [],
  },

  // The Onboarding page is components/onboarding-view.tsx; only its title is read from here.
  onboarding: {
    id: "onboarding",
    title: "Onboarding",
    subtitle: "Set the workspace up for MACS, then bring each new staff member on.",
    intro: "Setup steps and new-staff checklists, saved in this browser.",
    sections: [],
  },

  security: {
    id: "security",
    title: "Security check",
    subtitle: "Checks run by hand on 2026-10-15. This is not an automated audit.",
    intro:
      "Each check below says what was verified and what is still open. Nothing here means the whole system passed review.",
    sections: [
      {
        heading: "Checks",
        items: [
          {
            label: "API key",
            text: "Read only from the server's .env.local file. It is never sent to the browser.",
            state: "pass",
          },
          {
            label: "Sign-in",
            text: "Each person has their own account and passcode, stored as scrypt hashes. The chat, the shared store, the brain, and the feed all need a signed-in session.",
            state: "pass",
          },
          {
            label: "Roles",
            text: "Enforced on the server: the front office never sees finance, Finance never sees IEPs, and the chat only gets the parts of the dataset the person's role covers.",
            state: "pass",
          },
          {
            label: "Network access",
            text: "On the VPS, run it on 127.0.0.1 behind `tailscale serve`, so only devices on the school's tailnet can reach it. Not deployed yet.",
            state: "open",
          },
          {
            label: "Data in the page code",
            text: "The sample dataset and roster are built into the page code, so they reach a browser before sign-in. Real records must come from the server after sign-in.",
            state: "blocker",
          },
          {
            label: "Sample data",
            text: "Labeled as sample on every page that uses it.",
            state: "pass",
          },
          {
            label: "Student names",
            text: "Not in the sample data. Staff must remove names from anything they paste.",
            state: "open",
          },
          {
            label: "Records sent to the AI",
            text: "Pasted text and the dataset go to OpenRouter. A privacy decision is needed before real records.",
            state: "blocker",
          },
          {
            label: "Sending on anyone's behalf",
            text: "No send integration. Every draft has to be copied and sent by a person.",
            state: "pass",
          },
          {
            label: "Shared data",
            text: "Decisions, the Claims and Supplies sheets, onboarding, the brain, and the activity feed live in one file on the server. Chats stay in each browser.",
            state: "pass",
          },
          {
            label: "Packages",
            text: "Reviewed 2026-10-15. npm reports 5 high-severity warnings, all in the lint tooling (eslint-config-next and the packages under it). The packages that ship with the app have none. npm's suggested fix is a downgrade, so update the lint tooling once a fixed version is out.",
            state: "open",
          },
        ],
      },
    ],
    footnote:
      "Before real school records go in: serve the dataset from the server after sign-in, put the VPS on the school's tailnet, and decide what may go to the AI provider.",
  },

  mac: {
    id: "mac",
    title: "Text Mac",
    subtitle: "Mac is the always-on chief of staff agent. Text it here in the app.",
    intro:
      "Mac answers in this thread using the same assistant as the rest of the workspace. The opening messages are a sample written from the sample dataset. Texting Mac from a phone isn't connected yet.",
    thread: {
      dayLabel: "Today",
      messages: [
        { from: "mac", text: "Good morning. Two things need you before Friday.", time: "7:02 AM" },
        { from: "you", text: "Okay. What are they?" },
        {
          from: "mac",
          text: "The IEP meeting for S-1107 is Friday the 16th, and that review is already five days overdue. The FTE Survey 2 data goes to ACPS on the 23rd, with about USD 4,346 net at stake.",
        },
        { from: "you", text: "Can you draft a note to the case manager?" },
        {
          from: "mac",
          text: "Drafted, and nothing was sent. You can review it first. Everything else can wait until after lunch.",
          time: "7:04 AM",
        },
      ],
    },
    sections: [
      {
        heading: "Not connected yet",
        items: [
          { label: "Phone number", text: "No number is set up for Mac.", state: "open" },
          {
            label: "Text service",
            text: "No SMS provider is connected. Replies in the thread above come through this app, not a phone.",
            state: "open",
          },
          {
            label: "Always on",
            text: "The app runs only while it is started on this Mac. Mac needs hosting that stays up.",
            state: "blocker",
          },
          {
            label: "Who can text Mac",
            text: "No sign-in and no allow-list. Anyone with the number could reach it.",
            state: "blocker",
          },
          {
            label: "Sending",
            text: "Mac drafts only. A person sends anything to a family or staff member.",
            state: "pass",
          },
        ],
      },
    ],
    footnote:
      "Before Mac works by phone: pick a number, connect a text service, host Mac somewhere that stays on, and add sign-in with an allow-list of staff numbers.",
  },
};
