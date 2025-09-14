import { borderSchema } from './definitions.js';

/**
 * @typedef {import('./definitions.js').Border} Border
 */

/**
 * @typedef {Object} Connection
 * @property {string} shapeId - The ID of the shape to connect to.
 * @property {number} connectionPoint - The connection point index on the shape.
 */
export const connectionSchema = {
    type: 'object',
    properties: {
        shapeId: { type: 'string' },
        connectionPoint: { type: 'integer' },
    },
    required: ['shapeId', 'connectionPoint'],
};

/**
 * @typedef {Object} Connector
 * @property {'connector'} type - The type of the shape.
 * @property {Connection} start - The start connection.
 * @property {Connection} end - The end connection.
 * @property {'straight' | 'elbow' | 'curved'} shape - The shape of the connector.
 * @property {Border} [lineStyle] - The style of the connector line.
 * @property {Object} [startArrow] - The style of the start arrow.
 * @property {'none' | 'triangle' | 'stealth' | 'diamond' | 'oval'} [startArrow.type] - The type of the arrow head.
 * @property {'small' | 'medium' | 'large'} [startArrow.size] - The size of the arrow head.
 * @property {Object} [endArrow] - The style of the end arrow.
 * @property {'none' | 'triangle' | 'stealth' | 'diamond' | 'oval'} [endArrow.type] - The type of the arrow head.
 * @property {'small' | 'medium' | 'large'} [endArrow.size] - The size of the arrow head.
 */
export const connectorSchema = {
    type: 'object',
    definitions: {
        connection: connectionSchema,
        border: borderSchema,
    },
    properties: {
        type: { const: 'connector' },
        start: { $ref: '#/definitions/connection' },
        end: { $ref: '#/definitions/connection' },
        shape: { type: 'string', enum: ['straight', 'elbow', 'curved'] },
        lineStyle: { $ref: '#/definitions/border' },
        startArrow: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['none', 'triangle', 'stealth', 'diamond', 'oval'] },
                size: { type: 'string', enum: ['small', 'medium', 'large'] },
            },
        },
        endArrow: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['none', 'triangle', 'stealth', 'diamond', 'oval'] },
                size: { type: 'string', enum: ['small', 'medium', 'large'] },
            },
        },
    },
    required: ['type', 'start', 'end', 'shape'],
};
