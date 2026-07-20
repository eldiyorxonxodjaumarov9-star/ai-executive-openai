import path from "path";
import type { KnowledgeDocumentKind } from "./types";

export function detectDocumentKind(fileName: string): KnowledgeDocumentKind {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".txt") return "txt";
  if (ext === ".md" || ext === ".markdown") return "md";
  return "unknown";
}

/** Infer topic / document type from HBA-* and similar filenames. */
export function inferTopicFromFileName(fileName: string): { topic: string; documentType: string } {
  const base = fileName.replace(/\.[^.]+$/, "");
  const lower = base.toLowerCase();

  const map: Array<{ match: RegExp; topic: string; documentType: string }> = [
    { match: /aq-06_1/, topic: "it_ba_asoslar_missiya", documentType: "ba_playbook" },
    { match: /aq-06_2/, topic: "it_ba_itsm_incident_change", documentType: "ba_playbook" },
    { match: /aq-06_3/, topic: "it_ba_kpi_dashboard", documentType: "ba_playbook" },
    { match: /aq-06_4/, topic: "it_ba_hisobot_executive", documentType: "ba_playbook" },
    { match: /aq-06_5/, topic: "it_ba_yigilish_reja_keys", documentType: "ba_playbook" },
    { match: /aq-06|it_biznes_analitika|biznes_analitika/, topic: "it_ba_amaliy_qollanma", documentType: "ba_playbook" },
    { match: /aq-01|savdo_direktori/, topic: "savdo_amaliy_qollanma", documentType: "sales_playbook" },
    { match: /aq-04_1/, topic: "cs_asoslar_retention", documentType: "cs_playbook" },
    { match: /aq-04_2/, topic: "cs_onboarding_sla", documentType: "cs_playbook" },
    { match: /aq-04_3/, topic: "cs_health_nps_churn", documentType: "cs_playbook" },
    { match: /aq-04_4/, topic: "cs_renewal_upsell_hisobot", documentType: "cs_playbook" },
    { match: /aq-04_5/, topic: "cs_kpi_tavsiya_risk", documentType: "cs_playbook" },
    { match: /aq-04|customer_success/, topic: "cs_amaliy_qollanma", documentType: "cs_playbook" },
    { match: /aq-02_1/, topic: "taminot_asoslar_xarid", documentType: "procurement_playbook" },
    { match: /aq-02_2/, topic: "taminot_yetkazib_logistika", documentType: "procurement_playbook" },
    { match: /aq-02_3/, topic: "taminot_ombor_zaxira_sla", documentType: "procurement_playbook" },
    { match: /aq-02_4/, topic: "taminot_shartnoma_kpi", documentType: "procurement_playbook" },
    { match: /aq-02_5/, topic: "taminot_risk_tavsiya", documentType: "procurement_playbook" },
    { match: /aq-02|taminot_direktori/, topic: "taminot_amaliy_qollanma", documentType: "procurement_playbook" },
    { match: /aq-03_1/, topic: "moliya_nazorat_qoidalari", documentType: "finance_playbook" },
    { match: /aq-03_2/, topic: "moliya_tushum_xarajat", documentType: "finance_playbook" },
    { match: /aq-03_3/, topic: "moliya_debitor_pul_oqimi", documentType: "finance_playbook" },
    { match: /aq-03_4/, topic: "moliya_kpi_hisobot", documentType: "finance_playbook" },
    { match: /aq-03_5/, topic: "moliya_tavsiya_risk", documentType: "finance_playbook" },
    { match: /aq-03|moliya_direktori/, topic: "moliya_amaliy_qollanma", documentType: "finance_playbook" },
    { match: /aq-hr_01|hr_direktori|strategik_boshqaruv/, topic: "hr_strategiya", documentType: "hr_playbook" },
    { match: /aq-hr_02|rekruting|onboarding/, topic: "hr_rekruting_onboarding", documentType: "hr_playbook" },
    { match: /aq-hr_03|performance|boshqarish/, topic: "hr_performance", documentType: "hr_playbook" },
    { match: /aq-hr_04|motivatsiya|madaniyat/, topic: "hr_motivatsiya", documentType: "hr_playbook" },
    { match: /aq-hr_05|turnover|analitika|executive_hisobot/, topic: "hr_analitika", documentType: "hr_playbook" },
    { match: /aq-hr|hr_direktori/, topic: "hr_amaliy_qollanma", documentType: "hr_playbook" },
    { match: /hba-01|davlat/, topic: "davlat_tashkilotlari", documentType: "architecture_layer" },
    { match: /hba-02|sotuv/, topic: "sotuv", documentType: "architecture_layer" },
    { match: /hba-03|tijoriy|taklif|taminotch/, topic: "tijoriy_taklif", documentType: "architecture_layer" },
    { match: /hba-04|broker/, topic: "brokerlar", documentType: "architecture_layer" },
    { match: /hba-05|taminot|logistik/, topic: "taminot_logistika", documentType: "architecture_layer" },
    { match: /hba-06|hujjat/, topic: "hujjatlashtirish", documentType: "architecture_layer" },
    { match: /hba-07/, topic: "moliya", documentType: "architecture_layer" },
    { match: /hba-08|mijoz|xizmat/, topic: "mijozlarga_xizmat", documentType: "architecture_layer" },
    { match: /hba-09|boshqaruv/, topic: "boshqaruv", documentType: "architecture_layer" },
  ];

  for (const row of map) {
    if (row.match.test(lower)) return { topic: row.topic, documentType: row.documentType };
  }

  return { topic: base.slice(0, 80), documentType: "company_document" };
}

export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}
