export type Matrix = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

export const identity = (): Matrix => [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

export const multiply = (A: Matrix, B: Matrix): Matrix => {
  const C: Matrix = [
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

export const translate = (tx: number, ty: number): Matrix => [
  [1, 0, tx],
  [0, 1, ty],
  [0, 0, 1]
];

export const rotate = (angle: number): Matrix => {
  const rad = angle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [cos, -sin, 0],
    [sin, cos, 0],
    [0, 0, 1]
  ];
};

export const scale = (sx: number, sy: number): Matrix => [
  [sx, 0, 0],
  [0, sy, 0],
  [0, 0, 1]
];

export const transformPoint = (p: { x: number; y: number }, m: Matrix) => {
    return {
        x: m[0][0] * p.x + m[0][1] * p.y + m[0][2],
        y: m[1][0] * p.x + m[1][1] * p.y + m[1][2],
    }
}
