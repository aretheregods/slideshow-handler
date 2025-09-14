import { shapeSchema } from './shape.js';
import { fillSchema } from './definitions.js';

/**
 * @typedef {import('./shape.js').Shape} Shape
 * @typedef {import('./definitions.js').Fill} Fill
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {number} slideNumber
 * @property {string} notes
 * @property {Shape[]} shapes
 * @property {Object} [background] - The background of the slide.
 * @property {Fill} [background.fill] - The fill of the background.
 */
export const slideSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Slide",
  "description": "A single slide in a presentation.",
  "type": "object",
  "definitions": {
    "shape": shapeSchema,
    "fill": fillSchema,
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
            "fill": { "$ref": "#/definitions/fill" }
        }
    }
  },
  "required": ["id", "slideNumber", "shapes"]
}
