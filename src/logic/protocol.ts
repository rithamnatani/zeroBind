/**
 * Optimized data structures for keybind optimization.
 * Uses typed arrays for cache-efficient storage per data.md spec.
 */

// --- CONSTANTS ---
// Use powers of 2 for efficiency in CPU cache
export const MAX_BINDS = 32;
export const MAX_FINGERS = 16;

// --- 1. ID STORAGE (8-bit) ---
// Fits entire genome in 32 bytes (half a cache line)

/** Maps action index -> bound key index */
export const bindings = new Uint8Array(MAX_BINDS);

/** Maps key index -> finger index */
export const keyToFinger = new Uint8Array(MAX_BINDS);

// --- 2. MATH VALUES (32-bit Float) ---
// Native CPU/GPU precision, no fixed-point scaling needed

/** Effort cost per key (in milli Keybind Units, or mKU) */
export const keyEffort = new Uint16Array(MAX_BINDS);

/** Usage frequency per action (in percentage, but 100% = 60000, 0.01% = 6) */
export const actionFreq = new Uint16Array(MAX_BINDS);

/** Action indices sorted by priority (highest priority first) */
export const actionsSorted = new Uint8Array(MAX_BINDS);

/** Current load accumulated per finger */
export const fingerLoad = new Uint16Array(MAX_FINGERS);

// --- 3. MASKS (32-bit Int) ---
// Each bit represents a key slot. Enables 1-cycle collision checks.

/** Hard constraint masks per action (must NOT overlap) */
export const hardMasks = new Int32Array(MAX_BINDS);

/** Soft constraint masks per action (penalized overlap) */
export const softMasks = new Int32Array(MAX_BINDS);

// --- 4. GLOBAL STATE ---
/** Tracks which keys are currently occupied (bit per key), treat as a 32 bit integer */
export let globalOccupancyMask = 0;

// --- UTILITY FUNCTIONS ---

/** Resets all protocol state to initial values */
export function resetProtocol(): void {
    bindings.fill(0);
    keyToFinger.fill(0);
    keyEffort.fill(0);
    actionFreq.fill(0);
    fingerLoad.fill(0);
    hardMasks.fill(0);
    softMasks.fill(0);
    globalOccupancyMask = 0;
}

/** Sets occupancy for a key */
export function occupyKey(keyId: number): void {
    globalOccupancyMask |= (1 << keyId);
}

/** Clears occupancy for a key */
export function releaseKey(keyId: number): void {
    globalOccupancyMask &= ~(1 << keyId);
}

/** Checks if a key is occupied */
export function isKeyOccupied(keyId: number): boolean {
    return (globalOccupancyMask & (1 << keyId)) !== 0;
}

/** Checks if a mask has any collision with current occupancy */
export function hasCollision(mask: number): boolean {
    return (globalOccupancyMask & mask) !== 0;
}
