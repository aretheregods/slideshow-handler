import { shapeSchema } from './shape.js';
import { fillSchema, colorSchema } from './definitions.js';

/**
 * @typedef {import('./shape.js').Shape} Shape
 * @typedef {import('./definitions.js').Fill} Fill
 * @typedef {import('./definitions.js').Color} Color
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {number} slideNumber
 * @property {string} notes
 * @property {Shape[]} shapes
 * @property {Object} [background] - The background of the slide.
 * @property {Fill} [background.fill] - The fill of the background.
 * @property {Object} [background.colorMap] - A mapping of theme colors to slide-specific colors.
 * @property {Object} [transition] - The transition to this slide.
 * @property {string} [transition.type] - The type of transition.
 * @property {number} [transition.duration] - The duration of the transition in seconds.
 */
export const slideSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Slide",
  "description": "A single slide in a presentation.",
  "type": "object",
  "definitions": {
    "shape": shapeSchema,
    "fill": fillSchema,
    "color": colorSchema,
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
            "fill": { "$ref": "#/definitions/fill" },
            "colorMap": {
                "type": "object",
                "additionalProperties": { "$ref": "#/definitions/color" }
            }
        }
    },
    "transition": {
        "type": "object",
        "properties": {
            "type": { "type": "string" },
            "duration": { "type": "number" }
        }
    }
  },
  "required": ["id", "slideNumber", "shapes"]
}
