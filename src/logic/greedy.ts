import { OptimizerMemory, UNBOUND } from "./protocolBuffer";
import type * as Protocol from "./protocol";

// Configuration
const LOAD_PENALTY_FACTOR = 0.5; // How much we penalize overloaded fingers vs key effort

/**
 * Checks if an action can be placed on a key without violating hard constraints.
 * Returns true if the key is valid for this action.
 */
function checkHardConstraint(
  actionId: number,
  keyIndex: number,
  finger: number,
  keyToFingerMap: Protocol.KeyToFingerMap,
  bindingMap: Protocol.BindingMap,
  hardConstraintMasks: Protocol.HardConstraintMasks,
  keyCount: number
): boolean {
  const actionMask = hardConstraintMasks[actionId];

  // Check all keys on the same finger for conflicts
  for (let otherKey = 0; otherKey < keyCount; otherKey++) {
    if (keyToFingerMap[otherKey] !== finger) continue;
    if (bindingMap[otherKey] === UNBOUND) continue;

    const existingAction = bindingMap[otherKey];
    // Bitmask intersection: if bit is set, actions conflict
    if ((actionMask & (1 << existingAction)) !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * Calculates score for placing an action on a key.
 * Lower score = better placement.
 */
function scoreKey(
  keyIndex: number,
  finger: number,
  keyEffortsMKU: Protocol.KeyEffortsMKU,
  fingerLoadsMKU: Protocol.FingerLoadsMKU
): number {
  const effort = keyEffortsMKU[keyIndex];
  const currentLoad = fingerLoadsMKU[finger];
  return effort + currentLoad * LOAD_PENALTY_FACTOR;
}

/**
 * Finds the best valid keys for an action.
 * Returns an array of key indices, sorted by score (best first).
 */
function findBestKeys(
  actionId: number,
  keyCount: number,
  keyToFingerMap: Protocol.KeyToFingerMap,
  bindingMap: Protocol.BindingMap,
  hardConstraintMasks: Protocol.HardConstraintMasks,
  keyEffortsMKU: Protocol.KeyEffortsMKU,
  fingerLoadsMKU: Protocol.FingerLoadsMKU,
  maxCandidates: number
): number[] {
  // Track best candidates: [keyIndex, score]
  const candidates: Array<{ key: number; score: number }> = [];

  for (let k = 0; k < keyCount; k++) {
    // Skip occupied keys
    if (bindingMap[k] !== UNBOUND) continue;

    const finger = keyToFingerMap[k];

    // Skip if hard constraint violated
    if (
      !checkHardConstraint(
        actionId,
        k,
        finger,
        keyToFingerMap,
        bindingMap,
        hardConstraintMasks,
        keyCount
      )
    )
      continue;

    const score = scoreKey(k, finger, keyEffortsMKU, fingerLoadsMKU);

    // Insert into sorted candidates list
    if (candidates.length < maxCandidates) {
      candidates.push({ key: k, score });
      candidates.sort((a, b) => a.score - b.score);
    } else if (score < candidates[maxCandidates - 1].score) {
      candidates[maxCandidates - 1] = { key: k, score };
      candidates.sort((a, b) => a.score - b.score);
    }
  }

  return candidates.map((c) => c.key);
}

/**
 * Commits a binding: assigns action to key and updates finger load.
 */
function commitBinding(
  actionId: number,
  keyIndex: number,
  actionFrequency: number,
  bindingMap: Protocol.BindingMap,
  fingerLoadsMKU: Protocol.FingerLoadsMKU,
  keyToFingerMap: Protocol.KeyToFingerMap
): void {
  bindingMap[keyIndex] = actionId;
  const finger = keyToFingerMap[keyIndex];
  fingerLoadsMKU[finger] += actionFrequency;
}

/**
 * Greedy assignment algorithm.
 * Assigns actions to keys in priority order (most frequent first),
 * picking from the top 3 lowest-cost available keys at random.
 */
export function greedyAssign(
  memory: OptimizerMemory,
  sortedActions: Uint8Array,
  actionCount: number,
  keyCount: number
): void {
  const {
    keyEffortsMKU,
    hardConstraintMasks,
    keyToFingerMap,
    actionFrequencies,
    fingerLoadsMKU,
    bindingMap,
  } = memory;

  const MAX_CANDIDATES = 3;

  // Iterate actions from most frequent to least frequent
  for (let i = 0; i < actionCount; i++) {
    const actionId = sortedActions[i];
    const actionFreq = actionFrequencies[actionId];

    // Find best valid keys for this action
    const bestKeys = findBestKeys(
      actionId,
      keyCount,
      keyToFingerMap,
      bindingMap,
      hardConstraintMasks,
      keyEffortsMKU,
      fingerLoadsMKU,
      MAX_CANDIDATES
    );

    if (bestKeys.length === 0) {
      console.warn(
        `No valid key for action ${actionId}. Constraints too tight?`
      );
      continue;
    }

    // Pick randomly from best candidates for diversity
    const chosenKey = bestKeys[Math.floor(Math.random() * bestKeys.length)];

    // Commit the binding
    commitBinding(
      actionId,
      chosenKey,
      actionFreq,
      bindingMap,
      fingerLoadsMKU,
      keyToFingerMap
    );
  }
}
