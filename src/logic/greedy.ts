import { MAX_BINDS } from './protocol';

/**
 * Sorts action indices by frequency, highest first.
 * Uses selection sort to directly populate the result array.
 */
export function sortActions(actionFreq: Uint16Array): Uint8Array {
    // 1. Create the array ONCE (Zero allocation churn if pooled, or just fast native alloc)
    const sorted = new Uint8Array(32);

    // 2. Fill with 0..31
    for (let i = 0; i < 32; i++) sorted[i] = i;

    // 3. Sort In-Place
    // V8 optimizes TypedArray.sort heavily. 
    // It avoids some of the overhead of standard Array.sort.
    sorted.sort((a, b) => actionFreq[b] - actionFreq[a]);

    return sorted;
}

interface WarmStartContext {
    bindings: Uint8Array;
    fingerLoads: Uint16Array;    // The total load (Ghost + Greedy Keys)
    fingerContents: Int32Array;  // Which actions are on which finger
    occupancyMask: number;       // Which keys are used
}

export function greedyAssignBinds(
    actionsSorted: Uint8Array,
    keyEffort: Uint16Array,
    keyToFinger: Uint8Array,
    hardMasks: Int32Array, // Assuming: Bitmask of conflicting Action IDs
    softMasks: Int32Array, // Assuming: Bitmask of "awkward" Action IDs
    initialOccupancyMask: number,
    initialFingerLoads: Uint16Array
): WarmStartContext {
    // 1. Init with 255 to detect failures/unbound actions
    const bindings = new Uint8Array(32).fill(255);

    let occupancyMask = initialOccupancyMask;

    // Copy loads so we don't mutate the input prop
    const fingerLoads = new Uint16Array(initialFingerLoads);

    // Track which ACTIONS are on which FINGER (Dynamic Conflict Checking)
    // Index = Finger ID, Value = Bitmask of Action IDs currently on that finger
    const fingerContents = new Int32Array(16);

    // CONFIG: Tuning weights for the greedy selection
    const LOAD_PENALTY_MULTIPLIER = 10; // How much we hate tired fingers
    const SOFT_CONFLICT_PENALTY = 500;  // "mKU" penalty for soft conflicts

    for (let i = 0; i < 32; i++) {
        const actionId = actionsSorted[i];

        // 2. Fix Sentinel Bug: Only break if we hit a true "Empty" marker (if you use 255 for padding)
        // If actionsSorted is fully populated 0-31, just remove this check.
        if (actionId === 255) break;

        let bestKey = -1;
        let bestScore = Infinity; // Lower is better

        // Find best available key
        for (let keyId = 0; keyId < 32; keyId++) {
            const keyBit = 1 << keyId;

            // A. Occupancy Check (Key is taken)
            if ((occupancyMask & keyBit) !== 0) continue;

            const finger = keyToFinger[keyId];

            // B. Hard Conflict Check (Dynamic)
            // Does the current action hate any action ALREADY on this finger?
            if ((hardMasks[actionId] & fingerContents[finger]) !== 0) {
                continue; // Impossible combination
            }

            // C. Scoring
            const baseEffort = keyEffort[keyId];

            // Fix: Actually use the finger load!
            const loadPenalty = fingerLoads[finger] * LOAD_PENALTY_MULTIPLIER;

            // Soft Conflict: Action prefers not to share finger with existing actions
            const conflictPenalty = ((softMasks[actionId] & fingerContents[finger]) !== 0)
                ? SOFT_CONFLICT_PENALTY
                : 0;

            const totalScore = baseEffort + loadPenalty + conflictPenalty;

            if (totalScore < bestScore) {
                bestScore = totalScore;
                bestKey = keyId;
            }
        }

        if (bestKey !== -1) {
            bindings[actionId] = bestKey;

            // Update State
            occupancyMask |= (1 << bestKey);
            const finger = keyToFinger[bestKey];
            fingerLoads[finger] += keyEffort[bestKey];
            fingerContents[finger] |= (1 << actionId); // Mark this action as present on this finger
        } else {
            // Optional: Log failure if an action couldn't be placed
            // console.warn(`Could not place Action ${actionId}`);
        }
    }

    return { bindings, fingerLoads, fingerContents, occupancyMask };
}
