import { ColorParser, resolvePath, integerToRoman, parseGradientFill } from 'utils';
import { DML_NS, EMU_PER_PIXEL } from "constants";

/**
 * Resolves the font family for a text run.
 * @param {Object} finalRunProps - The final run properties.
 * @param {string} phType - The placeholder type.
 * @param {Object} slideContext - The context of the slide.
 * @returns {string} The resolved font family.
 */
export function resolveFontFamily( finalRunProps, phType, slideContext ) {
    const fontAlias = finalRunProps.font;
    const theme = slideContext.theme;

    if ( fontAlias ) {
        if ( fontAlias === '+mj-lt' ) {
            return theme?.fontScheme?.major || 'Arial';
        }
        if ( fontAlias === '+mn-lt' ) {
            return theme?.fontScheme?.minor || 'Arial';
        }
        return fontAlias; // It's a specific font like 'Calibri'
    }

    // No font in run, so fallback to placeholder type
    if ( phType === 'title' || phType === 'ctrTitle' || phType === 'subTitle' ) {
        return theme?.fontScheme?.major || 'Arial';
    }

    return theme?.fontScheme?.minor || 'Arial';
}

/**
 * Gets the character for an automatic numbering scheme.
 * @param {string} scheme - The numbering scheme.
 * @param {number} number - The number to convert.
 * @returns {string} The auto-numbering character.
 */
export function getAutoNumberingChar( scheme, number ) {
    switch ( scheme ) {
        case 'alphaLcParenBoth': return `(${ String.fromCharCode( 96 + number ) })`;
        case 'alphaLcParenR': return `${ String.fromCharCode( 96 + number ) })`;
        case 'alphaLcPeriod': return `${ String.fromCharCode( 96 + number ) }.`;
        case 'alphaUcParenBoth': return `(${ String.fromCharCode( 64 + number ) })`;
        case 'alphaUcParenR': return `${ String.fromCharCode( 64 + number ) })`;
        case 'alphaUcPeriod': return `${ String.fromCharCode( 64 + number ) }.`;
        case 'arabicParenBoth': return `(${ number })`;
        case 'arabicParenR': return `${ number })`;
        case 'arabicPeriod': return `${ number }.`;
        case 'arabicPlain': return `${ number }`;
        case 'romanLcParenBoth': return `(${ integerToRoman( number ).toLowerCase() })`;
        case 'romanLcParenR': return `${ integerToRoman( number ).toLowerCase() })`;
        case 'romanLcPeriod': return `${ integerToRoman( number ).toLowerCase() }.`;
        case 'romanUcParenBoth': return `(${ integerToRoman( number ) })`;
        case 'romanUcParenR': return `${ integerToRoman( number ) })`;
        case 'romanUcPeriod': return `${ integerToRoman( number ) }.`;
        default: return `${ number }.`;
    }
}

/**
 * Creates an image element from a URL.
 * @param {string} url - The URL of the image.
 * @returns {Promise<HTMLImageElement>} A promise that resolves to the loaded image element.
 */
export function createImage( url ) {
    return new Promise( ( resolve, reject ) => {
        const image = new Image();
        image.onload = () => resolve( image );
        image.onerror = reject;
        image.src = url;
    } );
}

/**
 * Populates the image map by loading image data from zip entries.
 * @param {Object} imageMap - The map to populate with image data.
 * @param {Object} rels - The relationships object.
 * @param {string} baseDir - The base directory for resolving image paths.
 * @param {Map<string, Object>} entriesMap - A map of zip file entries.
 * @returns {Promise<void>}
 */
export async function populateImageMap( imageMap, rels, baseDir, entriesMap ) {
    const imageRels = Object.values( rels ).filter( rel => rel.type.endsWith( '/image' ) );
    for ( const rel of imageRels ) {
        const imagePath = resolvePath( baseDir, rel.target );
        const imageEntry = entriesMap[ imagePath ];
        if ( imageEntry ) {
            try {
                const imageData = await imageEntry.async( "base64" );
                imageMap[ rel.id ] = `data:image/png;base64,${ imageData }`;
            } catch ( e ) {
                console.error( `Failed to load image data for relId ${ rel.id } at path ${ imagePath }`, e );
            }
        } else {
            console.warn( `Image relationship '${ rel.id }' points to a non-existent target: ${ rel.target } (resolved to ${ imagePath })` );
        }
    }
}

