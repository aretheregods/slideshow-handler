/**
 * @module schemaTransformer
 * @description A module for transforming parsed data into the new JSON schema format.
 */

/**
 * Transforms a slide into the new JSON schema format.
 * @param {Object} slideData - The slide data.
 * @returns {import('../schemas/slide.js').Slide} The transformed slide data.
 */
export function transformSlide(slideData) {
    return {
        id: slideData.slideId,
        slideNumber: slideData.slideNum,
        shapes: slideData.shapes.map(transformShape),
    };
}

/**
 * Transforms a shape into the new JSON schema format.
 * @param {Object} shapeData - The shape data from the parser.
 * @returns {import('../schemas/shape.js').Shape} The transformed shape data.
 */
function transformShape(shapeData) {
    const { pos, shapeProps, text, type } = shapeData;

    const baseShape = {
        id: `shape-${Math.random().toString(36).slice(2, 11)}`,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        rotation: 0,
        transform: shapeData.transform,
        fillColor: shapeProps.fill?.color || '#FFFFFF00',
        borderColor: shapeProps.stroke?.color || '#00000000',
    };

    if (text) {
        const firstRun = text.layout?.lines[0]?.runs[0];
        return {
            ...baseShape,
            type: 'textbox',
            content: text.layout?.lines.map(line => line.runs.map(run => run.text).join('')).join('\n') || '',
            fontFamily: firstRun?.font.family || 'Arial',
            fontSize: firstRun?.font.size || 18,
            fontColor: firstRun?.color || '#000000',
            bold: firstRun?.font.weight === 'bold',
            italic: firstRun?.font.style === 'italic',
            underline: firstRun?.underline || false,
            alignment: text.layout?.lines[0]?.paragraphProps.align || 'left',
        };
    }

    if (type === 'picture') {
        return {
            ...baseShape,
            type: 'image',
            src: shapeData.image.href,
            altText: shapeData.altText || '',
            srcRect: shapeData.image.srcRect,
        };
    }

    return {
        ...baseShape,
        type: 'shape',
        shapeType: shapeProps.geometry?.preset || 'rect',
        text: null,
    };
}
