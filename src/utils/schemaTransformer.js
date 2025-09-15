/**
 * @module schemaTransformer
 * @description A module for transforming parsed data into the new JSON schema format.
 */

function transformColor(colorData) {
    if (!colorData) {
        return undefined;
    }

    return {
        type: colorData.type || 'srgb',
        value: colorData.value,
        alpha: colorData.alpha,
    };
}

function transformFill(fillData) {
    if (!fillData) {
        return undefined;
    }

    if (fillData.type === 'solid') {
        return {
            type: 'solid',
            color: transformColor(fillData.color),
        };
    }

    if (fillData.type === 'gradient') {
        return {
            type: 'gradient',
            gradientType: fillData.gradientType || 'linear',
            angle: fillData.angle || 0,
            stops: fillData.stops.map(stop => ({
                color: transformColor(stop.color),
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

    if (fillData.type === 'pattern') {
        return {
            type: 'pattern',
            patternType: fillData.patternType,
            fgColor: transformColor(fillData.fgColor),
            bgColor: transformColor(fillData.bgColor),
        };
    }

    if (fillData.type === 'group') {
        return {
            type: 'group',
        };
    }

    if (fillData.type === 'none') {
        return {
            type: 'none',
        };
    }

    if (fillData.type === 'blip') {
        return {
            type: 'blip',
            src: fillData.src,
            dpi: fillData.dpi,
            rotateWithShape: fillData.rotateWithShape,
            crop: fillData.crop,
            effects: transformEffects(fillData.effects),
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

function transformBorder(borderData) {
    if (!borderData) {
        return undefined;
    }

    return {
        color: transformColor(borderData.color),
        width: borderData.width || 1,
        style: borderData.style || 'solid',
        cap: borderData.cap,
        join: borderData.join,
    };
}

function transformShadow(shadowData) {
    if (!shadowData) {
        return undefined;
    }

    return {
        color: transformColor(shadowData.color),
        blur: shadowData.blur,
        offsetX: shadowData.offsetX,
        offsetY: shadowData.offsetY,
        angle: shadowData.angle,
        distance: shadowData.distance,
    };
}

function transformEffects(effectsData) {
    if (!effectsData) {
        return undefined;
    }

    return effectsData.map(effect => {
        switch (effect.type) {
            case 'reflection':
                return {
                    type: 'reflection',
                    distance: effect.distance,
                    opacity: effect.opacity,
                    blur: effect.blur,
                };
            case 'blur':
                return {
                    type: 'blur',
                    radius: effect.radius,
                };
            case 'glow':
                return {
                    type: 'glow',
                    radius: effect.radius,
                    color: transformColor(effect.color),
                };
            case 'softEdge':
                return {
                    type: 'softEdge',
                    radius: effect.radius,
                };
            default:
                return effect;
        }
    });
}

function transform2D(transformData) {
    if (!transformData) {
        return undefined;
    }

    return {
        rotation: transformData.rot,
        flipH: transformData.flipH,
        flipV: transformData.flipV,
    };
}

function transform3D(transformData) {
    if (!transformData) {
        return undefined;
    }

    return {
        rotationX: transformData.rotX,
        rotationY: transformData.rotY,
        rotationZ: transformData.rotZ,
        perspective: transformData.perspective,
        bevelTop: transformData.bevelTop,
        bevelBottom: transformData.bevelBottom,
        extrusionHeight: transformData.extrusionHeight,
        extrusionColor: transformColor(transformData.extrusionColor),
        contourColor: transformColor(transformData.contourColor),
        contourWidth: transformData.contourWidth,
    };
}

function transformParagraph(paragraphData) {
    if (!paragraphData) {
        return undefined;
    }

    return {
        runs: paragraphData.runs.map(run => ({
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
        alignment: paragraphData.paragraphProps?.align || 'left',
        indent: paragraphData.paragraphProps?.indent,
        lineSpacing: paragraphData.paragraphProps?.lineSpacing,
        bullets: paragraphData.paragraphProps?.bullets,
        numbering: paragraphData.paragraphProps?.numbering,
    };
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
        notes: slideData.notes,
        shapes: slideData.shapes.map(transformShape),
        background: slideData.background ? {
            fill: transformFill(slideData.background.fill),
            colorMap: slideData.background.colorMap,
        } : undefined,
        transition: slideData.transition ? {
            type: slideData.transition.type,
            duration: slideData.transition.duration,
        } : undefined,
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
    const { pos, shapeProps, text, type, transform } = shapeData;

    const baseShape = {
        id: `shape-${Math.random().toString(36).slice(2, 11)}`,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        transform2D: transform2D(transform),
        transform3D: transform3D(transform),
        fill: transformFill(shapeProps.fill),
        border: transformBorder(shapeProps.stroke),
        shadow: transformShadow(shapeProps.shadow),
        effects: transformEffects(shapeProps.effects),
    };

    if (text) {
        return {
            ...baseShape,
            type: 'textbox',
            content: text.layout?.lines.map(transformParagraph) || [],
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
            adjustments: shapeProps.geometry.adjustments,
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

/**
 * Transforms a shape object from the old parser format to the new schema-compliant format.
 * @param {Object} oldShape - The shape data object from the original parser.
 * @param {Element} cNvPrNode - The cNvPr node containing the shape's ID.
 * @returns {Object} The new schema-compliant shape object.
 */
export function transformShapeToSchema(oldShape, cNvPrNode) {
    // The oldShape object has: { type, transform, pos, shapeProps, text, flipH, flipV, rotation }
    const { pos, shapeProps, text, transform, flipH, flipV, rotation } = oldShape;

    // Decompose the matrix string to get x and y
    const matrixValues = transform ? transform.replace(/matrix\(|\)/g, '').split(/[ ,]+/).map(Number) : [1, 0, 0, 1, 0, 0];
    const x = matrixValues[4];
    const y = matrixValues[5];

    // The old shape properties are nested in shapeProps
    const { stroke, effect, fill, geometry } = shapeProps;

    const border = stroke ? {
        color: { type: 'srgb', value: stroke.color },
        width: stroke.width,
        style: stroke.dash && stroke.dash.length > 0 ? 'dashed' : 'solid', // Simplified
        cap: stroke.cap,
        join: stroke.join,
    } : undefined;

    const shadow = effect && effect.type === 'outerShdw' ? {
        color: { type: 'srgb', value: effect.color },
        blur: effect.blurRad,
        offsetX: effect.dist * Math.cos(effect.dir * (Math.PI / 180)),
        offsetY: effect.dist * Math.sin(effect.dir * (Math.PI / 180)),
        angle: effect.dir,
        distance: effect.dist,
    } : undefined;

    const baseShape = {
        id: cNvPrNode.getAttribute('id'),
        x,
        y,
        width: pos.width,
        height: pos.height,
        transform2D: {
            rotation: rotation,
            flipH: flipH,
            flipV: flipV,
            matrix: transform, // Pass the original matrix string
        },
        fill: transformFill(fill),
        border,
        shadow,
        effects: [], // Other effects not handled yet
    };

    let specificShapeData = {};
    if (text) {
        specificShapeData.textbox = {
            paragraphs: text.paragraphs,
            bodyPr: text.bodyPr,
            layout: text.layout, // For renderer - will be removed later
        };
    } else if (geometry) {
        specificShapeData.geometry = geometry;
    } else {
        specificShapeData.geometry = { type: 'preset', preset: 'rect' };
    }

    // Return ONLY the new schema-compliant object
    return {
        ...baseShape,
        ...specificShapeData,
    };
}
