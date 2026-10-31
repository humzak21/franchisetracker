import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatMoney } from "@shared/roster/cap";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Section } from "@/components/layout/Section";
import { PlayerChip } from "@/components/player/PlayerChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { ExpiringContracts } from "./ExpiringContracts";
import { useQuery } from "@/lib/convex/useQuery";

type Cap = FunctionReturnType<typeof api.players.cap.bySeason>;
type Row = Cap["players"][number];

const columns: DataColumn<Row>[] = [
  {
    id: "player",
    header: "Player",
    value: (r) => r.displayName,
    cell: (r) => (
      <Link to="/players/$playerId" params={{ playerId: r.playerId }} className="hover:underline">
        <PlayerChip player={r} size="sm" />
      </Link>
    ),
    minWidth: 180,
  },
  {
    id: "hit",
    header: "Cap hit",
    align: "right",
    sortDescFirst: true,
    value: (r) => r.apy,
    cell: (r) => (r.apy === null ? "—" : formatMoney(r.apy)),
  },
  { id: "years", header: "Yrs", title: "Contract years", align: "right", value: (r) => r.years ?? null },
  {
    id: "expires",
    header: "Ends",
    title: "Contract runs through",
    align: "right",
    value: (r) => r.expiresYear ?? null,
    cell: (r) => (r.expiring ? <Badge tone="warn">{r.expiresYear}</Badge> : (r.expiresYear ?? "")),
  },
  { id: "ovr", header: "OVR", align: "right", sortDescFirst: true, value: (r) => r.ovr ?? null },
];

function CapForm({ seasonId, cap }: { seasonId: Id<"seasons">; cap: number | null }) {
  const save = useMutation(api.players.cap.setSalaryCap);
  const [text, setText] = useState(cap === null ? "" : String(cap / 1_000_000));
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await save({ seasonId, salaryCap: text.trim() === "" ? null : Math.round(Number(text) * 1_000_000) });
    } catch (err) {
      setError(errorMessage(err, "Not saved."));
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        Salary cap ($M)
        <Input
          aria-label="Salary cap in millions"
          inputMode="decimal"
          className="w-28"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <Button type="submit" size="sm" variant="outline">
        Save
      </Button>
      {error && <span className="text-sm text-loss">{error}</span>}
    </form>
  );
}

/**
 * The cap view (FEATURES.md 5.3, 5.10): every rostered player's cap hit from their contract, the
 * total against the season's cap, who expires and what that leaves next season, with a link to
 * the season's needs.
 */
export function CapView({ seasonId }: { seasonId: Id<"seasons"> }) {
  const cap = useQuery(api.players.cap.bySeason, { seasonId });
  if (cap === undefined) return <Skeleton className="h-64 rounded-xl" />;
  const expiring = cap.players.filter((p) => p.expiring).length;
  const missing = cap.players.filter((p) => p.apy === null).length;
  return (
    <div className="@container space-y-5">
      <TileStrip>
        <Tile
          label="Committed"
          value={formatMoney(cap.committed)}
          accent
          detail={`${cap.rostered - missing} of ${cap.rostered} contracts known`}
        />
        <Tile label="Cap" value={cap.salaryCap === null ? "—" : formatMoney(cap.salaryCap)} />
        <Tile label="Space" value={cap.space === null ? "—" : formatMoney(cap.space)} />
        <Tile label="Expiring" value={expiring} detail={`After ${cap.year}`} />
      </TileStrip>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CapForm key={String(cap.salaryCap)} seasonId={seasonId} cap={cap.salaryCap} />
        <Link
          to="/history/reports/$year"
          params={{ year: String(cap.year) }}
          hash="needs"
          className="text-sm text-primary underline"
        >
          Offseason needs
        </Link>
      </div>
      <Section title={`Going into ${cap.year + 1}`} description="If nobody who expires comes back.">
        <TileStrip>
          <Tile label="Committed" value={formatMoney(cap.next.committed)} />
          <Tile label="Cap" value={cap.next.salaryCap === null ? "—" : formatMoney(cap.next.salaryCap)} />
          <Tile label="Space" value={cap.next.space === null ? "—" : formatMoney(cap.next.space)} />
          <Tile label="Coming off" value={formatMoney(cap.next.freed)} detail={`${expiring} expiring`} />
        </TileStrip>
      </Section>
      <ExpiringContracts cap={cap} />
      <DataTable<Row>
        id="cap-view"
        data={cap.players}
        columns={columns}
        getRowId={(r) => r.playerId}
        identityColumn="player"
        primaryColumns={["hit", "expires"]}
        initialSort={{ id: "hit", desc: true }}
        caption="Cap hits"
      />
    </div>
  );
}
