import { parseXmlString, ColorParser } from 'utils';
import { EMU_PER_PIXEL, PT_TO_PX, PML_NS, DML_NS, CHART_NS } from '../constants.js';
import { parseExtensions } from './extensionParser.js';

/**
 * Parses the theme XML file.
 * @param {string} themeXml - The XML content of the theme file.
 * @returns {Object} The parsed theme object.
 */
export function parseTheme(themeXml) {
    const xmlDoc = parseXmlString(themeXml, "theme");
    const theme = {
        colorScheme: {},
        fontScheme: {},
        formatScheme: {
            fills: [],
            lines: [],
            effects: [],
            bgFills: [],
        },
    };

    const clrSchemeNode = xmlDoc.getElementsByTagNameNS(DML_NS, 'clrScheme')[0];
    if (clrSchemeNode) {
        for (const child of clrSchemeNode.children) {
            const colorName = child.localName;
            const srgbClrNode = child.getElementsByTagNameNS(DML_NS, 'srgbClr')[0];
            if (srgbClrNode) {
                theme.colorScheme[colorName] = `#${srgbClrNode.getAttribute('val')}`;
            }
            const sysClrNode = child.getElementsByTagNameNS(DML_NS, 'sysClr')[0];
            if (sysClrNode) {
                const lastColor = sysClrNode.getAttribute('lastClr');
                if (lastColor) {
                    // Use lastClr as a fallback, it's often more reliable
                    theme.colorScheme[colorName] = `#${lastColor}`;
                }
                // If no lastClr, we don't set a color, letting it fall back to default.
            }
        }
    }

    const fontSchemeNode = xmlDoc.getElementsByTagNameNS(DML_NS, 'fontScheme')[0];
    if (fontSchemeNode) {
        const majorFontNode = fontSchemeNode.getElementsByTagNameNS(DML_NS, 'majorFont')[0];
        if (majorFontNode) {
            const latinFontNode = majorFontNode.getElementsByTagNameNS(DML_NS, 'latin')[0];
            if (latinFontNode) {
                theme.fontScheme.major = latinFontNode.getAttribute('typeface');
            }
        }
        const minorFontNode = fontSchemeNode.getElementsByTagNameNS(DML_NS, 'minorFont')[0];
        if (minorFontNode) {
            const latinFontNode = minorFontNode.getElementsByTagNameNS(DML_NS, 'latin')[0];
            if (latinFontNode) {
                theme.fontScheme.minor = latinFontNode.getAttribute('typeface');
            }
        }
    }

    const fmtSchemeNode = xmlDoc.getElementsByTagNameNS(DML_NS, 'fmtScheme')[0];
    if (fmtSchemeNode) {
        const fillStyleLstNode = fmtSchemeNode.getElementsByTagNameNS(DML_NS, 'fillStyleLst')[0];
        if (fillStyleLstNode) {
            for (const fillNode of fillStyleLstNode.children) {
                if (fillNode.localName === 'solidFill') {
                    const colorObj = ColorParser.parseColor(fillNode);
                    theme.formatScheme.fills.push({ type: 'solid', color: colorObj });
                } else if (fillNode.localName === 'gradFill') {
                    const gsLstNode = fillNode.getElementsByTagNameNS(DML_NS, 'gsLst')[0];
                    const stops = [];
                    if (gsLstNode) {
                        for (const gsNode of gsLstNode.children) {
                            const pos = parseInt(gsNode.getAttribute('pos')) / 100000;
                            const colorObj = ColorParser.parseColor(gsNode);
                            if (colorObj) {
                                stops.push({ pos, color: colorObj });
                            }
                        }
                        stops.sort((a, b) => a.pos - b.pos);
                    }
                    let angle = 0;
                    let type = 'linear';
                    const linNode = fillNode.getElementsByTagNameNS(DML_NS, 'lin')[0];
                    if (linNode) {
                        angle = parseInt(linNode.getAttribute('ang')) / 60000;
                    }
                    const pathNode = fillNode.getElementsByTagNameNS(DML_NS, 'path')[0];
                    if(pathNode) {
                        type = 'path';
                    }
                    theme.formatScheme.fills.push({ type: 'gradient', gradient: { type, stops, angle } });
                } else if (fillNode.localName === 'blipFill') {
                    const blipNode = fillNode.getElementsByTagNameNS(DML_NS, 'blip')[0];
                    if (blipNode) {
                        const relId = blipNode.getAttribute('r:embed');
                        theme.formatScheme.fills.push({ type: 'image', relId: relId });
                    }
                } else if (fillNode.localName === 'pattFill') {
                    const pattern = {
                        type: 'pattern',
                        pattern: fillNode.getAttribute('prst'),
                        fgColor: null,
                        bgColor: null,
                    };
                    const fgClrNode = fillNode.getElementsByTagNameNS(DML_NS, 'fgClr')[0];
                    if (fgClrNode) {
                        pattern.fgColor = ColorParser.parseColor(fgClrNode);
                    }
                    const bgClrNode = fillNode.getElementsByTagNameNS(DML_NS, 'bgClr')[0];
                    if (bgClrNode) {
                        pattern.bgColor = ColorParser.parseColor(bgClrNode);
                    }
                    theme.formatScheme.fills.push(pattern);
                } else if (fillNode.localName === 'grpFill') {
                    theme.formatScheme.fills.push({ type: 'group' });
                } else if (fillNode.localName === 'noFill') {
                    theme.formatScheme.fills.push({ type: 'none' });
                } else {
                    theme.formatScheme.fills.push({ type: 'unsupported' });
                }
            }
        }

        const lnStyleLstNode = fmtSchemeNode.getElementsByTagNameNS(DML_NS, 'lnStyleLst')[0];
        if (lnStyleLstNode) {
            for (const lineNode of lnStyleLstNode.children) {
                const width = parseInt(lineNode.getAttribute('w') || '9525');
                const cap = lineNode.getAttribute('cap');
                const cmpd = lineNode.getAttribute('cmpd');

                const solidFillNode = lineNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
                if (solidFillNode) {
                    const colorObj = ColorParser.parseColor(solidFillNode);
                    theme.formatScheme.lines.push({ type: 'solid', color: colorObj, width: width / EMU_PER_PIXEL, cap, cmpd });
                } else {
                    theme.formatScheme.lines.push({ type: 'unsupported' });
                }
            }
        }

        const effectStyleLstNode = fmtSchemeNode.getElementsByTagNameNS(DML_NS, 'effectStyleLst')[0];
        if (effectStyleLstNode) {
            for (const effectStyleNode of effectStyleLstNode.children) {
                if (effectStyleNode.localName === 'effectStyle') {
                    const effectLstNode = effectStyleNode.getElementsByTagNameNS(DML_NS, 'effectLst')[0];
                    if (effectLstNode) {
                        const outerShdwNode = effectLstNode.getElementsByTagNameNS(DML_NS, 'outerShdw')[0];
                        if (outerShdwNode) {
                            const blurRad = parseInt(outerShdwNode.getAttribute('blurRad') || '0') / EMU_PER_PIXEL;
                            const dist = parseInt(outerShdwNode.getAttribute('dist') || '0') / EMU_PER_PIXEL;
                            const dir = parseInt(outerShdwNode.getAttribute('dir') || '0') / 60000;
                            const color = ColorParser.parseColor(outerShdwNode);
                            theme.formatScheme.effects.push({
                                type: 'outerShdw',
                                blurRad,
                                dist,
                                dir,
                                color,
                            });
                        } else {
                            // Placeholder for other or no effects
                            theme.formatScheme.effects.push(null);
                        }
                    } else {
                        theme.formatScheme.effects.push(null);
                    }
                }
            }
        }

        const bgFillStyleLstNode = fmtSchemeNode.getElementsByTagNameNS(DML_NS, 'bgFillStyleLst')[0];
        if (bgFillStyleLstNode) {
            for (const fillNode of bgFillStyleLstNode.children) {
                if (fillNode.localName === 'solidFill') {
                    const colorObj = ColorParser.parseColor(fillNode);
                    theme.formatScheme.bgFills.push({ type: 'solid', color: colorObj });
                } else if (fillNode.localName === 'gradFill') {
                    const gsLstNode = fillNode.getElementsByTagNameNS(DML_NS, 'gsLst')[0];
                    const stops = [];
                    if (gsLstNode) {
                        for (const gsNode of gsLstNode.children) {
                            const pos = parseInt(gsNode.getAttribute('pos')) / 100000;
                            const colorObj = ColorParser.parseColor(gsNode);
                            if (colorObj) {
                                stops.push({ pos, color: colorObj });
                            }
                        }
                        stops.sort((a, b) => a.pos - b.pos);
                    }
                    let angle = 0;
                    let type = 'linear';
                    const linNode = fillNode.getElementsByTagNameNS(DML_NS, 'lin')[0];
                    if (linNode) {
                        angle = parseInt(linNode.getAttribute('ang')) / 60000;
                    }
                    const pathNode = fillNode.getElementsByTagNameNS(DML_NS, 'path')[0];
                    if(pathNode) {
                        type = 'path';
                    }
                    theme.formatScheme.bgFills.push({ type: 'gradient', gradient: { type, stops, angle } });
                } else if (fillNode.localName === 'blipFill') {
                    const blipNode = fillNode.getElementsByTagNameNS(DML_NS, 'blip')[0];
                    if (blipNode) {
                        const relId = blipNode.getAttribute('r:embed');
                        theme.formatScheme.bgFills.push({ type: 'image', relId: relId });
                    }
                } else if (fillNode.localName === 'pattFill') {
                    const pattern = {
                        type: 'pattern',
                        pattern: fillNode.getAttribute('prst'),
                        fgColor: null,
                        bgColor: null,
                    };
                    const fgClrNode = fillNode.getElementsByTagNameNS(DML_NS, 'fgClr')[0];
                    if (fgClrNode) {
                        pattern.fgColor = ColorParser.parseColor(fgClrNode);
                    }
                    const bgClrNode = fillNode.getElementsByTagNameNS(DML_NS, 'bgClr')[0];
                    if (bgClrNode) {
                        pattern.bgColor = ColorParser.parseColor(bgClrNode);
                    }
                    theme.formatScheme.fills.push(pattern);
                } else if (fillNode.localName === 'grpFill') {
                    theme.formatScheme.fills.push({ type: 'group' });
                } else if (fillNode.localName === 'noFill') {
                    theme.formatScheme.fills.push({ type: 'none' });
                } else {
                    theme.formatScheme.fills.push({ type: 'unsupported' });
                }
            }
        }
    }

    return theme;
}

