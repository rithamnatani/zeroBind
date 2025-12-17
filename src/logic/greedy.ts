// greedy.ts
import { OptimizerMemory, UNBOUND } from "./optimizer-memory";

// --- CONFIGURATION ---
const LOAD_PENALTY_FACTOR = 0.5;

export function greedyAssign(
  memory: OptimizerMemory,
  sortedActions: Uint8Array, // Clearer: We know it's a list of IDs (0-255)
  actionCount: number,
  keyCount: number
): void {
  // Clear state
  memory.bindings.fill(UNBOUND);
  memory.fingerLoads.fill(0);

  for (let i = 0; i < actionCount; i++) {
    const actionId = sortedActions[i];

    // Find best keys
    const bestCandidates = findBestKeys(memory, actionId, keyCount);

    if (bestCandidates.length === 0) continue;

    // Random Pick
    const choice =
      bestCandidates[Math.floor(Math.random() * bestCandidates.length)];

    // Commit
    commitBinding(memory, choice.key, actionId);
  }
}

function findBestKeys(
  memory: OptimizerMemory,
  actionId: number,
  keyCount: number
): { key: number; score: number }[] {
  const candidates: { key: number; score: number }[] = [];

  for (let k = 0; k < keyCount; k++) {
    // 1. Check Occupancy
    if (memory.bindings[k] !== UNBOUND) continue;

    // 2. Check Constraints
    if (!checkHardConstraint(memory, actionId, k, keyCount)) continue;

    // 3. Score
    // Using standard array access is cleaner
    const finger = memory.keyToFinger[k];
    const effort = memory.keyEfforts[k];
    const currentLoad = memory.fingerLoads[finger];

    const score = effort + currentLoad * LOAD_PENALTY_FACTOR;

    candidates.push({ key: k, score });
  }

  return candidates.sort((a, b) => a.score - b.score).slice(0, 3);
}

function checkHardConstraint(
  memory: OptimizerMemory,
  actionId: number,
  targetKeyIndex: number,
  keyCount: number
): boolean {
  const targetFinger = memory.keyToFinger[targetKeyIndex];
  const actionMask = memory.hardMasks[actionId];

  for (let k = 0; k < keyCount; k++) {
    // Only check keys on same finger
    if (memory.keyToFinger[k] !== targetFinger) continue;

    const otherAction = memory.bindings[k];
    if (otherAction === UNBOUND) continue;

    // Conflict Check
    if ((actionMask & (1 << otherAction)) !== 0) {
      return false;
    }
  }
  return true;
}

function commitBinding(
  memory: OptimizerMemory,
  keyIndex: number,
  actionId: number
): void {
  const finger = memory.keyToFinger[keyIndex];
  const freq = memory.frequencies[actionId];

  memory.bindings[keyIndex] = actionId;
  memory.fingerLoads[finger] += freq;
}
