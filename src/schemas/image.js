import { shadowSchema, colorSchema } from './definitions.js';

/**
 * @typedef {import('./definitions.js').Shadow} Shadow
 * @typedef {import('./definitions.js').Color} Color
 */

/**
 * @typedef {Object} Image
 * @property {'image'} type - The type of the shape.
 * @property {string} src - The source URL of the image.
 * @property {string} [altText] - The alternative text for the image.
 * @property {Object} [crop] - The cropping information for the image.
 * @property {number} [crop.left] - The left crop percentage.
 * @property {number} [crop.right] - The right crop percentage.
 * @property {number} [crop.top] - The top crop percentage.
 * @property {number} [crop.bottom] - The bottom crop percentage.
 * @property {Shadow} [shadow] - The shadow effect for the image.
 * @property {Object} [reflection] - The reflection effect for the image.
 * @property {number} [reflection.distance] - The distance of the reflection.
 * @property {number} [reflection.blur] - The blur of the reflection.
 * @property {number} [reflection.opacity] - The opacity of the reflection.
 */
export const imageSchema = {
    type: 'object',
    definitions: {
        shadow: shadowSchema,
        color: colorSchema,
    },
    properties: {
        type: { const: 'image' },
        src: { type: 'string', format: 'uri' },
        altText: { type: 'string' },
        crop: {
            type: 'object',
            properties: {
                left: { type: 'number', minimum: 0, maximum: 1 },
                right: { type: 'number', minimum: 0, maximum: 1 },
                top: { type: 'number', minimum: 0, maximum: 1 },
                bottom: { type: 'number', minimum: 0, maximum: 1 },
            },
        },
        shadow: { $ref: '#/definitions/shadow' },
        reflection: {
            type: 'object',
            properties: {
                distance: { type: 'number' },
                blur: { type: 'number' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
            },
        },
    },
    required: ['type', 'src'],
};
