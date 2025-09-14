import { paragraphSchema, colorSchema } from './definitions.js';

/**
 * @typedef {import('./definitions.js').Paragraph} Paragraph
 * @typedef {import('./definitions.js').Color} Color
 */

/**
 * @typedef {Object} Textbox
 * @property {'textbox'} type - The type of the shape.
 * @property {Paragraph[]} content - The paragraphs in the textbox.
 * @property {'top' | 'middle' | 'bottom'} [verticalAlign] - The vertical alignment of the text.
 * @property {Object} [padding] - The padding of the textbox.
 * @property {number} [padding.left] - The left padding.
 * @property {number} [padding.right] - The right padding.
 * @property {number} [padding.top] - The top padding.
 * @property {number} [padding.bottom] - The bottom padding.
 * @property {'none' | 'fit' | 'shrink'} [textFit] - The text fitting behavior.
 * @property {number} [columns] - The number of columns for the text.
 * @property {number} [columnSpacing] - The spacing between columns.
 */
export const textboxSchema = {
    type: 'object',
    definitions: {
        paragraph: paragraphSchema,
        color: colorSchema,
    },
    properties: {
        type: { const: 'textbox' },
        content: {
            type: 'array',
            items: { $ref: '#/definitions/paragraph' },
        },
        verticalAlign: { type: 'string', enum: ['top', 'middle', 'bottom'] },
        padding: {
            type: 'object',
            properties: {
                left: { type: 'number' },
                right: { type: 'number' },
                top: { type: 'number' },
                bottom: { type: 'number' },
            },
        },
        textFit: { type: 'string', enum: ['none', 'fit', 'shrink'] },
        columns: { type: 'number' },
        columnSpacing: { type: 'number' },
    },
    required: ['type', 'content'],
};
