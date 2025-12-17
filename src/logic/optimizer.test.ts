import { describe, it, expect, beforeEach } from "vitest";
import {
  OptimizerMemory,
  MAX_COUNTS,
  MAX_FINGERS,
  UNBOUND,
} from "./optimizer-memory";
import { greedyAssign } from "./greedy";

describe("OptimizerMemory", () => {
  it("allocates exactly 512 bytes", () => {
    const mem = new OptimizerMemory();
    expect(mem.buffer.byteLength).toBe(512);
  });

  it("initializes bindings to UNBOUND", () => {
    const mem = new OptimizerMemory();
    for (let i = 0; i < MAX_COUNTS; i++) {
      expect(mem.bindings[i]).toBe(UNBOUND);
    }
  });

  it("initializes keyToFinger to UNBOUND", () => {
    const mem = new OptimizerMemory();
    for (let i = 0; i < MAX_COUNTS; i++) {
      expect(mem.keyToFinger[i]).toBe(UNBOUND);
    }
  });

  it("has correct array sizes", () => {
    const mem = new OptimizerMemory();
    expect(mem.hardMasks.length).toBe(MAX_COUNTS);
    expect(mem.softMasks.length).toBe(MAX_COUNTS);
    expect(mem.fingerLoads.length).toBe(MAX_FINGERS);
    expect(mem.keyEfforts.length).toBe(MAX_COUNTS);
    expect(mem.frequencies.length).toBe(MAX_COUNTS);
    expect(mem.keyToFinger.length).toBe(MAX_COUNTS);
    expect(mem.bindings.length).toBe(MAX_COUNTS);
  });

  it("shares the same underlying buffer", () => {
    const mem = new OptimizerMemory();
    // All views should reference the same buffer
    expect(mem.hardMasks.buffer).toBe(mem.buffer);
    expect(mem.bindings.buffer).toBe(mem.buffer);
  });
});

describe("greedyAssign", () => {
  let mem: OptimizerMemory;

  beforeEach(() => {
    mem = new OptimizerMemory();
  });

  it("assigns all actions when no constraints", () => {
    const keyCount = 4;
    const actionCount = 3;

    // Setup: 4 keys, each on different finger
    for (let k = 0; k < keyCount; k++) {
      mem.keyToFinger[k] = k; // Each key on its own finger
      mem.keyEfforts[k] = 100; // Equal effort
    }

    // Setup: 3 actions with frequencies
    mem.frequencies[0] = 1000;
    mem.frequencies[1] = 500;
    mem.frequencies[2] = 250;

    // No hard constraints (all zeros)

    // sortedActions: most frequent first
    const sortedActions = new Uint8Array([0, 1, 2]);

    greedyAssign(mem, sortedActions, actionCount, keyCount);

    // All 3 actions should be bound somewhere
    let boundCount = 0;
    for (let k = 0; k < keyCount; k++) {
      if (mem.bindings[k] !== UNBOUND) boundCount++;
    }
    expect(boundCount).toBe(actionCount);
  });

  it("respects hard constraints", () => {
    const keyCount = 2;
    const actionCount = 2;

    // Setup: 2 keys on SAME finger
    mem.keyToFinger[0] = 0;
    mem.keyToFinger[1] = 0;
    mem.keyEfforts[0] = 100;
    mem.keyEfforts[1] = 100;

    // Setup: 2 actions that conflict with each other
    mem.frequencies[0] = 1000;
    mem.frequencies[1] = 500;
    mem.hardMasks[0] = 0b10; // Action 0 conflicts with Action 1
    mem.hardMasks[1] = 0b01; // Action 1 conflicts with Action 0

    const sortedActions = new Uint8Array([0, 1]);

    greedyAssign(mem, sortedActions, actionCount, keyCount);

    // Only 1 action should be bound (can't put both on same finger)
    let boundCount = 0;
    for (let k = 0; k < keyCount; k++) {
      if (mem.bindings[k] !== UNBOUND) boundCount++;
    }
    expect(boundCount).toBe(1);

    // The first action (highest frequency) should be bound
    expect(mem.bindings[0] === 0 || mem.bindings[1] === 0).toBe(true);
  });

  it("updates finger loads", () => {
    const keyCount = 2;
    const actionCount = 2;

    mem.keyToFinger[0] = 0;
    mem.keyToFinger[1] = 1;
    mem.keyEfforts[0] = 100;
    mem.keyEfforts[1] = 100;

    mem.frequencies[0] = 1000;
    mem.frequencies[1] = 500;

    const sortedActions = new Uint8Array([0, 1]);

    greedyAssign(mem, sortedActions, actionCount, keyCount);

    // Finger loads should be updated
    const totalLoad = mem.fingerLoads[0] + mem.fingerLoads[1];
    expect(totalLoad).toBe(1500); // 1000 + 500
  });

  it("clears previous state before assigning", () => {
    mem.keyToFinger[0] = 0;
    mem.keyEfforts[0] = 100;
    mem.frequencies[0] = 1000;

    // Pre-pollute state
    mem.bindings[0] = 99;
    mem.fingerLoads[0] = 9999;

    const sortedActions = new Uint8Array([0]);

    greedyAssign(mem, sortedActions, 1, 1);

    // Should have cleared and reassigned
    expect(mem.bindings[0]).toBe(0);
    expect(mem.fingerLoads[0]).toBe(1000);
  });
});