/**
 * Calculates the size of a text block.
 * @param {Element[]} paragraphs - The paragraph elements.
 * @param {Object} pos - The position and dimensions of the text box.
 * @param {Object} defaultTextStyles - The default text styles.
 * @param {string} phKey - The placeholder key.
 * @param {string} phType - The placeholder type.
 * @param {Object} masterPlaceholders - The placeholders from the slide master.
 * @param {Object} layoutPlaceholders - The placeholders from the slide layout.
 * @param {Object} slideContext - The context of the slide.
 * @param {Object} bodyPr - The body properties.
 * @returns {{height: number}} An object containing the calculated height of the text block.
 */
export function calculateTextBlockSize( paragraphs, pos, defaultTextStyles, phKey, phType, masterPlaceholders, layoutPlaceholders, slideContext, bodyPr ) {
    const layout = layoutParagraphs( paragraphs, pos, defaultTextStyles, phKey, phType, masterPlaceholders, layoutPlaceholders, slideContext, bodyPr );
    return { height: layout.totalHeight };
}

/**
 * Gets the borders of a table cell.
 * @param {Element} cellNode - The table cell's XML node.
 * @param {Element} tblPrNode - The table properties XML node.
 * @param {number} r - The row index of the cell.
 * @param {number} c - The column index of the cell.
 * @param {number} numRows - The total number of rows in the table.
 * @param {number} numCols - The total number of columns in the table.
 * @param {Object} tableStyle - The table style object.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object} The parsed cell borders.
 */
export function getCellBorders( cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, slideContext ) {
    const borders = {};
    const tcPrNode = cellNode.getElementsByTagNameNS( DML_NS, 'tcPr' )[ 0 ];

    if ( tcPrNode ) {
        const borderMap = { 'lnL': 'left', 'lnR': 'right', 'lnT': 'top', 'lnB': 'bottom' };
        for ( const child of tcPrNode.children ) {
            const side = borderMap[ child.localName ];
            if ( side ) {
                const lnNode = child;
                const noFillNode = lnNode.getElementsByTagNameNS( DML_NS, 'noFill' )[ 0 ];
                const solidFillNode = lnNode.getElementsByTagNameNS( DML_NS, 'solidFill' )[ 0 ];

                if ( noFillNode ) {
                    borders[ side ] = 'none';
                } else if ( solidFillNode ) {
                    const colorObj = ColorParser.parseColor( solidFillNode );
                    const width = parseInt( lnNode.getAttribute( 'w' ) || '0' ) / EMU_PER_PIXEL;
                    if ( colorObj && width > 0 ) {
                        borders[ side ] = {
                            color: ColorParser.resolveColor( colorObj, slideContext ),
                            width: width
                        };
                    }
                }
            }
        }
    }

    if ( !tableStyle ) {
        return borders;
    }

    const finalBorders = { ...borders };

    // Base borders from wholeTbl
    const baseBorders = ( tableStyle.wholeTbl && tableStyle.wholeTbl.tcStyle && tableStyle.wholeTbl.tcStyle.borders ) ? tableStyle.wholeTbl.tcStyle.borders : {};

    const firstRow = tblPrNode.getAttribute( 'firstRow' ) === '1';
    const lastRow = tblPrNode.getAttribute( 'lastRow' ) === '1';
    const firstCol = tblPrNode.getAttribute( 'firstCol' ) === '1';
    const lastCol = tblPrNode.getAttribute( 'lastCol' ) === '1';
    const bandRow = tblPrNode.getAttribute( 'bandRow' ) === '1';
    const bandCol = tblPrNode.getAttribute( 'bandCol' ) === '1';

    const isFirstRow = r === 0;
    const isLastRow = r === numRows - 1;
    const isFirstCol = c === 0;
    const isLastCol = c === numCols - 1;

    const partsToCheck = [];
    if ( bandRow ) {
        const isDataRow = !( firstRow && isFirstRow ) && !( lastRow && isLastRow );
        if ( isDataRow ) {
            const dataRowIdx = firstRow ? r - 1 : r;
            if ( dataRowIdx >= 0 ) {
                if ( dataRowIdx % 2 === 0 && tableStyle.band1H ) { partsToCheck.push( tableStyle.band1H ); }
                else if ( dataRowIdx % 2 === 1 && tableStyle.band2H ) { partsToCheck.push( tableStyle.band2H ); }
            }
        }
    }
    if ( bandCol ) {
        const isDataCol = !( firstCol && isFirstCol ) && !( lastCol && isLastCol );
        if ( isDataCol ) {
            const dataColIdx = firstCol ? c - 1 : c;
            if ( dataColIdx >= 0 ) {
                if ( dataColIdx % 2 === 0 && tableStyle.band1V ) { partsToCheck.push( tableStyle.band1V ); }
                else if ( dataColIdx % 2 === 1 && tableStyle.band2V ) { partsToCheck.push( tableStyle.band2V ); }
            }
        }
    }
    if ( firstRow && isFirstRow && tableStyle.firstRow ) { partsToCheck.push( tableStyle.firstRow ); }
    if ( lastRow && isLastRow && tableStyle.lastRow ) { partsToCheck.push( tableStyle.lastRow ); }
    if ( firstCol && isFirstCol && tableStyle.firstCol ) { partsToCheck.push( tableStyle.firstCol ); }
    if ( lastCol && isLastCol && tableStyle.lastCol ) { partsToCheck.push( tableStyle.lastCol ); }
    if ( firstRow && isFirstRow && firstCol && isFirstCol && tableStyle.nwCell ) { partsToCheck.push( tableStyle.nwCell ); }
    if ( firstRow && isFirstRow && lastCol && isLastCol && tableStyle.neCell ) { partsToCheck.push( tableStyle.neCell ); }
    if ( lastRow && isLastRow && firstCol && isFirstCol && tableStyle.swCell ) { partsToCheck.push( tableStyle.swCell ); }
    if ( lastRow && isLastRow && lastCol && isLastCol && tableStyle.seCell ) { partsToCheck.push( tableStyle.seCell ); }

    const mergedPartBorders = {};
    for ( const part of partsToCheck ) {
        if ( part && part.tcStyle && part.tcStyle.borders ) {
            Object.assign( mergedPartBorders, part.tcStyle.borders );
        }
    }

    for ( const side of [ 'left', 'right', 'top', 'bottom' ] ) {
        if ( finalBorders[ side ] === undefined ) {
            const borderToApply = mergedPartBorders[ side ] || baseBorders[ side ];
            if ( borderToApply ) {
                const color = ColorParser.resolveColor( borderToApply.color, slideContext );
                if ( color ) {
                    finalBorders[ side ] = {
                        width: borderToApply.width,
                        color: color
                    };
                }
            }
        }
    }

    return finalBorders;
}

