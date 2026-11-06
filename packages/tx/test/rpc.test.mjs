import assert from "node:assert/strict";
import test from "node:test";
import { simulateOrderStatus } from "../dist/index.js";

const hash = "0xea9fe2e0d2fec1724e36e833d963218d40cbf7ec10af8418c765fd820ed898bd";
const encoded = "0x" + "1".padStart(64, "0") + "0".padStart(64, "0") + "0".padStart(64, "0") + "1".padStart(64, "0");

test("rpc simulation rejects bad inputs and never broadcasts", async () => {
  const calls = [];
  const encoded = "0x" + "1".padStart(64, "0") + "0".padStart(64, "0") + "0".padStart(64, "0") + "1".padStart(64, "0");
  const client = {
    async call(args) { calls.push(["call", args]); return { data: encoded }; },
    async estimateGas(args) { calls.push(["gas", args]); return 21000n; },
  };
  const bad = await simulateOrderStatus({ client, chainId: 4663, orderHash: "0x123", expectedChainId: 4663 });
  assert.equal(bad.state, "SIMULATION_UNAVAILABLE");
  assert.equal(bad.broadcast, false);
  const mismatch = await simulateOrderStatus({ client, chainId: 1, orderHash: hash, expectedChainId: 4663 });
  assert.equal(mismatch.revertReason, "CHAIN_MISMATCH");
  const ok = await simulateOrderStatus({ client, chainId: 4663, orderHash: hash, expectedChainId: 4663 });
  assert.equal(ok.state, "SIMULATED_SUCCESS");
  assert.equal(ok.executable, false);
  assert.equal(ok.broadcast, false);
  assert.equal(calls.length, 2);
});

test("rpc simulation reports revert, gas failure, and timeout distinctly", async () => {
  const reverted = await simulateOrderStatus({ client: { async call() { throw new Error("execution reverted"); }, async estimateGas() { return 1n; } }, chainId: 4663, orderHash: hash });
  assert.equal(reverted.state, "SIMULATED_REVERT");
  const gas = await simulateOrderStatus({ client: { async call() { return { data: encoded }; }, async estimateGas() { throw new Error("gas:estimate failed"); } }, chainId: 4663, orderHash: hash });
  assert.equal(gas.state, "SIMULATION_ERROR");
  const timeout = await simulateOrderStatus({ client: { async call() { throw new Error("request timeout"); }, async estimateGas() { return 1n; } }, chainId: 4663, orderHash: hash });
  assert.equal(timeout.state, "SIMULATION_ERROR");
  assert.equal(timeout.broadcast, false);
});
