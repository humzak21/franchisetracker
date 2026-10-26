/** Usage and cost per extraction model for the Settings panel. Pure. */

export type UsageRow = {
  model: string;
  tokens?: number;
  costUsd?: number;
  latencyMs?: number;
};

export type ModelUsage = {
  model: string;
  extractions: number;
  tokens: number;
  /** Null when the provider reported no cost for any of them. */
  costUsd: number | null;
  avgLatencyMs: number | null;
};

/** Totals per model, the most used first. */
export function usageByModel(rows: readonly UsageRow[]): ModelUsage[] {
  const byModel = new Map<string, { n: number; tokens: number; cost: number | null; latency: number[] }>();
  for (const row of rows) {
    const m = byModel.get(row.model) ?? { n: 0, tokens: 0, cost: null, latency: [] };
    m.n++;
    m.tokens += row.tokens ?? 0;
    if (row.costUsd !== undefined) m.cost = (m.cost ?? 0) + row.costUsd;
    if (row.latencyMs !== undefined && row.latencyMs > 0) m.latency.push(row.latencyMs);
    byModel.set(row.model, m);
  }
  return [...byModel.entries()]
    .map(([model, m]) => ({
      model,
      extractions: m.n,
      tokens: m.tokens,
      costUsd: m.cost,
      avgLatencyMs: m.latency.length ? m.latency.reduce((a, b) => a + b, 0) / m.latency.length : null,
    }))
    .sort((a, b) => b.extractions - a.extractions || a.model.localeCompare(b.model));
}
