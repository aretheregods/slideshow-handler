import { textboxSchema } from './textbox.js';
import { imageSchema } from './image.js';
import { geometrySchema } from './geometry.js';
import { tableSchema } from './table.js';
import { connectorSchema } from './connector.js';
import { fillSchema, borderSchema, shadowSchema } from './definitions.js';

/**
 * @typedef {import('./textbox.js').Textbox} Textbox
 * @typedef {import('./image.js').Image} Image
 * @typedef {import('./geometry.js').Geometry} Geometry
 * @typedef {import('./table.js').Table} Table
 * @typedef {import('./connector.js').Connector} Connector
 * @typedef {import('./definitions.js').Fill} Fill
 * @typedef {import('./definitions.js').Border} Border
 * @typedef {import('./definitions.js').Shadow} Shadow
 */

/**
 * @typedef {Object} BaseShape
 * @property {string} id - A unique identifier for the shape.
 * @property {number} x - The x-coordinate of the shape's top-left corner.
 * @property {number} y - The y-coordinate of the shape's top-left corner.
 * @property {number} width - The width of the shape.
 * @property {number} height - The height of the shape.
 * @property {number} [rotation] - The rotation angle in degrees.
 * @property {Fill} [fill] - The fill of the shape.
 * @property {Border} [border] - The border of the shape.
 * @property {Shadow} [shadow] - The shadow of the shape.
 */
const baseShapeSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        rotation: { type: 'number' },
        fill: { $ref: '#/definitions/fill' },
        border: { $ref: '#/definitions/border' },
        shadow: { $ref: '#/definitions/shadow' },
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
