import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchEntity } from "./entity-fetch";
import type { CrmRecord } from "../bitrix";

export class LeadTool implements BitrixTool {
  readonly name = "loadLeads" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    const result = await fetchEntity("leads", ctx.bypassCache);
    if (result.limitation) {
      ctx.loaded.limitations.push(result.limitation);
      ctx.loaded.entitiesFetched.leads = 0;
      return { name: this.name, success: false, durationMs: Date.now() - start, error: result.limitation };
    }
    ctx.loaded.leads = result.data as CrmRecord[];
    ctx.loaded.entitiesFetched.leads = ctx.loaded.leads.length;
    if (result.cached) ctx.loaded.cached = true;
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.loaded.leads.length, cached: result.cached },
    };
  }
}

export const leadTool = new LeadTool();
