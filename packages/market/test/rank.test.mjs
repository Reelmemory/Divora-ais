import assert from "node:assert/strict";
import test from "node:test";
import { addBaseUnits, paymentAsset, planApproval, toBaseUnits } from "@divora/shared";
import { quoteFromEnvironment, rankListings, unavailableSwapQuote } from "../dist/index.js";

test("ETH and WETH rank ahead of USDG without comparing raw amounts", () => {
  const ranked = rankListings([
    { id: "usdg", score: 70, currency: "USDG", priceBaseUnits: "20000" },
    { id: "eth", score: 70, currency: "ETH", priceBaseUnits: "1000000000000000" },
    { id: "weth", score: 70, currency: "WETH", priceBaseUnits: "2000000000000000" },
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ["eth", "weth", "usdg"]);
  assert.equal(ranked[2].reason.includes("not compared"), true);
});

test("same-currency cost uses integer base units and decimals are bounded", () => {
  assert.equal(toBaseUnits("1.5", 6)?.toString(), "1500000");
  assert.equal(toBaseUnits("1.2345678", 6), null);
  assert.equal(addBaseUnits(["20000", "200"]), "20200");
  const ranked = rankListings([
    { id: "high", score: 50, currency: "ETH", priceBaseUnits: "300", feeBaseUnits: "10", gasWei: "5" },
    { id: "low", score: 50, currency: "ETH", priceBaseUnits: "100", feeBaseUnits: "1", gasWei: "1" },
  ]);
  assert.equal(ranked[0].id, "low");
  assert.equal(ranked[0].sameCurrencyCost, "102");
});

test("verified quote can compare ETH and USDG; missing quote cannot", () => {
  const quoted = rankListings([
    { id: "usdg", score: 60, currency: "USDG", priceBaseUnits: "20000", quoteState: "AVAILABLE", quoteEthWei: "900" },
    { id: "eth", score: 60, currency: "ETH", priceBaseUnits: "1000", quoteState: "AVAILABLE", quoteEthWei: "1000" },
  ]);
  assert.equal(quoted[0].id, "usdg");
  const missing = rankListings([
    { id: "usdg", score: 60, currency: "USDG", priceBaseUnits: "1", quoteState: "UNAVAILABLE" },
    { id: "eth", score: 60, currency: "ETH", priceBaseUnits: "999999", quoteState: "NONE" },
  ]);
  assert.equal(missing[0].id, "eth");
});

test("swap quotes fail closed and approvals never guess a spender", () => {
  const quote = unavailableSwapQuote({ state: "FAILED", reason: "provider error" });
  assert.equal(quote.executable, false);
  assert.equal(quote.amountOut, null);
  const env = quoteFromEnvironment();
  assert.equal(env.state, "UNAVAILABLE");
  const usdg = paymentAsset("USDG");
  assert.equal(usdg?.decimals, 6);
  assert.equal(usdg?.address?.toLowerCase(), "0x5fc5360d0400a0fd4f2af552add042d716f1d168");
  const approval = planApproval({ currency: "USDG", amount: "20000" });
  assert.equal(approval.required, true);
  assert.equal(approval.spender, null);
  assert.equal(approval.executable, false);
  assert.equal(planApproval({ currency: "ETH" }).required, false);
});
