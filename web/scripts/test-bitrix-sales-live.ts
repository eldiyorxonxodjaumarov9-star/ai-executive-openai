/** Live Bitrix sales integration test — run: npx tsx scripts/test-bitrix-sales-live.ts */
import { fetchAllDealsComplete, fetchDealStages, checkBitrixHealth } from "../lib/server/bitrix";
import { computeSalesAnalytics, formatSalesBlock, parseSalesPeriod } from "../lib/server/sales-analytics";

async function main() {
  console.log("=== Bitrix Health ===");
  const health = await checkBitrixHealth();
  console.log(JSON.stringify(health, null, 2));

  if (!health.connected) {
    process.exit(1);
  }

  console.log("\n=== Fetching all deals ===");
  const [deals, stages] = await Promise.all([fetchAllDealsComplete(), fetchDealStages()]);
  console.log(`Deals: ${deals.length}, Stages: ${stages.size}`);

  const questions = [
    "Bugun qancha sotuv bo'ldi?",
    "Oxirgi 7 kunlik savdo qancha?",
  ];

  for (const q of questions) {
    const range = parseSalesPeriod(q);
    const stats = computeSalesAnalytics(deals, stages, range);
    console.log(`\n--- ${q} ---`);
    console.log(formatSalesBlock(stats, q));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
