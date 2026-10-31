/** The cap view (FEATURES.md 5.3, 5.10): cap hits from the roster's contracts, space and who expires. Pure. */

export type CapContract = { apy?: number; years?: number; total?: number; expiresYear?: number };

export type CapRow<P> = { playerId: P; contract?: CapContract };

export type CapSummary<P> = {
  /** Sum of every known cap hit (a contract's yearly average). */
  committed: number;
  /** Cap minus committed; null when the season's cap is not set. */
  space: number | null;
  /** Players with a cap hit, biggest first. */
  hits: { playerId: P; apy: number; expiresYear?: number }[];
  /** Contracts that run out with this season. */
  expiring: P[];
  /** What those contracts cost this season, off the books next season. */
  freed: number;
  /** Rostered players without a contract on record. */
  unknown: P[];
};

export function capHit(contract: CapContract | undefined): number | null {
  if (!contract) return null;
  if (contract.apy !== undefined) return contract.apy;
  if (contract.total !== undefined && contract.years) return contract.total / contract.years;
  return null;
}

/** Whether a contract ends with `year`. An end year decides over years left; an undated one runs on. */
export function runsOut(contract: CapContract | undefined, year: number): boolean {
  if (contract?.expiresYear !== undefined) return contract.expiresYear <= year;
  return contract?.years !== undefined && contract.years <= 1;
}

export function capSummary<P>(
  rows: readonly CapRow<P>[],
  cap: number | undefined,
  year: number,
): CapSummary<P> {
  const hits: CapSummary<P>["hits"] = [];
  const unknown: P[] = [];
  const expiring: P[] = [];
  let freed = 0;
  for (const row of rows) {
    const apy = capHit(row.contract);
    if (apy === null) unknown.push(row.playerId);
    else hits.push({ playerId: row.playerId, apy, expiresYear: row.contract?.expiresYear });
    if (runsOut(row.contract, year)) {
      expiring.push(row.playerId);
      freed += apy ?? 0;
    }
  }
  hits.sort((a, b) => b.apy - a.apy);
  const committed = hits.reduce((n, h) => n + h.apy, 0);
  return { committed, space: cap === undefined ? null : cap - committed, hits, expiring, freed, unknown };
}

/** "$9.2M", "$750K". */
export function formatMoney(dollars: number): string {
  const sign = dollars < 0 ? "−" : "";
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}
