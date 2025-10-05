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
        "extension": {
            "type": "object",
            "properties": {
                "uri": { "type": "string" },
                "xml": { "type": "string" }
            },
            "required": ["uri", "xml"]
        },
        "extensions": {
            "type": "array",
            "items": { "$ref": "#/definitions/extension" }
        },
        "color": {
            "type": "string"
        },
        "intermediateColor": {
            "type": "object",
            "properties": {
                "srgb": { "type": "string" },
                "scheme": { "type": "string" },
                "tint": { "type": "number" },
                "shade": { "type": "number" },
                "alpha": { "type": "number" },
                "lumMod": { "type": "number" },
                "lumOff": { "type": "number" }
            },
            "oneOf": [
                { "required": ["srgb"] },
                { "required": ["scheme"] }
            ]
        },
        "gradientFill": {
            "type": "object",
            "properties": {
                "type": { "const": "gradient" },
                "gradient": {
                    "type": "object",
                    "properties": {
                        "type": { "type": "string", "enum": ["linear", "radial", "rectangular", "path"] },
                        "angle": { "type": "number" },
                        "rotWithShape": { "type": "boolean" },
                        "stops": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "color": {
                                        "type": "object",
                                        "properties": {
                                            "color": { "type": "string" },
                                            "alpha": { "type": "number", "minimum": 0, "maximum": 1 }
                                        },
                                        "required": ["color"]
                                    },
                                    "pos": { "type": "number", "minimum": 0, "maximum": 1 }
                                },
                                "required": ["color", "pos"]
                            }
                        }
                    },
                    "required": ["stops"]
                }
            },
            "required": ["type", "gradient"]
        },
        "solidFill": {
            "type": "object",
            "properties": {
                "type": { "const": "solid" },
                "color": { "$ref": "#/definitions/color" }
            },
            "required": ["type", "color"]
        },
        "blipFill": {
            "type": "object",
            "properties": {
                "type": { "const": "image" },
                "relId": { "type": "string" },
                "rotWithShape": { "type": "boolean" },
                "href": { "type": "string" }
            },
            "required": ["type", "relId"]
        },
        "noFill": {
            "type": "object",
            "properties": {
                "type": { "const": "none" }
            },
            "required": ["type"]
        },
        "patternFill": {
            "type": "object",
            "properties": {
                "type": { "const": "pattern" },
                "pattern": { "type": "string" },
                "fgColor": { "$ref": "#/definitions/color" },
                "bgColor": { "$ref": "#/definitions/color" }
            },
            "required": ["type", "pattern", "fgColor", "bgColor"]
        },
        "groupFill": {
            "type": "object",
            "properties": {
                "type": { "const": "group" }
            },
            "required": ["type"]
        },
        "unsupportedFill": {
            "type": "object",
            "properties": {
                "type": { "const": "unsupported" }
            },
            "required": ["type"]
        },
        "fill": {
            "oneOf": [
                { "type": "string" },
                { "$ref": "#/definitions/solidFill" },
                { "$ref": "#/definitions/gradientFill" },
                { "$ref": "#/definitions/blipFill" },
                { "$ref": "#/definitions/patternFill" },
                { "$ref": "#/definitions/groupFill" },
                { "$ref": "#/definitions/noFill" },
                { "$ref": "#/definitions/unsupportedFill" }
            ]
        },
        "stroke": {
            "type": "object",
            "properties": {
                "type": { "type": "string", "enum": ["solid"] },
                "width": { "type": "number" },
                "color": { "$ref": "#/definitions/color" },
                "dash": { "type": "array", "items": { "type": "number" } },
                "cap": { "type": "string" },
                "join": { "type": "string" },
                "cmpd": { "type": "string" }
            },
            "required": ["type", "width", "color"]
        },
        "unsupportedStroke": {
            "type": "object",
            "properties": {
                "type": { "const": "unsupported" }
            },
            "required": ["type"]
        },
        "themeLine": {
            "oneOf": [
                { "$ref": "#/definitions/stroke" },
                { "$ref": "#/definitions/unsupportedStroke" }
            ]
        },
        "outerShadowEffect": {
            "type": "object",
            "properties": {
                "type": { "const": "outerShdw" },
                "blurRad": { "type": "number" },
                "dist": { "type": "number" },
                "dir": { "type": "number" },
                "color": { "$ref": "#/definitions/color" }
            },
            "required": ["type", "blurRad", "dist", "dir", "color"]
        },
        "effect": {
            "oneOf": [
                { "$ref": "#/definitions/outerShadowEffect" }
            ]
        },
        "customGeometry": {
            "type": "object",
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "cmd": { "type": "string" },
                            "points": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "x": { "type": "number" },
                                        "y": { "type": "number" }
                                    },
                                    "required": ["x", "y"]
                                }
                            }
                        },
                        "required": ["cmd", "points"]
                    }
                },
                "w": { "type": "number" },
                "h": { "type": "number" }
            },
            "required": ["commands", "w", "h"]
        },
        "geometry": {
            "type": "object",
            "properties": {
                "type": { "type": "string", "enum": ["preset", "custom"] },
                "preset": { "type": "string" },
                "adjustments": {
                    "type": "object",
                    "additionalProperties": { "type": "number" }
                },
                "path": { "$ref": "#/definitions/customGeometry" }
            },
            "required": ["type"]
        },
        "shapeProps": {
            "type": "object",
            "properties": {
                "geometry": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/geometry" }] },
                "fill": { "oneOf": [{ "type": "null" }, { "type": "string" }, { "$ref": "#/definitions/fill" }] },
                "stroke": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] },
                "effect": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/effect" }] }
            }
        },
        "paragraphProps": {
            "type": "object",
            "properties": {
                "level": { "type": "integer" },
                "marL": { "type": "number" },
                "indent": { "type": "number" },
                "align": { "type": "string" },
                "bullet": {
                    "type": "object",
                    "properties": {
                        "type": { "type": "string" },
                        "color": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/intermediateColor" }] },
                        "char": { "type": "string" },
                        "font": { "type": "string" },
                        "startAt": { "type": "integer" },
                        "scheme": { "type": "string" },
                        "relId": { "type": "string" },
                        "size": { "oneOf": [{ "type": "string" }, { "type": "number" }] }
                    },
                    "required": ["type"]
                },
                "defRPr": {
                    "type": "object",
                    "properties": {
                        "size": { "type": "number" },
                        "bold": { "type": "boolean" },
                        "italic": { "type": "boolean" },
                        "color": { "$ref": "#/definitions/intermediateColor" },
                        "font": { "type": "string" }
                    }
                }
            },
            "required": ["level"]
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
        "textStyle": {
            "type": "object",
            "additionalProperties": { "$ref": "#/definitions/paragraphProps" }
        },
        "tableCellStyle": {
            "type": "object",
            "properties": {
                "fill": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/fill" }] },
                "borders": {
                    "type": "object",
                    "properties": {
                        "top": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] },
                        "right": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] },
                        "bottom": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] },
                        "left": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] }
                    }
                }
            }
        },
        "tableTextStyle": {
            "type": "object",
            "properties": {
                "bold": { "type": "boolean" },
                "italic": { "type": "boolean" },
                "color": {
                    "oneOf": [
                        { "type": "null" },
                        { "$ref": "#/definitions/intermediateColor" }
                    ]
                }
            }
        },
        "tableStylePart": {
            "type": "object",
            "properties": {
                "tcStyle": { "$ref": "#/definitions/tableCellStyle" },
                "tcTxStyle": { "$ref": "#/definitions/tableTextStyle" }
            }
        },
        "tableStyle": {
            "type": "object",
            "additionalProperties": { "$ref": "#/definitions/tableStylePart" }
        },
        "placeholder": {
            "type": "object",
            "properties": {
                "pos": { "$ref": "#/definitions/pos" },
                "type": { "type": "string" },
                "listStyle": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/textStyle" }] },
                "shapeProps": { "$ref": "#/definitions/shapeProps" },
                "bodyPr": { "$ref": "#/definitions/bodyPr" }
            },
            "required": ["type", "shapeProps", "bodyPr"]
        },
        "theme": {
            "type": "object",
            "properties": {
                "colorScheme": {
                    "type": "object",
                    "additionalProperties": { "type": "string" }
                },
                "fontScheme": {
                    "type": "object",
                    "properties": {
                        "major": { "type": "string" },
                        "minor": { "type": "string" }
                    },
                    "required": ["major", "minor"]
                },
                "formatScheme": {
                    "type": "object",
                    "properties": {
                        "fills": { "type": "array", "items": { "$ref": "#/definitions/fill" } },
                        "lines": { "type": "array", "items": { "$ref": "#/definitions/themeLine" } },
                        "effects": { "type": "array", "items": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/effect" }] } },
                        "bgFills": { "type": "array", "items": { "$ref": "#/definitions/fill" } }
                    },
                    "required": ["fills", "lines", "effects", "bgFills"]
                }
            },
            "required": ["colorScheme", "fontScheme", "formatScheme"]
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
                "top": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] },
                "right": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] },
                "bottom": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] },
                "left": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/stroke" }] }
            }
        },
        "chartData": {
            "type": "object",
            "properties": {
                "type": { "type": "string" },
                "title": { "oneOf": [{ "type": "null" }, { "type": "string" }] },
                "labels": { "type": "array", "items": { "type": "string" } },
                "datasets": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": { "type": "string" },
                            "data": { "type": "array", "items": { "type": "number" } }
                        },
                        "required": ["label", "data"]
                    }
                }
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
                },
                "opacity": { "type": "number" },
                "duotone": {
                    "type": "array",
                    "items": { "$ref": "#/definitions/intermediateColor" }
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
                        "value": { "type": "string" },
                        "source": { "type": "string", "enum": ["slide", "layout", "master"] }
                    },
                    "required": ["type", "value", "source"]
                },
                {
                    "allOf": [ { "$ref": "#/definitions/gradientFill" } ],
                    "properties": {
                        "source": { "type": "string", "enum": ["slide", "layout", "master"] }
                    },
                    "required": ["source"]
                },
                {
                    "type": "object",
                    "properties": {
                        "type": { "enum": ["image"] },
                        "relId": { "type": "string" },
                        "source": { "type": "string", "enum": ["slide", "layout", "master"] }
                    },
                    "required": ["type", "relId", "source"]
                }
            ]
        },
        "anyShape": {
            "oneOf": [
                { "$ref": "#/definitions/shape" },
                { "$ref": "#/definitions/table" },
                { "$ref": "#/definitions/chart" },
                { "$ref": "#/definitions/picture" },
                { "$ref": "#/definitions/diagram" }
            ]
        },
        "diagram": {
            "type": "object",
            "properties": {
                "type": { "enum": ["diagram"] },
                "shapes": {
                    "type": "array",
                    "items": { "$ref": "#/definitions/shape" }
                }
            },
            "required": ["type", "shapes"]
        },
        "shape": {
            "type": "object",
            "properties": {
                "type": { "enum": ["shape"] },
                "transform": { "oneOf": [{ "type": "string" }, { "type": "null" }] },
                "pos": {
                    "oneOf": [
                        { "type": "null" },
                        { "$ref": "#/definitions/pos" }
                    ]
                },
                "shapeProps": { "$ref": "#/definitions/shapeProps" },
                "text": {
                    "oneOf": [
                        { "type": "null" },
                        { "$ref": "#/definitions/text" }
                    ]
                },
                "flipH": { "type": "boolean" },
                "flipV": { "type": "boolean" },
                "rot": { "type": "number" },
                "extensions": {
                    "oneOf": [
                        { "type": "null" },
                        { "$ref": "#/definitions/extensions" }
                    ]
                }
            },
            "required": ["type", "shapeProps", "flipH", "flipV", "rot"]
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
                "transform": { "type": "string" },
                "pos": { "$ref": "#/definitions/pos" },
                "chartData": { "$ref": "#/definitions/chartData" }
            },
            "required": ["type", "pos", "chartData", "transform"]
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
                        { "$ref": "#/definitions/shapeProps" }
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
                },
                "rot": { "type": "number" },
                "extensions": {
                    "oneOf": [
                        { "type": "null" },
                        { "$ref": "#/definitions/extensions" }
                    ]
                }
            },
            "required": ["type", "transform", "pos", "rot"]
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
        },
        "placeholders": {
            "type": "object",
            "additionalProperties": { "$ref": "#/definitions/placeholder" }
        },
        "theme": { "$ref": "#/definitions/theme" }
    },
    "required": ["background", "shapes"]
};