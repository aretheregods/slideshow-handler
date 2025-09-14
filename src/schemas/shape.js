import { textboxSchema } from './textbox.js';
import { imageSchema } from './image.js';
import { geometrySchema } from './geometry.js';
import { tableSchema } from './table.js';
import { connectorSchema } from './connector.js';
import { fillSchema, borderSchema, shadowSchema, effectSchema, transform2DSchema, transform3DSchema } from './definitions.js';

/**
 * @typedef {import('./textbox.js').Textbox} Textbox
 * @typedef {import('./image.js').Image} Image
 * @typedef {import('./geometry.js').Geometry} Geometry
 * @typedef {import('./table.js').Table} Table
 * @typedef {import('./connector.js').Connector} Connector
 * @typedef {import('./definitions.js').Fill} Fill
 * @typedef {import('./definitions.js').Border} Border
 * @typedef {import('./definitions.js').Shadow} Shadow
 * @typedef {import('./definitions.js').Effect} Effect
 * @typedef {import('./definitions.js').Transform2D} Transform2D
 * @typedef {import('./definitions.js').Transform3D} Transform3D
 */

/**
 * @typedef {Object} BaseShape
 * @property {string} id - A unique identifier for the shape.
 * @property {number} x - The x-coordinate of the shape's top-left corner.
 * @property {number} y - The y-coordinate of the shape's top-left corner.
 * @property {number} width - The width of the shape.
 * @property {number} height - The height of the shape.
 * @property {Transform2D} [transform2D] - 2D transformations for the shape.
 * @property {Transform3D} [transform3D] - 3D transformations for the shape.
 * @property {Fill} [fill] - The fill of the shape.
 * @property {Border} [border] - The border of the shape.
 * @property {Shadow} [shadow] - The shadow of the shape.
 * @property {Effect[]} [effects] - An array of effects applied to the shape.
 */
const baseShapeSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        transform2D: { $ref: '#/definitions/transform2D' },
        transform3D: { $ref: '#/definitions/transform3D' },
        fill: { $ref: '#/definitions/fill' },
        border: { $ref: '#/definitions/border' },
        shadow: { $ref: '#/definitions/shadow' },
        effects: {
            type: 'array',
            items: { $ref: '#/definitions/effect' },
        },
    },
    required: ['id', 'x', 'y', 'width', 'height'],
};

/**
 * @typedef {BaseShape & (Textbox | Image | Geometry | Table | Connector)} Shape
 * @description A polymorphic schema for any shape on a slide.
 */
export const shapeSchema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "Shape",
    "description": "A shape on a slide.",
    "definitions": {
        textbox: textboxSchema,
        image: imageSchema,
        geometry: geometrySchema,
        table: tableSchema,
        connector: connectorSchema,
        fill: fillSchema,
        border: borderSchema,
        shadow: shadowSchema,
        effect: effectSchema,
        transform2D: transform2DSchema,
        transform3D: transform3DSchema,
    },
    "allOf": [
        baseShapeSchema,
        {
            "oneOf": [
                { "$ref": "#/definitions/textbox" },
                { "$ref": "#/definitions/image" },
                { "$ref": "#/definitions/geometry" },
                { "$ref": "#/definitions/table" },
                { "$ref": "#/definitions/connector" }
            ]
        }
    ]
};
