import { describe, it, expect, beforeEach } from "vitest";
import {
  OptimizerMemory,
  MAX_COUNTS,
  MAX_FINGERS,
  UNBOUND,
} from "./optimizer-memory";
import { greedyAssign } from "./greedy";
import { annealingAssign } from "./annealing";

describe("OptimizerMemory", () => {
  it("allocates exactly 2560 bytes", () => {
    const mem = new OptimizerMemory();
    expect(mem.buffer.byteLength).toBe(2560);
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
    // ALLOC_SIZE is 65
    expect(mem.hardMasks.length).toBe(65);
    expect(mem.softMasks.length).toBe(65);
    expect(mem.fingerLoads.length).toBe(MAX_FINGERS);
    expect(mem.keyEfforts.length).toBe(MAX_COUNTS);
    expect(mem.frequencies.length).toBe(65);
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
    mem.hardMasks[0] = 2n; // Action 0 conflicts with Action 1 (1 << 1)
    mem.hardMasks[1] = 1n; // Action 1 conflicts with Action 0 (1 << 0)

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
});

describe("annealingAssign", () => {
  let mem: OptimizerMemory;

  beforeEach(() => {
    mem = new OptimizerMemory();
  });

  it("does not crash with valid input", () => {
    const keyCount = 4;
    const actionCount = 3;

    for (let k = 0; k < keyCount; k++) {
      mem.keyToFinger[k] = k;
      mem.keyEfforts[k] = 100;
    }

    for (let a = 0; a < actionCount; a++) {
      mem.frequencies[a] = 1000 - a * 100;
    }

    const sortedActions = new Uint8Array([0, 1, 2]);
    greedyAssign(mem, sortedActions, actionCount, keyCount);

    // Should not throw
    expect(() =>
      annealingAssign(mem, actionCount, keyCount, 100, 0.9995, 100)
    ).not.toThrow();
  });

  it("respects hard constraints after annealing", () => {
    const keyCount = 4;
    const actionCount = 2;

    // 4 keys on 2 fingers (2 keys per finger)
    mem.keyToFinger[0] = 0;
    mem.keyToFinger[1] = 0;
    mem.keyToFinger[2] = 1;
    mem.keyToFinger[3] = 1;

    for (let k = 0; k < keyCount; k++) {
      mem.keyEfforts[k] = 100;
    }

    mem.frequencies[0] = 1000;
    mem.frequencies[1] = 500;

    // Actions 0 and 1 conflict
    mem.hardMasks[0] = 2n; // (1 << 1)
    mem.hardMasks[1] = 1n; // (1 << 0)

    const sortedActions = new Uint8Array([0, 1]);
    greedyAssign(mem, sortedActions, actionCount, keyCount);
    annealingAssign(mem, actionCount, keyCount, 100, 0.9995, 1000);

    // Verify constraints: if both actions are bound, they must be on different fingers
    let finger0Actions = 0n;
    let finger1Actions = 0n;

    for (let k = 0; k < keyCount; k++) {
      const action = mem.bindings[k];
      if (action !== UNBOUND) {
        if (mem.keyToFinger[k] === 0) finger0Actions |= 1n << BigInt(action);
        else finger1Actions |= 1n << BigInt(action);
      }
    }

    // No finger should have both action 0 and action 1
    const bothOnFinger0 = (finger0Actions & 3n) === 3n;
    const bothOnFinger1 = (finger1Actions & 3n) === 3n;
    expect(bothOnFinger0 || bothOnFinger1).toBe(false);
  });

  it("maintains valid state after annealing", () => {
    const keyCount = 6;
    const actionCount = 4;

    for (let k = 0; k < keyCount; k++) {
      mem.keyToFinger[k] = k % 3;
      mem.keyEfforts[k] = 50 + k * 10;
    }

    for (let a = 0; a < actionCount; a++) {
      mem.frequencies[a] = 1000 - a * 200;
    }

    const sortedActions = new Uint8Array([0, 1, 2, 3]);
    greedyAssign(mem, sortedActions, actionCount, keyCount);
    annealingAssign(mem, actionCount, keyCount, 100, 0.9995, 500);

    // Verify fingerContents matches actual bindings
    const expectedContents = new BigInt64Array(16);
    for (let k = 0; k < keyCount; k++) {
      const action = mem.bindings[k];
      if (action !== UNBOUND) {
        expectedContents[mem.keyToFinger[k]] |= 1n << BigInt(action);
      }
    }

    for (let f = 0; f < 3; f++) {
      expect(mem.fingerContents[f]).toBe(expectedContents[f]);
    }
  });
});
