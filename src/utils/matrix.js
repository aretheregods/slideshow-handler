export class Matrix {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        this.m = [a, b, c, d, e, f];
    }

    clone() {
        return new Matrix(this.m[0], this.m[1], this.m[2], this.m[3], this.m[4], this.m[5]);
    }

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

    translate(x, y) {
        this.multiply(new Matrix(1, 0, 0, 1, x, y));
        return this;
    }

    rotate(rad) {
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        this.multiply(new Matrix(c, s, -s, c, 0, 0));
        return this;
    }

    scale(sx, sy) {
        this.multiply(new Matrix(sx, 0, 0, sy, 0, 0));
        return this;
    }

    transformPoint(x, y) {
        return {
            x: this.m[0] * x + this.m[2] * y + this.m[4],
            y: this.m[1] * x + this.m[3] * y + this.m[5],
        };
    }

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
