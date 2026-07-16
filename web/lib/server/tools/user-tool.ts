import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchUsersForDeals } from "./entity-fetch";

export class UserTool implements BitrixTool {
  readonly name = "loadUsers" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    try {
      ctx.loaded.users = await fetchUsersForDeals(ctx.loaded.deals);
      return {
        name: this.name,
        success: true,
        durationMs: Date.now() - start,
        meta: { count: ctx.loaded.users.size },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "user fetch xato";
      ctx.loaded.limitations.push(`users: ${msg}`);
      return { name: this.name, success: false, durationMs: Date.now() - start, error: msg };
    }
  }
}

export const userTool = new UserTool();
