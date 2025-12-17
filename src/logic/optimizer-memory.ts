export const MAX_COUNTS = 64;
// We allocate 65 slots. Index 64 is "UNBOUND".
// This allows frequencies[64] to safely return 0.
export const ALLOC_SIZE = 65;
export const MAX_FINGERS = 16;
export const UNBOUND = 64;

export class OptimizerMemory {
  public readonly buffer: ArrayBuffer;

  // --- 1. 64-bit Views (BigInt) ---
  public readonly hardMasks: BigInt64Array; // Constraints
  public readonly softMasks: BigInt64Array; // Scoring penalties
  public readonly fingerContents: BigInt64Array; // Current press counts (64 bits of history)

  // --- 2. 32-bit Views ---
  public readonly fingerLoads: Uint32Array; // Current press counts
  public readonly frequencies: Uint32Array; // Action counts (Upgraded to Uint32)

  // --- 3. 16-bit Views ---
  public readonly keyEfforts: Uint16Array; // Cost of each key (mKU)

  // --- 4. 8-bit Views ---
  public readonly keyToFinger: Uint8Array; // Hardware map
  public readonly bindings: Uint8Array; // The Solution (Key -> Action)

  constructor() {
    // Calculate size:
    // Mask arrays are now double size (8 bytes per item * 65 items)
    // ~2.5KB total. Still fits in L1 Cache easily.
    this.buffer = new ArrayBuffer(2048); //Rounded up from 1750
    let offset = 0;

    // 1. BigInts (8 bytes)
    this.hardMasks = new BigInt64Array(this.buffer, offset, ALLOC_SIZE);
    offset += ALLOC_SIZE * 8;

    this.softMasks = new BigInt64Array(this.buffer, offset, ALLOC_SIZE);
    offset += ALLOC_SIZE * 8;

    this.fingerContents = new BigInt64Array(this.buffer, offset, MAX_FINGERS);
    offset += MAX_FINGERS * 8;

    // 2. Uint32s (4 bytes)
    this.fingerLoads = new Uint32Array(this.buffer, offset, MAX_FINGERS);
    offset += MAX_FINGERS * 4;

    this.frequencies = new Uint32Array(this.buffer, offset, ALLOC_SIZE);
    offset += ALLOC_SIZE * 4;

    // 3. Uint16s (2 bytes)
    this.keyEfforts = new Uint16Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 2;

    // 4. Uint8s (1 byte)
    this.keyToFinger = new Uint8Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 1;

    this.bindings = new Uint8Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 1;

    // Defaults
    this.bindings.fill(UNBOUND);
    this.keyToFinger.fill(UNBOUND);
  }
}