/**
 * Gets the fill color of a table cell.
 * @param {Element} cellNode - The table cell's XML node.
 * @param {Element} tblPrNode - The table properties XML node.
 * @param {number} r - The row index of the cell.
 * @param {number} c - The column index of the cell.
 * @param {number} numRows - The total number of rows in the table.
 * @param {number} numCols - The total number of columns in the table.
 * @param {Object} tableStyle - The table style object.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object|string|null} The parsed cell fill color, or null if no fill is defined.
 */
export function getCellFillColor( cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, slideContext ) {
    // This function is now self-contained and handles all precedence logic.
    const tcPrNode = cellNode.getElementsByTagNameNS( DML_NS, 'tcPr' )[ 0 ];

    // Level 1: Direct formatting (Explicit color fills)
    if ( tcPrNode ) {
        let solidFillNode, gradFillNode;
        for ( const child of tcPrNode.children ) {
            if ( child.localName === 'solidFill' ) solidFillNode = child;
            if ( child.localName === 'gradFill' ) gradFillNode = child;
        }

        if ( gradFillNode ) {
            return parseGradientFill( gradFillNode, slideContext );
        }
        if ( solidFillNode ) {
            const colorObj = ColorParser.parseColor( solidFillNode );
            if ( colorObj ) {
                return { type: 'solid', color: ColorParser.resolveColor( colorObj, slideContext ) };
            }
        }
    }

    // Level 2: Direct noFill (Explicit no fill)
    if ( tcPrNode ) {
        const noFillNode = Array.from( tcPrNode.children ).find( c => c.localName === 'noFill' );
        if ( noFillNode ) {
            return 'none';
        }
    }

    // Level 3 & 4: Table Styles
    if ( tableStyle ) {
        let conditionalFill = null;
        let wholeTblFill = null;

        if ( tableStyle.wholeTbl && tableStyle.wholeTbl.tcStyle && tableStyle.wholeTbl.tcStyle.fill ) {
            if ( tableStyle.wholeTbl.tcStyle.fill.type === 'solid' ) {
                wholeTblFill = { type: 'solid', color: ColorParser.resolveColor( tableStyle.wholeTbl.tcStyle.fill.color, slideContext ) };
            }
        }

        const firstRowAttr = tblPrNode.getAttribute( 'firstRow' );

        const firstRow = firstRowAttr === '1';
        const lastRow = tblPrNode.getAttribute( 'lastRow' ) === '1';
        const firstCol = tblPrNode.getAttribute( 'firstCol' ) === '1';
        const lastCol = tblPrNode.getAttribute( 'lastCol' ) === '1';
        const bandRow = tblPrNode.getAttribute( 'bandRow' ) === '1';
        const bandCol = tblPrNode.getAttribute( 'bandCol' ) === '1';

        const isFirstRow = r === 0;
        const isLastRow = r === numRows - 1;
        const isFirstCol = c === 0;
        const isLastCol = c === numCols - 1;

        const partsToCheck = [];
        if ( bandCol ) {
            const isDataCol = !( firstCol && isFirstCol ) && !( lastCol && isLastCol );
            if ( isDataCol ) {
                const dataColIdx = firstCol ? c - 1 : c;
                if ( dataColIdx >= 0 ) {
                    if ( dataColIdx % 2 === 0 && tableStyle.band1V ) partsToCheck.push( tableStyle.band1V );
                    else if ( dataColIdx % 2 === 1 && tableStyle.band2V ) partsToCheck.push( tableStyle.band2V );
                }
            }
        }
        if ( bandRow ) {
            const isDataRow = !( firstRow && isFirstRow ) && !( lastRow && isLastRow );
            if ( isDataRow ) {
                const dataRowIdx = firstRow ? r - 1 : r;
                if ( dataRowIdx >= 0 ) {
                    if ( dataRowIdx % 2 === 0 && tableStyle.band1H ) partsToCheck.push( tableStyle.band1H );
                    else if ( dataRowIdx % 2 === 1 && tableStyle.band2H ) partsToCheck.push( tableStyle.band2H );
                }
            }
        }
        if ( firstCol && isFirstCol && tableStyle.firstCol ) partsToCheck.push( tableStyle.firstCol );
        if ( lastCol && isLastCol && tableStyle.lastCol ) partsToCheck.push( tableStyle.lastCol );
        if ( firstRow && isFirstRow && tableStyle.firstRow ) partsToCheck.push( tableStyle.firstRow );
        if ( lastRow && isLastRow && tableStyle.lastRow ) partsToCheck.push( tableStyle.lastRow );
        if ( firstRow && isFirstRow && firstCol && isFirstCol && tableStyle.nwCell ) partsToCheck.push( tableStyle.nwCell );
        if ( firstRow && isFirstRow && lastCol && isLastCol && tableStyle.neCell ) partsToCheck.push( tableStyle.neCell );
        if ( lastRow && isLastRow && firstCol && isFirstCol && tableStyle.swCell ) partsToCheck.push( tableStyle.swCell );
        if ( lastRow && isLastRow && lastCol && isLastCol && tableStyle.seCell ) partsToCheck.push( tableStyle.seCell );

        let finalConditionalFill = null;
        for ( const part of partsToCheck ) {
            if ( part && part.tcStyle && part.tcStyle.fill ) {
                finalConditionalFill = part.tcStyle.fill;
            }
        }

        if ( finalConditionalFill ) {
            if ( finalConditionalFill.type === 'none' ) {
                conditionalFill = 'none';
            } else if ( finalConditionalFill.type === 'solid' ) {
                conditionalFill = { type: 'solid', color: ColorParser.resolveColor( finalConditionalFill.color, slideContext ) };
            } else if ( finalConditionalFill.type === 'gradient' ) {
                const resolvedStops = finalConditionalFill.gradient.stops.map( stop => ( {
                    ...stop,
                    color: ColorParser.resolveColor( stop.color, slideContext, true )
                } ) );
                conditionalFill = { type: 'gradient', gradient: { ...finalConditionalFill.gradient, stops: resolvedStops } };
            }
        }

        if ( conditionalFill && conditionalFill !== 'none' ) {
            return conditionalFill;
        }
        if ( wholeTblFill && wholeTblFill !== 'none' ) {
            return wholeTblFill;
        }
    }

    return null;
}

