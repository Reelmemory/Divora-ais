import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DiscoveryState } from "@divora/shared";

export async function loadDiscoveryState(path: string): Promise<DiscoveryState | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as DiscoveryState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveDiscoveryState(path: string, state: DiscoveryState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2));
}
