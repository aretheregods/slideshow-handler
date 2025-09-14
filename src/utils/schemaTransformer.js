/**
 * @module schemaTransformer
 * @description A module for transforming parsed data into the new JSON schema format.
 */

function transformFill(fillData) {
    if (!fillData) {
        return undefined;
    }

    if (fillData.type === 'solid') {
        return {
            type: 'solid',
            color: {
                type: fillData.color.type || 'srgb',
                value: fillData.color.value,
            }
        };
    }

    if (fillData.type === 'gradient') {
        return {
            type: 'gradient',
            gradientType: fillData.gradientType || 'linear',
            angle: fillData.angle || 0,
            stops: fillData.stops.map(stop => ({
                color: {
                    type: stop.color.type || 'srgb',
                    value: stop.color.value,
                },
                position: stop.position,
            })),
        };
    }

    if (fillData.type === 'picture') {
        return {
            type: 'picture',
            src: fillData.src,
            fit: fillData.fit || 'stretch',
            opacity: fillData.opacity,
        };
    }

    // Default to solid fill if type is unknown or not provided, assuming fillData is a color string
    if (typeof fillData.color === 'string') {
        return {
            type: 'solid',
            color: {
                type: 'srgb',
                value: fillData.color,
            }
        };
    }


    return undefined;
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
        shapes: slideData.shapes.map(transformShape),
        background: {
            fill: transformFill(slideData.background)
        }
    };
}

function transformCustomGeometry(geometryData) {
    if (!geometryData || !geometryData.paths) {
        return undefined;
    }

    return {
        paths: geometryData.paths.map(path => ({
            width: path.w,
            height: path.h,
            fill: path.fill,
            stroke: path.stroke,
            commands: path.commands.map(cmd => {
                const command = { type: cmd.type };
                if (cmd.pts) {
                    command.points = cmd.pts.map(pt => ({ x: pt.x, y: pt.y }));
                }
                if (cmd.hR) command.heightRadius = cmd.hR;
                if (cmd.wR) command.widthRadius = cmd.wR;
                if (cmd.stAng) command.startAngle = cmd.stAng;
                if (cmd.swAng) command.swingAngle = cmd.swAng;
                return command;
            }),
        })),
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
        rotation: shapeData.transform ? 0 : undefined, // Simplified, would need proper transform parsing
        fill: transformFill(shapeProps.fill),
        border: shapeProps.stroke ? {
            color: { type: 'srgb', value: shapeProps.stroke.color },
            width: shapeProps.stroke.width || 1,
            style: 'solid' // Assuming solid, as dash style not in sample data
        } : undefined,
    };

    if (text) {
        return {
            ...baseShape,
            type: 'textbox',
            content: text.layout?.lines.map(line => ({
                runs: line.runs.map(run => ({
                    text: run.text,
                    fontFamily: run.font?.family,
                    fontSize: run.font?.size,
                    fontColor: run.color ? { type: 'srgb', value: run.color } : undefined,
                    bold: run.font?.weight === 'bold',
                    italic: run.font?.style === 'italic',
                    underline: run.underline || 'none',
                    strikethrough: run.strikethrough || 'none',
                    capitalization: run.font?.caps || 'none',
                    baseline: run.font?.baseline,
                    characterSpacing: run.font?.spacing,
                    highlight: run.highlight ? { type: 'srgb', value: run.highlight } : undefined,
                    hyperlink: run.hyperlink,
                })),
                alignment: line.paragraphProps.align || 'left',
            })) || [],
        };
    }

    if (type === 'picture') {
        return {
            ...baseShape,
            type: 'image',
            src: shapeData.image.href,
            altText: shapeData.altText || '',
            crop: shapeData.image.srcRect ? {
                left: shapeData.image.srcRect.l,
                right: shapeData.image.srcRect.r,
                top: shapeData.image.srcRect.t,
                bottom: shapeData.image.srcRect.b,
            } : undefined,
        };
    }

    if (shapeProps.geometry?.preset) {
        return {
            ...baseShape,
            type: 'shape',
            shapeType: shapeProps.geometry.preset,
        };
    }

    if (shapeProps.geometry?.custom) {
        return {
            ...baseShape,
            type: 'shape',
            shapeType: 'custom',
            custom: transformCustomGeometry(shapeProps.geometry.custom),
        };
    }

    return {
        ...baseShape,
        type: 'shape',
        shapeType: 'rect', // Default to rect if no geometry is specified
    };
}
