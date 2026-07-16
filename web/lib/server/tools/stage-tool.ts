import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchEntity } from "./entity-fetch";
import type { DealStageInfo } from "../bitrix";

export class StageTool implements BitrixTool {
  readonly name = "loadStages" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    const result = await fetchEntity("stages", ctx.bypassCache);
    if (result.limitation) {
      ctx.loaded.limitations.push(result.limitation);
      ctx.loaded.entitiesFetched.stages = 0;
      return { name: this.name, success: false, durationMs: Date.now() - start, error: result.limitation };
    }
    ctx.loaded.stages = result.data as Map<string, DealStageInfo>;
    ctx.loaded.entitiesFetched.stages = ctx.loaded.stages.size;
    if (result.cached) ctx.loaded.cached = true;
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.loaded.stages.size, cached: result.cached },
    };
  }
}

export const stageTool = new StageTool();
