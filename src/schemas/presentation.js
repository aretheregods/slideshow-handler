import { slideSchema } from './slide.js';
import { shapeSchema } from './shape.js';
import { fillSchema, colorSchema, effectSchema } from './definitions.js';

/**
 * @typedef {import('./slide.js').Slide} Slide
 * @typedef {import('./shape.js').Shape} Shape
 * @typedef {import('./definitions.js').Color} Color
 * @typedef {import('./definitions.js').Fill} Fill
 * @typedef {import('./definitions.js').Effect} Effect
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
 * @property {Object} effectScheme - The effect scheme of the theme.
 */
const themeSchema = {
    type: 'object',
    definitions: {
        color: colorSchema,
        effect: effectSchema,
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
        effectScheme: {
            type: 'array',
            items: { $ref: '#/definitions/effect' },
        }
    },
};

/**
 * @typedef {Object} SlideLayout
 * @property {string} name - The name of the layout.
 * @property {Shape[]} shapes - The shapes in the layout.
 * @property {Object} [background] - The background of the layout.
 * @property {Fill} [background.fill] - The fill of the background.
 */
const slideLayoutSchema = {
    type: 'object',
    definitions: {
        shape: shapeSchema,
        fill: fillSchema,
    },
    properties: {
        name: { type: 'string' },
        shapes: {
            type: 'array',
            items: { $ref: '#/definitions/shape' },
        },
        background: {
            type: 'object',
            properties: {
                fill: { $ref: '#/definitions/fill' },
            },
        },
    },
    required: ['name', 'shapes'],
};

/**
 * @typedef {Object} SlideMaster
 * @property {string} name - The name of the master.
 * @property {SlideLayout[]} slideLayouts - The slide layouts for this master.
 * @property {Object} [background] - The background of the master.
 * @property {Fill} [background.fill] - The fill of the background.
 */
const slideMasterSchema = {
    type: 'object',
    definitions: {
        slideLayout: slideLayoutSchema,
        fill: fillSchema,
    },
    properties: {
        name: { type: 'string' },
        slideLayouts: {
            type: 'array',
            items: { $ref: '#/definitions/slideLayout' },
        },
        background: {
            type: 'object',
            properties: {
                fill: { $ref: '#/definitions/fill' },
            },
        },
    },
    required: ['name', 'slideLayouts'],
};


/**
 * @typedef {Object} Presentation
 * @property {string} title
 * @property {string} author
 * @property {Theme} theme
 * @property {number} slideWidth - The width of the slides in the presentation.
 * @property {number} slideHeight - The height of the slides in the presentation.
 * @property {Slide[]} slides
 * @property {SlideMaster[]} slideMasters - The slide masters for the presentation.
 */
export const presentationSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Presentation",
  "description": "The root object for a presentation.",
  "type": "object",
  "definitions": {
    "slide": slideSchema,
    "theme": themeSchema,
    "slideMaster": slideMasterSchema,
  },
  "properties": {
    "title": { "type": "string" },
    "author": { "type": "string" },
    "theme": { "$ref": "#/definitions/theme" },
    "slideWidth": { "type": "number" },
    "slideHeight": { "type": "number" },
    "slides": {
      "type": "array",
      "items": { "$ref": "#/definitions/slide" }
    },
    "slideMasters": {
        "type": "array",
        "items": { "$ref": '#/definitions/slideMaster' }
    },
  },
  "required": ["slides", "slideWidth", "slideHeight"]
}
