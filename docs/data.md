# ZeroBind Data Protocol

## Constants

| Name          | Value      | Description                              |
| ------------- | ---------- | ---------------------------------------- |
| `MAX_COUNTS`  | 32         | Max keys/actions (fits in Int32 bitmask) |
| `MAX_FINGERS` | 16         | Max fingers (cache-aligned)              |
| `UNBOUND`     | 0xFF (255) | Sentinel: "No action assigned"           |

## Units

- **mKU** (milliKeyUnit): 1/1000 of a KeyUnit
- **KU** (KeyUnit): Work to move between keys (F → J = 1 KU)

---

## Memory Layout (512 Bytes)

All arrays are backed by a single `ArrayBuffer` for cache efficiency.

### 1. Static Data (Immutable during optimization)

#### `keyToFinger` — Uint8Array[32]

Maps Key Index → Finger Index.

```
Index: Key ID (0-31)
Value: Finger ID (0-15)
```

#### `keyEfforts` — Uint16Array[32]

Physical difficulty of pressing each key.

```
Index: Key ID
Value: Effort in mKU (0-65535)
```

#### `frequencies` — Uint16Array[32]

How often each action is used.

```
Index: Action ID
Value: Scaled frequency (0-65535)
Higher = more frequent
```

#### `hardMasks` — Int32Array[32]

Hard constraints (simultaneous actions that conflict).

```
Index: Action ID (row)
Value: Bitmask of conflicting Action IDs

Logic: Row 'A' contains bits for all actions that
       cannot share a finger with 'A'.

Why Int32? Check 32 conflicts in 1 CPU cycle via bitwise AND.
```

#### `softMasks` — Int32Array[32]

Soft constraints (sequential actions / SFBs that cause penalty).

```
Index: Action ID
Value: Bitmask of penalized Action IDs

Same structure as hardMasks, used for scoring not invalidation.
```

---

### 2. Dynamic State (Mutated during optimization)

#### `bindings` — Uint8Array[32]

The solution: which action is on which key.

```
Index: Key ID
Value: Action ID (0-31) or UNBOUND (0xFF)

If bindings[k] === UNBOUND → key is free
If bindings[k] !== UNBOUND → key is occupied by that action
```

#### `fingerLoads` — Uint32Array[16]

Current accumulated load on each finger.

```
Index: Finger ID
Value: Total load in mKU

Preset binds: If keys are already bound (e.g., fixed WASD),
their load should be pre-calculated before optimization starts.
```

---

### 3. Extras (Not in buffer)

#### `sortedActions` — Uint8Array[32]

Action IDs sorted by frequency (most → least).

```
Index: Priority rank
Value: Action ID

Used only by greedy algorithm, not annealing.
Passed as function parameter, not stored in buffer.
```

#### Count Parameters

```typescript
actionCount: number; // How many actions are actually used
keyCount: number; // How many keys are actually used
fingerCount: number; // How many fingers are actually used
```

**Why pass counts explicitly?**

This enables CPU loop unrolling and better branch prediction. When the loop bound is a constant known at function entry, the CPU can:

1. Predict branches without pipeline flushing
2. Unroll small loops entirely
3. Avoid bounds-checking on every iteration

If we checked `if (index < array.length)` inside hot loops, the CPU would have to verify bounds millions of times instead of once.

---

## Memory Byte Map

| Offset    | Size    | Property      | Type            |
| --------- | ------- | ------------- | --------------- |
| 0-127     | 128     | `hardMasks`   | Int32Array[32]  |
| 128-255   | 128     | `softMasks`   | Int32Array[32]  |
| 256-319   | 64      | `fingerLoads` | Uint32Array[16] |
| 320-383   | 64      | `keyEfforts`  | Uint16Array[32] |
| 384-447   | 64      | `frequencies` | Uint16Array[32] |
| 448-479   | 32      | `keyToFinger` | Uint8Array[32]  |
| 480-511   | 32      | `bindings`    | Uint8Array[32]  |
| **Total** | **512** |               |                 |

---

## Design Notes

### Bitmasks as Boolean Arrays

An Int32 is 32 "light switches" in one integer. `MaskA & MaskB` compares all 32 switches in one CPU cycle.

### Storage vs Usage

- **In arrays** → Use typed arrays (`Uint8Array`, etc.) for tight packing
- **In function args** → Use `number` (CPU registers are 32/64-bit anyway)

### Why 512 Bytes?

- Exactly 8 cache lines (64 bytes each)
- Entire optimizer state fits in L1 cache
- Sorted by type size for proper alignment
