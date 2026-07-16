import type { BitrixTool, ToolExecutionContext, ToolExecutionResult } from "./types";
import { fetchEntity } from "./entity-fetch";
import type { CrmRecord } from "../bitrix";

export class ContactTool implements BitrixTool {
  readonly name = "loadContacts" as const;

  async execute(ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const start = Date.now();
    const result = await fetchEntity("contacts", ctx.bypassCache);
    if (result.limitation) {
      ctx.loaded.limitations.push(result.limitation);
      ctx.loaded.entitiesFetched.contacts = 0;
      return { name: this.name, success: false, durationMs: Date.now() - start, error: result.limitation };
    }
    ctx.loaded.contacts = result.data as CrmRecord[];
    ctx.loaded.entitiesFetched.contacts = ctx.loaded.contacts.length;
    if (result.cached) ctx.loaded.cached = true;
    return {
      name: this.name,
      success: true,
      durationMs: Date.now() - start,
      meta: { count: ctx.loaded.contacts.length, cached: result.cached },
    };
  }
}

export const contactTool = new ContactTool();
