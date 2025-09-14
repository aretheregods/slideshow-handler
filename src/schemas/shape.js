/**
 * @typedef {Object} Shape
 * @property {string} id
 * @property {'textbox' | 'image' | 'shape'} type
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {string} fillColor
 * @property {string} borderColor
 * @property {string} [content]
 * @property {string} [fontFamily]
 * @property {number} [fontSize]
 * @property {string} [fontColor]
 * @property {boolean} [bold]
 * @property {boolean} [italic]
 * @property {boolean} [underline]
 * @property {string} [alignment]
 * @property {string} [src]
 * @property {string} [altText]
 * @property {string} [shapeType]
 * @property {string | null} [text]
 */

const baseShapeSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', description: 'A unique identifier for the shape.' },
        type: { type: 'string', enum: ['textbox', 'image', 'shape'] },
        x: { type: 'number', description: 'The x-coordinate of the shape\'s top-left corner in inches.' },
        y: { type: 'number', description: 'The y-coordinate of the shape\'s top-left corner in inches.' },
        width: { type: 'number', description: 'The width of the shape in inches.' },
        height: { type: 'number', description: 'The height of the shape in inches.' },
        rotation: { type: 'number', description: 'The rotation angle in degrees.' },
        fillColor: { type: 'string', description: 'The background color of the shape in hex format.' },
        borderColor: { type: 'string', description: 'The border color of the shape in hex format.' },
    },
    required: ['id', 'type', 'x', 'y', 'width', 'height'],
};

const textboxSchema = {
    ...baseShapeSchema,
    properties: {
        ...baseShapeSchema.properties,
        type: { const: 'textbox' },
        content: { type: 'string' },
        fontFamily: { type: 'string' },
        fontSize: { type: 'number' },
        fontColor: { type: 'string' },
        bold: { type: 'boolean' },
        italic: { type: 'boolean' },
        underline: { type: 'boolean' },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
    },
    required: [...baseShapeSchema.required, 'content'],
};

const imageSchema = {
    ...baseShapeSchema,
    properties: {
        ...baseShapeSchema.properties,
        type: { const: 'image' },
        src: { type: 'string', description: 'The source of the image, as a base64-encoded string or a URL.' },
        altText: { type: 'string', description: 'Alternative text for the image.' },
    },
    required: [...baseShapeSchema.required, 'src'],
};

const shapeSchema = {
    ...baseShapeSchema,
    properties: {
        ...baseShapeSchema.properties,
        type: { const: 'shape' },
        shapeType: { type: 'string', enum: ['rectangle', 'oval', 'line'] },
        text: { type: ['string', 'null'] },
    },
    required: [...baseShapeSchema.required, 'shapeType'],
};

export const shapeDefinitions = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Shape',
    description: 'A shape on a slide.',
    oneOf: [
        textboxSchema,
        imageSchema,
        shapeSchema,
    ],
};
