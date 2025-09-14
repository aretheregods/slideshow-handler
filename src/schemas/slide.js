import { shapeDefinitions } from './shape.js';

/**
 * @typedef {import('./shape.js').Shape} Shape
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {number} slideNumber
 * @property {string} notes
 * @property {Shape[]} shapes
 */

export const slideSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Slide',
    description: 'A single slide in a presentation.',
    type: 'object',
    definitions: {
        shape: shapeDefinitions,
    },
    properties: {
        id: {
            type: 'string',
            description: 'A unique identifier for the slide.',
        },
        slideNumber: {
            type: 'integer',
            description: 'The number of the slide.',
        },
        notes: {
            type: 'string',
            description: 'Speaker notes for the slide.',
        },
        shapes: {
            type: 'array',
            items: {
                $ref: '#/definitions/shape'
            }
        }
    },
    required: ['id', 'slideNumber', 'shapes'],
};
