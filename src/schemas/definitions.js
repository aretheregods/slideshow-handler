/**
 * @typedef {Object} Color
 * @property {'srgb' | 'scheme'} type - The type of color.
 * @property {string} value - The color value (e.g., hex code for srgb, theme color name for scheme).
 * @property {number} [alpha] - The alpha transparency value (0-1).
 */
export const colorSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['srgb', 'scheme'] },
        value: { type: 'string' },
        alpha: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['type', 'value'],
};

/**
 * @typedef {Object} SolidFill
 * @property {'solid'} type - The type of fill.
 * @property {Color} color - The color of the fill.
 */
export const solidFillSchema = {
    type: 'object',
    properties: {
        type: { const: 'solid' },
        color: { $ref: '#/definitions/color' },
    },
    required: ['type', 'color'],
};

/**
 * @typedef {Object} GradientFill
 * @property {'gradient'} type - The type of fill.
 * @property {'linear' | 'radial' | 'rectangular' | 'path'} gradientType - The type of gradient.
 * @property {number} angle - The angle of the gradient.
 * @property {Object[]} stops - The gradient stops.
 * @property {Color} stops[].color - The color of the stop.
 * @property {number} stops[].position - The position of the stop (0-1).
 */
export const gradientFillSchema = {
    type: 'object',
    properties: {
        type: { const: 'gradient' },
        gradientType: { type: 'string', enum: ['linear', 'radial', 'rectangular', 'path'] },
        angle: { type: 'number' },
        stops: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    color: { $ref: '#/definitions/color' },
                    position: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['color', 'position'],
            },
        },
    },
    required: ['type', 'gradientType', 'stops'],
};

/**
 * @typedef {Object} PictureFill
 * @property {'picture'} type - The type of fill.
 * @property {string} src - The source URL of the image.
 * @property {'stretch' | 'tile'} fit - How the picture should fit the shape.
 * @property {number} [opacity] - The opacity of the picture.
 */