/**
 * Parses a color map from a node's attributes.
 * @param {Element} node - The XML node containing the color map attributes.
 * @returns {Object} The parsed color map.
 */
export function parseColorMap(node) {
    const colorMap = {};
    if (node) {
        for (const { name, value } of node.attributes) {
            colorMap[name] = value;
        }
    }
    return colorMap;
}

/**
 * Parses table styles from an XML string.
 * @param {string} xmlString - The XML content of the table styles.
 * @returns {{styles: Object, defaultStyleId: string}} An object containing the parsed styles and the default style ID.
 */
export function parseTableStyles(xmlString) {
    const xmlDoc = parseXmlString(xmlString, "tableStyles");
    const styles = {};

    const tblStyleLstNode = xmlDoc.getElementsByTagNameNS(DML_NS, 'tblStyleLst')[0];
    const defaultStyleId = tblStyleLstNode ? tblStyleLstNode.getAttribute('def') : null;

    const tblStyleNodes = xmlDoc.getElementsByTagNameNS(DML_NS, 'tblStyle');

    for (const styleNode of tblStyleNodes) {
        const styleId = styleNode.getAttribute('styleId');
        const styleDef = {};

        const styleParts = ['wholeTbl', 'band1H', 'band2H', 'band1V', 'band2V', 'firstRow', 'lastRow', 'firstCol', 'lastCol', 'nwCell', 'neCell', 'swCell', 'seCell'];

        for (const partName of styleParts) {
            const partNode = styleNode.getElementsByTagNameNS(DML_NS, partName)[0];
            if (partNode) {
                styleDef[partName] = parseStylePart(partNode);
            }
        }
        styles[styleId] = styleDef;
    }

    return { styles, defaultStyleId };
}

