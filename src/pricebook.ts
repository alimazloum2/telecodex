import type { Context } from "grammy";

export type PriceObservation = {
  price: number;
  unit: string;
  currency: string;
  region: string;
  source_name: string;
  date_captured: string;
  age_days: number;
  is_stale: boolean;
};

export type PriceSearchResult = {
  id: number;
  canonical_name: string;
  score: number;
  observations: PriceObservation[];
};

export function formatPriceLookup(query: string, results: PriceSearchResult[]): string {
  if (!results.length) {
    return `No pricebook match for "${query}".`;
  }
  const lines = [`💵 Price lookup: ${query}`];
  for (const result of results.slice(0, 3)) {
    lines.push(`\n${result.canonical_name} (${result.score.toFixed(2)})`);
    for (const obs of result.observations.slice(0, 5)) {
      const stale = obs.is_stale ? " STALE" : "";
      lines.push(`• ${obs.region}: ${obs.price} ${obs.currency}/${obs.unit} — ${obs.source_name}, ${obs.date_captured}, ${obs.age_days}d old${stale}`);
    }
  }
  return lines.join("\n").slice(0, 3900);
}

export async function runPriceLookup(query: string, baseUrl = process.env.NEXCORE_PRICEBOOK_URL || "http://127.0.0.1:5055"): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`Pricebook HTTP ${response.status}`);
  }
  const data = (await response.json()) as { results?: PriceSearchResult[] };
  return formatPriceLookup(query, data.results || []);
}

export async function handlePriceLookup(ctx: Context): Promise<void> {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text || "" : "";
  const match = text.match(/^price\s+(.+)/i);
  if (!match) return;
  const query = match[1].trim();
  if (!query) return;
  const status = await ctx.reply("🔎 Searching NexCore pricebook…");
  try {
    const reply = await runPriceLookup(query);
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, reply);
  } catch (error) {
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, `❌ Pricebook lookup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
