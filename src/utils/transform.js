import { ColorParser } from './colorParser.js';

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

function transformShapeProps(shapeProps, slideContext) {
    const newShapeProps = { ...shapeProps };

    if (shapeProps.fill) {
        newShapeProps.fill = ColorParser.resolveColor(shapeProps.fill, slideContext);
    }
    if (shapeProps.stroke) {
        const resolvedStroke = { ...shapeProps.stroke };
        if (resolvedStroke.color) {
            resolvedStroke.color = ColorParser.resolveColor(resolvedStroke.color, slideContext);
        }
        newShapeProps.stroke = resolvedStroke;
    }
    // Effects might have colors too, but we'll leave that for a future step.

    return newShapeProps;
}

export function transformShape(shape, slideContext) {
    const newShape = { ...shape };

    if (newShape.shapeProps) {
        newShape.shapeProps = transformShapeProps(newShape.shapeProps, slideContext);
    }

    if (newShape.text) {
        newShape.text = transformText(newShape.text, slideContext);
    }

    if (newShape.placeholderProps) {
        newShape.placeholderProps = transformShapeProps(newShape.placeholderProps, slideContext);
    }

    switch (newShape.type) {
        case 'chart':
            // TODO: Add chart color transformation logic here
            break;
        case 'table':
            newShape.cells = newShape.cells.map(cell => {
                const newCell = { ...cell };
                newCell.fill = _resolveTableCellFill(newCell, newShape.tableStyle, slideContext);
                newCell.borders = _resolveTableCellBorders(newCell, newShape.tableStyle, slideContext);
                if (newCell.text) {
                    newCell.text = transformText(newCell.text, slideContext);
                }
                return newCell;
            });
            break;
    }

    return newShape;
}

// Helper functions for table cell styling, adapted from drawing.js
// These are kept private to the transform module.

function _resolveTableCellFill(cell, tableStyle, slideContext) {
    // This is a simplified version. A full implementation would need to handle
    // style precedence (direct format vs. table style parts).
    // For now, we just resolve the color if it exists.
    if (cell.fill) {
        return ColorParser.resolveColor(cell.fill, slideContext);
    }
    return null;
}

function _resolveTableCellBorders(cell, tableStyle, slideContext) {
    // Simplified version for now.
    const newBorders = {};
    if (cell.borders) {
        for (const side in cell.borders) {
            const border = cell.borders[side];
            if (border.color) {
                newBorders[side] = {
                    ...border,
                    color: ColorParser.resolveColor(border.color, slideContext),
                };
            } else {
                newBorders[side] = border;
            }
        }
    }
    return newBorders;
}
