export const MAX_COUNTS = 32;
export const MAX_FINGERS = 16;
export const UNBOUND = 0xff; // 255

export class OptimizerMemory {
  public readonly buffer: ArrayBuffer;

  // --- 1. 32-bit Views ---
  public readonly hardMasks: Int32Array; // Constraints
  public readonly softMasks: Int32Array; // Scoring penalties
  public readonly fingerLoads: Uint32Array; // Current press counts

  // --- 2. 16-bit Views ---
  public readonly keyEfforts: Uint16Array; // Cost of each key (mKU)
  public readonly frequencies: Uint16Array; // Action counts

  // --- 3. 8-bit Views ---
  public readonly keyToFinger: Uint8Array; // Hardware map
  public readonly bindings: Uint8Array; // The Solution (Key -> Action)

  constructor() {
    this.buffer = new ArrayBuffer(512);
    let offset = 0;

    // 1. Int32s (4 bytes)
    this.hardMasks = new Int32Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 4;

    this.softMasks = new Int32Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 4;

    this.fingerLoads = new Uint32Array(this.buffer, offset, MAX_FINGERS);
    offset += MAX_FINGERS * 4;

    // 2. Uint16s (2 bytes)
    this.keyEfforts = new Uint16Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 2;

    this.frequencies = new Uint16Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 2;

    // 3. Uint8s (1 byte)
    this.keyToFinger = new Uint8Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 1;

    this.bindings = new Uint8Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 1;

    // Defaults
    this.bindings.fill(UNBOUND);
    this.keyToFinger.fill(UNBOUND); // Safety fill
  }
}
