import type { PreparedFulfillment } from "@divora/shared";
import { decodeFunctionResult, encodeFunctionData, type PublicClient } from "viem";

const SEAPORT = "0x0000000000000068f116a894984e2db1123eb395";
const orderStatusAbi = [{
  name: "getOrderStatus",
  type: "function",
  stateMutability: "view",
  inputs: [{ name: "orderHash", type: "bytes32" }],
  outputs: [
    { name: "isValidated", type: "bool" },
    { name: "isCancelled", type: "bool" },
    { name: "totalFilled", type: "uint256" },
    { name: "totalSize", type: "uint256" },
  ],
}] as const;

const fulfillBasicOrderAbi = [{
  name: "fulfillBasicOrder_efficient_6GL6yc",
  type: "function",
  stateMutability: "payable",
  inputs: [{
    name: "parameters",
    type: "tuple",
    components: [
      { name: "considerationToken", type: "address" },
      { name: "considerationIdentifier", type: "uint256" },
      { name: "considerationAmount", type: "uint256" },
      { name: "offerer", type: "address" },
      { name: "zone", type: "address" },
      { name: "offerToken", type: "address" },
      { name: "offerIdentifier", type: "uint256" },
      { name: "offerAmount", type: "uint256" },
      { name: "basicOrderType", type: "uint8" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "zoneHash", type: "bytes32" },
      { name: "salt", type: "uint256" },
      { name: "offererConduitKey", type: "bytes32" },
      { name: "fulfillerConduitKey", type: "bytes32" },
      { name: "totalOriginalAdditionalRecipients", type: "uint256" },
      {
        name: "additionalRecipients",
        type: "tuple[]",
        components: [
          { name: "amount", type: "uint256" },
          { name: "recipient", type: "address" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
  }],
  outputs: [{ name: "fulfilled", type: "bool" }],
}] as const;

const erc20Abi = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export interface RpcSimulation {
  kind: "rpc-eth-call";
  chainId: number;
  to: `0x${string}`;
  method: "getOrderStatus" | "fulfillBasicOrder_efficient_6GL6yc";
  state: "SIMULATED_SUCCESS" | "SIMULATED_REVERT" | "SIMULATION_ERROR" | "SIMULATION_UNAVAILABLE";
  success: boolean;
  gasEstimate: string | null;
  revertReason: string | null;
  result: { isValidated: boolean; isCancelled: boolean; totalFilled: string; totalSize: string } | { fulfilled: boolean } | null;
  executable: false;
  broadcast: false;
  warnings: string[];
}

export interface Erc20RpcInspection {
  kind: "rpc-erc20-inspection";
  chainId: number;
  token: `0x${string}`;
  symbol: string | null;
  decimals: number | null;
  buyerBalance: string | null;
  allowance: string | null;
  sufficientBalance: boolean | null;
  sufficientAllowance: boolean | null;
  executable: false;
  broadcast: false;
  error: string | null;
}

export async function simulateOrderStatus(input: {
  client: PublicClient;
  chainId: number;
  orderHash: `0x${string}`;
  expectedChainId?: number;
}): Promise<RpcSimulation> {
  const base = { kind: "rpc-eth-call" as const, chainId: input.chainId, to: SEAPORT as `0x${string}`, method: "getOrderStatus" as const, executable: false as const, broadcast: false as const };
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.orderHash)) {
    return { ...base, state: "SIMULATION_UNAVAILABLE", success: false, gasEstimate: null, revertReason: "INVALID_ORDER_HASH", result: null, warnings: ["Order hash was not a 32-byte value."] };
  }
  if (input.expectedChainId !== undefined && input.expectedChainId !== input.chainId) {
    return { ...base, state: "SIMULATION_UNAVAILABLE", success: false, gasEstimate: null, revertReason: "CHAIN_MISMATCH", result: null, warnings: ["RPC chain id did not match the listing chain."] };
  }
  const data = encodeFunctionData({ abi: orderStatusAbi, functionName: "getOrderStatus", args: [input.orderHash] });
  try {
    const [call, gas] = await Promise.all([
      input.client.call({ to: SEAPORT, data }),
      input.client.estimateGas({ to: SEAPORT, data }).catch((error: unknown) => { throw new Error(`gas:${error instanceof Error ? error.message : "estimate failed"}`); }),
    ]);
    if (!call.data) return { ...base, state: "SIMULATION_ERROR", success: false, gasEstimate: null, revertReason: "EMPTY_CALL_RESULT", result: null, warnings: ["eth_call returned no data. This is not a broadcast result."] };
    const decoded = decodeFunctionResult({ abi: orderStatusAbi, functionName: "getOrderStatus", data: call.data });
    return { ...base, state: "SIMULATED_SUCCESS", success: true, gasEstimate: gas.toString(), revertReason: null, result: { isValidated: decoded[0], isCancelled: decoded[1], totalFilled: decoded[2].toString(), totalSize: decoded[3].toString() }, warnings: ["eth_call and estimateGas succeeded for Seaport.getOrderStatus. This does not prove a buy would succeed when broadcast."] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "rpc error";
    return { ...base, state: message.includes("revert") ? "SIMULATED_REVERT" : "SIMULATION_ERROR", success: false, gasEstimate: null, revertReason: message, result: null, warnings: ["RPC simulation failed. No transaction was signed or broadcast."] };
  }
}

export async function simulateFulfillmentBuy(input: {
  client: PublicClient;
  chainId: number;
  buyer: `0x${string}`;
  fulfillment: PreparedFulfillment;
}): Promise<RpcSimulation> {
  const base = {
    kind: "rpc-eth-call" as const,
    chainId: input.chainId,
    to: (input.fulfillment.to ?? SEAPORT) as `0x${string}`,
    method: "fulfillBasicOrder_efficient_6GL6yc" as const,
    executable: false as const,
    broadcast: false as const,
  };
  if (input.fulfillment.source !== "opensea-fulfillment_data" || !input.fulfillment.to || !input.fulfillment.basicOrderParameters) {
    return { ...base, state: "SIMULATION_UNAVAILABLE", success: false, gasEstimate: null, revertReason: "FULFILLMENT_PARAMETERS_MISSING", result: null, warnings: ["Verified Seaport basicOrderParameters are required before RPC buy simulation."] };
  }
  const p = input.fulfillment.basicOrderParameters;
  try {
    const data = encodeFunctionData({
      abi: fulfillBasicOrderAbi,
      functionName: "fulfillBasicOrder_efficient_6GL6yc",
      args: [{
        considerationToken: p.considerationToken,
        considerationIdentifier: BigInt(p.considerationIdentifier),
        considerationAmount: BigInt(p.considerationAmount),
        offerer: p.offerer,
        zone: p.zone,
        offerToken: p.offerToken,
        offerIdentifier: BigInt(p.offerIdentifier),
        offerAmount: BigInt(p.offerAmount),
        basicOrderType: p.basicOrderType,
        startTime: BigInt(p.startTime),
        endTime: BigInt(p.endTime),
        zoneHash: p.zoneHash,
        salt: BigInt(p.salt),
        offererConduitKey: p.offererConduitKey,
        fulfillerConduitKey: p.fulfillerConduitKey,
        totalOriginalAdditionalRecipients: BigInt(p.totalOriginalAdditionalRecipients),
        additionalRecipients: p.additionalRecipients.map((r) => ({ amount: BigInt(r.amount), recipient: r.recipient })),
        signature: p.signature,
      }],
    });
    const value = BigInt(input.fulfillment.value ?? "0");
    const [call, gas] = await Promise.all([
      input.client.call({ account: input.buyer, to: input.fulfillment.to, value, data }),
      input.client.estimateGas({ account: input.buyer, to: input.fulfillment.to, value, data }),
    ]);
    if (!call.data) return { ...base, state: "SIMULATION_ERROR", success: false, gasEstimate: null, revertReason: "EMPTY_CALL_RESULT", result: null, warnings: ["eth_call returned no data."] };
    const fulfilled = decodeFunctionResult({ abi: fulfillBasicOrderAbi, functionName: "fulfillBasicOrder_efficient_6GL6yc", data: call.data });
    return {
      ...base,
      state: fulfilled ? "SIMULATED_SUCCESS" : "SIMULATED_REVERT",
      success: Boolean(fulfilled),
      gasEstimate: gas.toString(),
      revertReason: fulfilled ? null : "FULFILL_RETURNED_FALSE",
      result: { fulfilled: Boolean(fulfilled) },
      warnings: ["Read-only eth_call and estimateGas succeeded for Seaport fulfillBasicOrder_efficient_6GL6yc. No transaction was signed or broadcast."],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "rpc error";
    return { ...base, state: message.includes("revert") ? "SIMULATED_REVERT" : "SIMULATION_ERROR", success: false, gasEstimate: null, revertReason: message, result: null, warnings: ["RPC buy simulation failed. No transaction was signed or broadcast."] };
  }
}

export async function inspectErc20PaymentReadiness(input: {
  client: PublicClient;
  chainId: number;
  token: `0x${string}`;
  requiredAmount?: string | null;
  buyer?: `0x${string}` | null;
  spender?: `0x${string}` | null;
}): Promise<Erc20RpcInspection> {
  const base: Erc20RpcInspection = {
    kind: "rpc-erc20-inspection",
    chainId: input.chainId,
    token: input.token,
    symbol: null,
    decimals: null,
    buyerBalance: null,
    allowance: null,
    sufficientBalance: null,
    sufficientAllowance: null,
    executable: false,
    broadcast: false,
    error: null,
  };
  try {
    const symbolData = encodeFunctionData({ abi: erc20Abi, functionName: "symbol" });
    const decimalsData = encodeFunctionData({ abi: erc20Abi, functionName: "decimals" });
    const [symbolCall, decimalsCall] = await Promise.all([
      input.client.call({ to: input.token, data: symbolData }),
      input.client.call({ to: input.token, data: decimalsData }),
    ]);
    if (symbolCall.data) base.symbol = decodeFunctionResult({ abi: erc20Abi, functionName: "symbol", data: symbolCall.data });
    if (decimalsCall.data) base.decimals = Number(decodeFunctionResult({ abi: erc20Abi, functionName: "decimals", data: decimalsCall.data }));

    const required = input.requiredAmount && /^\d+$/.test(input.requiredAmount) ? BigInt(input.requiredAmount) : null;
    if (input.buyer) {
      const balData = encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [input.buyer] });
      const balCall = await input.client.call({ to: input.token, data: balData });
      if (balCall.data) {
        const bal = decodeFunctionResult({ abi: erc20Abi, functionName: "balanceOf", data: balCall.data });
        base.buyerBalance = bal.toString();
        if (required !== null) base.sufficientBalance = bal >= required;
      }
      if (input.spender) {
        const allowData = encodeFunctionData({ abi: erc20Abi, functionName: "allowance", args: [input.buyer, input.spender] });
        const allowCall = await input.client.call({ to: input.token, data: allowData });
        if (allowCall.data) {
          const allow = decodeFunctionResult({ abi: erc20Abi, functionName: "allowance", data: allowCall.data });
          base.allowance = allow.toString();
          if (required !== null) base.sufficientAllowance = allow >= required;
        }
      }
    }
    return base;
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : "erc20 rpc inspection failed" };
  }
}
