import type * as Protocol from "./protocol";

/**
 * ============================================================================
 * CONSTANTS & CONFIGURATION
 * ============================================================================
 */

// Sizes
export const MAX_COUNTS = 32;
export const MAX_FINGERS = 16;

// Special Values
export const UNBOUND = 0xff; // 255

/**
 * ============================================================================
 * MEMORY LAYOUT (The Single Block)
 * ============================================================================
 * * Total Memory Required: EXACTLY 512 Bytes
 * * Cache Lines: Exactly 8 (64 bytes * 8)
 * * * LAYOUT STRATEGY (Sorted by Type Size for Alignment):
 * 1. Int32/Uint32 (4 bytes) - Masks, Loads
 * 2. Uint16 (2 bytes) - Efforts, Frequencies
 * 3. Uint8 (1 byte) - Maps, Bindings
 */

export class OptimizerMemory {
  // The raw block of memory
  public readonly buffer: ArrayBuffer;

  // --- 1. 32-bit Views (Alignment: 4 bytes) ---
  public readonly hardConstraintMasks: Protocol.HardConstraintMasks; // 32 * 4 = 128 bytes
  public readonly softConstraintMasks: Protocol.SoftConstraintMasks; // 32 * 4 = 128 bytes
  public readonly fingerLoadsMKU: Protocol.FingerLoadsMKU; // 16 * 4 = 64 bytes

  // --- 2. 16-bit Views (Alignment: 2 bytes) ---
  public readonly keyEffortsMKU: Protocol.KeyEffortsMKU; // 32 * 2 = 64 bytes
  public readonly actionFrequencies: Protocol.ActionFrequencies; // 32 * 2 = 64 bytes

  // --- 3. 8-bit Views (Alignment: 1 byte) ---
  public readonly keyToFingerMap: Protocol.KeyToFingerMap; // 32 * 1 = 32 bytes
  public readonly bindingMap: Protocol.BindingMap; // 32 * 1 = 32 bytes

  constructor() {
    // Allocate exactly 512 bytes
    this.buffer = new ArrayBuffer(512);

    // --- OFFSET TRACKING ---
    let offset = 0;

    // 1. Hard Masks (Bytes 0 - 127)
    this.hardConstraintMasks = new Int32Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 4;

    // 2. Soft Masks (Bytes 128 - 255)
    this.softConstraintMasks = new Int32Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 4;

    // 3. Finger Loads (Bytes 256 - 319)
    this.fingerLoadsMKU = new Uint32Array(this.buffer, offset, MAX_FINGERS);
    offset += MAX_FINGERS * 4;

    // 4. Key Efforts (Bytes 320 - 383)
    this.keyEffortsMKU = new Uint16Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 2;

    // 5. Action Frequencies (Bytes 384 - 447)
    this.actionFrequencies = new Uint16Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 2;

    // 6. Key To Finger Map (Bytes 448 - 479)
    this.keyToFingerMap = new Uint8Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 1;

    // 7. Bindings (Bytes 480 - 511)
    this.bindingMap = new Uint8Array(this.buffer, offset, MAX_COUNTS);
    offset += MAX_COUNTS * 1;

    // Total Used: 512 Bytes.

    // Initialize defaults
    this.bindingMap.fill(UNBOUND);
    this.keyToFingerMap.fill(UNBOUND);
  }
}
