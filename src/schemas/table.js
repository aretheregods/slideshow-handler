import { borderSchema, fillSchema, paragraphSchema, colorSchema } from './definitions.js';

/**
 * @typedef {import('./definitions.js').Border} Border
 * @typedef {import('./definitions.js').Fill} Fill
 * @typedef {import('./definitions.js').Paragraph} Paragraph
 * @typedef {import('./definitions.js').Color} Color
 */

/**
 * @typedef {Object} TableCell
 * @property {Paragraph[]} content - The content of the cell.
 * @property {Border} [border] - The border of the cell.
 * @property {Fill} [fill] - The fill of the cell.
 * @property {number} [rowSpan] - The number of rows the cell spans.
 * @property {number} [colSpan] - The number of columns the cell spans.
 * @property {'top' | 'middle' | 'bottom'} [verticalAlign] - The vertical alignment of the cell content.
 */
export const tableCellSchema = {
    type: 'object',
    definitions: {
        border: borderSchema,
        fill: fillSchema,
        paragraph: paragraphSchema,
        color: colorSchema
    },
    properties: {
        content: {
            type: 'array',
            items: { $ref: '#/definitions/paragraph' },
        },
        border: { $ref: '#/definitions/border' },
        fill: { $ref: '#/definitions/fill' },
        rowSpan: { type: 'integer', minimum: 1 },
        colSpan: { type: 'integer', minimum: 1 },
        verticalAlign: { type: 'string', enum: ['top', 'middle', 'bottom'] },
    },
    required: ['content'],
};

/**
 * @typedef {Object} TableRow
 * @property {TableCell[]} cells - The cells in the row.
 * @property {number} height - The height of the row.
 */
export const tableRowSchema = {
    type: 'object',
    definitions: {
        tableCell: tableCellSchema,
    },
    properties: {
        cells: {
            type: 'array',
            items: { $ref: '#/definitions/tableCell' },
        },
        height: { type: 'number' },
    },
    required: ['cells'],
};

/**
 * @typedef {Object} Table
 * @property {'table'} type - The type of the shape.
 * @property {TableRow[]} rows - The rows in the table.
 * @property {number[]} columnWidths - The widths of the columns.
 * @property {boolean} [firstRowHeader] - Whether the first row is a header.
 * @property {boolean} [lastRowFooter] - Whether the last row is a footer.
 * @property {boolean} [bandedRows] - Whether the rows are banded.
 * @property {boolean} [bandedColumns] - Whether the columns are banded.
 */
export const tableSchema = {
    type: 'object',
    definitions: {
        tableRow: tableRowSchema,
    },
    properties: {
        type: { const: 'table' },
        rows: {
            type: 'array',
            items: { $ref: '#/definitions/tableRow' },
        },
        columnWidths: {
            type: 'array',
            items: { type: 'number' },
        },
        firstRowHeader: { type: 'boolean' },
        lastRowFooter: { type: 'boolean' },
        bandedRows: { type: 'boolean' },
        bandedColumns: { type: 'boolean' },
    },
    required: ['type', 'rows', 'columnWidths'],
};