/**
 * Gets the text style of a table cell.
 * @param {Element} tblPrNode - The table properties XML node.
 * @param {number} r - The row index of the cell.
 * @param {number} c - The column index of the cell.
 * @param {number} numRows - The total number of rows in the table.
 * @param {number} numCols - The total number of columns in the table.
 * @param {Object} tableStyle - The table style object.
 * @returns {Object} The parsed cell text style.
 */
export function getCellTextStyle( tblPrNode, r, c, numRows, numCols, tableStyle, cellNode, slideContext ) {
    if ( !tableStyle ) return {};

    let finalStyle = {};

    const firstRow = tblPrNode.getAttribute( 'firstRow' ) === '1';
    const lastRow = tblPrNode.getAttribute( 'lastRow' ) === '1';
    const firstCol = tblPrNode.getAttribute( 'firstCol' ) === '1';
    const lastCol = tblPrNode.getAttribute( 'lastCol' ) === '1';
    const bandRow = tblPrNode.getAttribute( 'bandRow' ) === '1';
    const bandCol = tblPrNode.getAttribute( 'bandCol' ) === '1';

    const isFirstRow = r === 0;
    const isLastRow = r === numRows - 1;
    const isFirstCol = c === 0;
    const isLastCol = c === numCols - 1;

    // Layer styles in increasing order of precedence
    const partsToCheck = [];
    if ( tableStyle.wholeTbl ) partsToCheck.push( tableStyle.wholeTbl );
    if ( bandCol ) {
        const isDataCol = !( firstCol && isFirstCol ) && !( lastCol && isLastCol );
        if ( isDataCol ) {
            const dataColIdx = firstCol ? c - 1 : c;
            if ( dataColIdx >= 0 ) {
                if ( dataColIdx % 2 === 0 && tableStyle.band1V ) { partsToCheck.push( tableStyle.band1V ); }
                else if ( dataColIdx % 2 === 1 && tableStyle.band2V ) { partsToCheck.push( tableStyle.band2V ); }
            }
        }
    }
    if ( bandRow ) {
        const isDataRow = !( firstRow && isFirstRow ) && !( lastRow && isLastRow );
        if ( isDataRow ) {
            const dataRowIdx = firstRow ? r - 1 : r;
            if ( dataRowIdx >= 0 ) {
                if ( dataRowIdx % 2 === 0 && tableStyle.band1H ) { partsToCheck.push( tableStyle.band1H ); }
                else if ( dataRowIdx % 2 === 1 && tableStyle.band2H ) { partsToCheck.push( tableStyle.band2H ); }
            }
        }
    }
    if ( firstCol && isFirstCol && tableStyle.firstCol ) { partsToCheck.push( tableStyle.firstCol ); }
    if ( lastCol && isLastCol && tableStyle.lastCol ) { partsToCheck.push( tableStyle.lastCol ); }
    if ( firstRow && isFirstRow && tableStyle.firstRow ) { partsToCheck.push( tableStyle.firstRow ); }
    if ( lastRow && isLastRow && tableStyle.lastRow ) { partsToCheck.push( tableStyle.lastRow ); }
    if ( firstRow && isFirstRow && firstCol && isFirstCol && tableStyle.nwCell ) { partsToCheck.push( tableStyle.nwCell ); }
    if ( firstRow && isFirstRow && lastCol && isLastCol && tableStyle.neCell ) { partsToCheck.push( tableStyle.neCell ); }
    if ( lastRow && isLastRow && firstCol && isFirstCol && tableStyle.swCell ) { partsToCheck.push( tableStyle.swCell ); }
    if ( lastRow && isLastRow && lastCol && isLastCol && tableStyle.seCell ) { partsToCheck.push( tableStyle.seCell ); }

    for ( const part of partsToCheck ) {
        if ( part && part.tcTxStyle ) {
            finalStyle = { ...finalStyle, ...part.tcTxStyle };
        }
    }

    const rPrNode = cellNode.getElementsByTagNameNS( DML_NS, 'rPr' )[ 0 ];
    if ( rPrNode ) {
        const sz = rPrNode.getAttribute( 'sz' );
        if ( sz ) {
            finalStyle.fontSize = parseInt( sz ) / 100;
        }

        const latinFontNode = rPrNode.getElementsByTagNameNS( DML_NS, 'latin' )[ 0 ];
        if ( latinFontNode && latinFontNode.hasAttribute( 'typeface' ) ) {
            finalStyle.font = latinFontNode.getAttribute( 'typeface' );
        }

        const solidFillNode = rPrNode.getElementsByTagNameNS( DML_NS, 'solidFill' )[ 0 ];
        if ( solidFillNode ) {
            const colorObj = ColorParser.parseColor( solidFillNode );
            if ( colorObj ) {
                finalStyle.color = colorObj;
            }
        }
    }

    if ( finalStyle.color ) {
        finalStyle.color = ColorParser.resolveColor( finalStyle.color, slideContext );
    }

    return finalStyle;
}

