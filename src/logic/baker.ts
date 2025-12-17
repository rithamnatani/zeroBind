/**
 * Sorts action indices by frequency, highest first.
 * Uses selection sort to directly populate the result array.
 */
export function sortActions(actionFreq: Uint16Array): Uint8Array {
    // 1. Initialize with 255 (Sentinel for "Empty")
    // This ensures all unused slots at the end are already correctly marked.
    const sorted = new Uint8Array(32).fill(255);

    // 2. Compact: Collect only active indices (freq > 0)
    let count = 0;
    for (let i = 0; i < 32; i++) {
        if (actionFreq[i] > 0) {
            sorted[count++] = i;
        }
    }

    // 3. Sort ONLY the active portion
    // .subarray() creates a view on the existing buffer (cheap), 
    // so sorting it modifies the underlying 'sorted' array in-place.
    if (count > 0) {
        sorted.subarray(0, count).sort((a, b) => actionFreq[b] - actionFreq[a]);
    }

    return sorted;
}
