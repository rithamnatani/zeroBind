/**
 * ============================================================================
 * CONSTANTS & CONFIGURATION
 * ============================================================================
 */

// Sizes
// Merged MAX_ACTIONS and MAX_KEYS effectively, but kept distinct for clarity.
// Both must be <= 32 to fit in standard Int32 bitmasks.
export const MAX_COUNTS = 32;
export const MAX_FINGERS = 16; // Increased to 16 for better cache alignment/flexibility.

// Special Values
export const UNBOUND = 0xff; // 255. Represents "No Action Assigned" to this key.

//Units:
//mKU = milliKeyUnits, 1/1000 of a KeyUnit
//KU = KeyUnits, the work required to move from one key to another, F -> J = 1 KU

// 1. STATIC DATA (Read-Only Lookups) "Immutable" in usage: The optimizer reads these but NEVER writes to them.

// A. Key Definitions (The Physical Hardware)

/**
 * Maps Key Index -> Finger Index.
 * Index: Key ID (0 to MAX_COUNTS-1)
 * Value: Finger ID (0 to MAX_FINGERS-1)
 * Array Size: MAX_COUNTS (Keys).
 */
export type KeyToFingerMap = Uint8Array;

/**
 * The physical difficulty of pressing a key.
 * Index: Key ID
 * Value: Effort in mKU (milliKeyUnit).
 * Array Size: MAX_COUNTS (Keys).
 * Suffix 'MKU' denotes the unit. (milliKeyUnit)
 */
export type KeyEffortsMKU = Uint16Array;

// B. Action Definitions (The Game Inputs)

/**
 * How often an action is used.
 * Index: Action ID (0 to MAX_COUNTS-1)
 * Value: Scaled Frequency (0 to ~60000). 0 being 0%, 60000 being 100%
 * Array Size: MAX_COUNTS (Actions).
 * Higher = More frequent.
 */
export type ActionFrequencies = Uint16Array;

/**
 * HARD Constraints (Simultaneous Actions).
 * Index: Action ID (Rows)
 * Value: Bitmask (Int32) of OTHER Action IDs (Cols) that conflict.
 * Array Size: MAX_COUNTS (Actions).
 *
 * * LOGIC:
 * Think of this as a multiplication table or adjacency matrix compressed into bits.
 * Row 'A' contains the bits for all actions that cannot share a finger with 'A'.
 *
 * * WHY INT32?
 * It allows checking up to 32 specific conflicts in a SINGLE CPU instruction (bitwise AND).
 * If we used arrays, we'd have to loop 32 times.
 * To increase the limit, we'd need to use 64-bit integers
 */
export type HardConstraintMasks = Int32Array;

/**
 * SOFT Constraints (Sequential Actions / SFBs).
 * Index: Action ID
 * Value: Bitmask (Int32) of OTHER Action IDs that cause a penalty.
 * Array Size: MAX_COUNTS (Actions).
 *
 * Same structure as HardConstraints, just used for scoring, not invalidation.
 */
export type SoftConstraintMasks = Int32Array;

//2. DYNAMIC STATE (Mutable) These arrays are updated millions of times during the loop.

/**
 * Index: Key ID (0 to MAX_COUNTS-1)
 * Value: Action ID (0 to MAX_COUNTS-1) or UNBOUND (0xFF).
 * Array Size: MAX_COUNTS (Keys).
 *
 * This acts as BOTH the binding map AND the occupancy map.
 * If bindings[k] === UNBOUND, the key is free.
 * If bindings[k] !== UNBOUND, the key is occupied by that Action.
 * Usage in SA: We pick two Keys at random and swap their Actions.
 */
export type BindingMap = Uint8Array;

/**
 * Current accumulated load on each finger.
 * Index: Finger ID
 * Value: Total Load in mKU.
 * Array Size: MAX_FINGERS (Fingers).
 * * PRESET BINDS:
 * If keys are already bound outside this optimizer (e.g., fixed Movement keys),
 * their load should be pre-calculated and inserted here BEFORE the optimization starts.
 * The optimizer will then add its own load on top of this baseline.
 */
export type FingerLoadsMKU = Uint32Array;

//3. Extras, not in the buffer, passed as parameters

/**
 * Index: Just a regular array of action IDs, sorted by frequency
 * Value: Action ID (0 to MAX_COUNTS-1)
 * Array Size: MAX_COUNTS (Actions).
 * The indexes of the actions, sorted by frequency
 * Is a scratchpad, so we can avoid reallocating every time greedy is called.
 * Note: Only used for greedy algorithm, not annealing
 */
export type sortedActions = Uint8Array;

// How many keys, fingers, and actions are actually used, so the CPU can unroll the loop and avoid flushing the pipepline
// This is because of branch prediction, which is much faster than checking if a value is within bounds
export type NUM_KEYS = number;
export type NUM_FINGERS = number;
export type NUM_ACTIONS = number;
