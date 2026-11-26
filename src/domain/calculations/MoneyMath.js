/**
 * @file MoneyMath.js
 * @description Pure JavaScript domain utility functions for exact integer minor-unit arithmetic.
 * @standards SRS Alignment: NFR-05, Section 1.4, Section 6.2
 * @constitutional-mandates
 *   1. Integer Minor-Unit Math: All amounts are stored and calculated strictly in integer minor units (cents / centavos).
 *   2. Zero Floating-Point Drift: Floating-point math for money is strictly prohibited; conversions use Math.round(val * 100).
 *   3. Precondition Checks: Explicit errors thrown if !Number.isInteger(minor) || minor < 0.
 */

'use strict';

/**
 * Validates that a value is a valid non-negative integer minor unit (cents/centavos).
 * Throws an Error if the value is not an integer or is less than zero.
 *
 * @param {unknown} minor - The minor unit value to validate.
 * @throws {Error} If minor is not an integer or is negative.
 * @returns {void}
 */
export function assertIntegerMinor(minor) {
  if (typeof minor !== 'number' || !Number.isInteger(minor) || minor < 0) {
    throw new Error(
      `Amount must be a non-negative integer minor unit, received: ${
        typeof minor === 'number' ? minor : typeof minor
      }`
    );
  }
}

/**
 * Converts major units (dollars / córdobas) to exact integer minor units (cents / centavos).
 * Eliminates floating-point drift using Math.round(val * 100).
 *
 * @param {number|string} dollars - Major currency units to convert.
 * @throws {Error} If dollars is not a finite number or is negative.
 * @returns {number} Exact integer minor units.
 */
export function toMinorUnits(dollars) {
  const num =
    typeof dollars === 'string' && dollars.trim() !== ''
      ? Number(dollars)
      : dollars;

  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new Error(
      `Expected a finite number of major currency units, received: ${dollars}`
    );
  }

  if (num < 0) {
    throw new Error(
      `Monetary amount cannot be negative, received: ${dollars}`
    );
  }

  const minor = Math.round(num * 100) + 0; // +0 ensures negative zero (-0) is normalized to 0

  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Amount exceeds maximum safe integer representation: ${dollars}`);
  }

  assertIntegerMinor(minor);
  return minor;
}

/**
 * Formats integer minor units (cents / centavos) to a 2-decimal-place major units string.
 *
 * @param {number} minor - Exact integer minor units.
 * @throws {Error} If minor is not a valid non-negative integer.
 * @returns {string} String formatted to 2 decimals (e.g. "12.34").
 */
export function toMajorUnits(minor) {
  assertIntegerMinor(minor);
  return (minor / 100).toFixed(2);
}

/**
 * Safely adds two integer minor-unit amounts.
 * Guarantees zero floating-point drift and safe integer bounds.
 *
 * @param {number} aMinor - First operand in integer minor units.
 * @param {number} bMinor - Second operand in integer minor units.
 * @throws {Error} If inputs are not valid minor units or if overflow occurs.
 * @returns {number} The integer minor-unit sum.
 */
export function add(aMinor, bMinor) {
  assertIntegerMinor(aMinor);
  assertIntegerMinor(bMinor);

  const result = aMinor + bMinor;

  if (!Number.isSafeInteger(result)) {
    throw new Error(
      `Integer overflow detected in addition: ${aMinor} + ${bMinor}`
    );
  }

  return result;
}

/**
 * Alias for add(aMinor, bMinor).
 */
export const addMinor = add;

/**
 * Safely subtracts one integer minor-unit amount from another.
 * Prevents negative monetary results (underflow below zero).
 *
 * @param {number} aMinor - Minuend in integer minor units.
 * @param {number} bMinor - Subtrahend in integer minor units.
 * @throws {Error} If inputs are not valid minor units or if result would be negative.
 * @returns {number} The integer minor-unit difference.
 */
export function subtract(aMinor, bMinor) {
  assertIntegerMinor(aMinor);
  assertIntegerMinor(bMinor);

  const result = aMinor - bMinor;

  if (result < 0) {
    throw new Error(
      `Subtraction result cannot be negative minor units, received: ${aMinor} - ${bMinor} = ${result}`
    );
  }

  return result;
}

/**
 * Alias for subtract(aMinor, bMinor).
 */
export const subtractMinor = subtract;

/**
 * Safely sums an array or variable list of integer minor units.
 *
 * @param {number[]|...number} amounts - Array of minor units or rest arguments.
 * @throws {Error} If any element is not a valid minor unit or on overflow.
 * @returns {number} The total sum in minor units.
 */
export function sum(...amounts) {
  const list =
    amounts.length === 1 && Array.isArray(amounts[0]) ? amounts[0] : amounts;

  return list.reduce((total, amount) => add(total, amount), 0);
}

/**
 * Alias for sum(...amounts).
 */
export const sumMinor = sum;

/**
 * Compares two integer minor-unit amounts.
 *
 * @param {number} aMinor - First minor amount.
 * @param {number} bMinor - Second minor amount.
 * @throws {Error} If operands are not valid minor units.
 * @returns {-1|0|1} -1 if a < b, 0 if a === b, 1 if a > b.
 */
export function compare(aMinor, bMinor) {
  assertIntegerMinor(aMinor);
  assertIntegerMinor(bMinor);

  if (aMinor < bMinor) return -1;
  if (aMinor > bMinor) return 1;
  return 0;
}

/**
 * Alias for compare(aMinor, bMinor).
 */
export const compareMinor = compare;

/**
 * Default export object bundling all money math utilities.
 */
const MoneyMath = Object.freeze({
  assertIntegerMinor,
  toMinorUnits,
  toMajorUnits,
  add,
  addMinor,
  subtract,
  subtractMinor,
  sum,
  sumMinor,
  compare,
  compareMinor,
});

export default MoneyMath;
