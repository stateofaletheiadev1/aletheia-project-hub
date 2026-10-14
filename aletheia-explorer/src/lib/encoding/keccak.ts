// Keccak-256 (the pre-NIST padding Ethereum uses), for the EIP-55 casing of alt: identifiers
// (ADR-062). Only short inputs are hashed, so 64-bit lanes are BigInts for clarity rather
// than split 32-bit words for speed. Checked against the standard empty-input digest and the
// EIP-55 vectors in tests/identifiers.test.ts.

const MASK = (1n << 64n) - 1n;
const RATE = 136; // bytes: 1600-bit state minus 2 x 256-bit capacity

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

// Rotation offset of lane (x, y), indexed x + 5y.
const ROTATIONS = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

function rotl(value: bigint, shift: number): bigint {
  if (shift === 0) return value;
  const s = BigInt(shift);
  return ((value << s) | (value >> (64n - s))) & MASK;
}

function lane(state: bigint[], index: number): bigint {
  return state[index] ?? 0n;
}

function permute(state: bigint[]): void {
  const c = new Array<bigint>(5).fill(0n);
  const b = new Array<bigint>(25).fill(0n);
  for (const constant of ROUND_CONSTANTS) {
    for (let x = 0; x < 5; x++) {
      c[x] = lane(state, x) ^ lane(state, x + 5) ^ lane(state, x + 10) ^ lane(state, x + 15) ^ lane(state, x + 20);
    }
    for (let x = 0; x < 5; x++) {
      const d = (c[(x + 4) % 5] ?? 0n) ^ rotl(c[(x + 1) % 5] ?? 0n, 1);
      for (let y = 0; y < 25; y += 5) state[x + y] = lane(state, x + y) ^ d;
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(lane(state, x + 5 * y), ROTATIONS[x + 5 * y] ?? 0);
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 25; y += 5) {
        state[x + y] = (b[x + y] ?? 0n) ^ (~(b[((x + 1) % 5) + y] ?? 0n) & MASK & (b[((x + 2) % 5) + y] ?? 0n));
      }
    }
    state[0] = lane(state, 0) ^ constant;
  }
}

export function keccak256(input: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.floor(input.length / RATE + 1) * RATE);
  padded.set(input);
  padded[input.length] = (padded[input.length] ?? 0) ^ 0x01;
  padded[padded.length - 1] = (padded[padded.length - 1] ?? 0) ^ 0x80;

  const state = new Array<bigint>(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += RATE) {
    for (let i = 0; i < RATE / 8; i++) {
      let word = 0n;
      for (let k = 7; k >= 0; k--) word = (word << 8n) | BigInt(padded[offset + 8 * i + k] ?? 0);
      state[i] = lane(state, i) ^ word;
    }
    permute(state);
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number((lane(state, i >> 3) >> BigInt(8 * (i % 8))) & 0xffn);
  return out;
}
