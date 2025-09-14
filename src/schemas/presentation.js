import { slideSchema } from './slide.js';
import { colorSchema } from './definitions.js';

/**
 * @typedef {import('./slide.js').Slide} Slide
 * @typedef {import('./definitions.js').Color} Color
 */

/**
 * @typedef {Object} Theme
 * @property {string} name - The name of the theme.
 * @property {Object} fontScheme - The font scheme of the theme.
 * @property {string} fontScheme.major - The major font.
 * @property {string} fontScheme.minor - The minor font.
 * @property {Object} colorScheme - The color scheme of the theme.
 * @property {Color} colorScheme.accent1 - Accent color 1.
 * @property {Color} colorScheme.accent2 - Accent color 2.
 * @property {Color} colorScheme.accent3 - Accent color 3.
 * @property {Color} colorScheme.accent4 - Accent color 4.
 * @property {Color} colorScheme.accent5 - Accent color 5.
 * @property {Color} colorScheme.accent6 - Accent color 6.
 * @property {Color} colorScheme.hyperlink - Hyperlink color.
 * @property {Color} colorScheme.followedHyperlink - Followed hyperlink color.
 */
const themeSchema = {
    type: 'object',
    definitions: {
        color: colorSchema,
    },
    properties: {
        name: { type: 'string' },
        fontScheme: {
            type: 'object',
            properties: {
                major: { type: 'string' },
                minor: { type: 'string' },
            },
        },
        colorScheme: {
            type: 'object',
            properties: {
                accent1: { $ref: '#/definitions/color' },
                accent2: { $ref: '#/definitions/color' },
                accent3: { $ref: '#/definitions/color' },
                accent4: { $ref: '#/definitions/color' },
                accent5: { $ref: '#/definitions/color' },
                accent6: { $ref: '#/definitions/color' },
                hyperlink: { $ref: '#/definitions/color' },
                followedHyperlink: { $ref: '#/definitions/color' },
            },
        },
    },
};

/**
 * @typedef {Object} Presentation
 * @property {string} title
 * @property {string} author
 * @property {Theme} theme
 * @property {Slide[]} slides
 */
export const presentationSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Presentation",
  "description": "The root object for a presentation.",
  "type": "object",
  "definitions": {
    "slide": slideSchema,
    "theme": themeSchema
  },
  "properties": {
    "title": { "type": "string" },
    "author": { "type": "string" },
    "theme": { "$ref": "#/definitions/theme" },
    "slides": {
      "type": "array",
      "items": { "$ref": "#/definitions/slide" }
    }
  },
  "required": ["slides"]
}
