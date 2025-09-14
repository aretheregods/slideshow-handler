import { EMU_PER_PIXEL } from "../constants";

/**
 * @module schemaTransformer
 * @description A module for transforming parsed data into the new JSON schema format.
 */

/**
 * Transforms the parsed presentation data into the new JSON schema format.
 * @param {Object} presentationData - The data parsed by pptxParser.js.
 * @param {string} presentationData.title
 * @param {string} presentationData.author
 * @param {Object} presentationData.theme
 * @param {Object[]} slidesData
 * @returns {import('../schemas/presentation.js').Presentation} The transformed presentation data.
 */
export function transformPresentation(currentPresentation, newData) {
    const newPresentation = { ...currentPresentation };

    if (newData.theme) {
        newPresentation.themeSettings = {
            backgroundColor: newData.theme.colorScheme?.bg1 || '#FFFFFF',
            defaultFont: newData.theme.fontScheme?.minor || 'Calibri',
        };
    }

    if (newData.slides) {
        newPresentation.slides = newData.slides;
    }

    return newPresentation;
}

/**
 * Transforms a slide into the new JSON schema format.
 * @param {Object} slideData - The slide data.
 * @returns {import('../schemas/slide.js').Slide} The transformed slide data.
 */
export function transformSlide(slideData) {
    return {
        id: slideData.slideId,
        slideNumber: slideData.slideNum,
        notes: '', // TODO: Extract notes if available
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
        x: pos.x / EMU_PER_PIXEL,
        y: pos.y / EMU_PER_PIXEL,
        width: pos.width / EMU_PER_PIXEL,
        height: pos.height / EMU_PER_PIXEL,
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

    if (type === 'table') {
        return {
            ...baseShape,
            type: 'table',
            rows: shapeData.rows,
        };
    }

    if (type === 'chart') {
        return {
            ...baseShape,
            type: 'chart',
            chartData: shapeData.chartData,
        };
    }

    return {
        ...baseShape,
        type: 'shape',
        shapeType: shapeProps.geometry?.preset || 'rectangle',
        text: null,
    };
}
