export const currentSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Current Slide",
  "description": "The implicit schema for a slide in the current application.",
  "type": "object",
  "definitions": {
    "pos": {
      "type": "object",
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" },
        "width": { "type": "number" },
        "height": { "type": "number" }
      },
      "required": ["x", "y", "width", "height"]
    },
    "geometry": {
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "preset": { "type": "string" },
        "adjustments": {
          "type": "object",
          "additionalProperties": { "type": "number" }
        }
      },
      "required": ["type", "preset", "adjustments"]
    },
    "color": {
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "value": { "type": "string" },
        "alpha": { "type": "number" }
      },
      "required": ["type", "value"]
    },
    "gradient": {
      "type": "object",
      "properties": {
        "angle": { "type": "number" },
        "stops": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "color": { "$ref": "#/definitions/color" },
              "position": { "type": "number" }
            },
            "required": ["color", "position"]
          }
        }
      },
      "required": ["angle", "stops"]
    },
    "fill": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "type": { "enum": ["solid"] },
            "color": { "$ref": "#/definitions/color" }
          },
          "required": ["type", "color"]
        },
        {
          "type": "object",
          "properties": {
            "type": { "enum": ["gradient"] },
            "gradient": { "$ref": "#/definitions/gradient" }
          },
          "required": ["type", "gradient"]
        }
      ]
    },
    "stroke": {
      "type": "object",
      "properties": {
        "width": { "type": "number" },
        "color": { "$ref": "#/definitions/color" },
        "dash": { "type": "string" },
        "cap": { "type": "string" }
      },
      "required": ["width", "color"]
    },
    "shapeProps": {
      "type": "object",
      "properties": {
        "geometry": {
          "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/geometry" } ]
        },
        "fill": {
          "oneOf": [ { "type": "null" }, { "type": "string" }, { "$ref": "#/definitions/fill" } ]
        },
        "stroke": {
          "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/stroke" } ]
        },
        "effect": {
          "oneOf": [ { "type": "null" }, { "type": "object" } ]
        }
      }
    },
    "text": {
      "type": "object",
      "properties": {
        "layout": { "$ref": "#/definitions/textLayout" },
        "bodyPr": { "$ref": "#/definitions/bodyPr" },
        "pos": { "$ref": "#/definitions/pos" }
      },
      "required": ["layout", "bodyPr", "pos"]
    },
    "textLayout": {
      "type": "object",
      "properties": {
        "totalHeight": { "type": "number" },
        "lines": {
          "type": "array",
          "items": { "$ref": "#/definitions/textLine" }
        }
      },
      "required": ["totalHeight", "lines"]
    },
    "textLine": {
      "type": "object",
      "properties": {
        "runs": {
          "type": "array",
          "items": { "$ref": "#/definitions/textRun" }
        },
        "width": { "type": "number" },
        "height": { "type": "number" },
        "paragraphProps": { "$ref": "#/definitions/paragraphProps" },
        "startY": { "type": "number" },
        "isFirstLine": { "type": "boolean" },
        "bulletChar": { "type": "string" },
        "x": { "type": "number" }
      },
      "required": ["runs", "width", "height", "paragraphProps", "startY", "isFirstLine", "x"]
    },
    "textRun": {
      "type": "object",
      "properties": {
        "text": { "type": "string" },
        "font": { "$ref": "#/definitions/font" },
        "color": { "type": "string" }
      },
      "required": ["text", "font", "color"]
    },
    "font": {
      "type": "object",
      "properties": {
        "style": { "type": "string" },
        "weight": { "type": "string" },
        "size": { "type": "number" },
        "family": { "type": "string" }
      },
      "required": ["style", "weight", "size", "family"]
    },
    "paragraphProps": {
      "type": "object",
      "properties": {
        "level": { "type": "integer" },
        "marL": { "type": "number" },
        "indent": { "type": "number" },
        "align": { "type": "string" },
        "bullet": { "$ref": "#/definitions/bullet" },
        "defRPr": { "type": "object" }
      },
      "required": ["level"]
    },
    "bullet": {
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "color": {
          "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/color" } ]
        },
        "char": { "type": "string" },
        "font": { "type": "string" },
        "startAt": { "type": "integer" },
        "scheme": { "type": "string" },
        "relId": { "type": "string" }
      },
      "required": ["type"]
    },
    "bodyPr": {
      "type": "object",
      "properties": {
        "lIns": { "type": "number" },
        "rIns": { "type": "number" },
        "tIns": { "type": "number" },
        "bIns": { "type": "number" },
        "anchor": { "type": "string" },
        "fontScale": { "type": "number" },
        "lnSpcReduction": { "type": "number" }
      }
    },
    "tableCell": {
      "type": "object",
      "properties": {
        "pos": { "$ref": "#/definitions/pos" },
        "fill": {
          "oneOf": [
            { "type": "null" },
            { "$ref": "#/definitions/color" }
          ]
        },
        "borders": { "$ref": "#/definitions/borders" },
        "text": {
          "oneOf": [
            { "type": "null" },
            { "$ref": "#/definitions/text" }
          ]
        }
      },
      "required": ["pos", "fill", "borders", "text"]
    },
    "borders": {
      "type": "object",
      "properties": {
        "top": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/stroke" } ] },
        "right": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/stroke" } ] },
        "bottom": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/stroke" } ] },
        "left": { "oneOf": [ { "type": "null" }, { "$ref": "#/definitions/stroke" } ] }
      }
    },
    "chartData": {
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "labels": { "type": "array", "items": { "type": "string" } },
        "datasets": {
          "type": "array",
          "items": { "type": "object" }
        },
        "title": { "type": "string" }
      },
      "required": ["type", "labels", "datasets"]
    },
    "image": {
      "type": "object",
      "properties": {
        "href": { "type": "string" },
        "srcRect": {
          "oneOf": [
            { "type": "null" },
            { "$ref": "#/definitions/srcRect" }
          ]
        }
      },
      "required": ["href"]
    },
    "srcRect": {
      "type": "object",
      "properties": {
        "l": { "type": "number" },
        "t": { "type": "number" },
        "r": { "type": "number" },
        "b": { "type": "number" }
      },
      "required": ["l", "t", "r", "b"]
    },
    "background": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "properties": {
            "type": { "enum": ["color"] },
            "value": { "type": "string" }
          },
          "required": ["type", "value"]
        },
        {
          "type": "object",
          "properties": {
            "type": { "enum": ["gradient"] },
            "value": { "$ref": "#/definitions/gradient" }
          },
          "required": ["type", "value"]
        },
        {
          "type": "object",
          "properties": {
            "type": { "enum": ["image"] },
            "relId": { "type": "string" }
          },
          "required": ["type", "relId"]
        }
      ]
    },
    "anyShape": {
      "oneOf": [
        { "$ref": "#/definitions/shape" },
        { "$ref": "#/definitions/group" },
        { "$ref": "#/definitions/table" },
        { "$ref": "#/definitions/chart" },
        { "$ref": "#/definitions/picture" }
      ]
    },
    "shape": {
      "type": "object",
      "properties": {
        "type": { "enum": ["shape"] },
        "transform": { "type": "string" },
        "pos": { "$ref": "#/definitions/pos" },
        "shapeProps": { "$ref": "#/definitions/shapeProps" },
        "text": {
          "oneOf": [
            { "type": "null" },
            { "$ref": "#/definitions/text" }
          ]
        },
        "flipH": { "type": "boolean" },
        "flipV": { "type": "boolean" }
      },
      "required": ["type", "transform", "pos", "shapeProps", "text", "flipH", "flipV"]
    },
    "group": {
      "type": "object",
      "properties": {
        "type": { "enum": ["group"] },
        "name": { "type": "string" },
        "shapes": {
          "type": "array",
          "items": { "$ref": "#/definitions/anyShape" }
        }
      },
      "required": ["type", "name", "shapes"]
    },
    "table": {
      "type": "object",
      "properties": {
        "type": { "enum": ["table"] },
        "transform": { "type": "string" },
        "pos": { "$ref": "#/definitions/pos" },
        "cells": {
          "type": "array",
          "items": { "$ref": "#/definitions/tableCell" }
        }
      },
      "required": ["type", "transform", "pos", "cells"]
    },
    "chart": {
      "type": "object",
      "properties": {
        "type": { "enum": ["chart"] },
        "pos": { "$ref": "#/definitions/pos" },
        "chartData": { "$ref": "#/definitions/chartData" }
      },
      "required": ["type", "pos", "chartData"]
    },
    "picture": {
      "type": "object",
      "properties": {
        "type": { "enum": ["picture"] },
        "transform": { "type": "string" },
        "pos": { "$ref": "#/definitions/pos" },
        "placeholderProps": {
          "oneOf": [
            { "type": "null" },
            { "type": "object" }
          ]
        },
        "pathString": {
          "oneOf": [
            { "type": "null" },
            { "type": "string" }
          ]
        },
        "image": {
          "oneOf": [
            { "type": "null" },
            { "$ref": "#/definitions/image" }
          ]
        }
      },
      "required": ["type", "transform", "pos", "placeholderProps", "pathString", "image"]
    }
  },
  "properties": {
    "background": {
      "$ref": "#/definitions/background"
    },
    "shapes": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/anyShape"
      }
    }
  },
  "required": ["background", "shapes"]
};
