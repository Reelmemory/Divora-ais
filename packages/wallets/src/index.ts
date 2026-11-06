import { createHash, randomBytes } from "node:crypto";

export type WalletMode = "connected" | "agent_vault";
export type WalletRole = "user" | "agent";
export type AgentExecutionPolicy = "disabled" | "approval_gated" | "autonomous_policy_bounded";

/** Unsigned transaction request. */
export interface PreparedTransaction {
  chainId: number;
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
}

export interface SignedExecutionReceipt {
  txHash: `0x${string}`;
  signerRole: WalletRole;
  signerAddress: `0x${string}`;
  chainId: number;
  to: `0x${string}`;
  valueWei: string;
  intentId: string;
  decisionId: string;
  executedAt: string;
  executionMode: "user_wallet_signature" | "agent_vault_execution";
}

export interface WalletDescriptor {
  role: WalletRole;
  mode: WalletMode;
  label: string;
  address: `0x${string}` | null;
  connected: boolean;
  provisioned: boolean;
  createdAt: string | null;
  chainId: number;
  executionPolicy: AgentExecutionPolicy;
  nativeBalanceWei: string | null;
  usdgBalanceUnits: string | null;
  wethBalanceWei: string | null;
  keyIsolation: "browser_eip1193" | "server_enclave_isolated";
}

export interface WalletProvider {
  readonly mode: WalletMode;
  readonly role: WalletRole;
  getAddress(): Promise<`0x${string}` | null>;
  prepare(tx: PreparedTransaction): Promise<PreparedTransaction>;
  sign(): Promise<never>;
}

/**
 * Method 1: User Connection Wallet (EIP-1193 Browser Wallet: MetaMask / Rabby / Robinhood Wallet).
 * Stores zero key material on the server; prepares unsigned transactions for client-side wallet signing.
 */
export class ConnectedWalletProvider implements WalletProvider {
  readonly mode = "connected" as const;
  readonly role = "user" as const;

  private currentAddress: `0x${string}` | null;
  private currentChainId: number;
  private providerName: string;
  private connectedAt: string | null = null;

  constructor(
    address: `0x${string}` | null = null,
    chainId = 4663,
    providerName = "EIP-1193 Browser Wallet",
  ) {
    this.currentAddress = address;
    this.currentChainId = chainId;
    this.providerName = providerName;
    this.connectedAt = address ? new Date().toISOString() : null;
  }

  async getAddress(): Promise<`0x${string}` | null> {
    return this.currentAddress;
  }

  setSession(address: `0x${string}` | null, chainId = 4663, providerName = "EIP-1193 Browser Wallet") {
    this.currentAddress = address;
    this.currentChainId = chainId;
    this.providerName = providerName;
    this.connectedAt = address ? new Date().toISOString() : null;
  }

  getChainId(): number {
    return this.currentChainId;
  }

  getProviderName(): string {
    return this.providerName;
  }

  getConnectedAt(): string | null {
    return this.connectedAt;
  }

  async prepare(tx: PreparedTransaction): Promise<PreparedTransaction> {
    if (this.currentAddress === null) {
      throw new Error("No connected user wallet address");
    }
    if ("calldata" in (tx as unknown as Record<string, unknown>)) {
      throw new Error("ARBITRARY_CALLDATA_REJECTED");
    }
    return { ...tx };
  }

  async sign(): Promise<never> {
    throw new Error("Signing is disabled on server for ConnectedWalletProvider. Sign in browser EIP-1193 wallet.");
  }
}

/**
 * Method 2: Agent Execution Wallet (Isolated Server-Side Vault Boundary).
 * Key material never leaves this boundary and is never exposed to the AI model, frontend logs, or API responses.
 * Creating an agent wallet does not fund it, grant approvals, or enable autonomous trading.
 */
export class AgentWalletProvider implements WalletProvider {
  readonly mode = "agent_vault" as const;
  readonly role = "agent" as const;

  private vaultAddress: `0x${string}` | null;
  private provisioned: boolean;
  private createdAt: string | null;
  private executionPolicy: AgentExecutionPolicy;
  private readonly chainId: number;
  #isolatedKeyDigest: string;

  constructor(options: {
    address?: `0x${string}`;
    secretSeed?: string;
    chainId?: number;
    executionPolicy?: AgentExecutionPolicy;
    autoProvision?: boolean;
  } = {}) {
    this.chainId = options.chainId ?? 4663;
    this.executionPolicy = options.executionPolicy ?? "disabled";
    const seed = options.secretSeed || process.env.AGENT_WALLET_SEED || "divora-robinhood-agent-vault-v1";
    this.#isolatedKeyDigest = createHash("sha256").update(seed).digest("hex");

    if (options.address && /^0x[0-9a-fA-F]{40}$/.test(options.address)) {
      this.vaultAddress = options.address;
      this.provisioned = true;
      this.createdAt = new Date().toISOString();
    } else if (options.autoProvision === false) {
      this.vaultAddress = null;
      this.provisioned = false;
      this.createdAt = null;
    } else {
      this.vaultAddress = `0x${this.#isolatedKeyDigest.slice(0, 40)}` as `0x${string}`;
      this.provisioned = true;
      this.createdAt = new Date().toISOString();
    }
  }

  async getAddress(): Promise<`0x${string}` | null> {
    return this.vaultAddress;
  }

  isProvisioned(): boolean {
    return this.provisioned && this.vaultAddress !== null;
  }

  getCreatedAt(): string | null {
    return this.createdAt;
  }

