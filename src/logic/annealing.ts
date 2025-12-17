// annealing.ts
import { OptimizerMemory, ALLOC_SIZE, UNBOUND } from "./optimizer-memory";

// --- 64-BIT LOOKUP TABLE ---
const ACTION_TO_MASK = new BigInt64Array(ALLOC_SIZE);
for (let i = 0; i < 64; i++) ACTION_TO_MASK[i] = 1n << BigInt(i);
ACTION_TO_MASK[UNBOUND] = 0n; // Safety pad

// --- PENALTY LOOKUP TABLE ---
// Exponential penalty for overloading a finger.
// Matches the logic in Greedy: 0->0, 1->1, 2->2, 3->4...
// Fix 3: Use bitwise shift instead of Math.pow
const COUNT_TO_PENALTY = new Int32Array(65);
for (let i = 1; i < 65; i++) {
  // Safe: finger can't hold >31 keys, shift won't overflow
  COUNT_TO_PENALTY[i] = 1 << (i - 1);
}

// Optimization: Direct params instead of Config Object
export function annealingAssign(
  memory: OptimizerMemory,
  actionCount: number,
  keyCount: number,
  temp: number = 100,
  coolingRate: number = 0.9995,
  iterations: number = 50000
): void {
  // 1. Unpack References
  const {
    bindings,
    hardMasks,
    fingerContents,
    keyToFinger,
    keyEfforts,
    frequencies,
  } = memory;

  // 2. Pre-calculate Finger Counts (Crucial for Penalty Delta)
  const fingerCounts = new Int32Array(16);
  for (let k = 0; k < keyCount; k++) {
    if (bindings[k] !== UNBOUND) {
      fingerCounts[keyToFinger[k]]++;
    }
  }

  for (let i = 0; i < iterations; i++) {
    // A. Pick Keys (Branchless-ish) - Fix 5: Use Math.random()
    const kA = (Math.random() * keyCount) | 0;
    const kB = (Math.random() * keyCount) | 0;

    if (kA === kB) continue;

    const actionA = bindings[kA]; // 0-64
    const actionB = bindings[kB]; // 0-64

    // Optimization: Skip if both are empty (128 = 64 + 64)
    if (actionA + actionB === 128) continue;

    const fingerA = keyToFinger[kA];
    const fingerB = keyToFinger[kB];

    if (fingerA === fingerB) continue;

    // B. Constraints (BigInt)
    const maskA = ACTION_TO_MASK[actionA];
    const maskB = ACTION_TO_MASK[actionB];

    // Check conflicts (XOR logic)
    if ((hardMasks[actionA] & (fingerContents[fingerB] ^ maskB)) !== 0n)
      continue;
    if ((hardMasks[actionB] & (fingerContents[fingerA] ^ maskA)) !== 0n)
      continue;

    // C. Scoring (Branchless!)
    // frequencies[64] is 0, so this math works even for UNBOUND.
    const freqA = frequencies[actionA];
    const freqB = frequencies[actionB];
    const effortA = keyEfforts[kA];
    const effortB = keyEfforts[kB];

    // Effort Delta
    const currentEffort = effortA * freqA + effortB * freqB;
    const newEffort = effortA * freqB + effortB * freqA;

    // Finger Penalty Delta (The Missing Piece)
    const countA = fingerCounts[fingerA];
    const countB = fingerCounts[fingerB];

    // Calculate logical change (-1 if losing action, +1 if gaining)
    // If action is UNBOUND (64), it doesn't count as a "real" item.
    const aIsReal = actionA !== UNBOUND ? 1 : 0;
    const bIsReal = actionB !== UNBOUND ? 1 : 0;

    const newCountA = countA - aIsReal + bIsReal;
    const newCountB = countB - bIsReal + aIsReal;

    const currentPenalty = COUNT_TO_PENALTY[countA] + COUNT_TO_PENALTY[countB];
    const newPenalty =
      COUNT_TO_PENALTY[newCountA] + COUNT_TO_PENALTY[newCountB];

    const delta = newEffort + newPenalty - (currentEffort + currentPenalty);

    // D. Acceptance - Fix 5: Use Math.random()
    if (delta >= 0) {
      if (Math.random() > Math.exp(-delta / temp)) continue;
    }

    // E. Commit
    bindings[kA] = actionB;
    bindings[kB] = actionA;

    // Update Counts
    fingerCounts[fingerA] = newCountA;
    fingerCounts[fingerB] = newCountB;

    // Update Masks (BigInt)
    fingerContents[fingerA] = (fingerContents[fingerA] & ~maskA) | maskB;
    fingerContents[fingerB] = (fingerContents[fingerB] & ~maskB) | maskA;

    // Note: We do NOT need to update fingerLoads here for the algorithm to work.
    // We only need to update them once at the very end if you want to display stats.

    temp *= coolingRate;
  }
}
