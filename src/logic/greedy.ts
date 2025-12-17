// greedy.ts
import { OptimizerMemory, UNBOUND } from "./optimizer-memory";

export function greedyAssign(
  memory: OptimizerMemory,
  sortedActions: Uint8Array,
  actionCount: number,
  keyCount: number
): void {
  // ---------------------------------------------------------
  // 1. RESET DERIVED STATE (But Keep Bindings!)
  // ---------------------------------------------------------
  // We wipe the loads/contents because we will rebuild them
  // from the presets exactly.
  memory.fingerLoads.fill(0);
  memory.fingerContents.fill(0n); // BigInt fill

  // Track which actions are already handled by presets
  let assignedActionsMask = 0n; // BigInt mask

  // Fix 1: Integer Counts (Local Array)
  const fingerCounts = new Int32Array(16);

  // ---------------------------------------------------------
  // 2. REHYDRATE (Account for Presets)
  // ---------------------------------------------------------
  // Scan the existing bindings to rebuild the state
  for (let k = 0; k < keyCount; k++) {
    const actionId = memory.bindings[k];

    // If this key has a preset action...
    if (actionId !== UNBOUND) {
      const finger = memory.keyToFinger[k];

      // Safety check: Skip invalid fingers
      if (finger >= 16) continue;

      // 1. Mark action as done so we don't assign it again
      assignedActionsMask |= 1n << BigInt(actionId);

      // 2. Add the Load (Frequency)
      memory.fingerLoads[finger] += memory.frequencies[actionId];

      // 3. Add the Constraint (Bitmask)
      memory.fingerContents[finger] |= 1n << BigInt(actionId);

      // 4. Increment finger count
      fingerCounts[finger]++;
    }
  }

  // PRE-ALLOCATE SCRATCHPAD
  const penaltyScratch = new Int32Array(16);

  // ---------------------------------------------------------
  // 3. MAIN ASSIGNMENT LOOP
  // ---------------------------------------------------------
  for (let i = 0; i < actionCount; i++) {
    const actionId = sortedActions[i];

    // SKIP if this action was already found in the presets
    if ((assignedActionsMask & (1n << BigInt(actionId))) !== 0n) {
      continue;
    }

    // --- STANDARD GREEDY LOGIC BELOW ---

    // Find up to 3 best keys
    const [k0, k1, k2, count] = findBestKeys(
      memory,
      actionId,
      keyCount,
      penaltyScratch,
      fingerCounts
    );

    if (count === 0) continue; // Should rarely happen if keys > actions

    // Random Pick from top 3
    let chosenKey = k0;
    if (count > 1) {
      const rand = Math.random();
      if (count === 2) {
        if (rand > 0.5) chosenKey = k1;
      } else {
        // count is 3
        if (rand > 0.66) chosenKey = k2;
        else if (rand > 0.33) chosenKey = k1;
      }
    }

    // Commit new binding
    const finger = memory.keyToFinger[chosenKey];
    // Safety check
    if (finger < 16) {
      memory.bindings[chosenKey] = actionId;
      memory.fingerLoads[finger] += memory.frequencies[actionId];
      memory.fingerContents[finger] |= 1n << BigInt(actionId);
      fingerCounts[finger]++;
    }
  }
}

/**
 * Returns a tuple: [BestKey, 2ndBest, 3rdBest, NumberFound]
 * This avoids allocating objects or arrays inside the function.
 */
function findBestKeys(
  memory: OptimizerMemory,
  actionId: number,
  keyCount: number,
  fingerPenalties: Int32Array,
  fingerCounts: Int32Array
): [number, number, number, number] {
  let k0 = -1,
    s0 = Infinity;
  let k1 = -1,
    s1 = Infinity;
  let k2 = -1,
    s2 = Infinity;
  let found = 0;

  const actionMask = memory.hardMasks[actionId]; // BigInt

  // Fix 4: Pre-calc blocked finger mask (32-bit integer)
  let blockedMask = 0;
  for (let f = 0; f < 16; f++) {
    // Fix 1 & 3: Use fingerCounts and bitwise shift for penalty
    const c = fingerCounts[f];
    fingerPenalties[f] = c > 0 ? 1 << (c - 1) : 0;

    // Build blocked mask
    if ((actionMask & memory.fingerContents[f]) !== 0n) {
      blockedMask |= 1 << f;
    }
  }

  for (let k = 0; k < keyCount; k++) {
    if (memory.bindings[k] !== UNBOUND) continue;

    const finger = memory.keyToFinger[k];

    // SAFETY: Skip invalid fingers (UNBOUND = 64)
    if (finger >= 16) continue;

    // Fix 4: Use pre-calculated blocked mask (fast integer check)
    if ((blockedMask & (1 << finger)) !== 0) continue;

    // USE PRE-CALCULATED PENALTY
    const score = memory.keyEfforts[k] + fingerPenalties[finger];

    if (score < s2) {
      k2 = k;
      s2 = score;
      if (s2 < s1) {
        let tk = k1;
        let ts = s1;
        k1 = k2;
        s1 = s2;
        k2 = tk;
        s2 = ts;
        if (s1 < s0) {
          tk = k0;
          ts = s0;
          k0 = k1;
          s0 = s1;
          k1 = tk;
          s1 = ts;
        }
      }
      if (found < 3) found++;
    }
  }

  return [k0, k1, k2, found];
}
