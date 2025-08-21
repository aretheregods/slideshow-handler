/**
 * @typedef {[[number, number, number], [number, number, number], [number, number, number]]} Matrix
 */

/**
 * @typedef {{x: number, y: number}} Point
 */

/**
 * Returns an identity matrix.
 * @returns {Matrix}
 */
export const identity = () => [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

/**
 * Multiplies two matrices.
 * @param {Matrix} A
 * @param {Matrix} B
 * @returns {Matrix}
 */
export const multiply = (A, B) => {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
};

/**
 * Creates a translation matrix.
 * @param {number} tx
 * @param {number} ty
 * @returns {Matrix}
 */
export const translate = (tx, ty) => [
  [1, 0, tx],
  [0, 1, ty],
  [0, 0, 1]
];

/**
 * Creates a rotation matrix.
 * @param {number} angle - The rotation angle in degrees.
 * @returns {Matrix}
 */
export const rotate = (angle) => {
  const rad = angle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [cos, -sin, 0],
    [sin, cos, 0],
    [0, 0, 1]
  ];
};

/**
 * Creates a scale matrix.
 * @param {number} sx
 * @param {number} sy
 * @returns {Matrix}
 */
export const scale = (sx, sy) => [
  [sx, 0, 0],
  [0, sy, 0],
  [0, 0, 1]
];

/**
 * Transforms a point by a matrix.
 * @param {Point} p
 * @param {Matrix} m
 * @returns {Point}
 */
export const transformPoint = (p, m) => {
    return {
        x: m[0][0] * p.x + m[0][1] * p.y + m[0][2],
        y: m[1][0] * p.x + m[1][1] * p.y + m[1][2],
    }
}
