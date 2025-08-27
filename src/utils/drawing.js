import { BlobWriter } from "zipjs";
import { ColorParser, resolvePath, integerToRoman, parseGradientFill } from 'utils';
import { DML_NS, EMU_PER_PIXEL } from "constants";

export function resolveFontFamily(finalRunProps, phType, slideContext) {
    const fontAlias = finalRunProps.font;
    const theme = slideContext.theme;

    if (fontAlias) {
        if (fontAlias === '+mj-lt') {
            return theme?.fontScheme?.major || 'Arial';
        }
        if (fontAlias === '+mn-lt') {
            return theme?.fontScheme?.minor || 'Arial';
        }
        return fontAlias; // It's a specific font like 'Calibri'
    }

    // No font in run, so fallback to placeholder type
    if (phType === 'title' || phType === 'ctrTitle' || phType === 'subTitle') {
        return theme?.fontScheme?.major || 'Arial';
    }

    return theme?.fontScheme?.minor || 'Arial';
}

export function getAutoNumberingChar(scheme, number) {
    switch (scheme) {
        case 'alphaLcParenBoth': return `(${String.fromCharCode(96 + number)})`;
        case 'alphaLcParenR': return `${String.fromCharCode(96 + number)})`;
        case 'alphaLcPeriod': return `${String.fromCharCode(96 + number)}.`;
        case 'alphaUcParenBoth': return `(${String.fromCharCode(64 + number)})`;
        case 'alphaUcParenR': return `${String.fromCharCode(64 + number)})`;
        case 'alphaUcPeriod': return `${String.fromCharCode(64 + number)}.`;
        case 'arabicParenBoth': return `(${number})`;
        case 'arabicParenR': return `${number})`;
        case 'arabicPeriod': return `${number}.`;
        case 'arabicPlain': return `${number}`;
        case 'romanLcParenBoth': return `(${integerToRoman(number).toLowerCase()})`;
        case 'romanLcParenR': return `${integerToRoman(number).toLowerCase()})`;
        case 'romanLcPeriod': return `${integerToRoman(number).toLowerCase()}.`;
        case 'romanUcParenBoth': return `(${integerToRoman(number)})`;
        case 'romanUcParenR': return `${integerToRoman(number)})`;
        case 'romanUcPeriod': return `${integerToRoman(number)}.`;
        default: return `${number}.`;
    }
}

export function createImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });
}

export async function populateImageMap(imageMap, rels, baseDir, entriesMap) {
    const imageRels = Object.values(rels).filter(rel => rel.type.endsWith('/image'));
    for (const rel of imageRels) {
        // Do not overwrite an image that has already been loaded from a more specific source (e.g., slide vs layout)
        if (imageMap[rel.id]) {
            continue;
        }

        const imagePath = resolvePath(baseDir, rel.target);
        const imageEntry = entriesMap.get(imagePath);
        if (imageEntry) {
            try {
                const writer = new BlobWriter();
                const imageBlob = await imageEntry.getData(writer);
                const reader = new FileReader();
                const imageData = await new Promise((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageBlob);
                });
                imageMap[rel.id] = `data:image/png;base64,${imageData}`;
            } catch (e) {
                console.error(`Failed to load image data for relId ${rel.id} at path ${imagePath}`, e);
            }
        } else {
            console.warn(`Image relationship '${rel.id}' points to a non-existent target: ${rel.target} (resolved to ${imagePath})`);
        }
    }
}

export function calculateTextBlockSize(paragraphs, pos, defaultTextStyles, phKey, phType, masterPlaceholders, layoutPlaceholders, slideContext, bodyPr) {
    const layout = layoutParagraphs(paragraphs, pos, defaultTextStyles, phKey, phType, masterPlaceholders, layoutPlaceholders, slideContext, bodyPr);
    return { height: layout.totalHeight };
}

export function getCellBorders(cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, slideContext) {
    const borders = {};
    const tcPrNode = cellNode.getElementsByTagNameNS(DML_NS, 'tcPr')[0];

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

    // Base borders from wholeTbl
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

export function getCellFillColor(cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, slideContext) {
    // Level 1: Direct Formatting (highest precedence)
    const tcPrNode = cellNode.getElementsByTagNameNS(DML_NS, 'tcPr')[0];
    if (tcPrNode) {
        for ( const child of tcPrNode.children ) {
            if ( child.localName === 'noFill' ) {
                return 'none';
            }
        }

        let gradFillNode = null;
        for ( const child of tcPrNode.children ) {
            if ( child.localName === 'gradFill' ) {
                gradFillNode = child;
                break;
            }
        }
        if (gradFillNode) {
            return parseGradientFill(gradFillNode, slideContext);
        }

        let solidFillNode = null;
        for ( const child of tcPrNode.children ) {
            if ( child.localName === 'solidFill' ) {
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

    // Level 2 & 3: Table Styles
    if (!tableStyle) return null;

    let finalFill = null;

    // Base fill from wholeTbl
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

    // Layer styles in increasing order of precedence
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

export function getCellTextStyle(tblPrNode, r, c, numRows, numCols, tableStyle) {
    if (!tableStyle) return {};

    let finalStyle = {};

    // Base style from wholeTbl
    if (tableStyle.wholeTbl && tableStyle.wholeTbl.tcTxStyle) {
        finalStyle = { ...tableStyle.wholeTbl.tcTxStyle };
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

    // Layer styles in increasing order of precedence
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
        if (part && part.tcTxStyle) {
            finalStyle = { ...finalStyle, ...part.tcTxStyle };
        }
    }

    return finalStyle;
}

export function buildPathStringFromGeom(geometry, pos) {
    if (!geometry || !pos) return null;

    if (geometry.type === 'custom' && geometry.path) {
        const pathData = geometry.path;
        const scaleX = pathData.w === 0 ? 1 : pos.width / pathData.w;
        const scaleY = pathData.h === 0 ? 1 : pos.height / pathData.h;

        let pathString = '';
        pathData.commands.forEach(command => {
            switch (command.cmd) {
                case 'moveTo': {
                    const p = command.points[0];
                    pathString += `M ${p.x * scaleX} ${p.y * scaleY} `;
                    break;
                }
                case 'lnTo': {
                    const p = command.points[0];
                    pathString += `L ${p.x * scaleX} ${p.y * scaleY} `;
                    break;
                }
                case 'cubicBezTo': {
                    const p1 = command.points[0];
                    const p2 = command.points[1];
                    const p3 = command.points[2];
                    pathString += `C ${p1.x * scaleX} ${p1.y * scaleY} ${p2.x * scaleX} ${p2.y * scaleY} ${p3.x * scaleX} ${p3.y * scaleY} `;
                    break;
                }
                case 'quadBezTo': {
                    const p1 = command.points[0];
                    const p2 = command.points[1];
                    pathString += `Q ${p1.x * scaleX} ${p1.y * scaleY} ${p2.x * scaleX} ${p2.y * scaleY} `;
                    break;
                }
                case 'close': {
                    pathString += 'Z ';
                    break;
                }
            }
        });
        return pathString;
    }

    return null;
}
