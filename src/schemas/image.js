import { shadowSchema, colorSchema, effectSchema } from './definitions.js';

/**
 * @typedef {import('./definitions.js').Shadow} Shadow
 * @typedef {import('./definitions.js').Color} Color
 * @typedef {import('./definitions.js').Effect} Effect
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
 * @property {number} [brightness] - The brightness of the image.
 * @property {number} [contrast] - The contrast of the image.
 * @property {Effect[]} [effects] - An array of effects applied to the image.
 */
export const imageSchema = {
    type: 'object',
    definitions: {
        shadow: shadowSchema,
        color: colorSchema,
        effect: effectSchema,
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
        brightness: { type: 'number', minimum: -1, maximum: 1 },
        contrast: { type: 'number', minimum: -1, maximum: 1 },
        effects: {
            type: 'array',
            items: { $ref: '#/definitions/effect' },
        },
    },
    required: ['type', 'src'],
};
