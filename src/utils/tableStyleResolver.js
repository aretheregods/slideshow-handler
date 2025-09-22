import { ColorParser, parseGradientFill } from 'utils';
import { DML_NS, EMU_PER_PIXEL } from "constants";

function parseBorder(lnNode, slideContext) {
    const noFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'noFill')[0];
    if (noFillNode) {
        return 'none';
    }

    const solidFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
    if (solidFillNode) {
        const colorObj = ColorParser.parseColor(solidFillNode);
        const width = parseInt(lnNode.getAttribute('w') || '0') / EMU_PER_PIXEL;
        if (colorObj && width > 0) {
            return {
                color: ColorParser.resolveColor(colorObj, slideContext),
                width: width
            };
        }
    }

    return null;
}

export class TableStyleResolver {
    constructor(tblPrNode, tableStyle, defaultTableStyle, numRows, numCols, slideContext) {
        this.tblPrNode = tblPrNode;
        this.tableStyle = tableStyle || {}; // Ensure tableStyle is an object
        this.defaultTableStyle = defaultTableStyle || {}; // Ensure defaultTableStyle is an object
        this.numRows = numRows;
        this.numCols = numCols;
        this.slideContext = slideContext;

        this.firstRow = this.tblPrNode.getAttribute('firstRow') === '1';
        this.lastRow = this.tblPrNode.getAttribute('lastRow') === '1';
        this.firstCol = this.tblPrNode.getAttribute('firstCol') === '1';
        this.lastCol = this.tblPrNode.getAttribute('lastCol') === '1';
        this.bandRow = this.tblPrNode.getAttribute('bandRow') === '1';
        this.bandCol = this.tblPrNode.getAttribute('bandCol') === '1';
    }

    getFill(cellNode, r, c) {
        // Level 1: Direct Formatting (highest precedence)
        const tcPrNode = cellNode.getElementsByTagNameNS(DML_NS, 'tcPr')[0];
        if (tcPrNode) {
            const solidFillNode = tcPrNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
            if (solidFillNode) {
                const colorObj = ColorParser.parseColor(solidFillNode);
                if (colorObj) {
                    return { type: 'solid', color: ColorParser.resolveColor(colorObj, this.slideContext) };
                }
            }

            const gradFillNode = tcPrNode.getElementsByTagNameNS(DML_NS, 'gradFill')[0];
            if (gradFillNode) {
                return parseGradientFill(gradFillNode, this.slideContext);
            }

            const noFillNode = tcPrNode.getElementsByTagNameNS(DML_NS, 'noFill')[0];
            if (noFillNode) {
                // A "noFill" on a cell means it should inherit from the table style, not be transparent.
                // So we'll fall through to the style logic.
            } else {
                // If there's a tcPr but no fill instructions, we assume no direct fill is specified.
            }
        }

        // Level 2 & 3: Table Styles
        let finalFill = null;

        const getPart = (partName) => this.tableStyle[partName] || (this.defaultTableStyle && this.defaultTableStyle[partName]);

        const isFirstRow = r === 0;
        const isLastRow = r === this.numRows - 1;
        const isFirstCol = c === 0;
        const isLastCol = c === this.numCols - 1;

        const partNames = [];
        if (this.firstRow && isFirstRow && this.firstCol && isFirstCol) partNames.push('nwCell');
        if (this.firstRow && isFirstRow && this.lastCol && isLastCol) partNames.push('neCell');
        if (this.lastRow && isLastRow && this.firstCol && isFirstCol) partNames.push('swCell');
        if (this.lastRow && isLastRow && this.lastCol && isLastCol) partNames.push('seCell');
        if (this.firstRow && isFirstRow) partNames.push('firstRow');
        if (this.lastRow && isLastRow) partNames.push('lastRow');
        if (this.firstCol && isFirstCol) partNames.push('firstCol');
        if (this.lastCol && isLastCol) partNames.push('lastCol');
        if (this.bandRow) {
            const isDataRow = !(this.firstRow && isFirstRow) && !(this.lastRow && isLastRow);
            if (isDataRow) {
                const dataRowIdx = this.firstRow ? r - 1 : r;
                if (dataRowIdx >= 0) {
                    if (dataRowIdx % 2 === 0) partNames.push('band1H');
                    else partNames.push('band2H');
                }
            }
        }
        if (this.bandCol) {
            const isDataCol = !(this.firstCol && isFirstCol) && !(this.lastCol && isLastCol);
            if (isDataCol) {
                const dataColIdx = this.firstCol ? c - 1 : c;
                if (dataColIdx >= 0) {
                    if (dataColIdx % 2 === 0) partNames.push('band1V');
                    else partNames.push('band2V');
                }
            }
        }
        partNames.push('wholeTbl');

        for (const partName of partNames) {
            const part = getPart(partName);
            if (part && part.tcStyle && part.tcStyle.fill) {
                if (part.tcStyle.fill.type !== 'none') {
                    finalFill = part.tcStyle.fill;
                    break;
                }
            }
        }

        if (r === 0 && this.firstRow) {
            const firstRowPart = getPart('firstRow');
            if (firstRowPart && firstRowPart.tcStyle && firstRowPart.tcStyle.fill && firstRowPart.tcStyle.fill.type === 'none') {
                const band1HPart = getPart('band1H');
                if (band1HPart && band1HPart.tcStyle && band1HPart.tcStyle.fill) {
                    finalFill = band1HPart.tcStyle.fill;
                }
            }
        }

        if (finalFill) {
            return { type: 'solid', color: ColorParser.resolveColor(finalFill.color, this.slideContext) };
        }

        return null;
    }

