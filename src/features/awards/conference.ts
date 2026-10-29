import type { Conference } from "@shared/domain";

/** Each conference's mark: its color for text, rules and fills. */
export const CONFERENCE_TONE: Record<Conference, { text: string; border: string; fill: string }> = {
  AFC: { text: "text-afc", border: "border-afc", fill: "bg-afc" },
  NFC: { text: "text-nfc", border: "border-nfc", fill: "bg-nfc" },
};
