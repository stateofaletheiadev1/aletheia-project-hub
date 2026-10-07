import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, splitAmount } from "../src/lib/format/amount.ts";

const E18 = 10n ** 18n;

test("whole amounts show cents and no tail (41A.7: 125.00 AEY)", () => {
  assert.equal(formatAmount((125n * E18).toString(), "AEY", "en"), "125.00 AEY");
});

test("sub-cent digits form a grouped, trimmed tail (41A.7: 125.00 0042 AEY)", () => {
  const parts = splitAmount("125000042000000000000", 18, 2, "en");
  assert.equal(parts.fraction, "00");
  assert.equal(parts.tail, "0042");
  assert.equal(parts.exact, "125.000042000000000000");
});

test("long tails are grouped in fours with thin spaces", () => {
  const parts = splitAmount("1000000000000000001", 18, 2, "en");
  assert.equal(parts.tail, ["0000", "0000", "0000", "0001"].join(String.fromCharCode(0x2009)));
});

test("grouping follows the locale", () => {
  const de = splitAmount((1_250_000n * E18).toString(), 18, 2, "de");
  assert.equal(de.whole, "1.250.000");
  assert.equal(de.decimalSeparator, ",");
});

test("the exact value is a canonical decimal string", () => {
  assert.equal(splitAmount("1", 18, 2, "en").exact, "0.000000000000000001");
  assert.equal(splitAmount("1500", 3, 3, "en").exact, "1.500");
});

test("negative amounts use the true minus sign; negative zero is zero", () => {
  assert.equal(formatAmount("-1500", "ALnT", "en"), "−1.500 ALnT");
  assert.equal(splitAmount("-0", 3, 3, "en").negative, false);
});

test("zero-decimal assets have no fraction and no trailing separator (ERRATA E-14)", () => {
  const parts = splitAmount("123", 0, 0, "en");
  assert.equal(parts.fraction, "");
  assert.equal(parts.exact, "123");
});

test("values beyond Number precision stay exact", () => {
  const units = "340282366920938463463374607431768211455"; // u128::MAX
  assert.equal(splitAmount(units, 18, 2, "en").exact, "340282366920938463463.374607431768211455");
});

test("non-decimal input is refused", () => {
  assert.throws(() => splitAmount("1e18", 18, 2, "en"), TypeError);
  assert.throws(() => splitAmount("12.5", 18, 2, "en"), TypeError);
});
