import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type SeasonReportData = FunctionReturnType<typeof api.seasons.reports.get>;
export type Need = NonNullable<SeasonReportData["report"]>["needs"][number];
export type ArchiveRow = FunctionReturnType<typeof api.seasons.reports.archive>[number];
