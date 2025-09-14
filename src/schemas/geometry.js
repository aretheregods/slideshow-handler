/**
 * @typedef {Object} Geometry
 * @property {'shape'} type - The type of the shape.
 * @property {string} shapeType - The preset shape type.
 * @property {Object} [custom] - The custom geometry definition.
 */
export const geometrySchema = {
    type: 'object',
    properties: {
        type: { const: 'shape' },
        shapeType: {
            type: 'string',
            enum: [
                'rectangle', 'oval', 'line', 'triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon',
                'decagon', 'dodecagon', 'star4', 'star5', 'star6', 'star7', 'star8', 'star10', 'star12',
                'star16', 'star24', 'star32', 'rightArrow', 'leftArrow', 'upArrow', 'downArrow',
                'leftRightArrow', 'upDownArrow', 'quadArrow', 'leftRightUpArrow', 'bentUpArrow',
                'bentArrow', 'swooshArrow', 'leftRightCircularArrow', 'leftCircularArrow', 'rightCircularArrow',
                'curvedRightArrow', 'curvedLeftArrow', 'curvedUpArrow', 'curvedDownArrow',
                'stripedRightArrow', 'notchedRightArrow', 'homePlate', 'chevron', 'rightTriangle',
                'leftTriangle', 'topBevel', 'bottomBevel', 'leftBracket', 'rightBracket',
                'leftBrace', 'rightBrace', 'plus', 'minus', 'multiply', 'divide', 'equal', 'notEqual',
                'flowchartProcess', 'flowchartDecision', 'flowchartData', 'flowchartPredefinedProcess',
                'flowchartInternalStorage', 'flowchartDocument', 'flowchartMultidocument',
                'flowchartTerminator', 'flowchartPreparation', 'flowchartManualInput',
                'flowchartManualOperation', 'flowchartConnector', 'flowchartOffpageConnector',
                'flowchartCard', 'flowchartPunchedTape', 'flowchartSummingJunction', 'flowchartOr',
                'flowchartCollate', 'flowchartSort', 'flowchartExtract', 'flowchartMerge',
                'flowchartStoredData', 'flowdataDelay', 'flowchartSequentialAccessStorage',
                'flowchartMagneticDisk', 'flowchartDirectAccessStorage', 'flowchartDisplay',
            ]
        },
        custom: {
            type: 'object',
            properties: {
                paths: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            width: { type: 'number' },
                            height: { type: 'number' },
                            fill: { type: 'string', enum: ['darken', 'darkenLess', 'lighten', 'lightenLess', 'none', 'normal'] },
                            stroke: { type: 'boolean' },
                            commands: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string', enum: ['moveTo', 'lnTo', 'arcTo', 'cubicBezTo', 'quadBezTo', 'close'] },
                                        points: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    x: { type: 'number' },
                                                    y: { type: 'number' },
                                                },
                                                required: ['x', 'y'],
                                            }
                                        },
                                        heightRadius: { type: 'number' },
                                        widthRadius: { type: 'number' },
                                        startAngle: { type: 'number' },
                                        swingAngle: { type: 'number' },
                                    },
                                    required: ['type'],
                                }
                            }
                        },
                        required: ['width', 'height', 'commands'],
                    }
                }
            },
            required: ['paths'],
        }
    },
    required: ['type', 'shapeType'],
};
