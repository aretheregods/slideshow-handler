/**
 * @class Matrix
 * @description Represents a 2D transformation matrix.
 */
export class Matrix {
    /**
     * Creates an instance of Matrix.
     * @param {number} [a=1] - The scaleX component.
     * @param {number} [b=0] - The skewY component.
     * @param {number} [c=0] - The skewX component.
     * @param {number} [d=1] - The scaleY component.
     * @param {number} [e=0] - The translateX component.
     * @param {number} [f=0] - The translateY component.
     */
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        this.m = [a, b, c, d, e, f];
    }

    /**
     * Creates a new Matrix with the same values as this one.
     * @returns {Matrix} A new Matrix instance.
     */
    clone() {
        return new Matrix(this.m[0], this.m[1], this.m[2], this.m[3], this.m[4], this.m[5]);
    }

    /**
     * Multiplies this matrix by another matrix.
     * @param {Matrix} matrix - The matrix to multiply by.
     * @returns {Matrix} This matrix after multiplication.
     */
    multiply(matrix) {
        const m1 = this.m;
        const m2 = matrix.m;
        const m = [
            m1[0] * m2[0] + m1[2] * m2[1],
            m1[1] * m2[0] + m1[3] * m2[1],
            m1[0] * m2[2] + m1[2] * m2[3],
            m1[1] * m2[2] + m1[3] * m2[3],
            m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
            m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
        ];
        this.m = m;
        return this;
    }

    /**
     * Applies a translation to this matrix.
     * @param {number} x - The translation in the x direction.
     * @param {number} y - The translation in the y direction.
     * @returns {Matrix} This matrix after translation.
     */
    translate(x, y) {
        this.multiply(new Matrix(1, 0, 0, 1, x, y));
        return this;
    }

    /**
     * Applies a rotation to this matrix.
     * @param {number} rad - The rotation angle in radians.
     * @returns {Matrix} This matrix after rotation.
     */
    rotate(rad) {
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        this.multiply(new Matrix(c, s, -s, c, 0, 0));
        return this;
    }

    /**
     * Applies a scaling transformation to this matrix.
     * @param {number} sx - The scaling factor in the x direction.
     * @param {number} sy - The scaling factor in the y direction.
     * @returns {Matrix} This matrix after scaling.
     */
    scale(sx, sy) {
        this.multiply(new Matrix(sx, 0, 0, sy, 0, 0));
        return this;
    }

    /**
     * Transforms a point by this matrix.
     * @param {number} x - The x-coordinate of the point.
     * @param {number} y - The y-coordinate of the point.
     * @returns {{x: number, y: number}} The transformed point.
     */
    transformPoint(x, y) {
        return {
            x: this.m[0] * x + this.m[2] * y + this.m[4],
            y: this.m[1] * x + this.m[3] * y + this.m[5],
        };
    }

    /**
     * Decomposes the matrix into its translation, rotation, and scale components.
     * @returns {{translation: {x: number, y: number}, rotation: number, scale: {x: number, y: number}}} The decomposed components.
     */
    decompose() {
        const m = this.m;
        const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];
        const det = a * d - b * c;
        const sx = Math.sqrt(a * a + b * b);
        const rotation = Math.atan2(b, a);

        return {
            translation: { x: e, y: f },
            rotation: rotation,
            scale: { x: sx, y: det / sx }
        };
    }
}
