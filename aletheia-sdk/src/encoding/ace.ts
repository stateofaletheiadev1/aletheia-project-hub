// Aletheia Canonical Encoding (APS-0041, spec Section 9; `crates/core/src/ace.rs`).
// Fixed-width little-endian integers, u32 length prefixes, u8 presence tags, no trailing
// bytes. Only the shapes the wallet signs or reviews are needed here.

export class AceError extends Error {
  override name = "AceError";
}

const U64_MAX = (1n << 64n) - 1n;
const U128_MAX = (1n << 128n) - 1n;

export class AceWriter {
  #chunks: number[] = [];

  u8(value: number): this {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new AceError(`u8 out of range: ${value}`);
    this.#chunks.push(value);
    return this;
  }

  u16(value: number): this {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new AceError(`u16 out of range: ${value}`);
    this.#chunks.push(value & 0xff, value >>> 8);
    return this;
  }

  u32(value: number): this {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw new AceError(`u32 out of range: ${value}`);
    for (let i = 0; i < 4; i++) this.#chunks.push((value >>> (8 * i)) & 0xff);
    return this;
  }

  u64(value: bigint): this {
    return this.#wide(value, 8, U64_MAX, "u64");
  }

  u128(value: bigint): this {
    return this.#wide(value, 16, U128_MAX, "u128");
  }

  /** Fixed-size array: raw bytes, no prefix (rule 3). */
  fixed(bytes: Uint8Array): this {
    for (const byte of bytes) this.#chunks.push(byte);
    return this;
  }

  /** Variable-length bytes: u32 length, then the bytes (rule 4). */
  bytes(bytes: Uint8Array): this {
    this.u32(bytes.length);
    return this.fixed(bytes);
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.#chunks);
  }

  #wide(value: bigint, width: number, max: bigint, name: string): this {
    if (value < 0n || value > max) throw new AceError(`${name} out of range: ${value}`);
    let rest = value;
    for (let i = 0; i < width; i++) {
      this.#chunks.push(Number(rest & 0xffn));
      rest >>= 8n;
    }
    return this;
  }
}

export class AceReader {
  #bytes: Uint8Array;
  #position = 0;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  get position(): number {
    return this.#position;
  }

  u8(): number {
    return this.#take(1)[0]!;
  }

  u16(): number {
    const raw = this.#take(2);
    return raw[0]! | (raw[1]! << 8);
  }

  u32(): number {
    const raw = this.#take(4);
    return (raw[0]! | (raw[1]! << 8) | (raw[2]! << 16) | (raw[3]! << 24)) >>> 0;
  }

  u64(): bigint {
    return this.#wide(8);
  }

  u128(): bigint {
    return this.#wide(16);
  }

  fixed(length: number): Uint8Array {
    return this.#take(length).slice();
  }

  bytes(maxLength: number): Uint8Array {
    const offset = this.#position;
    const length = this.u32();
    if (length > maxLength) throw new AceError(`length ${length} at offset ${offset} exceeds ${maxLength}`);
    return this.fixed(length);
  }

  /** A complete value has no trailing bytes (rule 9). */
  finish(): void {
    if (this.#position !== this.#bytes.length) {
      throw new AceError(`${this.#bytes.length - this.#position} trailing bytes at offset ${this.#position}`);
    }
  }

  #take(length: number): Uint8Array {
    if (this.#position + length > this.#bytes.length) {
      throw new AceError(
        `need ${length} bytes at offset ${this.#position}, have ${this.#bytes.length - this.#position}`,
      );
    }
    const out = this.#bytes.subarray(this.#position, this.#position + length);
    this.#position += length;
    return out;
  }

  #wide(width: number): bigint {
    const raw = this.#take(width);
    let value = 0n;
    for (let i = width - 1; i >= 0; i--) value = (value << 8n) | BigInt(raw[i]!);
    return value;
  }
}