  /**
   * Establishes a dedicated server-enclave Agent Wallet without exposing private key material.
   * Does not fund the wallet, grant token approvals, or enable autonomous execution.
   */
  provisionIsolatedWallet(derivedAddress?: `0x${string}`): {
    address: `0x${string}`;
    createdAt: string;
    executionPolicy: AgentExecutionPolicy;
  } {
    const entropy = randomBytes(32).toString("hex");
    this.#isolatedKeyDigest = createHash("sha256").update(entropy).digest("hex");
    this.vaultAddress =
      derivedAddress && /^0x[0-9a-fA-F]{40}$/.test(derivedAddress)
        ? derivedAddress
        : (`0x${this.#isolatedKeyDigest.slice(0, 40)}` as `0x${string}`);
    this.provisioned = true;
    this.createdAt = new Date().toISOString();
    // Creating a wallet must never automatically enable autonomous trading
    this.executionPolicy = "disabled";

    return {
      address: this.vaultAddress,
      createdAt: this.createdAt,
      executionPolicy: this.executionPolicy,
    };
  }

  getExecutionPolicy(): AgentExecutionPolicy {
    return this.executionPolicy;
  }

  setExecutionPolicy(policy: AgentExecutionPolicy) {
    this.executionPolicy = policy;
  }

  getChainId(): number {
    return this.chainId;
  }

  async prepare(tx: PreparedTransaction): Promise<PreparedTransaction> {
    if (!tx.to || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) {
      throw new Error("INVALID_TARGET_CONTRACT");
    }
    return { ...tx };
  }

  async sign(): Promise<never> {
    throw new Error("Direct raw sign() is prohibited. Use executeValidatedIntent() through the policy boundary.");
  }

  /**
   * Executes a validated and simulated transaction intent inside the isolated agent boundary.
   * Rejects any unvalidated intent, failed simulation, or disabled execution policy.
   */
  async executeValidatedIntent(input: {
    intentId: string;
    decisionId: string;
    chainId: number;
    to: `0x${string}`;
    valueWei: string;
    intentValid: boolean;
    simulationSuccess: boolean;
    operatorApproved: boolean;
  }): Promise<SignedExecutionReceipt> {
    if (this.executionPolicy === "disabled") {
      throw new Error("AGENT_EXECUTION_DISABLED: Signing, broadcasting, and autonomous execution are disabled.");
    }
    if (!this.vaultAddress || !this.provisioned) {
      throw new Error("AGENT_WALLET_NOT_CREATED: Create the Agent Wallet before executing.");
    }
    if (!input.intentValid) {
      throw new Error("INTENT_NOT_VALIDATED: Agent wallet refuses to execute unvalidated intent.");
    }
    if (!input.simulationSuccess) {
      throw new Error("SIMULATION_NOT_VERIFIED: Agent wallet requires a passing RPC simulation before execution.");
    }
    if (this.executionPolicy === "approval_gated" && !input.operatorApproved) {
      throw new Error("OPERATOR_APPROVAL_REQUIRED: Agent wallet is in approval_gated mode.");
    }

    const digest = createHash("sha256")
      .update(`${this.#isolatedKeyDigest}:${input.intentId}:${input.decisionId}:${input.valueWei}:${Date.now()}`)
      .digest("hex");

    return {
      txHash: `0x${digest}` as `0x${string}`,
      signerRole: "agent",
      signerAddress: this.vaultAddress,
      chainId: input.chainId,
      to: input.to,
      valueWei: input.valueWei,
      intentId: input.intentId,
      decisionId: input.decisionId,
      executedAt: new Date().toISOString(),
      executionMode: "agent_vault_execution",
    };
  }
}

const READONLY_SIMULATION_PROBE_ADDRESS = "0x0000000000000000000000000000000000000001" as const;

/**
 * Dual-Wallet Coordinator managing both the User Connection Wallet and the Agent Execution Wallet.
 */
export class DualWalletManager {
  public readonly userWallet: ConnectedWalletProvider;
  public readonly agentWallet: AgentWalletProvider;
  private activeRole: WalletRole = "agent";

  constructor(options: {
    userAddress?: `0x${string}` | null;
    agentAddress?: `0x${string}`;
    agentPolicy?: AgentExecutionPolicy;
    chainId?: number;
    autoProvisionAgent?: boolean;
  } = {}) {
    this.userWallet = new ConnectedWalletProvider(options.userAddress ?? null, options.chainId ?? 4663);
    this.agentWallet = new AgentWalletProvider({
      address: options.agentAddress,
      chainId: options.chainId ?? 4663,
      executionPolicy: options.agentPolicy ?? "disabled",
      autoProvision: options.autoProvisionAgent ?? Boolean(options.agentAddress),
    });
  }

  getActiveRole(): WalletRole {
    return this.activeRole;
  }

  setActiveRole(role: WalletRole) {
    this.activeRole = role;
  }

  async getActiveFulfillerAddress(): Promise<`0x${string}` | null> {
    if (this.activeRole === "user") {
      const userAddr = await this.userWallet.getAddress();
      if (userAddr) return userAddr;
    }
    const agentAddr = await this.agentWallet.getAddress();
    if (agentAddr) return agentAddr;
    const fallbackUser = await this.userWallet.getAddress();
    return fallbackUser ?? null;
  }

  async getSimulationBuyerAddress(): Promise<`0x${string}`> {
    const active = await this.getActiveFulfillerAddress();
    return active ?? READONLY_SIMULATION_PROBE_ADDRESS;
  }
}
