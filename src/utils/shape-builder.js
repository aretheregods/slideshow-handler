import Konva from 'konva';
import * as Matrix from './matrix.js';

// --- Type Definitions (JSDoc) ---

/**
 * @typedef {import('./matrix.js').Matrix} Matrix
 * @typedef {import('./matrix.js').Point} Point
 * @typedef {import('konva/lib/Node').Node} KonvaNode
 * @typedef {import('konva/lib/shapes/Group').Group} KonvaGroup
 * @typedef {import('konva/lib/shapes/Line').Line} KonvaLine
 * @typedef {import('konva/lib/shapes/Text').Text} KonvaText
 * @typedef {import('konva/lib/shapes/Rect').Rect} KonvaRect
 */

/**
 * @enum {string}
 */
export const ShapeType = {
  Group: 'group',
  Line: 'line',
  Text: 'text',
  Rect: 'rect',
  Ellipse: 'ellipse',
};

/**
 * @typedef {object} Transform
 * @property {number} [x=0]
 * @property {number} [y=0]
 * @property {number} [rot=0]
 * @property {boolean} [flipV=false]
 * @property {boolean} [flipH=false]
 */

/**
 * @typedef {object} Geometry
 * @property {number} [w=0]
 * @property {number} [h=0]
 */

/**
 * @typedef {object} Stroke
 * @property {string} [color]
 * @property {number} [width]
 */

/**
 * @typedef {object} ShapeStyle
 * @property {Stroke} [stroke]
 * @property {string} [fill]
 */

/**
 * @typedef {object} TextStyle
 * @property {string} [fontFamily]
 * @property {number} [fontSize]
 * @property {string} [color]
 * @property {boolean} [bold]
 * @property {boolean} [italic]
 */

/**
 * @typedef {object} Bullet
 * @property {string} char
 * @property {TextStyle} [style]
 */

/**
 * @typedef {object} Paragraph
 * @property {string} text
 * @property {TextStyle} [style]
 * @property {Bullet} [bullet]
 */

/**
 * @typedef {object} BaseShape
 * @property {ShapeType} type
 * @property {Transform} transform
 * @property {Geometry} geometry
 * @property {ShapeStyle} [style]
 */

/**
 * @typedef {BaseShape & { type: 'group', shapes: Shape[] }} GroupShape
 */

/**
 * @typedef {BaseShape & { type: 'line', points: Point[] }} LineShape
 */

/**
 * @typedef {BaseShape & { type: 'text', paragraphs: Paragraph[] }} TextShape
 */

/**
 * @typedef {GroupShape | LineShape | TextShape | BaseShape} Shape
 */


// --- Transformation Logic ---

/**
 * Decomposes a matrix into components that can be used by Konva.
 * @param {Matrix} matrix
 * @returns {{x: number, y: number, rotation: number, scaleX: number, scaleY: number}}
 */
function decompose(matrix) {
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

/**
 * Calculates the local transformation matrix for a shape.
 * @param {Transform} transform
 * @param {Geometry} geometry
 * @returns {Matrix}
 */
function getTransformationMatrix(transform, geometry) {
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

/**
 * Creates a Konva shape from a shape definition.
 * @param {Shape} shape
 * @param {Matrix} parentMatrix
 * @returns {KonvaNode}
 */
function createKonvaShape(shape, parentMatrix) {
  const localMatrix = getTransformationMatrix(shape.transform, shape.geometry);
  const finalMatrix = Matrix.multiply(parentMatrix, localMatrix);

  if (shape.type === ShapeType.Group) {
    const groupNode = new Konva.Group();
    shape.shapes.forEach(childShape => {
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
        points: shape.points.flatMap(p => [p.x, p.y]),
        stroke: shape.style?.stroke?.color || 'black',
        strokeWidth: shape.style?.stroke?.width || 1,
        strokeScaleEnabled: false,
      });

    case ShapeType.Text:
      const textBoxGroup = new Konva.Group(baseConfig);
      let currentY = 0;

      shape.paragraphs.forEach(p => {
        const paraGroup = new Konva.Group({ y: currentY });
        const fontSize = p.style?.fontSize || 12;
        const bulletIndent = 20;

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

/**
 * Builds an array of Konva shapes from shape definitions.
 * @param {Shape[]} shapes
 * @returns {KonvaNode[]}
 */
export function buildShapes(shapes) {
  const identityMatrix = Matrix.identity();
  return shapes.map(shape => createKonvaShape(shape, identityMatrix));
}
