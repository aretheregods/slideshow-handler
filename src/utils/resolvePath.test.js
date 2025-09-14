import { describe, it, expect } from 'vitest';
import { resolvePath } from './resolvePath.js';

describe('resolvePath', () => {
    it('should resolve a simple relative path', () => {
        expect(resolvePath('a/b', 'c/d')).toBe('a/b/c/d');
    });

    it('should handle single dot (.) in the path', () => {
        expect(resolvePath('a/b', './c')).toBe('a/b/c');
    });

    it('should handle double dots (..) to go up one level', () => {
        expect(resolvePath('a/b/c', '../d')).toBe('a/b/d');
    });

    it('should handle multiple double dots (..)', () => {
        expect(resolvePath('a/b/c/d', '../../e')).toBe('a/b/e');
    });

    it('should handle absolute paths (starting with /)', () => {
        expect(resolvePath('a/b', '/c/d')).toBe('c/d');
    });

    it('should handle a mix of single and double dots', () => {
        expect(resolvePath('a/b/c', './../d/./../e')).toBe('a/b/e');
    });

    it('should handle backslashes by converting them to forward slashes', () => {
        expect(resolvePath('a\\b', 'c\\d')).toBe('a/b/c/d');
    });

    it('should handle an empty target', () => {
        expect(resolvePath('a/b', '')).toBe('a/b');
    });

    it('should handle an empty base directory', () => {
        expect(resolvePath('', 'c/d')).toBe('c/d');
    });

    it('should not go above the root level', () => {
        expect(resolvePath('a/b', '../../../c')).toBe('c');
    });

    it('should handle complex paths', () => {
        expect(resolvePath('a/b/c/d', '../.././e/../f/g')).toBe('a/b/f/g');
    });
});
