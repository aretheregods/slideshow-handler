import { ColorParser, parseGradientFill } from 'utils';
import { DML_NS, EMU_PER_PIXEL } from 'constants';

function transformText(text, slideContext) {
    if (!text || !text.layout || !text.layout.lines) {
        return text;
    }

    const newLayout = {
        ...text.layout,
        lines: text.layout.lines.map(line => {
            // Resolve bullet color
            let newBulletColor = null;
            if (line.paragraphProps.bullet?.color) {
                newBulletColor = ColorParser.resolveColor(line.paragraphProps.bullet.color, slideContext);
            } else if (line.paragraphProps.defRPr?.color) {
                newBulletColor = ColorParser.resolveColor(line.paragraphProps.defRPr.color, slideContext);
            }

            return {
                ...line,
                paragraphProps: {
                    ...line.paragraphProps,
                    bullet: {
                        ...line.paragraphProps.bullet,
                        color: newBulletColor || '#000',
                    },
                },
                runs: line.runs.map(run => {
                    const newRun = { ...run };
                    // Resolve run color
                    if (run.color) {
                        newRun.color = ColorParser.resolveColor(run.color, slideContext) || '#000000';
                    }
                    // Resolve highlight color
                    if (run.highlight) {
                        newRun.highlight = ColorParser.resolveColor(run.highlight, slideContext);
                    }
                    return newRun;
                }),
            };
        }),
    };

    return { ...text, layout: newLayout };
}

function transformShapeProps(shape, slideContext) {
    const { shapeProps, layoutShapeProps, masterShapeProps, useBgFill, finalBg } = shape;

    let finalFill = shapeProps.fill ?? layoutShapeProps.fill ?? masterShapeProps.fill;
    const finalStroke = shapeProps.stroke ?? layoutShapeProps.stroke ?? masterShapeProps.stroke;
    const finalEffect = shapeProps.effect ?? layoutShapeProps.effect ?? masterShapeProps.effect;

    if (useBgFill) {
        if (finalBg?.type === 'color') {
            finalFill = { type: 'solid', color: finalBg.value };
        } else {
            finalFill = 'none';
        }
    }

    const newShapeProps = { ...shapeProps };

    if (finalFill) {
        newShapeProps.fill = ColorParser.resolveColor(finalFill, slideContext);
    }
    if (finalStroke) {
        const resolvedStroke = { ...finalStroke };
        if (resolvedStroke.color) {
            resolvedStroke.color = ColorParser.resolveColor(resolvedStroke.color, slideContext);
        }
        newShapeProps.stroke = resolvedStroke;
    }
    newShapeProps.effect = finalEffect;

    // --- Default Fill Logic ---
    if (newShapeProps.fill === null && shape.type !== 'cxnSp') {
        if (!shape.rawFillNode) { // Only apply default if no fill was specified at all
            if (slideContext.theme && slideContext.theme.formatScheme.fills.length > 0) {
                const defaultFill = slideContext.theme.formatScheme.fills[1] || slideContext.theme.formatScheme.fills[0];
                if (defaultFill.type === 'solid' && defaultFill.color) {
                    newShapeProps.fill = { type: 'solid', color: ColorParser.resolveColor(defaultFill.color, slideContext) };
                }
            }
        }
    }

    return newShapeProps;
}

export function transformShape(shape, slideContext) {
    const newShape = { ...shape };

    if (newShape.shapeProps) {
        newShape.shapeProps = transformShapeProps(newShape, slideContext);
    }

    if (newShape.text) {
        newShape.text = transformText(newShape.text, slideContext);
    }

    if (newShape.placeholderProps) {
        newShape.placeholderProps = transformShapeProps(newShape, slideContext);
    }

    if (shape.type === 'gradient') {
        const resolvedStops = shape.gradient.stops.map(stop => ({
            ...stop,
            color: ColorParser.resolveColor(stop.color, slideContext, true)
        }));
        return { ...shape, gradient: { ...shape.gradient, stops: resolvedStops } };
    }

    switch (newShape.type) {
        case 'chart':
            // TODO: Add chart color transformation logic here
            break;
        case 'table':
            newShape.cells = newShape.cells.map((cell, index) => {
                const newCell = { ...cell };
                const r = Math.floor(index / newShape.numCols);
                const c = index % newShape.numCols;

                newCell.fill = getCellFillColor(newCell, newShape.tblPrNode, r, c, newShape.numRows, newShape.numCols, newShape.tableStyle, slideContext);
                newCell.borders = getCellBorders(newCell, newShape.tblPrNode, r, c, newShape.numRows, newShape.numCols, newShape.tableStyle, slideContext);

                if (newCell.text) {
                    newCell.text = transformText(newCell.text, slideContext);
                }
                return newCell;
            });
            break;
    }

    return newShape;
}

