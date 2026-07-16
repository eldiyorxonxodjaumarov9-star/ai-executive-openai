import type { CrmRecord, DealStageInfo } from "./bitrix";
import { isDealSuccessful } from "./sales-analytics";
import { dealAmount } from "./sales-analytics";

export interface BitrixUserInfo {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
}

export interface NormalizedDeal {
  id: string;
  title: string;
  opportunity: number;
  currency: string;
  stageId: string;
  stageSemanticId: string;
  stageName: string;
  assignedById: string;
  assignedByName: string;
  dateCreate: string;
  closeDate: string;
  isWon: boolean;
  isLost: boolean;
  isOpen: boolean;
}

export function isDealLost(deal: CrmRecord, stages: Map<string, DealStageInfo>): boolean {
  if (deal.STAGE_SEMANTIC_ID === "F") return true;
  const info = stages.get(String(deal.STAGE_ID || ""));
  if (info?.isFail) return true;
  if (info?.semantics === "F") return true;
  return false;
}

export function isDealOpen(deal: CrmRecord, stages: Map<string, DealStageInfo>): boolean {
  return !isDealSuccessful(deal, stages) && !isDealLost(deal, stages);
}

export function userDisplayName(user: BitrixUserInfo | undefined): string {
  if (!user) return "Noma'lum xodim";
  const full = `${user.firstName} ${user.lastName}`.trim();
  return full || user.name || "Noma'lum xodim";
}

export function normalizeDeal(
  deal: CrmRecord,
  stages: Map<string, DealStageInfo>,
  users: Map<string, BitrixUserInfo>
): NormalizedDeal {
  const assignedId = String(deal.ASSIGNED_BY_ID ?? "");
  const stageId = String(deal.STAGE_ID ?? "");
  const stageInfo = stages.get(stageId);
  const user = users.get(assignedId);

  return {
    id: String(deal.ID ?? ""),
    title: String(deal.TITLE ?? "Nomsiz bitim"),
    opportunity: dealAmount(deal),
    currency: String(deal.CURRENCY_ID ?? "UZS"),
    stageId,
    stageSemanticId: String(deal.STAGE_SEMANTIC_ID ?? stageInfo?.semantics ?? ""),
    stageName: stageInfo?.name ?? "Noma'lum bosqich",
    assignedById: assignedId,
    assignedByName: userDisplayName(user),
    dateCreate: String(deal.DATE_CREATE ?? ""),
    closeDate: String(deal.CLOSEDATE ?? ""),
    isWon: isDealSuccessful(deal, stages),
    isLost: isDealLost(deal, stages),
    isOpen: isDealOpen(deal, stages),
  };
}

export function normalizeDeals(
  deals: CrmRecord[],
  stages: Map<string, DealStageInfo>,
  users: Map<string, BitrixUserInfo>
): NormalizedDeal[] {
  return deals.map((d) => normalizeDeal(d, stages, users));
}
