import { describe, expect, it } from "vitest";
import {
  amountParts,
  AmountError,
  formatAmount,
  formatDisplay,
  groupWhole,
  parseAmount,
  parseBaseUnits,
  trimAmount,
} from "../src/util/amount.js";
import { formatPaymentUri, parsePaymentUri, UriError } from "../src/uri/payment-uri.js";
import { renderAddress } from "../src/addresses/identifiers.js";
import type { BaseUnits } from "../src/util/brand.js";

const U128_MAX = (1n << 128n) - 1n;

describe("amounts", () => {
  it("parses exactly, like crates/wallet parse_amount", () => {
    expect(parseAmount("125.5", 18)).toBe(125_500_000_000_000_000_000n);
    expect(parseAmount("0.000000000000000001", 18)).toBe(1n);
    expect(parseAmount("1,5", 3)).toBe(1500n);
    expect(parseAmount(" 7 ", 3)).toBe(7000n);
    expect(parseAmount("0", 18)).toBe(0n);
    expect(parseAmount("12", 0)).toBe(12n);
  });

  it("refuses anything inexact", () => {
    for (const text of ["", ".", "1.", ".5", "-1", "1e3", "1.2.3", "abc", "1 000"]) {
      expect(() => parseAmount(text, 18), text).toThrow(AmountError);
    }
    expect(() => parseAmount("1.0001", 3)).toThrow(/at most 3/);
    expect(() => parseAmount("1.5", 0)).toThrow(/no fractional/);
    expect(() => parseAmount((U128_MAX + 1n).toString(), 0)).toThrow(AmountError);
  });

  it("formats every decimal, like the node's display field", () => {
    expect(formatAmount(936750n, 3)).toBe("936.750");
    expect(formatAmount(0n, 18)).toBe("0.000000000000000000");
    expect(formatAmount(U128_MAX, 18)).toBe("340282366920938463463.374607431768211455");
    expect(formatAmount(5n, 0)).toBe("5");
    expect(() => formatAmount(-1n, 3)).toThrow(AmountError);
    for (const value of [0n, 1n, 999n, 10n ** 18n, U128_MAX]) {
      expect(parseAmount(formatAmount(value, 18), 18)).toBe(value);
    }
  });

  it("parses node base-unit strings", () => {
    expect(parseBaseUnits("936750")).toBe(936750n);
    expect(() => parseBaseUnits("1.5")).toThrow(AmountError);
    expect(() => parseBaseUnits((U128_MAX + 1n).toString())).toThrow(AmountError);
  });

  it("splits for the denomination style without losing digits", () => {
    const parts = amountParts(1_284_551_250_000_000_000_000_000n, 18);
    expect(parts).toEqual({
      integer: "1,284,551",
      separator: ".",
      fraction: "25",
      exact: "1284551.250000000000000000",
    });
    expect(amountParts(1n, 18).fraction).toBe("000000000000000001");
    expect(amountParts(1_000_000_000_000_000_000n, 18).fraction).toBe("00");
    expect(amountParts(1_000_000_000_000_000_000n, 18, { precision: "full" }).fraction).toBe("000000000000000000");
    expect(amountParts(5n, 0)).toMatchObject({ integer: "5", separator: "", fraction: "" });
    const german = amountParts(1_234_500n, 3, { locale: "de" });
    expect(german.integer).toBe("1.234");
    expect(german.separator).toBe(",");
    expect(german.fraction).toBe("50");
    expect(formatDisplay(1_000_250n, 3, "ALnT")).toBe("1,000.25 ALnT");
    expect(groupWhole(1106149n)).toBe("1,106,149");
    expect(groupWhole(12)).toBe("12");
    expect(trimAmount("1000.250")).toBe("1000.25");
    expect(trimAmount("7.000")).toBe("7");
    expect(trimAmount("1000")).toBe("1000");
  });
});

describe("payment URI", () => {
  const recipient = renderAddress(
    Uint8Array.from({ length: 20 }, (_, i) => (i * 37 + 171) & 0xff),
    "mainnet",
  );

  it("round-trips the APS-0030 example shape", () => {
    const uri = formatPaymentUri({
      recipient,
      asset: "AEY",
      amount: 125_000_000_000_000_000_000n as BaseUnits,
      memo: "invoice 2026/118 ✓",
    });
    expect(uri).toBe(
      `aletheia:${recipient}?asset=AEY&amount=125.000000000000000000&memo=invoice%202026%2F118%20%E2%9C%93`,
    );
    expect(parsePaymentUri(uri, "mainnet")).toEqual({
      recipient,
      asset: "AEY",
      amount: 125_000_000_000_000_000_000n,
      memo: "invoice 2026/118 ✓",
    });
  });

  it("defaults to AEY with no amount or memo", () => {
    expect(parsePaymentUri(`aletheia:${recipient}`, "mainnet")).toEqual({
      recipient,
      asset: "AEY",
      amount: null,
      memo: null,
    });
    expect(formatPaymentUri({ recipient, asset: "ALnT", amount: null, memo: "" })).toBe(
      `aletheia:${recipient}?asset=ALnT`,
    );
  });

  it("reads the amount with the asset's decimals whatever the parameter order", () => {
    expect(parsePaymentUri(`aletheia:${recipient}?amount=2.5&asset=ALnT`, "mainnet").amount).toBe(2500n);
  });

  it("refuses everything not in the grammar", () => {
    const bad = [
      `bitcoin:${recipient}`,
      `aletheia:${recipient}?asset=BTC`,
      `aletheia:${recipient}?asset=ALnT&amount=1.0001`,
      `aletheia:${recipient}?foo=1`,
      `aletheia:${recipient}?asset=AEY&asset=AEY`,
      `aletheia:${recipient}?memo=%zz`,
      `aletheia:${recipient}?memo=%ff`,
      `aletheia:${recipient}?memo=a b`,
      `aletheia:${recipient}?memo=${"a".repeat(257)}`,
      `aletheia:alt:nothex`,
    ];
    for (const text of bad) expect(() => parsePaymentUri(text, "mainnet"), text).toThrow(UriError);
  });

  it("names the network of a foreign recipient", () => {
    const devnet = renderAddress(
      Uint8Array.from({ length: 20 }, (_, i) => (i * 37 + 171) & 0xff),
      "devnet",
    );
    try {
      parsePaymentUri(`aletheia:${devnet}`, "mainnet");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UriError);
      expect((error as UriError).foundNetwork).toBe("devnet");
    }
  });
});
