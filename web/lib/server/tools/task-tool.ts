import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchEntity } from "./entity-fetch";
import type { CrmRecord } from "../bitrix";

export class TaskTool implements BitrixTool {
  readonly name = "loadTasks" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    const result = await fetchEntity("tasks", ctx.bypassCache);
    if (result.limitation) {
      ctx.loaded.limitations.push(result.limitation);
      ctx.loaded.entitiesFetched.tasks = 0;
      return { name: this.name, success: false, durationMs: Date.now() - start, error: result.limitation };
    }
    ctx.loaded.tasks = result.data as CrmRecord[];
    ctx.loaded.entitiesFetched.tasks = ctx.loaded.tasks.length;
    if (result.cached) ctx.loaded.cached = true;
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.loaded.tasks.length, cached: result.cached },
    };
  }
}

export const taskTool = new TaskTool();
