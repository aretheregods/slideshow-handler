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
 * @typedef {Object} Fill
 * @description A polymorphic schema for different types of fills.
 */
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

export const fillSchema = {
    oneOf: [
        { $ref: '#/definitions/solidFill' },
        { $ref: '#/definitions/gradientFill' },
        { $ref: '#/definitions/pictureFill' },
    ],
    definitions: {
        color: colorSchema,
        solidFill: solidFillSchema,
        gradientFill: gradientFillSchema,
        pictureFill: pictureFillSchema,
    }
};

/**
 * @typedef {Object} Border
 * @property {Color} color - The color of the border.
 * @property {number} width - The width of the border in points.
 * @property {'solid' | 'dashed' | 'dotted'} style - The style of the border.
 */
export const borderSchema = {
    type: 'object',
    properties: {
        color: { $ref: '#/definitions/color' },
        width: { type: 'number' },
        style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
    },
    required: ['color', 'width', 'style'],
};

/**
 * @typedef {Object} Shadow
 * @property {Color} color - The color of the shadow.
 * @property {number} blur - The blur radius of the shadow.
 * @property {number} offsetX - The horizontal offset of the shadow.
 * @property {number} offsetY - The vertical offset of the shadow.
 */
export const shadowSchema = {
    type: 'object',
    properties: {
        color: { $ref: '#/definitions/color' },
        blur: { type: 'number' },
        offsetX: { type: 'number' },
        offsetY: { type: 'number' },
    },
    required: ['color', 'blur', 'offsetX', 'offsetY'],
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
 * @typedef {Object} Paragraph
 * @property {TextRun[]} runs - The text runs in the paragraph.
 * @property {'left' | 'center' | 'right' | 'justify'} [alignment] - The alignment of the paragraph.
 * @property {number} [indent] - The indentation of the paragraph.
 * @property {number} [lineSpacing] - The line spacing of the paragraph.
 */
export const paragraphSchema = {
    type: 'object',
    properties: {
        runs: {
            type: 'array',
            items: { $ref: '#/definitions/textRun' },
        },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
        indent: { type: 'number' },
        lineSpacing: { type: 'number' },
    },
    required: ['runs'],
};
