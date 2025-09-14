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
            // In a real implementation, this would be a more detailed schema for custom geometries
            // For now, we'll keep it simple.
            properties: {
                path: { type: 'string' }
            }
        }
    },
    required: ['type', 'shapeType'],
};