/**
 * Parses a part of a table style.
 * @param {Element} partNode - The XML node of the style part.
 * @returns {Object} The parsed style part definition.
 */
export function parseStylePart(partNode) {
    const partDef = {
        tcStyle: {},
        tcTxStyle: {}
    };

    const tcStyleNode = partNode.getElementsByTagNameNS(DML_NS, 'tcStyle')[0];
    if (tcStyleNode) {
        const fillContainer = tcStyleNode.getElementsByTagNameNS(DML_NS, 'fill')[0] || tcStyleNode;
        for (const fillChild of fillContainer.children) {
            if (fillChild.localName === 'noFill') {
                partDef.tcStyle.fill = { type: 'none' };
                break;
            } else if (fillChild.localName === 'solidFill') {
                partDef.tcStyle.fill = { type: 'solid', color: ColorParser.parseColor(fillChild) };
                break;
            } else if (fillChild.localName === 'gradFill') {
                const gsLstNode = fillChild.getElementsByTagNameNS(DML_NS, 'gsLst')[0];
                const stops = [];
                if (gsLstNode) {
                    for (const gsNode of gsLstNode.children) {
                        const pos = parseInt(gsNode.getAttribute('pos')) / 100000;
                        const colorObj = ColorParser.parseColor(gsNode);
                        if (colorObj) {
                            stops.push({ pos, color: colorObj });
                        }
                    }
                    stops.sort((a, b) => a.pos - b.pos);
                }
                let angle = 0;
                let type = 'linear';
                const linNode = fillChild.getElementsByTagNameNS(DML_NS, 'lin')[0];
                if (linNode) {
                    angle = parseInt(linNode.getAttribute('ang')) / 60000;
                }
                partDef.tcStyle.fill = { type: 'gradient', gradient: { type, stops, angle } };
                break;
            }
        }

        const tcBdrNode = tcStyleNode.getElementsByTagNameNS(DML_NS, 'tcBdr')[0];
        if (tcBdrNode) {
            partDef.tcStyle.borders = {};
            const borderTypes = ['left', 'right', 'top', 'bottom'];
            for (const type of borderTypes) {
                const borderNode = tcBdrNode.getElementsByTagNameNS(DML_NS, type)[0];
                if (borderNode) {
                    const lnNode = borderNode.getElementsByTagNameNS(DML_NS, 'ln')[0];
                    if (lnNode) {
                        const width = parseInt(lnNode.getAttribute('w') || '9525') / EMU_PER_PIXEL;
                        const solidFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
                        if (solidFillNode) {
                            const colorObj = ColorParser.parseColor(solidFillNode);
                            if (colorObj) {
                                partDef.tcStyle.borders[type] = {
                                    width: width,
                                    color: colorObj
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    const tcTxStyleNode = partNode.getElementsByTagNameNS(DML_NS, 'tcTxStyle')[0];
    if (tcTxStyleNode) {
        const style = {};
        const bold = tcTxStyleNode.getAttribute( 'b' );
        if ( bold === '1' || bold === 'on' ) {
            style.bold = true;
        } else if ( bold === '0' || bold === 'off' ) {
            style.bold = false;
        }

        const italic = tcTxStyleNode.getAttribute( 'i' );
        if ( italic === '1' || italic === 'on' ) {
            style.italic = true;
        } else if ( italic === '0' || italic === 'off' ) {
            style.italic = false;
        }

        // Color can be in fontRef or a direct child of tcTxStyle
        const fontRefNode = tcTxStyleNode.getElementsByTagNameNS(DML_NS, 'fontRef')[0];
        const colorContainerNode = fontRefNode || tcTxStyleNode; // This is where the color info lives

        // The actual color can be a direct child, or inside a fill tag.
        const solidFillNode = colorContainerNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];

        const colorSourceNode = solidFillNode || colorContainerNode; // Pass the fill node if it exists

        const colorObj = ColorParser.parseColor(colorSourceNode);
        if (colorObj) {
            style.color = colorObj;
        }

        partDef.tcTxStyle = style;
    }

    return partDef;
}

/**
 * Parses the background of a slide.
 * @param {XMLDocument} xmlDoc - The XML document of the slide.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object|null} The parsed background object, or null if no background is defined.
 */
export function parseBackground(xmlDoc, slideContext) {
    const bgNode = xmlDoc.getElementsByTagNameNS(PML_NS, 'bg')[0];
    if (!bgNode) {
        return null;
    }

    let bg = null;
    const bgPrNode = bgNode.getElementsByTagNameNS(PML_NS, 'bgPr')[0];
    const bgRefNode = bgNode.getElementsByTagNameNS(PML_NS, 'bgRef')[0];

    if (bgPrNode) {
        const solidFillNode = bgPrNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
        if (solidFillNode) {
            const colorObj = ColorParser.parseColor(solidFillNode);
            if (colorObj) {
                bg = { type: 'color', value: ColorParser.resolveColor(colorObj, slideContext) };
            }
        }

        const gradFillNode = bgPrNode.getElementsByTagNameNS(DML_NS, 'gradFill')[0];
        if (gradFillNode) {
            bg = parseGradientFill(gradFillNode, slideContext);
        }

        const blipFillNode = bgPrNode.getElementsByTagNameNS(DML_NS, 'blipFill')[0];
        if (blipFillNode) {
            const blipNode = blipFillNode.getElementsByTagNameNS(DML_NS, 'blip')[0];
            if (blipNode) {
                const relId = blipNode.getAttribute('r:embed');
                bg = { type: 'image', relId: relId };
            }
        }
    } else if (bgRefNode) {
        const idx = parseInt(bgRefNode.getAttribute('idx'));
        if (idx > 0 && idx < 1000) {
            const themeBgFill = slideContext.theme.formatScheme.bgFills[idx - 1];
            if (themeBgFill) {
                if (themeBgFill.type === 'solid') {
                    const color = ColorParser.resolveColor(themeBgFill.color, slideContext);
                    bg = { type: 'color', value: color };
                } else if (themeBgFill.type === 'gradient') {
                    const resolvedStops = themeBgFill.gradient.stops.map(stop => ({
                        ...stop,
                        color: ColorParser.resolveColor(stop.color, slideContext, true)
                    }));
                    bg = { type: 'gradient', gradient: { ...themeBgFill.gradient, stops: resolvedStops } };
                }
            }
        } else if (idx >= 1000) {
            const colorObj = ColorParser.parseColor(bgRefNode);
            if (colorObj) {
                bg = { type: 'color', value: ColorParser.resolveColor(colorObj, slideContext) };
            }
        }
    }

    return bg;
}

/**
 * Parses a custom geometry from a `custGeom` node.
 * @param {Element} custGeomNode - The `custGeom` XML node.
 * @returns {Object|null} The parsed custom geometry object, or null if invalid.
 */
export function parseCustomGeometry(custGeomNode) {
    if (!custGeomNode) return null;
    const pathLstNode = custGeomNode.getElementsByTagNameNS(DML_NS, 'pathLst')[0];
    if (!pathLstNode) return null;

    const pathNode = pathLstNode.getElementsByTagNameNS(DML_NS, 'path')[0];
    if (!pathNode) return null;

    const pathW = parseInt(pathNode.getAttribute('w'));
    const pathH = parseInt(pathNode.getAttribute('h'));
    const commands = [];

    for (const cmdNode of pathNode.children) {
        const cmd = cmdNode.localName;
        const ptNodes = cmdNode.getElementsByTagNameNS(DML_NS, 'pt');
        const points = Array.from(ptNodes).map(pt => ({
            x: parseInt(pt.getAttribute('x')),
            y: parseInt(pt.getAttribute('y')),
        }));

        // close doesn't have points, handle it separately
        if (cmd === 'close') {
            commands.push({ cmd: 'close', points: [] });
        } else {
            commands.push({ cmd, points });
        }
    }

    if (commands.length === 0) return null;

    return {
        commands: commands,
        w: pathW,
        h: pathH,
    };
}

/**
 * Parses a gradient fill from a fill node.
 * @param {Element} fillNode - The XML node containing the gradient fill data.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object} The parsed gradient fill object.
 */
export function parseGradientFill(fillNode, slideContext) {
    const gsLstNode = fillNode.getElementsByTagNameNS(DML_NS, 'gsLst')[0];
    const stops = [];
    if (gsLstNode) {
        for (const gsNode of gsLstNode.children) {
            const pos = parseInt(gsNode.getAttribute('pos')) / 100000;
            const colorObj = ColorParser.parseColor(gsNode);
            if (colorObj) {
                stops.push({ pos, color: ColorParser.resolveColor(colorObj, slideContext, true) });
            }
        }
        stops.sort((a, b) => a.pos - b.pos);
    }

    let angle = 0;
    let type = 'linear';
    const linNode = fillNode.getElementsByTagNameNS(DML_NS, 'lin')[0];
    if (linNode) {
        angle = parseInt(linNode.getAttribute('ang')) / 60000;
    }

    const pathNode = fillNode.getElementsByTagNameNS(DML_NS, 'path')[0];
    if(pathNode) {
        type = 'path';
    }

    return { type: 'gradient', gradient: { type, stops, angle } };
}

/**
 * Parses line properties from an `ln` node.
 * @param {Element} lnNode - The `ln` XML node.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object|null} The parsed line properties object, or null if no line is defined.
 */
export function parseLineProperties(lnNode, slideContext) {
    if (!lnNode) return null;

    const noFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'noFill')[0];
    if (noFillNode) return null;

    const capMap = {
        rnd: 'round',
        sq: 'square',
        flat: 'butt'
    };

    const props = {
        width: parseInt(lnNode.getAttribute('w') || '9525') / EMU_PER_PIXEL,
        cap: capMap[lnNode.getAttribute('cap')] || 'butt',
        join: null, // miter, round, bevel
        cmpd: lnNode.getAttribute('cmpd'),
        dash: [],
    };

    const roundNode = lnNode.getElementsByTagNameNS(DML_NS, 'round')[0];
    if (roundNode) props.join = 'round';

    const bevelNode = lnNode.getElementsByTagNameNS(DML_NS, 'bevel')[0];
    if (bevelNode) props.join = 'bevel';

    const miterNode = lnNode.getElementsByTagNameNS(DML_NS, 'miter')[0];
    if (miterNode) props.join = 'miter';

    const prstDashNode = lnNode.getElementsByTagNameNS(DML_NS, 'prstDash')[0];
    if (prstDashNode) {
        const dashType = prstDashNode.getAttribute('val') || 'solid';
        const w = props.width;
        switch (dashType) {
            case 'dot':
                props.dash = [w, 3 * w];
                break;
            case 'dash':
                props.dash = [3 * w, 4 * w];
                break;
            case 'lgDash':
                props.dash = [8 * w, 3 * w];
                break;
            case 'dashDot':
                props.dash = [4 * w, 3 * w, w, 3 * w];
                break;
            case 'lgDashDot':
                props.dash = [8 * w, 3 * w, w, 3 * w];
                break;
            case 'lgDashDotDot':
                props.dash = [8 * w, 3 * w, w, 3 * w, w, 3 * w];
                break;
            case 'sysDash':
                props.dash = [3 * w, w];
                break;
            case 'sysDot':
                props.dash = [w, w];
                break;
            case 'sysDashDot':
                props.dash = [3 * w, w, w, w];
                break;
            case 'sysDashDotDot':
                props.dash = [3 * w, w, w, w, w, w];
                break;
        }
    }

    const solidFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
    if (solidFillNode) {
        props.color = ColorParser.resolveColor(ColorParser.parseColor(solidFillNode), slideContext);
    }

    const gradFillNode = lnNode.getElementsByTagNameNS(DML_NS, 'gradFill')[0];
    if (gradFillNode) {
        props.color = parseGradientFill(gradFillNode, slideContext);
    }

    return props;
}

/**
 * Parses the properties of a shape.
 * @param {Element} shapeNode - The shape's XML node.
 * @param {Object} slideContext - The context of the slide.
 * @param {number|string} slideNum - The slide number, used for context in error messages.
 * @returns {Object} The parsed shape properties.
 */
export function parseShapeProperties(shapeNode, slideContext, slideNum) {
    const spPrNode = shapeNode.getElementsByTagNameNS(PML_NS, 'spPr')[0];
    if (!spPrNode) return { fill: null, stroke: null, geometry: null, rawFillNode: null, rawStrokeNode: null, effect: null };

    const properties = { fill: null, stroke: null, geometry: null, rawFillNode: null, rawStrokeNode: null, effect: null };

    const prstGeomNode = spPrNode.getElementsByTagNameNS(DML_NS, 'prstGeom')[0];
    if (prstGeomNode) {
        const avLstNode = prstGeomNode.getElementsByTagNameNS(DML_NS, 'avLst')[0];
        const adjustments = {};
        if (avLstNode) {
            const gdNodes = avLstNode.getElementsByTagNameNS(DML_NS, 'gd');
            for (const gdNode of gdNodes) {
                const name = gdNode.getAttribute('name');
                const fmla = gdNode.getAttribute('fmla');
                if (fmla.startsWith('val ')) {
                    adjustments[name] = parseInt(fmla.substring(4));
                }
            }
        }
        properties.geometry = {
            type: 'preset',
            preset: prstGeomNode.getAttribute('prst'),
            adjustments: adjustments,
        };
    }

    const custGeomNode = spPrNode.getElementsByTagNameNS(DML_NS, 'custGeom')[0];
    if (custGeomNode) {
        properties.geometry = { type: 'custom', path: parseCustomGeometry(custGeomNode) };
    }

    // --- Fill Parsing ---
    let fillNode = null;
    const fillTypes = ['solidFill', 'gradFill', 'noFill', 'blipFill', 'pattFill', 'grpFill'];
    for (const child of spPrNode.children) {
        if (fillTypes.includes(child.localName)) {
            fillNode = child;
            break;
        }
    }

    if (fillNode) {
        properties.rawFillNode = fillNode.outerHTML;
        if (fillNode.localName === 'noFill') {
            properties.fill = { type: 'none' };
        } else if (fillNode.localName === 'solidFill') {
            const colorObj = ColorParser.parseColor(fillNode);
            if (colorObj) properties.fill = { type: 'solid', color: ColorParser.resolveColor(colorObj, slideContext) };
        } else if (fillNode.localName === 'gradFill') {
            properties.fill = parseGradientFill(fillNode, slideContext);
        } else if (fillNode.localName === 'blipFill') {
            const blipNode = fillNode.getElementsByTagNameNS(DML_NS, 'blip')[0];
            if (blipNode) {
                const rotWithShape = fillNode.getAttribute('rotWithShape') !== '0';
                properties.fill = { type: 'image', relId: blipNode.getAttribute('r:embed'), rotWithShape };
            }
        } else if (fillNode.localName === 'pattFill') {
            const fgClrNode = fillNode.getElementsByTagNameNS(DML_NS, 'fgClr')[0];
            const bgClrNode = fillNode.getElementsByTagNameNS(DML_NS, 'bgClr')[0];
            properties.fill = {
                type: 'pattern',
                pattern: fillNode.getAttribute('prst'),
                fgColor: fgClrNode ? ColorParser.resolveColor(ColorParser.parseColor(fgClrNode), slideContext) : '#000000',
                bgColor: bgClrNode ? ColorParser.resolveColor(ColorParser.parseColor(bgClrNode), slideContext) : 'transparent',
            };
        } else if (fillNode.localName === 'grpFill') {
            properties.fill = { type: 'group' };
        }
    } else {
        const styleNode = shapeNode.getElementsByTagNameNS(PML_NS, 'style')[0];
        if (styleNode) {
            const fillRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'fillRef')[0];
            if (fillRefNode) {
                properties.rawFillNode = fillRefNode.outerHTML;
                const idx = parseInt(fillRefNode.getAttribute('idx'));
                const colorOverride = ColorParser.parseColor(fillRefNode);
                if (idx > 0 && slideContext.theme.formatScheme.fills[idx - 1]) {
                    const themeFill = slideContext.theme.formatScheme.fills[idx - 1];
                    let colorObj = colorOverride || themeFill.color;
                    if (themeFill.type === 'solid') {
                        properties.fill = { type: 'solid', color: ColorParser.resolveColor(colorObj, slideContext) };
                    }
                } else if (colorOverride) {
                    properties.fill = { type: 'solid', color: ColorParser.resolveColor(colorOverride, slideContext) };
                }
            }
        }
    }

    // --- Stroke Parsing ---
    const lnNode = spPrNode.getElementsByTagNameNS(DML_NS, 'ln')[0];
    if (lnNode) {
        properties.rawStrokeNode = lnNode.outerHTML;
        properties.stroke = parseLineProperties(lnNode, slideContext);
    } else {
        const styleNode = shapeNode.getElementsByTagNameNS(PML_NS, 'style')[0];
        if (styleNode) {
            const lnRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'lnRef')[0];
            if (lnRefNode) {
                properties.rawStrokeNode = lnRefNode.outerHTML;
                const idx = parseInt(lnRefNode.getAttribute('idx'));
                if (idx > 0 && slideContext.theme.formatScheme.lines[idx - 1]) {
                    const themeLine = slideContext.theme.formatScheme.lines[idx - 1];
                    if (themeLine.type === 'solid') {
                        const strokeProps = { ...themeLine };
                        const lnRefColorObj = ColorParser.parseColor(lnRefNode);
                        if (lnRefColorObj) {
                            strokeProps.color = ColorParser.resolveColor(lnRefColorObj, slideContext);
                        } else {
                            strokeProps.color = ColorParser.resolveColor(themeLine.color, slideContext);
                        }
                        properties.stroke = strokeProps;
                    }
                }
            }
        }
    }

    // --- Effect Parsing ---
    const effectLstNode = spPrNode.getElementsByTagNameNS(DML_NS, 'effectLst')[0];
    if (effectLstNode) {
        const outerShdwNode = effectLstNode.getElementsByTagNameNS(DML_NS, 'outerShdw')[0];
        if (outerShdwNode) {
            const blurRad = parseInt(outerShdwNode.getAttribute('blurRad') || '0') / EMU_PER_PIXEL;
            const dist = parseInt(outerShdwNode.getAttribute('dist') || '0') / EMU_PER_PIXEL;
            const dir = parseInt(outerShdwNode.getAttribute('dir') || '0') / 60000;
            const colorObj = ColorParser.parseColor(outerShdwNode);
            properties.effect = {
                type: 'outerShdw',
                blurRad,
                dist,
                dir,
                color: ColorParser.resolveColor(colorObj, slideContext),
            };
        }
    } else {
        const styleNode = shapeNode.getElementsByTagNameNS(PML_NS, 'style')[0];
        if (styleNode) {
            const effectRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'effectRef')[0];
            if (effectRefNode) {
                const idx = parseInt(effectRefNode.getAttribute('idx'));
                if (idx > 0 && slideContext.theme.formatScheme.effects[idx - 1]) {
                    properties.effect = slideContext.theme.formatScheme.effects[idx - 1];
                    // Apply color override if present
                    const colorOverride = ColorParser.parseColor(effectRefNode);
                    if (properties.effect && colorOverride) {
                        properties.effect.color = ColorParser.resolveColor(colorOverride, slideContext);
                    }
                }
            }
        }
    }

    // --- Default Fill Logic ---
    if (properties.fill === null && shapeNode.localName !== 'cxnSp') {
            if (!properties.rawFillNode) { // Only apply default if no fill was specified at all
                if (slideContext.theme && slideContext.theme.formatScheme.fills.length > 0) {
                    const defaultFill = slideContext.theme.formatScheme.fills[1] || slideContext.theme.formatScheme.fills[0]; // Often the second fill is the default shape fill
                    if (defaultFill.type === 'solid' && defaultFill.color) {
                        properties.fill = { type: 'solid', color: ColorParser.resolveColor(defaultFill.color, slideContext) };
                    }
                }
            }
    }

    return properties;
}

/**
 * Parses text styles from a style node.
 * @param {Element} styleNode - The XML node containing the text styles.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object|null} The parsed text styles, or null if the style node is not provided.
 */
export function parseTextStyle(styleNode, slideContext) {
    if (!styleNode) return null;
    const styles = {};
    for (let i = 1; i <= 9; i++) {
        const lvlPr = styleNode.getElementsByTagNameNS(DML_NS, `lvl${i}pPr`)[0];
        if (lvlPr) {
            styles[i - 1] = parseParagraphProperties(lvlPr, slideContext);
        }
    }
    return styles;
}

/**
 * Parses the body properties of a text body.
 * @param {Element} txBodyNode - The `txBody` XML node.
 * @returns {Object} The parsed body properties.
 */
export function parseBodyProperties(txBodyNode) {
    const bodyPrNode = txBodyNode ? txBodyNode.getElementsByTagNameNS(DML_NS, 'bodyPr')[0] : null;

    if (!bodyPrNode) return {};

    const props = {};
    const anchor = bodyPrNode.getAttribute('anchor');
    if (anchor) props.anchor = anchor;

    const lIns = bodyPrNode.getAttribute('lIns');
    if (lIns) props.lIns = parseInt(lIns) / EMU_PER_PIXEL;

    const tIns = bodyPrNode.getAttribute('tIns');
    if (tIns) props.tIns = parseInt(tIns) / EMU_PER_PIXEL;

    const rIns = bodyPrNode.getAttribute('rIns');
    if (rIns) props.rIns = parseInt(rIns) / EMU_PER_PIXEL;

    const bIns = bodyPrNode.getAttribute('bIns');
    if (bIns) props.bIns = parseInt(bIns) / EMU_PER_PIXEL;

    const noAutofitNode = bodyPrNode.getElementsByTagNameNS(DML_NS, 'noAutofit')[0];
    if (noAutofitNode) {
        props.noAutofit = true;
    }

    const normAutofitNode = bodyPrNode.getElementsByTagNameNS(DML_NS, 'normAutofit')[0];
    if (normAutofitNode) {
        const fontScale = normAutofitNode.getAttribute('fontScale');
        if (fontScale) {
            props.fontScale = parseInt(fontScale) / 100000;
        }
        const lnSpcReduction = normAutofitNode.getAttribute('lnSpcReduction');
        if (lnSpcReduction) {
            props.lnSpcReduction = parseInt(lnSpcReduction) / 100000;
        }
    }

    return props;
}

/**
 * Parses the properties of a paragraph.
 * @param {Element} pPrNode - The `pPr` XML node.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object} The parsed paragraph properties.
 */
export function parseParagraphProperties(pPrNode, slideContext) {
    if (!pPrNode) return {};

    const properties = { bullet: {}, defRPr: {} };

    const align = pPrNode.getAttribute('algn');
    if (align) properties.align = align;

    const marL = pPrNode.getAttribute('marL');
    if (marL) properties.marL = parseInt(marL) / EMU_PER_PIXEL;

    const indent = pPrNode.getAttribute('indent');
    if (indent) properties.indent = parseInt(indent) / EMU_PER_PIXEL;

    const buNone = pPrNode.getElementsByTagNameNS(DML_NS, 'buNone')[0];
    if (buNone) properties.bullet.type = 'none';

    const buChar = pPrNode.getElementsByTagNameNS(DML_NS, 'buChar')[0];
    if (buChar) {
        properties.bullet.type = 'char';
        properties.bullet.char = buChar.getAttribute('char');
    }

    const buFont = pPrNode.getElementsByTagNameNS(DML_NS, 'buFont')[0];
    if (buFont) {
        properties.bullet.font = buFont.getAttribute('typeface');
    }

    const buAutoNum = pPrNode.getElementsByTagNameNS(DML_NS, 'buAutoNum')[0];
    if (buAutoNum) {
        properties.bullet.type = 'auto';
        properties.bullet.scheme = buAutoNum.getAttribute('type');
        properties.bullet.startAt = parseInt(buAutoNum.getAttribute('startAt') || '1');
    }

    const buBlip = pPrNode.getElementsByTagNameNS(DML_NS, 'buBlip')[0];
    if (buBlip) {
        const blip = buBlip.getElementsByTagNameNS(DML_NS, 'blip')[0];
        if (blip) {
            properties.bullet.type = 'image';
            properties.bullet.relId = blip.getAttribute('r:embed');
        }
    }

    const buSzPct = pPrNode.getElementsByTagNameNS(DML_NS, 'buSzPct')[0];
    if (buSzPct) {
        properties.bullet.size = `${parseInt(buSzPct.getAttribute('val')) / 1000}%`;
    }

    const buSzPts = pPrNode.getElementsByTagNameNS(DML_NS, 'buSzPts')[0];
    if (buSzPts) {
        properties.bullet.size = `${parseInt(buSzPts.getAttribute('val')) / 100}pt`;
    }

    const buClr = pPrNode.getElementsByTagNameNS(DML_NS, 'buClr')[0];
    if (buClr) {
        // Here, the color element is not a solidFill, but a direct child
        const srgbClr = buClr.getElementsByTagNameNS(DML_NS, 'srgbClr')[0];
        if (srgbClr) {
            properties.bullet.color = { srgb: `#${srgbClr.getAttribute('val')}` };
        }
        const schemeClr = buClr.getElementsByTagNameNS(DML_NS, 'schemeClr')[0];
        if (schemeClr) {
            properties.bullet.color = ColorParser.parseColor(buClr);
        }
    }

    const defRPrNode = pPrNode.getElementsByTagNameNS(DML_NS, 'defRPr')[0];
    if (defRPrNode) {
        const sz = defRPrNode.getAttribute('sz');
        if (sz) {
            properties.defRPr.size = (parseInt(sz) / 100) * PT_TO_PX;
        }
        properties.defRPr.bold = defRPrNode.getAttribute('b') === '1';
        properties.defRPr.italic = defRPrNode.getAttribute('i') === '1';

        const solidFillNode = defRPrNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
        if (solidFillNode) {
            properties.defRPr.color = ColorParser.parseColor(solidFillNode);
        }

        const latinFontNode = defRPrNode.getElementsByTagNameNS(DML_NS, 'latin')[0];
        if (latinFontNode) {
            const typeface = latinFontNode.getAttribute('typeface');
            if (typeface) {
                if (typeface.startsWith('+mj-')) {
                    properties.defRPr.font = slideContext?.theme?.fontScheme?.major || typeface;
                } else if (typeface.startsWith('+mn-')) {
                    properties.defRPr.font = slideContext?.theme?.fontScheme?.minor || typeface;
                } else {
                    properties.defRPr.font = typeface;
                }
            }
        }
    }

    return properties;
}

/**
 * Parses a slide master or layout XML.
 * @param {string} xml - The XML content of the master or layout.
 * @param {Object} theme - The presentation theme.
 * @param {Object|null} masterColorMap - The color map from the master slide.
 * @param {boolean} isLayout - A flag indicating whether the XML is for a slide layout.
 * @returns {Object} An object containing placeholders, static shapes, default text styles, and color maps.
 */
export function parseMasterOrLayout(xml, theme, masterColorMap = null, isLayout = false) {
    const xmlDoc = parseXmlString(xml, isLayout ? "slideLayout" : "slideMaster");

    const placeholders = {};
    const staticShapes = [];
    const defaultTextStyles = {};
    let colorMap = null;
    let colorMapOverride = null;
    let extensions = null;

    const rootNode = xmlDoc.documentElement;
    if ( rootNode ) {
        const cSldNode = rootNode.getElementsByTagNameNS(PML_NS, 'cSld')[0];
        if ( cSldNode ) {
            extensions = parseExtensions(cSldNode);
        }

        const rootExtensions = parseExtensions(rootNode);
        if ( rootExtensions ) {
            extensions = (extensions || []).concat(rootExtensions);
        }
    }

    if (isLayout) {
        const clrMapOvrNode = xmlDoc.getElementsByTagNameNS(PML_NS, 'clrMapOvr')[0];
        if (clrMapOvrNode) {
            const overrideNode = clrMapOvrNode.getElementsByTagNameNS(DML_NS, 'overrideClrMapping')[0];
            if (overrideNode) {
                colorMapOverride = parseColorMap(overrideNode);
            }
        }
    } else {
        const clrMapNode = xmlDoc.getElementsByTagNameNS(PML_NS, 'clrMap')[0];
        colorMap = parseColorMap(clrMapNode);
    }

    const txStyles = xmlDoc.getElementsByTagNameNS(PML_NS, 'txStyles')[0];
    const tempSlideContext = {
        theme: theme,
        colorMap: isLayout ? { ...(masterColorMap || {}), ...(colorMapOverride || {}) } : colorMap,
    };
    if (txStyles) {
        defaultTextStyles.title = parseTextStyle(txStyles.getElementsByTagNameNS(PML_NS, 'titleStyle')[0], tempSlideContext);
        defaultTextStyles.body = parseTextStyle(txStyles.getElementsByTagNameNS(PML_NS, 'bodyStyle')[0], tempSlideContext);
        defaultTextStyles.other = parseTextStyle(txStyles.getElementsByTagNameNS(PML_NS, 'otherStyle')[0], tempSlideContext);
    }

    const spTreeNode = xmlDoc.getElementsByTagNameNS(PML_NS, 'spTree')[0];
    if (spTreeNode) {
        for (const shapeNode of spTreeNode.children) {
            const supportedNodes = ['sp', 'cxnSp', 'grpSp', 'graphicFrame', 'pic'];
            if (!supportedNodes.includes(shapeNode.localName)) {
                continue;
            }

            const nvPr = shapeNode.getElementsByTagNameNS(PML_NS, 'nvPr')[0];
            const ph = nvPr ? nvPr.getElementsByTagNameNS(PML_NS, 'ph')[0] : null;

            if (ph) {
                const type = ph.getAttribute('type');
                const idx = ph.getAttribute('idx');
                const key = idx ? `idx_${idx}` : type;

                // Always create a placeholder entry for shapes with a <p:ph> tag.
                // The position will be added only if it exists.
                const placeholderData = {
                    pos: null,
                    type: type,
                    listStyle: null,
                    shapeProps: {},
                    bodyPr: {}
                };

                const xfrmNode = shapeNode.getElementsByTagNameNS(DML_NS, 'xfrm')[0];
                if (xfrmNode) {
                    const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
                    const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
                    if (offNode && extNode) {
                        placeholderData.pos = {
                            x: parseInt(offNode.getAttribute("x")) / EMU_PER_PIXEL,
                            y: parseInt(offNode.getAttribute("y")) / EMU_PER_PIXEL,
                            width: parseInt(extNode.getAttribute("cx")) / EMU_PER_PIXEL,
                            height: parseInt(extNode.getAttribute("cy")) / EMU_PER_PIXEL,
                        };
                        placeholderData.transform = {
                            rot: parseInt(xfrmNode.getAttribute('rot') || '0'),
                            flipH: xfrmNode.getAttribute('flipH') === '1',
                            flipV: xfrmNode.getAttribute('flipV') === '1',
                        };
                    }
                }

                const txBodyNode = shapeNode.getElementsByTagNameNS(PML_NS, 'txBody')[0];
                if (txBodyNode) {
                    const lstStyleNode = txBodyNode.getElementsByTagNameNS(DML_NS, 'lstStyle')[0];
                    if (lstStyleNode) {
                        placeholderData.listStyle = parseTextStyle(lstStyleNode, tempSlideContext);
                    }
                    placeholderData.bodyPr = parseBodyProperties(txBodyNode);
                    placeholderData.txBodyNode = txBodyNode;
                }

                placeholderData.shapeProps = parseShapeProperties(shapeNode, tempSlideContext, "layout/master");

                placeholders[key] = placeholderData;

                if (type === 'pic') {
                    staticShapes.push(shapeNode);
                }
            } else {
                staticShapes.push(shapeNode);
            }
        }
    }
    return { placeholders, staticShapes, defaultTextStyles, colorMap, colorMapOverride, extensions };
}

/**
 * Parses the source rectangle of a blip fill.
 * @param {Element} blipFillNode - The `blipFill` XML node.
 * @returns {Object|null} The parsed source rectangle, or null if not defined.
 */
export function parseSourceRectangle(blipFillNode) {
    if (!blipFillNode) return null;
    const srcRectNode = blipFillNode.getElementsByTagNameNS(DML_NS, 'srcRect')[0];
    if (!srcRectNode) return null;

    return {
        l: parseInt(srcRectNode.getAttribute('l') || '0') / 100000,
        r: parseInt(srcRectNode.getAttribute('r') || '0') / 100000,
        t: parseInt(srcRectNode.getAttribute('t') || '0') / 100000,
        b: parseInt(srcRectNode.getAttribute('b') || '0') / 100000,
    };
}

/**
 * Parses chart data from a chart XML file.
 * @param {string} chartXml - The XML content of the chart.
 * @returns {Object|null} The parsed chart data, or null if the chart is invalid.
 */
export function parseChart(chartXml) {
    const xmlDoc = parseXmlString(chartXml, "chart");

    const chartData = {
        type: null,
        title: null,
        labels: [],
        datasets: []
    };

    const titleNode = xmlDoc.getElementsByTagNameNS(CHART_NS, 'title')[0];
    if (titleNode) {
        chartData.title = titleNode.textContent.trim();
    }

    const plotAreaNode = xmlDoc.getElementsByTagNameNS(CHART_NS, 'plotArea')[0];
    if (!plotAreaNode) return null;

    const chartTypeMap = {
        'barChart': 'bar',
        'lineChart': 'line',
        'pieChart': 'pie',
        'doughnutChart': 'doughnut',
        'ofPieChart': 'pie',
        // TODO: Add other chart types
    };

    let chartTypeNode;
    for (const type in chartTypeMap) {
        chartTypeNode = plotAreaNode.getElementsByTagNameNS(CHART_NS, type)[0];
        if (chartTypeNode) {
            chartData.type = chartTypeMap[type];
            break;
        }
    }

    if (!chartTypeNode) return null;

    const serNodes = chartTypeNode.getElementsByTagNameNS(CHART_NS, 'ser');
    for (const serNode of serNodes) {
        const dataset = {
            label: '',
            data: []
        };

        const txValNode = serNode.getElementsByTagNameNS(CHART_NS, 'tx')[0]?.getElementsByTagNameNS(CHART_NS, 'v')[0];
        if (txValNode) {
            dataset.label = txValNode.textContent.trim();
        }

        const catNode = serNode.getElementsByTagNameNS(CHART_NS, 'cat')[0];
        if (catNode) {
            const strRefNode = catNode.getElementsByTagNameNS(CHART_NS, 'strRef')[0];
            if (strRefNode) {
                const ptNodes = strRefNode.getElementsByTagNameNS(CHART_NS, 'pt');
                chartData.labels = Array.from(ptNodes).map(pt => pt.textContent.trim());
            }
        }

        const valNode = serNode.getElementsByTagNameNS(CHART_NS, 'val')[0];
        if (valNode) {
            const numRefNode = valNode.getElementsByTagNameNS(CHART_NS, 'numRef')[0];
            if (numRefNode) {
                const ptNodes = numRefNode.getElementsByTagNameNS(CHART_NS, 'pt');
                dataset.data = Array.from(ptNodes).map(pt => parseFloat(pt.textContent.trim()));
            }
        }

        chartData.datasets.push(dataset);
    }

    return chartData;
}