/**
 * Builds an SVG path string from a custom geometry.
 * @param {Object} geometry - The geometry object.
 * @param {Object} pos - The position and dimensions of the shape.
 * @returns {string|null} The SVG path string, or null if the geometry is invalid.
 */
export function buildPathStringFromGeom( geometry, pos, flipH, flipV ) {
    if ( !geometry || !pos ) return null;

    function polarToCartesian( centerX, centerY, radiusX, radiusY, angleInDegrees ) {
        const geomType = geometry.type === 'preset' ? geometry.preset : geometry.type;
        let angleOffset = 180;
        if ( geomType === 'arc' && ( flipH || flipV || geometry.rot ) ) {
            angleOffset = 0;
        }

        const angleInRadians = ( angleInDegrees - angleOffset ) * Math.PI / 180.0;
        return {
            x: centerX + ( radiusX * Math.cos( angleInRadians ) ),
            y: centerY + ( radiusY * Math.sin( angleInRadians ) )
        };
    }

    const geomType = geometry.type === 'preset' ? geometry.preset : geometry.type;

    switch ( geomType ) {
        case 'rect':
            return `M 0 0 L ${ pos.width } 0 L ${ pos.width } ${ pos.height } L 0 ${ pos.height } Z`;
        case 'ellipse':
            return `M ${ pos.width / 2 } 0 A ${ pos.width / 2 } ${ pos.height / 2 } 0 1 0 ${ pos.width / 2 } ${ pos.height } A ${ pos.width / 2 } ${ pos.height / 2 } 0 1 0 ${ pos.width / 2 } 0 Z`;
        case 'arc': {
            const arcAdj = geometry.adjustments;
            let arcStartAngle, arcSweepAngle;

            if ( arcAdj?.adj1 !== undefined && arcAdj?.adj2 !== undefined ) {
                arcStartAngle = arcAdj.adj1 / 60000;
                let endAngleFromXml = arcAdj.adj2 / 60000;
                if ( endAngleFromXml < arcStartAngle ) {
                    endAngleFromXml -= 360;
                }
                arcSweepAngle = endAngleFromXml - arcStartAngle;

                if ( !flipH && !flipV ) {
                    // Unintuitive; but it's the only thing that worked. So it must be right.
                    arcStartAngle -= 60;
                    arcSweepAngle /= Math.PI * Math.SQRT2;
                }
            } else {
                arcStartAngle = 90;
                arcSweepAngle = 90;
            }

            const arcEndAngle = arcStartAngle + arcSweepAngle;
            const arcCenterX = pos.width / 2;
            const arcCenterY = pos.height / 2;
            const arcRadiusX = pos.width / 2;
            const arcRadiusY = pos.height / 2;

            const arcStart = polarToCartesian( arcCenterX, arcCenterY, arcRadiusX, arcRadiusY, arcStartAngle );
            const arcEnd = polarToCartesian( arcCenterX, arcCenterY, arcRadiusX, arcRadiusY, arcEndAngle );

            const arcLargeArcFlag = Math.abs( arcSweepAngle ) <= 180 ? "0" : "1";
            let arcSweepFlag = arcSweepAngle >= 0 ? "1" : "0";
            if ( flipH ^ flipV ) {
                arcSweepFlag = arcSweepFlag === "0" ? "0" : "1";
            }


            console.log( { arcStart, arcEnd } );

            return `M ${ arcStart.x } ${ arcStart.y } A ${ arcRadiusX } ${ arcRadiusY } 0 ${ arcLargeArcFlag } ${ arcSweepFlag } ${ arcEnd.x } ${ arcEnd.y }`;
        }
        case 'custom':
            if ( geometry.path ) {
                const pathData = geometry.path;
                const scaleX = pathData.w === 0 ? 1 : pos.width / pathData.w;
                const scaleY = pathData.h === 0 ? 1 : pos.height / pathData.h;

                let pathString = '';
                pathData.commands.forEach( command => {
                    switch ( command.cmd ) {
                        case 'moveTo': {
                            const p = command.points[ 0 ];
                            pathString += `M ${ p.x * scaleX } ${ p.y * scaleY } `;
                            break;
                        }
                        case 'lnTo': {
                            const p = command.points[ 0 ];
                            pathString += `L ${ p.x * scaleX } ${ p.y * scaleY } `;
                            break;
                        }
                        case 'cubicBezTo': {
                            const p1 = command.points[ 0 ];
                            const p2 = command.points[ 1 ];
                            const p3 = command.points[ 2 ];
                            pathString += `C ${ p1.x * scaleX } ${ p1.y * scaleY } ${ p2.x * scaleX } ${ p2.y * scaleY } ${ p3.x * scaleX } ${ p3.y * scaleY } `;
                            break;
                        }
                        case 'quadBezTo': {
                            const p1 = command.points[ 0 ];
                            const p2 = command.points[ 1 ];
                            pathString += `Q ${ p1.x * scaleX } ${ p1.y * scaleY } ${ p2.x * scaleX } ${ p2.y * scaleY } `;
                            break;
                        }
                        case 'close': {
                            pathString += 'Z ';
                            break;
                        }
                    }
                } );
                return pathString;
            }
            return null;
        case 'blockArc': {
            const avLst = geometry.adjustments;
            const adj1 = avLst?.adj1 !== undefined ? avLst.adj1 : 0;
            const adj2 = avLst?.adj2 !== undefined ? avLst.adj2 : 10800000;
            const adj3 = avLst?.adj3 !== undefined ? avLst.adj3 : 50000;

            const startAngle = adj1 / 60000;
            const sweepAngle = adj2 / 60000;
            const endAngle = startAngle + sweepAngle;

            const centerX = pos.width / 2;
            const centerY = pos.height / 2;
            const outerRadiusX = pos.width / 2;
            const outerRadiusY = pos.height / 2;

            const innerRadiusRatio = adj3 / 100000;
            const innerRadiusX = outerRadiusX * ( 1 - innerRadiusRatio );
            const innerRadiusY = outerRadiusY * ( 1 - innerRadiusRatio );

            const outerStart = polarToCartesian( centerX, centerY, outerRadiusX, outerRadiusY, startAngle );
            const outerEnd = polarToCartesian( centerX, centerY, outerRadiusX, outerRadiusY, endAngle );
            const innerStart = polarToCartesian( centerX, centerY, innerRadiusX, innerRadiusY, startAngle );
            const innerEnd = polarToCartesian( centerX, centerY, innerRadiusX, innerRadiusY, endAngle );

            const largeArcFlag = sweepAngle <= 180 ? "0" : "1";

            return `M ${ outerStart.x } ${ outerStart.y } A ${ outerRadiusX } ${ outerRadiusY } 0 ${ largeArcFlag } 1 ${ outerEnd.x } ${ outerEnd.y } L ${ innerEnd.x } ${ innerEnd.y } A ${ innerRadiusX } ${ innerRadiusY } 0 ${ largeArcFlag } 0 ${ innerStart.x } ${ innerStart.y } Z`;
        }
        case 'roundRect': {
            const adj_roundRect = geometry.adjustments?.adj !== undefined ? geometry.adjustments.adj : 16667;
            const cornerRadiusRatio = adj_roundRect / 100000;
            const cornerRadius = ( ( pos.width + pos.height ) / 2 ) * cornerRadiusRatio;

            return `M ${ cornerRadius } 0 L ${ pos.width - cornerRadius } 0 A ${ cornerRadius } ${ cornerRadius } 0 0 1 ${ pos.width } ${ cornerRadius } L ${ pos.width } ${ pos.height - cornerRadius } A ${ cornerRadius } ${ cornerRadius } 0 0 1 ${ pos.width - cornerRadius } ${ pos.height } L ${ cornerRadius } ${ pos.height } A ${ cornerRadius } ${ cornerRadius } 0 0 1 0 ${ pos.height - cornerRadius } L 0 ${ cornerRadius } A ${ cornerRadius } ${ cornerRadius } 0 0 1 ${ cornerRadius } 0 Z`;
        }
        case 'round1Rect':
        case 'round2SameRect':
        case 'round2DiagRect':
        case 'snip1Rect':
        case 'snip2SameRect':
        case 'snip2DiagRect':
        case 'snipRoundRect': {
            const adj1_multi = geometry.adjustments?.adj1 !== undefined ? geometry.adjustments.adj1 : 16667;
            const adj2_multi = geometry.adjustments?.adj2 !== undefined ? geometry.adjustments.adj2 : 16667;
            const cornerRadius1 = Math.min( pos.width, pos.height ) * ( adj1_multi / 100000 );
            const cornerRadius2 = Math.min( pos.width, pos.height ) * ( adj2_multi / 100000 );

            switch ( geomType ) {
                case 'round1Rect':
                    return `M 0 ${ cornerRadius1 } A ${ cornerRadius1 } ${ cornerRadius1 } 0 0 1 ${ cornerRadius1 } 0 L ${ pos.width } 0 L ${ pos.width } ${ pos.height } L 0 ${ pos.height } Z`;
                case 'round2SameRect':
                    return `M 0 ${ cornerRadius1 } A ${ cornerRadius1 } ${ cornerRadius1 } 0 0 1 ${ cornerRadius1 } 0 L ${ pos.width - cornerRadius2 } 0 A ${ cornerRadius2 } ${ cornerRadius2 } 0 0 1 ${ pos.width } ${ cornerRadius2 } L ${ pos.width } ${ pos.height } L 0 ${ pos.height } Z`;
                case 'round2DiagRect':
                    return `M 0 ${ cornerRadius1 } A ${ cornerRadius1 } ${ cornerRadius1 } 0 0 1 ${ cornerRadius1 } 0 L ${ pos.width } 0 L ${ pos.width } ${ pos.height - cornerRadius2 } A ${ cornerRadius2 } ${ cornerRadius2 } 0 0 1 ${ pos.width - cornerRadius2 } ${ pos.height } L 0 ${ pos.height } Z`;
                case 'snip1Rect':
                    return `M ${ cornerRadius1 } 0 L ${ pos.width } 0 L ${ pos.width } ${ pos.height } L 0 ${ pos.height } L 0 ${ cornerRadius1 } Z`;
                case 'snip2SameRect':
                    return `M ${ cornerRadius1 } 0 L ${ pos.width - cornerRadius2 } 0 L ${ pos.width } ${ cornerRadius2 } L ${ pos.width } ${ pos.height } L 0 ${ pos.height } L 0 ${ cornerRadius1 } Z`;
                case 'snip2DiagRect':
                    return `M ${ cornerRadius1 } 0 L ${ pos.width } 0 L ${ pos.width } ${ pos.height - cornerRadius2 } L ${ pos.width - cornerRadius2 } ${ pos.height } L 0 ${ pos.height } L 0 ${ cornerRadius1 } Z`;
                case 'snipRoundRect':
                    return `M ${ cornerRadius1 } 0 L ${ pos.width } 0 L ${ pos.width } ${ pos.height } L ${ cornerRadius2 } ${ pos.height } A ${ cornerRadius2 } ${ cornerRadius2 } 0 0 1 0 ${ pos.height - cornerRadius2 } L 0 ${ cornerRadius1 } Z`;
            }
            break;
        }
        case 'corner': {
            return `M 0 0 L 0 ${ pos.height } L ${ pos.width } ${ pos.height }`;
        }
        case 'chevron': {
            const adj_chevron = geometry.adjustments?.adj !== undefined ? geometry.adjustments.adj : 50000;
            const adjRatio = adj_chevron / 100000;
            const x1 = pos.width * adjRatio * ( 3 / 10 );
            const x2 = pos.width - x1;
            const midY = pos.height / 2;
            return `M 0 0 L ${ x2 } 0 L ${ pos.width } ${ midY } L ${ x2 } ${ pos.height } L 0 ${ pos.height } L ${ x1 } ${ midY } Z`;
        }
        case 'homePlate': {
            const adj_homePlate = geometry.adjustments?.adj !== undefined ? geometry.adjustments.adj : 50000;
            const adjRatio = adj_homePlate / 100000;
            const shoulderX = pos.width * adjRatio * ( 3 / 10 );
            const x2 = pos.width - shoulderX;
            return `M 0 0 L ${ x2 } 0 L ${ pos.width } ${ pos.height / 2 } L ${ x2 } ${ pos.height } L 0 ${ pos.height } Z`;
        }
    }

    return null;
}