export const pictureFillSchema = {
    type: 'object',
    properties: {
        type: { const: 'picture' },
        src: { type: 'string', format: 'uri' },
        fit: { type: 'string', enum: ['stretch', 'tile'] },
        opacity: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['type', 'src', 'fit'],
};

/**
 * @typedef {Object} BlipFill
 * @property {'blip'} type - The type of fill.
 * @property {string} src - The source URL of the image.
 * @property {number} [dpi] - The DPI of the image.
 * @property {boolean} [rotateWithShape] - Whether the image rotates with the shape.
 * @property {Object} [crop] - The cropping information for the image.
 * @property {number} [crop.left] - The left crop percentage.
 * @property {number} [crop.right] - The right crop percentage.
 * @property {number} [crop.top] - The top crop percentage.
 * @property {number} [crop.bottom] - The bottom crop percentage.
 * @property {Effect[]} [effects] - An array of effects applied to the image.
 */
export const blipFillSchema = {
    type: 'object',
    properties: {
        type: { const: 'blip' },
        src: { type: 'string', format: 'uri' },
        dpi: { type: 'number' },
        rotateWithShape: { type: 'boolean' },
        crop: {
            type: 'object',
            properties: {
                left: { type: 'number' },
                right: { type: 'number' },
                top: { type: 'number' },
                bottom: { type: 'number' },
            },
        },
        effects: {
            type: 'array',
            items: { $ref: '#/definitions/effect' },
        },
    },
    required: ['type', 'src'],
};

/**
 * @typedef {Object} NoFill
 * @property {'none'} type - The type of fill.
 */
export const noFillSchema = {
    type: 'object',
    properties: {
        type: { const: 'none' },
    },
    required: ['type'],
};

/**
 * @typedef {Object} PatternFill
 * @property {'pattern'} type - The type of fill.
 * @property {string} patternType - The type of pattern (e.g., 'dash', 'dot', 'cross').
 * @property {Color} fgColor - The foreground color of the pattern.
 * @property {Color} [bgColor] - The background color of the pattern.
 */
export const patternFillSchema = {
    type: 'object',
    properties: {
        type: { const: 'pattern' },
        patternType: { type: 'string' },
        fgColor: { $ref: '#/definitions/color' },
        bgColor: { $ref: '#/definitions/color' },
    },
    required: ['type', 'patternType', 'fgColor'],
};

/**
 * @typedef {Object} GroupFill
 * @property {'group'} type - The type of fill.
 */
export const groupFillSchema = {
    type: 'object',
    properties: {
        type: { const: 'group' },
    },
    required: ['type'],
};

/**
 * @typedef {Object} Fill
 * @description A polymorphic schema for different types of fills.
 */
export const fillSchema = {
    oneOf: [
        { $ref: '#/definitions/solidFill' },
        { $ref: '#/definitions/gradientFill' },
        { $ref: '#/definitions/pictureFill' },
        { $ref: '#/definitions/patternFill' },
        { $ref: '#/definitions/groupFill' },
        { $ref: '#/definitions/blipFill' },
        { $ref: '#/definitions/noFill' },
    ],
    definitions: {
        color: colorSchema,
        solidFill: solidFillSchema,
        gradientFill: gradientFillSchema,
        pictureFill: pictureFillSchema,
        patternFill: patternFillSchema,
        groupFill: groupFillSchema,
        blipFill: blipFillSchema,
        noFill: noFillSchema,
    }
};

/**
 * @typedef {Object} Border
 * @property {Color} color - The color of the border.
 * @property {number} width - The width of the border in points.
 * @property {'solid' | 'dashed' | 'dotted' | string} style - The style of the border.
 * @property {'round' | 'square' | 'flat'} cap - The cap type of the border.
 * @property {'round' | 'miter' | 'bevel'} join - The join type of the border.
 */
export const borderSchema = {
    type: 'object',
    properties: {
        color: { $ref: '#/definitions/color' },
        width: { type: 'number' },
        style: { type: 'string' },
        cap: { type: 'string', enum: ['round', 'square', 'flat'] },
        join: { type: 'string', enum: ['round', 'miter', 'bevel'] },
    },
    required: ['color', 'width', 'style'],
};

/**
 * @typedef {Object} Shadow
 * @property {Color} color - The color of the shadow.
 * @property {number} blur - The blur radius of the shadow.
 * @property {number} offsetX - The horizontal offset of the shadow.
 * @property {number} offsetY - The vertical offset of the shadow.
 * @property {number} [angle] - The angle of the shadow.
 * @property {number} [distance] - The distance of the shadow.
 */
export const shadowSchema = {
    type: 'object',
    properties: {
        color: { $ref: '#/definitions/color' },
        blur: { type: 'number' },
        offsetX: { type: 'number' },
        offsetY: { type: 'number' },
        angle: { type: 'number' },
        distance: { type: 'number' },
    },
    required: ['color', 'blur', 'offsetX', 'offsetY'],
};

/**
 * @typedef {Object} Effect
 * @description A schema for various effects like blur, glow, reflection, etc.
 * @property {'blur' | 'glow' | 'reflection' | 'softEdge'} type - The type of effect.
 * @property {number} [radius] - The radius of the effect (for blur, glow, softEdge).
 * @property {Color} [color] - The color of the glow.
 * @property {number} [distance] - The distance of the reflection.
 * @property {number} [opacity] - The opacity of the reflection.
 */
export const effectSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['blur', 'glow', 'reflection', 'softEdge'] },
        radius: { type: 'number' },
        color: { $ref: '#/definitions/color' },
        distance: { type: 'number' },
        opacity: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['type'],
};

/**
 * @typedef {Object} Transform2D
 * @property {number} [rotation] - The rotation angle in degrees.
 * @property {boolean} [flipH] - Whether the shape is flipped horizontally.
 * @property {boolean} [flipV] - Whether the shape is flipped vertically.
 */
export const transform2DSchema = {
    type: 'object',
    properties: {
        rotation: { type: 'number' },
        flipH: { type: 'boolean' },
        flipV: { type: 'boolean' },
    },
};

/**
 * @typedef {Object} Bevel
 * @property {number} [width] - The width of the bevel.
 * @property {number} [height] - The height of the bevel.
 * @property {'angle' | 'circle' | 'coolSlant' | 'cross' | 'divot' | 'hardEdge' | 'relaxedInset' | 'riblet' | 'slope' | 'softRound'} [preset] - The preset for the bevel.
 */
export const bevelSchema = {
    type: 'object',
    properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        preset: { type: 'string', enum: ['angle', 'circle', 'coolSlant', 'cross', 'divot', 'hardEdge', 'relaxedInset', 'riblet', 'slope', 'softRound'] },
    },
};

/**
 * @typedef {Object} Transform3D
 * @property {number} [rotationX] - The rotation around the X-axis.
 * @property {number} [rotationY] - The rotation around the Y-axis.
 * @property {number} [rotationZ] - The rotation around the Z-axis.
 * @property {number} [perspective] - The perspective value.
 * @property {Bevel} [bevelTop] - The top bevel of the shape.
 * @property {Bevel} [bevelBottom] - The bottom bevel of the shape.
 * @property {number} [extrusionHeight] - The height of the extrusion.
 * @property {Color} [extrusionColor] - The color of the extrusion.
 * @property {Color} [contourColor] - The color of the contour.
 * @property {number} [contourWidth] - The width of the contour.
 */
