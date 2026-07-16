import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchEntity } from "./entity-fetch";
import type { CrmRecord } from "../bitrix";

export class CompanyTool implements BitrixTool {
  readonly name = "loadCompanies" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    const result = await fetchEntity("companies", ctx.bypassCache);
    if (result.limitation) {
      ctx.loaded.limitations.push(result.limitation);
      ctx.loaded.entitiesFetched.companies = 0;
      return { name: this.name, success: false, durationMs: Date.now() - start, error: result.limitation };
    }
    ctx.loaded.companies = result.data as CrmRecord[];
    ctx.loaded.entitiesFetched.companies = ctx.loaded.companies.length;
    if (result.cached) ctx.loaded.cached = true;
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.loaded.companies.length, cached: result.cached },
    };
  }
}

export const companyTool = new CompanyTool();
