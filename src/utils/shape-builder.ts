import Konva from 'konva';
import * as Matrix from './matrix';

// --- Type Definitions ---
// Since src/types/shape.ts does not exist, defining types here.

export enum ShapeType {
  Group = 'group',
  Line = 'line',
  Text = 'text',
  Rect = 'rect',
  Ellipse = 'ellipse',
}

export interface Transform {
  x?: number;
  y?: number;
  rot?: number;
  flipV?: boolean;
  flipH?: boolean;
}

export interface Geometry {
  w?: number;
  h?: number;
}

export interface Stroke {
    color?: string;
    width?: number;
}

export interface ShapeStyle {
    stroke?: Stroke;
    fill?: string;
}

export interface Bullet {
    char: string;
    style?: TextStyle;
}

export interface Paragraph {
    text: string;
    style?: TextStyle;
    bullet?: Bullet;
}

export interface TextStyle {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
}

export interface BaseShape {
  type: ShapeType;
  transform: Transform;
  geometry: Geometry;
  style?: ShapeStyle;
}

export interface GroupShape extends BaseShape {
  type: ShapeType.Group;
  shapes: Shape[];
}

export interface LineShape extends BaseShape {
  type: ShapeType.Line;
  points: { x: number; y: number }[];
}

export interface TextShape extends BaseShape {
  type: ShapeType.Text;
  paragraphs: Paragraph[];
}

export type Shape = GroupShape | LineShape | TextShape | BaseShape;


// --- Transformation Logic ---

function decompose(matrix: Matrix.Matrix) {
  const a = matrix[0][0], b = matrix[0][1], c = matrix[0][2];
  const d = matrix[1][0], e = matrix[1][1], f = matrix[1][2];
  const tx = c, ty = f;
  const scaleX = Math.sqrt(a * a + d * d);
  const rotationRad = Math.atan2(d, a);
  const rotationDeg = rotationRad * (180 / Math.PI);
  const det = a * e - b * d;
  const scaleY = det / scaleX;
  return { x: tx, y: ty, rotation: rotationDeg, scaleX, scaleY };
}

function getTransformationMatrix(transform: Transform, geometry: Geometry): Matrix.Matrix {
  const { x = 0, y = 0, rot = 0, flipV = false, flipH = false } = transform;
  const { w = 0, h = 0 } = geometry;
  const centerX = w / 2, centerY = h / 2;

  let m = Matrix.translate(x, y);
  const centerTransform = [
    Matrix.translate(centerX, centerY),
    Matrix.rotate(rot),
    Matrix.scale(flipH ? -1 : 1, flipV ? -1 : 1),
    Matrix.translate(-centerX, -centerY),
  ].reduce(Matrix.multiply);
  m = Matrix.multiply(m, centerTransform);
  return m;
}


// --- Shape Creation Logic ---

function createKonvaShape(shape: Shape, parentMatrix: Matrix.Matrix): Konva.Node {
  const localMatrix = getTransformationMatrix(shape.transform, shape.geometry);
  const finalMatrix = Matrix.multiply(parentMatrix, localMatrix);

  if (shape.type === ShapeType.Group) {
    const groupNode = new Konva.Group();
    (shape as GroupShape).shapes.forEach(childShape => {
      groupNode.add(createKonvaShape(childShape, finalMatrix));
    });
    return groupNode;
  }

  const decomposed = decompose(finalMatrix);
  const baseConfig = {
    ...decomposed,
    width: shape.geometry.w,
    height: shape.geometry.h,
  };

  switch (shape.type) {
    case ShapeType.Line:
      return new Konva.Line({
        ...baseConfig,
        points: (shape as LineShape).points.flatMap(p => [p.x, p.y]),
        stroke: (shape as LineShape).style?.stroke?.color || 'black',
        strokeWidth: (shape as LineShape).style?.stroke?.width || 1,
        strokeScaleEnabled: false,
      });

    case ShapeType.Text:
      const textShape = shape as TextShape;
      const textBoxGroup = new Konva.Group(baseConfig);
      let currentY = 0;

      textShape.paragraphs.forEach(p => {
        const paraGroup = new Konva.Group({ y: currentY });
        const fontSize = p.style?.fontSize || 12;
        const bulletIndent = 20;
        const lineHeight = fontSize * 1.2;

        if (p.bullet) {
          const bulletNode = new Konva.Text({
            text: p.bullet.char,
            fontSize: p.bullet.style?.fontSize || fontSize,
            fontFamily: p.bullet.style?.fontFamily || p.style?.fontFamily || 'Arial',
            fill: p.bullet.style?.color || p.style?.color || 'black',
            x: 0,
            y: 0,
          });
          paraGroup.add(bulletNode);
        }

        const textNode = new Konva.Text({
          text: p.text,
          fontSize: fontSize,
          fontFamily: p.style?.fontFamily || 'Arial',
          fill: p.style?.color || 'black',
          x: p.bullet ? bulletIndent : 0,
          y: 0,
          width: (shape.geometry.w || 200) - (p.bullet ? bulletIndent : 0),
          wrap: 'word',
        });
        paraGroup.add(textNode);
        textBoxGroup.add(paraGroup);

        // Use textNode's height for more accurate line positioning
        currentY += textNode.height();
      });
      return textBoxGroup;

    default:
      return new Konva.Rect({
        ...baseConfig,
        fill: shape.style?.fill || 'grey',
        stroke: shape.style?.stroke?.color,
        strokeWidth: shape.style?.stroke?.width,
        opacity: 0.8,
      });
  }
}

export function buildShapes(shapes: Shape[]): Konva.Node[] {
  const identityMatrix = Matrix.identity();
  return shapes.map(shape => createKonvaShape(shape, identityMatrix));
}
