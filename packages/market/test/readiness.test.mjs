import assert from "node:assert/strict";
import test from "node:test";
import { assessFulfillmentReadiness } from "../dist/index.js";

const listing = {
  id: "0xabc", chainId: 4663, marketplace: "opensea", collection: "onlyhoodpixel",
  contractAddress: "0x536de17561c3dec4dba699bd13a40afdc77f4641", tokenId: "123",
  seller: "0x722ffa423cce95953d97c9c4a2ac0049e70f0ee7", price: "20000", currency: "USDG",
  expiresAt: null, protocolAddress: "0x0000000000000068f116a894984e2db1123eb395",
  source: "fixture", observedAt: "2026-10-14T00:00:00.000Z", freshness: "AVAILABLE",
};

test("USDG listing is blocked before fulfillment and is not simulated", () => {
  const readiness = assessFulfillmentReadiness(listing, { paymentToken: "0x5fc5360d0400a0fd4f2af552add042d716f1d168", paymentSymbol: "USDG", considerationTotal: "19800" });
  assert.equal(readiness.ready, false);
  assert.equal(readiness.calldataReturned, false);
  assert.equal(readiness.simulated, false);
  assert.equal(readiness.executable, false);
  assert.ok(readiness.blockers.includes("FULFILLER_ADDRESS_MISSING"));
  assert.ok(readiness.blockers.includes("ERC20_APPROVAL_REQUIRED"));
  assert.equal(readiness.feeBps, 100);
});
