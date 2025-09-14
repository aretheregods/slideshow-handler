/**
 * @typedef {Object} Shape
 * @property {string} id
 * @property {'textbox' | 'image' | 'shape'} type
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {string} transform
 * @property {string} fillColor
 * @property {string} borderColor
 * @property {string} [content]
 * @property {string} [fontFamily]
 * @property {number} [fontSize]
 * @property {string} [fontColor]
 * @property {boolean} [bold]
 * @property {boolean} [italic]
 * @property {boolean} [underline]
 * @property {string} [alignment]
 * @property {string} [src]
 * @property {string} [altText]
 * @property {Object} [srcRect]
 * @property {string} [shapeType]
 * @property {string | null} [text]
 */

export const shapeSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Shape",
  "description": "A shape on a slide.",
  "oneOf": [
    { "$ref": "#/definitions/textbox" },
    { "$ref": "#/definitions/image" },
    { "$ref": "#/definitions/shape" }
  ],
  "definitions": {
    "baseShape": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "width": { "type": "number" },
        "height": { "type": "number" },
        "rotation": { "type": "number" },
        "transform": { "type": "string" },
        "fillColor": { "type": "string" },
        "borderColor": { "type": "string" }
      },
      "required": ["id", "type", "x", "y", "width", "height"]
    },
    "textbox": {
      "allOf": [
        { "$ref": "#/definitions/baseShape" },
        {
          "type": "object",
          "properties": {
            "type": { "const": "textbox" },
            "content": { "type": "string" },
            "fontFamily": { "type": "string" },
            "fontSize": { "type": "number" },
            "fontColor": { "type": "string" },
            "bold": { "type": "boolean" },
            "italic": { "type": "boolean" },
            "underline": { "type": "boolean" },
            "alignment": { "type": "string", "enum": ["left", "center", "right", "justify"] }
          },
          "required": ["content"]
        }
      ]
    },
    "image": {
      "allOf": [
        { "$ref": "#/definitions/baseShape" },
        {
          "type": "object",
          "properties": {
            "type": { "const": "image" },
            "src": { "type": "string" },
            "altText": { "type": "string" },
            "srcRect": { "type": "object" }
          },
          "required": ["src"]
        }
      ]
    },
    "shape": {
      "allOf": [
        { "$ref": "#/definitions/baseShape" },
        {
          "type": "object",
          "properties": {
            "type": { "const": "shape" },
            "shapeType": { "type": "string" },
            "text": { "type": ["string", "null"] }
          },
          "required": ["shapeType"]
        }
      ]
    }
  }
}
