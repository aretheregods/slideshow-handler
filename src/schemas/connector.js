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
 * @property {Object} [lineStyle] - The style of the connector line.
 * @property {string} [lineStyle.color] - The color of the line.
 * @property {number} [lineStyle.width] - The width of the line.
 * @property {'solid' | 'dashed' | 'dotted'} [lineStyle.style] - The style of the line.
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
    },
    properties: {
        type: { const: 'connector' },
        start: { $ref: '#/definitions/connection' },
        end: { $ref: '#/definitions/connection' },
        shape: { type: 'string', enum: ['straight', 'elbow', 'curved'] },
        lineStyle: {
            type: 'object',
            properties: {
                color: { type: 'string' },
                width: { type: 'number' },
                style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
            },
        },
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
