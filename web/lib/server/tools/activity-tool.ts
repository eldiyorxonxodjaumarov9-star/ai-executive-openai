import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchEntity } from "./entity-fetch";
import type { CrmRecord } from "../bitrix";

export class ActivityTool implements BitrixTool {
  readonly name = "loadActivities" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    const result = await fetchEntity("activities", ctx.bypassCache);
    if (result.limitation) {
      ctx.loaded.limitations.push(result.limitation);
      ctx.loaded.entitiesFetched.activities = 0;
      return { name: this.name, success: false, durationMs: Date.now() - start, error: result.limitation };
    }
    ctx.loaded.activities = result.data as CrmRecord[];
    ctx.loaded.entitiesFetched.activities = ctx.loaded.activities.length;
    if (result.cached) ctx.loaded.cached = true;
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.loaded.activities.length, cached: result.cached },
    };
  }
}

export const activityTool = new ActivityTool();