function getCellBorders(cell, tblPrNode, r, c, numRows, numCols, tableStyle, slideContext) {
    const borders = {};
    const tcPrNode = cell.tcPrNode;

    if (tcPrNode) {
        const borderMap = { 'lnL': 'left', 'lnR': 'right', 'lnT': 'top', 'lnB': 'bottom' };
        for (const child of tcPrNode.children) {
            const side = borderMap[child.localName];
            if (side) {
                const lnNode = child;
                const noFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'noFill')[0];
                const solidFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];

                if (noFillNode) {
                    borders[side] = 'none';
                } else if (solidFillNode) {
                    const colorObj = ColorParser.parseColor(solidFillNode);
                    const width = parseInt(lnNode.getAttribute('w') || '0') / EMU_PER_PIXEL;
                    if (colorObj && width > 0) {
                        borders[side] = {
                            color: ColorParser.resolveColor(colorObj, slideContext),
                            width: width
                        };
                    }
                }
            }
        }
    }

    if (!tableStyle) {
        return borders;
    }

    const finalBorders = { ...borders };

    const baseBorders = (tableStyle.wholeTbl && tableStyle.wholeTbl.tcStyle && tableStyle.wholeTbl.tcStyle.borders) ? tableStyle.wholeTbl.tcStyle.borders : {};

    const firstRow = tblPrNode.getAttribute('firstRow') === '1';
    const lastRow = tblPrNode.getAttribute('lastRow') === '1';
    const firstCol = tblPrNode.getAttribute('firstCol') === '1';
    const lastCol = tblPrNode.getAttribute('lastCol') === '1';
    const bandRow = tblPrNode.getAttribute('bandRow') === '1';
    const bandCol = tblPrNode.getAttribute('bandCol') === '1';

    const isFirstRow = r === 0;
    const isLastRow = r === numRows - 1;
    const isFirstCol = c === 0;
    const isLastCol = c === numCols - 1;

    const partsToCheck = [];
    if (bandRow) {
        const isDataRow = !(firstRow && isFirstRow) && !(lastRow && isLastRow);
        if (isDataRow) {
            const dataRowIdx = firstRow ? r - 1 : r;
            if (dataRowIdx >= 0) {
                if (dataRowIdx % 2 === 0 && tableStyle.band1H) { partsToCheck.push(tableStyle.band1H); }
                else if (dataRowIdx % 2 === 1 && tableStyle.band2H) { partsToCheck.push(tableStyle.band2H); }
            }
        }
    }
    if (bandCol) {
        const isDataCol = !(firstCol && isFirstCol) && !(lastCol && isLastCol);
        if (isDataCol) {
            const dataColIdx = firstCol ? c - 1 : c;
            if (dataColIdx >= 0) {
                if (dataColIdx % 2 === 0 && tableStyle.band1V) { partsToCheck.push(tableStyle.band1V); }
                else if (dataColIdx % 2 === 1 && tableStyle.band2V) { partsToCheck.push(tableStyle.band2V); }
            }
        }
    }
    if (firstRow && isFirstRow && tableStyle.firstRow) { partsToCheck.push(tableStyle.firstRow); }
    if (lastRow && isLastRow && tableStyle.lastRow) { partsToCheck.push(tableStyle.lastRow); }
    if (firstCol && isFirstCol && tableStyle.firstCol) { partsToCheck.push(tableStyle.firstCol); }
    if (lastCol && isLastCol && tableStyle.lastCol) { partsToCheck.push(tableStyle.lastCol); }
    if (firstRow && isFirstRow && firstCol && isFirstCol && tableStyle.nwCell) { partsToCheck.push(tableStyle.nwCell); }
    if (firstRow && isFirstRow && lastCol && isLastCol && tableStyle.neCell) { partsToCheck.push(tableStyle.neCell); }
    if (lastRow && isLastRow && firstCol && isFirstCol && tableStyle.swCell) { partsToCheck.push(tableStyle.swCell); }
    if (lastRow && isLastRow && lastCol && isLastCol && tableStyle.seCell) { partsToCheck.push(tableStyle.seCell); }

    const mergedPartBorders = {};
    for (const part of partsToCheck) {
        if (part && part.tcStyle && part.tcStyle.borders) {
            Object.assign(mergedPartBorders, part.tcStyle.borders);
        }
    }

    for (const side of ['left', 'right', 'top', 'bottom']) {
        if (finalBorders[side] === undefined) {
            const borderToApply = mergedPartBorders[side] || baseBorders[side];
            if (borderToApply) {
                const color = ColorParser.resolveColor(borderToApply.color, slideContext);
                if (color) {
                    finalBorders[side] = {
                        width: borderToApply.width,
                        color: color
                    };
                }
            }
        }
    }

    return finalBorders;
}

