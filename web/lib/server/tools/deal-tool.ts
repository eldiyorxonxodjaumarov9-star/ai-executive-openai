import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchEntity } from "./entity-fetch";
import type { CrmRecord } from "../bitrix";

export class DealTool implements BitrixTool {
  readonly name = "loadDeals" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    const result = await fetchEntity("deals", ctx.bypassCache);
    if (result.limitation) {
      ctx.loaded.limitations.push(result.limitation);
      ctx.loaded.entitiesFetched.deals = 0;
      return { name: this.name, success: false, durationMs: Date.now() - start, error: result.limitation };
    }
    const pack = result.data as { deals: CrmRecord[]; paginationPages: number };
    ctx.loaded.deals = pack.deals;
    ctx.loaded.paginationPages = pack.paginationPages;
    ctx.loaded.entitiesFetched.deals = pack.deals.length;
    if (result.cached) ctx.loaded.cached = true;
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: pack.deals.length, cached: result.cached },
    };
  }
}

export const dealTool = new DealTool();
