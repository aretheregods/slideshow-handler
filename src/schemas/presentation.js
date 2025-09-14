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
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Presentation",
  "description": "The root object for a presentation.",
  "type": "object",
  "definitions": {
    "slide": slideSchema
  },
  "properties": {
    "title": { "type": "string" },
    "author": { "type": "string" },
    "themeSettings": {
      "type": "object",
      "properties": {
        "backgroundColor": { "type": "string" },
        "defaultFont": { "type": "string" }
      }
    },
    "slides": {
      "type": "array",
      "items": { "$ref": "#/definitions/slide" }
    }
  },
  "required": ["slides"]
}
