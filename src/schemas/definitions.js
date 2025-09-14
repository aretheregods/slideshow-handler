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
export const fillSchema = {
    oneOf: [
        { $ref: '#/definitions/solidFill' },
        { $ref: '#/definitions/gradientFill' },
    ],
    definitions: {
        color: colorSchema,
        solidFill: solidFillSchema,
        gradientFill: gradientFillSchema,
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
 * @property {boolean} [underline] - Whether the text is underlined.
 * @property {boolean} [strikethrough] - Whether the text has a strikethrough.
 * @property {'baseline' | 'superscript' | 'subscript'} [baseline] - The baseline of the text.
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
        underline: { type: 'boolean' },
        strikethrough: { type: 'boolean' },
        baseline: { type: 'string', enum: ['baseline', 'superscript', 'subscript'] },
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
