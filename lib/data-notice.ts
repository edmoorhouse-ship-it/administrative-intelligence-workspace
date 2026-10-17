// Kept separate from the datasets so client components can show the notice
// without bundling a whole dataset into the browser.
import { profile } from "@/profiles";

/** The active profile's "today" for its sample data. */
export const DATA_AS_OF = profile.dataAsOf;

export const SAMPLE_DATA_NOTICE = profile.dataNotice;
