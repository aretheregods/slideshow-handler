import { describe, it, expect } from 'vitest';
import { integerToRoman } from './integerToRoman';

describe('integerToRoman', () => {
    it('should convert standard numbers', () => {
        expect(integerToRoman(1)).toBe('I');
        expect(integerToRoman(3)).toBe('III');
        expect(integerToRoman(5)).toBe('V');
        expect(integerToRoman(10)).toBe('X');
        expect(integerToRoman(50)).toBe('L');
        expect(integerToRoman(100)).toBe('C');
        expect(integerToRoman(500)).toBe('D');
        expect(integerToRoman(1000)).toBe('M');
    });

    it('should handle subtractive notation', () => {
        expect(integerToRoman(4)).toBe('IV');
        expect(integerToRoman(9)).toBe('IX');
        expect(integerToRoman(40)).toBe('XL');
        expect(integerToRoman(90)).toBe('XC');
        expect(integerToRoman(400)).toBe('CD');
        expect(integerToRoman(900)).toBe('CM');
    });

    it('should convert complex numbers', () => {
        expect(integerToRoman(58)).toBe('LVIII');
        expect(integerToRoman(1994)).toBe('MCMXCIV');
        expect(integerToRoman(2023)).toBe('MMXXIII');
        expect(integerToRoman(3999)).toBe('MMMCMXCIX');
    });

    it('should handle the largest standard Roman numeral mentioned in the plan', () => {
        expect(integerToRoman(3994)).toBe('MMMCMXCIV');
    });

    it('should handle edge cases gracefully', () => {
        expect(integerToRoman(0)).toBe('');
        expect(integerToRoman(-1)).toBe('');
        expect(integerToRoman(-10)).toBe('');
        expect(integerToRoman(4000)).toBe('MMMM');
    });

    it('should handle non-integer inputs gracefully', () => {
        // @ts-ignore
        expect(integerToRoman(1.5)).toBe('I');
        // @ts-ignore
        expect(integerToRoman('test')).toBe('');
        // @ts-ignore
        expect(integerToRoman(null)).toBe('');
        // @ts-ignore
        expect(integerToRoman(undefined)).toBe('');
    });
});
