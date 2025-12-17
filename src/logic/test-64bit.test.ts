import { describe, it, expect } from "vitest";
import { OptimizerMemory, UNBOUND } from "./optimizer-memory";
import { greedyAssign } from "./greedy";
import { annealingAssign } from "./annealing";

describe("64-bit Support", () => {
  it("handles actions with ID > 32", () => {
    const mem = new OptimizerMemory();
    const keyCount = 2;
    const actionCount = 2;

    // Setup: 2 keys on different fingers
    mem.keyToFinger[0] = 0;
    mem.keyToFinger[1] = 1;
    mem.keyEfforts[0] = 100;
    mem.keyEfforts[1] = 100;

    // Use high IDs: 40 and 50
    const actionA = 40;
    const actionB = 50;

    mem.frequencies[actionA] = 1000;
    mem.frequencies[actionB] = 500;

    const sortedActions = new Uint8Array([actionA, actionB]);

    greedyAssign(mem, sortedActions, actionCount, keyCount);

    expect(mem.bindings[0]).not.toBe(UNBOUND);
    expect(mem.bindings[1]).not.toBe(UNBOUND);

    // Verify bits are set correctly in BigInt
    // Finger 0 should have bit 40 or 50 set
    const content0 = mem.fingerContents[0];
    const content1 = mem.fingerContents[1];

    const hasA =
      (content0 & (1n << BigInt(actionA))) !== 0n ||
      (content1 & (1n << BigInt(actionA))) !== 0n;
    const hasB =
      (content0 & (1n << BigInt(actionB))) !== 0n ||
      (content1 & (1n << BigInt(actionB))) !== 0n;

    expect(hasA).toBe(true);
    expect(hasB).toBe(true);
  });

  it("detects conflicts between high-bit actions", () => {
    const mem = new OptimizerMemory();
    const keyCount = 2;
    const actionCount = 2;

    // Setup: 2 keys on SAME finger
    mem.keyToFinger[0] = 0;
    mem.keyToFinger[1] = 0;
    mem.keyEfforts[0] = 100;
    mem.keyEfforts[1] = 100;

    const actionA = 40;
    const actionB = 50;

    mem.frequencies[actionA] = 1000;
    mem.frequencies[actionB] = 500;

    // Conflict: Action A conflicts with Action B
    mem.hardMasks[actionA] = 1n << BigInt(actionB);
    mem.hardMasks[actionB] = 1n << BigInt(actionA);

    const sortedActions = new Uint8Array([actionA, actionB]);

    greedyAssign(mem, sortedActions, actionCount, keyCount);

    // Only one should be bound
    let boundCount = 0;
    if (mem.bindings[0] !== UNBOUND) boundCount++;
    if (mem.bindings[1] !== UNBOUND) boundCount++;

    expect(boundCount).toBe(1);
  });
});