    getBorders(cellNode, r, c) {
        const borders = {};
        const tcPrNode = cellNode.getElementsByTagNameNS(DML_NS, 'tcPr')[0];

        if (tcPrNode) {
            const borderMap = { 'lnL': 'left', 'lnR': 'right', 'lnT': 'top', 'lnB': 'bottom' };
            for (const child of tcPrNode.children) {
                const side = borderMap[child.localName];
                if (side) {
                    const border = parseBorder(child, this.slideContext);
                    if (border) {
                        borders[side] = border;
                    }
                }
            }
        }

        const finalBorders = { ...borders };
        let baseBorders = {};

        // Table-level borders from tblPr
        const tblBdrNode = this.tblPrNode.getElementsByTagNameNS(DML_NS, 'tblBdr')[0];
        if (tblBdrNode) {
            const borderMap = { 'left': 'left', 'right': 'right', 'top': 'top', 'bottom': 'bottom', 'insideH': 'insideH', 'insideV': 'insideV' };
            for (const child of tblBdrNode.children) {
                const side = borderMap[child.localName];
                if (side) {
                    const lnNode = child.getElementsByTagNameNS(DML_NS, 'ln')[0];
                    if (lnNode) {
                        const border = parseBorder(lnNode, this.slideContext);
                        if (border) {
                            baseBorders[side] = border;
                        }
                    }
                }
            }
        }

        if (this.tableStyle) {
            // Base borders from wholeTbl (overrides tblPr)
            if (this.tableStyle.wholeTbl && this.tableStyle.wholeTbl.tcStyle && this.tableStyle.wholeTbl.tcStyle.borders) {
                baseBorders = { ...baseBorders, ...this.tableStyle.wholeTbl.tcStyle.borders };
            }

            const applicableParts = this._getApplicableParts(r, c);
            const mergedPartBorders = {};
            for (const part of applicableParts) {
                if (part && part.tcStyle && part.tcStyle.borders) {
                    Object.assign(mergedPartBorders, part.tcStyle.borders);
                }
            }

            for (const side of ['left', 'right', 'top', 'bottom']) {
                if (finalBorders[side] === undefined) {
                    const borderToApply = mergedPartBorders[side] || baseBorders[side];
                    if (borderToApply) {
                        const color = ColorParser.resolveColor(borderToApply.color, this.slideContext);
                        if (color) {
                            finalBorders[side] = {
                                width: borderToApply.width,
                                color: color
                            };
                        }
                    }
                }
            }
        }

        return finalBorders;
    }

    getTextStyle(r, c) {
        if (!this.tableStyle) return {};

        let finalStyle = {};

        // Base style from wholeTbl
        if (this.tableStyle.wholeTbl && this.tableStyle.wholeTbl.tcTxStyle) {
            finalStyle = { ...this.tableStyle.wholeTbl.tcTxStyle };
        }

        const applicableParts = this._getApplicableParts(r, c);
        for (const part of applicableParts) {
            if (part && part.tcTxStyle) {
                finalStyle = { ...finalStyle, ...part.tcTxStyle };
            }
        }

        return finalStyle;
    }
}
