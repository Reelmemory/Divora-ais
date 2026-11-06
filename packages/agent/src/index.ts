import { LIFECYCLE_STAGES, type LifecycleStage, type StructuredAction } from "@divora/shared";

export interface LifecycleContext {
  stage: LifecycleStage;
  action?: StructuredAction;
  notes: string[];
}

export function initialContext(): LifecycleContext {
  return { stage: "DISCOVER", notes: [] };
}

export function nextStage(stage: LifecycleStage): LifecycleStage | null {
  const index = LIFECYCLE_STAGES.indexOf(stage);
  if (index < 0 || index === LIFECYCLE_STAGES.length - 1) return null;
  return LIFECYCLE_STAGES[index + 1] ?? null;
}
export { runAgentWorker, defaultAgentConstitution, type AgentWorkerOptions } from "./worker.js";