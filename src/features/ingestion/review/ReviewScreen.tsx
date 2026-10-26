import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FileWarning } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { INGESTION_TARGETS, isTargetKey } from "@shared/ingestion/targets";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { SplitPane } from "@/components/layout/SplitPane";
import { ImageViewer } from "@/components/media/ImageViewer";
import { Skeleton } from "@/components/ui/misc";
import { AttentionList } from "./AttentionList";
import { BoxScoreEditor } from "./BoxScoreEditor";
import { GameHeaderFields } from "./GameHeaderFields";
import { ReviewActions } from "./ReviewActions";
import { ReviewDraftProvider } from "./reviewDraft";
import { StatusBanner } from "./StatusBanner";
import { TeamStatsEditor } from "./TeamStatsEditor";

/** Review (FEATURES.md 5.11 and 9): screenshots beside the editable draft, two swipeable panes on phones. */
export function ReviewScreen({ setKey }: { setKey: string }) {
  const data = useQuery(api.ingestion.review.get, { setKey });
  const back = { to: "/inbox", label: "Inbox" };

  if (data === undefined) {
    return (
      <Page title="Review" back={back}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </Page>
    );
  }

  const target = data.targetKey && isTargetKey(data.targetKey) ? INGESTION_TARGETS[data.targetKey] : null;
  const eyebrow = [data.season?.year, data.weekKey ? weekLabel(data.weekKey, "long") : null]
    .filter(Boolean)
    .join(" · ");
  const extraction = data.extraction;
  const images = (
    <ImageViewer
      images={data.images.map((img, i) => ({ id: img._id, src: img.url, alt: `Screen ${i + 1}` }))}
    />
  );

  return (
    <Page title={target?.label ?? "Review"} eyebrow={eyebrow || "Untagged"} back={back}>
      <div className="space-y-4">
        <StatusBanner data={data} />
        {extraction && data.status !== "extracting" ? (
          <ReviewDraftProvider
            key={extraction._id}
            setKey={setKey}
            initial={extraction.draft}
            confidence={extraction.confidence}
            extractionNotes={extraction.warnings}
          >
            <SplitPane
              ratio="minmax(0, 1fr) minmax(0, 1fr)"
              panes={[
                {
                  id: "image",
                  label: "Screens",
                  content: <div className="lg:sticky lg:top-20">{images}</div>,
                },
                {
                  id: "draft",
                  label: "Draft",
                  content: (
                    <div className="space-y-5">
                      <AttentionList />
                      <Section title="Final score" variant="card">
                        <GameHeaderFields />
                      </Section>
                      <Section
                        title={extraction.draft.target === "game_box_score" ? "Players" : "Team stats"}
                      >
                        {extraction.draft.target === "game_box_score" ? (
                          <BoxScoreEditor />
                        ) : (
                          <TeamStatsEditor />
                        )}
                      </Section>
                      <p className="text-xs text-subtle-foreground">
                        Read by {extraction.model}
                        {extraction.latencyMs ? ` in ${(extraction.latencyMs / 1000).toFixed(1)}s` : ""}
                      </p>
                      <ReviewActions setKey={setKey} committed={data.status === "committed"} />
                    </div>
                  ),
                },
              ]}
            />
          </ReviewDraftProvider>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {images}
            {data.status !== "extracting" && data.status !== "queued" && (
              <EmptyState
                icon={FileWarning}
                title="No draft"
                description="Nothing was read from these screenshots yet."
                action={
                  <Link to="/inbox" className="text-sm text-primary underline">
                    Back to the inbox
                  </Link>
                }
              />
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