export const transform3DSchema = {
    type: 'object',
    definitions: {
        bevel: bevelSchema,
        color: colorSchema,
    },
    properties: {
        rotationX: { type: 'number' },
        rotationY: { type: 'number' },
        rotationZ: { type: 'number' },
        perspective: { type: 'number' },
        bevelTop: { $ref: '#/definitions/bevel' },
        bevelBottom: { $ref: '#/definitions/bevel' },
        extrusionHeight: { type: 'number' },
        extrusionColor: { $ref: '#/definitions/color' },
        contourColor: { $ref: '#/definitions/color' },
        contourWidth: { type: 'number' },
    },
};

/**
 * @typedef {Object} TextRun
 * @property {string} text - The text content.
 * @property {string} [fontFamily] - The font family.
 * @property {number} [fontSize] - The font size in points.
 * @property {Color} [fontColor] - The color of the font.
 * @property {boolean} [bold] - Whether the text is bold.
 * @property {boolean} [italic] - Whether the text is italic.
 * @property {string} [underline] - The style of the underline.
 * @property {Color} [highlight] - The highlight color of the text.
 * @property {Border} [textBorder] - The border/outline of the text.
 * @property {'none' | 'single' | 'double'} [strikethrough] - The strikethrough style.
 * @property {number} [baseline] - The baseline shift in percentage (positive for superscript, negative for subscript).
 * @property {'none' | 'all' | 'small'} [capitalization] - The capitalization style.
 * @property {number} [characterSpacing] - The spacing between characters in points.
 * @property {string} [hyperlink] - The URL for the hyperlink.
 */
export const textRunSchema = {
    type: 'object',
    properties: {
        text: { type: 'string' },
        fontFamily: { type: 'string' },
        fontSize: { type: 'number' },
        fontColor: { $ref: '#/definitions/color' },
        bold: { type: 'boolean' },
        italic: { type: 'boolean' },
        underline: {
            type: 'string',
            enum: [
                'none', 'dash', 'dashHeavy', 'dashLong', 'dashLongHeavy', 'dbl', 'dotDash',
                'dotDashHeavy', 'dotDotDash', 'dotDotDashHeavy', 'dotted', 'dottedHeavy',
                'heavy', 'sng', 'wavy', 'wavyDbl', 'wavyHeavy', 'words'
            ]
        },
        highlight: { $ref: '#/definitions/color' },
        textBorder: { $ref: '#/definitions/border' },
        strikethrough: { type: 'string', enum: ['none', 'single', 'double'] },
        baseline: { type: 'number' },
        capitalization: { type: 'string', enum: ['none', 'all', 'small'] },
        characterSpacing: { type: 'number' },
        hyperlink: { type: 'string', format: 'uri' },
    },
    required: ['text'],
};

/**
 * @typedef {Object} Bullets
 * @property {string} type - The type of bullet.
 * @property {string} [character] - The character to use for the bullet.
 * @property {string} [src] - The source URL for a picture bullet.
 */
export const bulletsSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['auto', 'numeric', 'char', 'pic'] },
        character: { type: 'string' },
        src: { type: 'string', format: 'uri' },
    },
    required: ['type'],
};

/**
 * @typedef {Object} Numbering
 * @property {string} type - The type of numbering.
 * @property {string} [format] - The format of the numbering.
 * @property {number} [start] - The starting number.
 */
export const numberingSchema = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['arabic', 'roman', 'alpha'] },
        format: { type: 'string' },
        start: { type: 'number' },
    },
    required: ['type'],
};

/**
 * @typedef {Object} Paragraph
 * @property {TextRun[]} runs - The text runs in the paragraph.
 * @property {'left' | 'center' | 'right' | 'justify'} [alignment] - The alignment of the paragraph.
 * @property {number} [indent] - The indentation of the paragraph.
 * @property {number} [lineSpacing] - The line spacing of the paragraph.
 * @property {Bullets} [bullets] - Bullet points for the paragraph.
 * @property {Numbering} [numbering] - Numbering for the paragraph.
 */
export const paragraphSchema = {
    type: 'object',
    definitions: {
        textRun: textRunSchema,
        bullets: bulletsSchema,
        numbering: numberingSchema,
    },
    properties: {
        runs: {
            type: 'array',
            items: { $ref: '#/definitions/textRun' },
        },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
        indent: { type: 'number' },
        lineSpacing: { type: 'number' },
        bullets: { $ref: '#/definitions/bullets' },
        numbering: { $ref: '#/definitions/numbering' },
    },
    required: ['runs'],
};
