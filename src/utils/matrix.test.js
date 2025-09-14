import { describe, it, expect } from 'vitest';
import { Matrix } from './matrix';

describe('Matrix', () => {
    describe('constructor', () => {
        it('should create an identity matrix if no arguments are passed', () => {
            const matrix = new Matrix();
            expect(matrix.m).toEqual([1, 0, 0, 1, 0, 0]);
        });

        it('should create a matrix with the given arguments', () => {
            const matrix = new Matrix(1, 2, 3, 4, 5, 6);
            expect(matrix.m).toEqual([1, 2, 3, 4, 5, 6]);
        });
    });

    describe('clone', () => {
        it('should return a new Matrix instance', () => {
            const matrix = new Matrix();
            const clone = matrix.clone();
            expect(clone).toBeInstanceOf(Matrix);
        });

        it('should have the same values as the original matrix', () => {
            const matrix = new Matrix(1, 2, 3, 4, 5, 6);
            const clone = matrix.clone();
            expect(clone.m).toEqual([1, 2, 3, 4, 5, 6]);
        });

        it('should be a different instance from the original matrix', () => {
            const matrix = new Matrix();
            const clone = matrix.clone();
            expect(clone).not.toBe(matrix);
        });
    });

    describe('multiply', () => {
        it('should not change the matrix when multiplying by an identity matrix', () => {
            const matrix = new Matrix(1, 2, 3, 4, 5, 6);
            const identity = new Matrix();
            matrix.multiply(identity);
            expect(matrix.m).toEqual([1, 2, 3, 4, 5, 6]);
        });

        it('should correctly multiply by a translation matrix', () => {
            const matrix = new Matrix();
            const translation = new Matrix(1, 0, 0, 1, 10, 20);
            matrix.multiply(translation);
            expect(matrix.m).toEqual([1, 0, 0, 1, 10, 20]);
        });

        it('should correctly multiply by a rotation matrix', () => {
            const matrix = new Matrix();
            const rad = Math.PI / 2;
            const c = Math.cos(rad);
            const s = Math.sin(rad);
            const rotation = new Matrix(c, s, -s, c, 0, 0);
            matrix.multiply(rotation);
            expect(matrix.m[0]).toBeCloseTo(0);
            expect(matrix.m[1]).toBeCloseTo(1);
            expect(matrix.m[2]).toBeCloseTo(-1);
            expect(matrix.m[3]).toBeCloseTo(0);
            expect(matrix.m[4]).toBeCloseTo(0);
            expect(matrix.m[5]).toBeCloseTo(0);
        });

        it('should correctly multiply by a scaling matrix', () => {
            const matrix = new Matrix();
            const scaling = new Matrix(2, 0, 0, 3, 0, 0);
            matrix.multiply(scaling);
            expect(matrix.m).toEqual([2, 0, 0, 3, 0, 0]);
        });

        it('should correctly multiply a combination of transformations', () => {
            const matrix = new Matrix();
            matrix.translate(10, 20);
            matrix.rotate(Math.PI / 2);
            matrix.scale(2, 3);

            const expected = new Matrix().translate(10, 20).rotate(Math.PI / 2).scale(2,3)

            matrix.m.forEach((val, i) => {
                expect(val).toBeCloseTo(expected.m[i]);
            })
        });
    });

    describe('translate', () => {
        it('should correctly translate with positive values', () => {
            const matrix = new Matrix();
            matrix.translate(10, 20);
            expect(matrix.m).toEqual([1, 0, 0, 1, 10, 20]);
        });

        it('should correctly translate with negative values', () => {
            const matrix = new Matrix();
            matrix.translate(-10, -20);
            expect(matrix.m).toEqual([1, 0, 0, 1, -10, -20]);
        });

        it('should not translate with zero values', () => {
            const matrix = new Matrix();
            matrix.translate(0, 0);
            expect(matrix.m).toEqual([1, 0, 0, 1, 0, 0]);
        });
    });

    describe('rotate', () => {
        it('should correctly rotate with a positive angle', () => {
            const matrix = new Matrix();
            const rad = Math.PI / 2;
            matrix.rotate(rad);
            expect(matrix.m[0]).toBeCloseTo(Math.cos(rad));
            expect(matrix.m[1]).toBeCloseTo(Math.sin(rad));
            expect(matrix.m[2]).toBeCloseTo(-Math.sin(rad));
            expect(matrix.m[3]).toBeCloseTo(Math.cos(rad));
        });

        it('should correctly rotate with a negative angle', () => {
            const matrix = new Matrix();
            const rad = -Math.PI / 2;
            matrix.rotate(rad);
            expect(matrix.m[0]).toBeCloseTo(Math.cos(rad));
            expect(matrix.m[1]).toBeCloseTo(Math.sin(rad));
            expect(matrix.m[2]).toBeCloseTo(-Math.sin(rad));
            expect(matrix.m[3]).toBeCloseTo(Math.cos(rad));
        });

        it('should not rotate with a zero angle', () => {
            const matrix = new Matrix();
            matrix.rotate(0);
            expect(matrix.m).toEqual([1, 0, 0, 1, 0, 0]);
        });

        it('should correctly rotate by 90 degrees', () => {
            const matrix = new Matrix();
            matrix.rotate(Math.PI / 2);
            expect(matrix.m[0]).toBeCloseTo(0);
            expect(matrix.m[1]).toBeCloseTo(1);
            expect(matrix.m[2]).toBeCloseTo(-1);
            expect(matrix.m[3]).toBeCloseTo(0);
        });

        it('should correctly rotate by 180 degrees', () => {
            const matrix = new Matrix();
            matrix.rotate(Math.PI);
            expect(matrix.m[0]).toBeCloseTo(-1);
            expect(matrix.m[1]).toBeCloseTo(0);
            expect(matrix.m[2]).toBeCloseTo(0);
            expect(matrix.m[3]).toBeCloseTo(-1);
        });
    });

    describe('scale', () => {
        it('should correctly scale with values greater than 1', () => {
            const matrix = new Matrix();
            matrix.scale(2, 3);
            expect(matrix.m).toEqual([2, 0, 0, 3, 0, 0]);
        });

        it('should correctly scale with values between 0 and 1', () => {
            const matrix = new Matrix();
            matrix.scale(0.5, 0.25);
            expect(matrix.m).toEqual([0.5, 0, 0, 0.25, 0, 0]);
        });

        it('should correctly scale with negative values (reflection)', () => {
            const matrix = new Matrix();
            matrix.scale(-1, 1);
            expect(matrix.m).toEqual([-1, 0, 0, 1, 0, 0]);
        });

        it('should correctly scale with one value being 1', () => {
            const matrix = new Matrix();
            matrix.scale(1, 2);
            expect(matrix.m).toEqual([1, 0, 0, 2, 0, 0]);
        });
    });

    describe('transformPoint', () => {
        it('should not change the point with an identity matrix', () => {
            const matrix = new Matrix();
            const point = matrix.transformPoint(10, 20);
            expect(point).toEqual({ x: 10, y: 20 });
        });

        it('should correctly transform a point with a translation matrix', () => {
            const matrix = new Matrix().translate(10, 20);
            const point = matrix.transformPoint(5, 5);
            expect(point).toEqual({ x: 15, y: 25 });
        });

        it('should correctly transform a point with a rotation matrix', () => {
            const matrix = new Matrix().rotate(Math.PI / 2);
            const point = matrix.transformPoint(10, 0);
            expect(point.x).toBeCloseTo(0);
            expect(point.y).toBeCloseTo(10);
        });

        it('should correctly transform a point with a scaling matrix', () => {
            const matrix = new Matrix().scale(2, 3);
            const point = matrix.transformPoint(10, 10);
            expect(point).toEqual({ x: 20, y: 30 });
        });

        it('should correctly transform a point with a combination of transformations', () => {
            const matrix = new Matrix().translate(10, 20).rotate(Math.PI).scale(2, 2);
            const point = matrix.transformPoint(5, 5);
            expect(point.x).toBeCloseTo(0);
            expect(point.y).toBeCloseTo(10);
        });
    });

    describe('decompose', () => {
        it('should correctly decompose an identity matrix', () => {
            const matrix = new Matrix();
            const decomposed = matrix.decompose();
            expect(decomposed.translation).toEqual({ x: 0, y: 0 });
            expect(decomposed.rotation).toBeCloseTo(0);
            expect(decomposed.scale).toEqual({ x: 1, y: 1 });
        });

        it('should correctly decompose a translation matrix', () => {
            const matrix = new Matrix().translate(10, 20);
            const decomposed = matrix.decompose();
            expect(decomposed.translation).toEqual({ x: 10, y: 20 });
            expect(decomposed.rotation).toBeCloseTo(0);
            expect(decomposed.scale).toEqual({ x: 1, y: 1 });
        });

        it('should correctly decompose a rotation matrix', () => {
            const matrix = new Matrix().rotate(Math.PI / 2);
            const decomposed = matrix.decompose();
            expect(decomposed.translation).toEqual({ x: 0, y: 0 });
            expect(decomposed.rotation).toBeCloseTo(Math.PI / 2);
            expect(decomposed.scale.x).toBeCloseTo(1);
            expect(decomposed.scale.y).toBeCloseTo(1);
        });

        it('should correctly decompose a scaling matrix', () => {
            const matrix = new Matrix().scale(2, 3);
            const decomposed = matrix.decompose();
            expect(decomposed.translation).toEqual({ x: 0, y: 0 });
            expect(decomposed.rotation).toBeCloseTo(0);
            expect(decomposed.scale).toEqual({ x: 2, y: 3 });
        });

        it('should correctly decompose a combination of transformations', () => {
            const matrix = new Matrix().translate(10, 20).rotate(Math.PI / 4).scale(2, 3);
            const decomposed = matrix.decompose();
            expect(decomposed.translation).toEqual({ x: 10, y: 20 });
            expect(decomposed.rotation).toBeCloseTo(Math.PI / 4);
            expect(decomposed.scale.x).toBeCloseTo(2);
            expect(decomposed.scale.y).toBeCloseTo(3);
        });
    });
});