function getCellFillColor(cell, tblPrNode, r, c, numRows, numCols, tableStyle, slideContext) {
    const tcPrNode = cell.tcPrNode;
    if (tcPrNode) {
        for (const child of tcPrNode.children) {
            if (child.localName === 'noFill') {
                return 'none';
            }
        }

        let gradFillNode = null;
        for (const child of tcPrNode.children) {
            if (child.localName === 'gradFill') {
                gradFillNode = child;
                break;
            }
        }
        if (gradFillNode) {
            return parseGradientFill(gradFillNode, slideContext);
        }

        let solidFillNode = null;
        for (const child of tcPrNode.children) {
            if (child.localName === 'solidFill') {
                solidFillNode = child;
                break;
            }
        }
        if (solidFillNode) {
            const colorObj = ColorParser.parseColor(solidFillNode);
            if (colorObj) {
                return { type: 'solid', color: ColorParser.resolveColor(colorObj, slideContext) };
            }
        }
    }

    if (!tableStyle) return null;

    let finalFill = null;

    if (tableStyle.wholeTbl && tableStyle.wholeTbl.tcStyle && tableStyle.wholeTbl.tcStyle.fill) {
        finalFill = tableStyle.wholeTbl.tcStyle.fill;
    }

    const firstRow = tblPrNode.getAttribute('firstRow') === '1';
    const lastRow = tblPrNode.getAttribute('lastRow') === '1';
    const firstCol = tblPrNode.getAttribute('firstCol') === '1';
    const lastCol = tblPrNode.getAttribute('lastCol') === '1';
    const bandRow = tblPrNode.getAttribute('bandRow') === '1';
    const bandCol = tblPrNode.getAttribute('bandCol') === '1';

    const isFirstRow = r === 0;
    const isLastRow = r === numRows - 1;
    const isFirstCol = c === 0;
    const isLastCol = c === numCols - 1;

    const partsToCheck = [];
    if (bandRow) {
        const isDataRow = !(firstRow && isFirstRow) && !(lastRow && isLastRow);
        if (isDataRow) {
            const dataRowIdx = firstRow ? r - 1 : r;
            if (dataRowIdx >= 0) {
                if (dataRowIdx % 2 === 0 && tableStyle.band1H) { partsToCheck.push(tableStyle.band1H); }
                else if (dataRowIdx % 2 === 1 && tableStyle.band2H) { partsToCheck.push(tableStyle.band2H); }
            }
        }
    }
    if (bandCol) {
        const isDataCol = !(firstCol && isFirstCol) && !(lastCol && isLastCol);
        if (isDataCol) {
            const dataColIdx = firstCol ? c - 1 : c;
            if (dataColIdx >= 0) {
                if (dataColIdx % 2 === 0 && tableStyle.band1V) { partsToCheck.push(tableStyle.band1V); }
                else if (dataColIdx % 2 === 1 && tableStyle.band2V) { partsToCheck.push(tableStyle.band2V); }
            }
        }
    }
    if (firstRow && isFirstRow && tableStyle.firstRow) { partsToCheck.push(tableStyle.firstRow); }
    if (lastRow && isLastRow && tableStyle.lastRow) { partsToCheck.push(tableStyle.lastRow); }
    if (firstCol && isFirstCol && tableStyle.firstCol) { partsToCheck.push(tableStyle.firstCol); }
    if (lastCol && isLastCol && tableStyle.lastCol) { partsToCheck.push(tableStyle.lastCol); }
    if (firstRow && isFirstRow && firstCol && isFirstCol && tableStyle.nwCell) { partsToCheck.push(tableStyle.nwCell); }
    if (firstRow && isFirstRow && lastCol && isLastCol && tableStyle.neCell) { partsToCheck.push(tableStyle.neCell); }
    if (lastRow && isLastRow && firstCol && isFirstCol && tableStyle.swCell) { partsToCheck.push(tableStyle.swCell); }
    if (lastRow && isLastRow && lastCol && isLastCol && tableStyle.seCell) { partsToCheck.push(tableStyle.seCell); }

    for (const part of partsToCheck) {
        if (part && part.tcStyle && part.tcStyle.fill) {
            finalFill = part.tcStyle.fill;
        }
    }

    if (finalFill) {
        if (finalFill.type === 'none') {
            return 'none';
        }
        if (finalFill.type === 'solid') {
            return { type: 'solid', color: ColorParser.resolveColor(finalFill.color, slideContext) };
        }
        if (finalFill.type === 'gradient') {
            const resolvedStops = finalFill.gradient.stops.map(stop => ({
                ...stop,
                color: ColorParser.resolveColor(stop.color, slideContext, true)
            }));
            return { type: 'gradient', gradient: { ...finalFill.gradient, stops: resolvedStops } };
        }
    }

    return null;
}
