import { slideSchema } from './slide.js';

/**
 * @typedef {import('./slide.js').Slide} Slide
 */

/**
 * @typedef {Object} Presentation
 * @property {string} title
 * @property {string} author
 * @property {Object} themeSettings
 * @property {string} themeSettings.backgroundColor
 * @property {string} themeSettings.defaultFont
 * @property {Slide[]} slides
 */

export const presentationSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Presentation',
    description: 'The root object for a presentation.',
    type: 'object',
    definitions: {
        slide: slideSchema,
    },
    properties: {
        title: {
            type: 'string',
            description: 'The title of the presentation.',
        },
        author: {
            type: 'string',
            description: 'The author of the presentation.',
        },
        themeSettings: {
            type: 'object',
            properties: {
                backgroundColor: {
                    type: 'string',
                    description: 'The background color of the presentation in hex format.',
                },
                defaultFont: {
                    type: 'string',
                    description: 'The default font for the presentation.',
                },
            },
        },
        slides: {
            type: 'array',
            items: {
                $ref: '#/definitions/slide'
            }
        }
    },
    required: ['slides'],
};
