import { shapeSchema } from './shape.js';

/**
 * @typedef {import('./shape.js').Shape} Shape
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {number} slideNumber
 * @property {string} notes
 * @property {Shape[]} shapes
 * @property {Object} [background] - The background of the slide.
 * @property {string} [background.color] - The background color.
 */
export const slideSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Slide",
  "description": "A single slide in a presentation.",
  "type": "object",
  "definitions": {
    "shape": shapeSchema
  },
  "properties": {
    "id": { "type": "string" },
    "slideNumber": { "type": "integer" },
    "notes": { "type": "string" },
    "shapes": {
      "type": "array",
      "items": { "$ref": "#/definitions/shape" }
    },
    "background": {
        "type": "object",
        "properties": {
            "color": { "type": "string" }
        }
    }
  },
  "required": ["id", "slideNumber", "shapes"]
}
