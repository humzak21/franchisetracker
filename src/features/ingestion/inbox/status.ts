import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { BadgeProps } from "@/components/ui/misc";

export type InboxSet = FunctionReturnType<typeof api.ingestion.inbox.list>[number];
export type UploadStatus = InboxSet["status"];

export const STATUS: Record<UploadStatus, { label: string; tone: BadgeProps["tone"] }> = {
  queued: { label: "Needs tags", tone: "warn" },
  extracting: { label: "Reading", tone: "accent" },
  review: { label: "Review", tone: "solid" },
  failed: { label: "Failed", tone: "loss" },
  committed: { label: "Committed", tone: "win" },
  rejected: { label: "Rejected", tone: "neutral" },
};

/** A queued set that is not waiting for tags. */
export const HOLD: Record<NonNullable<InboxSet["hold"]>, { label: string; tone: BadgeProps["tone"] }> = {
  duplicate: { label: "Already uploaded", tone: "warn" },
  budget: { label: "Held", tone: "warn" },
};

export type InboxFilter = "todo" | "done";

/** Waiting on the user (or the model) versus finished either way. */
export function filterOf(status: UploadStatus): InboxFilter {
  return status === "committed" || status === "rejected" ? "done" : "todo";
}
