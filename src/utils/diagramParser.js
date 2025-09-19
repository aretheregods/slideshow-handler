/**
 * @module diagramParser
 * @description A module for parsing diagram data from presentation XML.
 */

import {
    parseXmlString,
    ColorParser,
    Matrix,
    parseLineProperties,
    parseGradientFill,
    parseParagraphProperties,
    parseBodyProperties,
    resolveFontFamily,
    getAutoNumberingChar,
    resolvePath,
    getNormalizedXmlString,
    buildPathStringFromGeom,
} from 'utils';
import {
    EMU_PER_PIXEL,
    PT_TO_PX,
    LINE_HEIGHT,
    INDENTATION_AMOUNT,
    BULLET_OFFSET,
    PML_NS,
    DML_NS,
    DIAGRAM_NS,
    DSP_NS,
} from 'constants';

/**
 * Parses a diagram shape from a `dsp:sp` node.
 * @param {Element} dspSpNode - The `dsp:sp` XML node.
 * @param {Object} slideContext - The context of the slide.
 * @param {Matrix} parentMatrix - The transformation matrix of the parent element.
 * @returns {Object|null} The parsed shape data, or null if invalid.
 */
function parseDiagramShape(dspSpNode, dataModel, slideContext, parentMatrix) {
    const spPrNode = dspSpNode.getElementsByTagNameNS(DSP_NS, 'spPr')[0];
    if (!spPrNode) return null;

    const xfrmNode = spPrNode.getElementsByTagNameNS(DML_NS, 'xfrm')[0];
    if (!xfrmNode) return null;

    const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
    const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
    if (!offNode || !extNode) return null;

    const x = parseInt(offNode.getAttribute("x")) / EMU_PER_PIXEL;
    const y = parseInt(offNode.getAttribute("y")) / EMU_PER_PIXEL;
    const w = parseInt(extNode.getAttribute("cx")) / EMU_PER_PIXEL;
    const h = parseInt(extNode.getAttribute("cy")) / EMU_PER_PIXEL;
    const rot = parseInt(xfrmNode.getAttribute('rot') || '0') / 60000;
    const flipH = xfrmNode.getAttribute('flipH') === '1';
    const flipV = xfrmNode.getAttribute('flipV') === '1';

    const localMatrix = new Matrix();
    localMatrix.translate(x, y);
    localMatrix.translate(w / 2, h / 2);
    localMatrix.rotate(rot * Math.PI / 180);
    localMatrix.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    localMatrix.translate(-w / 2, -h / 2);

    const finalMatrix = parentMatrix.clone().multiply(localMatrix);
    const transform = `matrix(${finalMatrix.m.join(' ')})`;
    const pos = { x: 0, y: 0, width: w, height: h };

    const shapeProps = { fill: null, stroke: null, geometry: null, effect: null };

    const prstGeomNode = spPrNode.getElementsByTagNameNS(DML_NS, 'prstGeom')[0];
    if (prstGeomNode) {
        const avLstNode = prstGeomNode.getElementsByTagNameNS(DML_NS, 'avLst')[0];
        const adjustments = {};
        if (avLstNode) {
            const gdNodes = avLstNode.getElementsByTagNameNS(DML_NS, 'gd');
            for (const gdNode of gdNodes) {
                const name = gdNode.getAttribute('name');
                const fmla = gdNode.getAttribute('fmla');
                if (fmla && fmla.startsWith('val ')) {
                    adjustments[name] = parseInt(fmla.substring(4));
                }
            }
        }
        shapeProps.geometry = {
            type: 'preset',
            preset: prstGeomNode.getAttribute('prst'),
            adjustments: adjustments,
        };
    }

    const styleNode = dspSpNode.getElementsByTagNameNS(DSP_NS, 'style')[0];
    if (styleNode) {
        const fillRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'fillRef')[0];
        if (fillRefNode) {
            const color = ColorParser.parseColor(fillRefNode);
            if (color) {
                shapeProps.fill = { type: 'solid', color: ColorParser.resolveColor(color, slideContext) };
            }
        }

        const lnRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'lnRef')[0];
        if (lnRefNode) {
            const color = ColorParser.parseColor(lnRefNode);
            if (color) {
                shapeProps.stroke = {
                    color: ColorParser.resolveColor(color, slideContext),
                    width: 1,
                    dash: 'solid',
                };
            }
        }
    }

    if (!shapeProps.fill) {
        const solidFillNode = spPrNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
        if (solidFillNode) {
            const colorObj = ColorParser.parseColor(solidFillNode);
            if (colorObj) shapeProps.fill = { type: 'solid', color: ColorParser.resolveColor(colorObj, slideContext) };
        }
    }

    if (!shapeProps.stroke) {
        const lnNode = spPrNode.getElementsByTagNameNS(DML_NS, 'ln')[0];
        if (lnNode) {
            shapeProps.stroke = parseLineProperties(lnNode, slideContext);
        }
    }

    const modelId = dspSpNode.getAttribute('modelId');
    const tNode = dataModel[modelId];

    let textData = null;
    let txBodyNode = dspSpNode.getElementsByTagNameNS(DML_NS, 'txBody')[0];
    const useDataModelText = !txBodyNode || txBodyNode.textContent.trim() === '';

    if (useDataModelText && tNode) {
        txBodyNode = document.createElementNS(DML_NS, 'txBody');
        for (const child of Array.from(tNode.children)) {
            txBodyNode.appendChild(child.cloneNode(true));
        }
    }

    if (txBodyNode) {
        const bodyPr = parseBodyProperties(txBodyNode);
        const listStyle = txBodyNode.getElementsByTagNameNS(DML_NS, 'lstStyle')[0];
        const paragraphs = Array.from(txBodyNode.getElementsByTagNameNS(DML_NS, 'p'));

        if (paragraphs.length > 0) {
            const textPos = { ...pos };
            const txXfrmNode = dspSpNode.getElementsByTagNameNS(DML_NS, 'txXfrm')[0];
            if (txXfrmNode) {
                const txOffNode = txXfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
                const txExtNode = txXfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
                if (txOffNode && txExtNode) {
                    textPos.x = parseInt(txOffNode.getAttribute("x")) / EMU_PER_PIXEL;
                    textPos.y = parseInt(txOffNode.getAttribute("y")) / EMU_PER_PIXEL;
                    textPos.width = parseInt(txExtNode.getAttribute("cx")) / EMU_PER_PIXEL;
                    textPos.height = parseInt(txExtNode.getAttribute("cy")) / EMU_PER_PIXEL;
                }
            }
            // Simplified text layout for diagrams
            const styleNode = dspSpNode.getElementsByTagNameNS(DSP_NS, 'style')[0];
            const fontRefNode = styleNode?.getElementsByTagNameNS(DML_NS, 'fontRef')[0];
            const fontRef = fontRefNode ? { idx: fontRefNode.getAttribute('idx'), color: ColorParser.parseColor(fontRefNode) } : null;
            const layout = layoutDiagramParagraphs(paragraphs, textPos, bodyPr, slideContext, fontRef);
            textData = { layout, bodyPr, pos: textPos };
        }
    }

    return {
        type: 'shape',
        transform,
        pos,
        shapeProps,
        text: textData,
        flipH,
        flipV,
        rot,
    };
}

function layoutDiagramParagraphs(paragraphs, pos, bodyPr, slideContext, fontRef) {
    const paddedPos = {
        x: pos.x + (bodyPr.lIns || 0), y: pos.y + (bodyPr.tIns || 0),
        width: pos.width - (bodyPr.lIns || 0) - (bodyPr.rIns || 0),
        height: pos.height - (bodyPr.tIns || 0) - (bodyPr.bIns || 0),
    };

    const lines = [];
    let currentY = 0;

    for (const pNode of paragraphs) {
        const pPrNode = pNode.getElementsByTagNameNS(DML_NS, 'pPr')[0];
        const finalProps = parseParagraphProperties(pPrNode, slideContext) || { bullet: {}, defRPr: {} };
        finalProps.defRPr = finalProps.defRPr || {};

        let currentLine = { runs: [], width: 0, height: 0, paragraphProps: finalProps, startY: currentY, isFirstLine: true };
        const pushLine = () => {
            if (currentLine.runs.length > 0) {
                lines.push(currentLine);
                currentY += currentLine.height || LINE_HEIGHT;
            }
            currentLine = { runs: [], width: 0, height: 0, paragraphProps: finalProps, startY: currentY, isFirstLine: false };
        };

        for (const childNode of Array.from(pNode.childNodes).filter(n => ['r', 'fld', 'br'].includes(n.localName))) {
            if (childNode.localName === 'br') { pushLine(); continue; }
            const text = childNode.textContent;
            if (!text) continue;

            const rPr = childNode.getElementsByTagNameNS(DML_NS, 'rPr')[0];
            const runProps = { ...finalProps.defRPr };
            if (!runProps.color && fontRef?.color) {
                runProps.color = fontRef.color;
            }
            if (rPr) {
                if (rPr.getAttribute('sz')) runProps.size = (parseInt(rPr.getAttribute('sz')) / 100);
                if (rPr.getAttribute('b') === '1') runProps.bold = true; else if (rPr.getAttribute('b') === '0') runProps.bold = false;
                if (rPr.getAttribute('i') === '1') runProps.italic = true; else if (rPr.getAttribute('i') === '0') runProps.italic = false;
                const solidFill = rPr.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
                if (solidFill) runProps.color = ColorParser.parseColor(solidFill);
                const latinFont = rPr.getElementsByTagNameNS(DML_NS, 'latin')[0];
                if (latinFont?.getAttribute('typeface')) runProps.font = latinFont.getAttribute('typeface');
            }

            let fontSize = (runProps.size || 18) * PT_TO_PX;
            const fontFamily = runProps.font || 'Arial';
            const tempCtx = document.createElement('canvas').getContext('2d');
            tempCtx.font = `${runProps.italic ? 'italic' : 'normal'} ${runProps.bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;

            for (const word of text.split(/(\s+)/)) {
                if (!word) continue;
                const wordWidth = tempCtx.measureText(word).width;
                if (currentLine.width + wordWidth > paddedPos.width && currentLine.runs.length > 0) {
                    pushLine();
                }
                currentLine.runs.push({
                    text: word,
                    font: { style: runProps.italic ? 'italic' : 'normal', weight: runProps.bold ? 'bold' : 'normal', size: fontSize, family: fontFamily },
                    color: ColorParser.resolveColor(runProps.color, slideContext) || '#000000'
                });
                currentLine.width += wordWidth;
                currentLine.height = Math.max(currentLine.height, fontSize * 1.25);
            }
        }
        pushLine();
    }

    for (const line of lines) {
        const { align } = line.paragraphProps;
        let lineXOffset = 0;
        if (align === 'ctr') lineXOffset = (paddedPos.width - line.width) / 2;
        else if (align === 'r') lineXOffset = paddedPos.width - line.width;
        line.x = paddedPos.x + lineXOffset;
    }

    return { totalHeight: currentY, lines };
}


/**
 * Parses a diagram from a graphic frame.
 * @param {Element} frameNode - The graphic frame node containing the diagram.
 * @param {Object} diagram - An object containing the diagram parts (data, layout, style, color).
 * @param {Object} slideRels - The slide relationships.
 * @param {Object} entriesMap - A map of all presentation entries.
 * @param {Object} slideContext - The context of the slide.
 * @param {Matrix} parentMatrix - The transformation matrix of the parent element.
 * @returns {Promise<Array>} A promise that resolves to an array of shape objects.
 */
export async function parseDiagram(frameNode, slideRels, entriesMap, slideContext, parentMatrix) {
    const graphicData = frameNode.getElementsByTagNameNS(DML_NS, 'graphicData')[0];
    if (!graphicData) return [];
    const diagramRelIds = graphicData.getElementsByTagNameNS(DIAGRAM_NS, 'relIds')[0];
    if (!diagramRelIds) return [];
    const dataRelId = diagramRelIds.getAttribute('r:dm');

    const dataPath = resolvePath('ppt/slides', slideRels[dataRelId].target);
    const dataXml = await getNormalizedXmlString(entriesMap, dataPath);
    if (!dataXml) return [];

    const dataDoc = parseXmlString(dataXml);
    const extLst = dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'extLst')[0];
    const ext = extLst?.getElementsByTagNameNS(DML_NS, 'ext')[0];
    const dataModelExt = ext?.getElementsByTagNameNS('http://schemas.microsoft.com/office/drawing/2008/diagram', 'dataModelExt')[0];
    const drawingRelId = dataModelExt?.getAttribute('relId');

    if (!drawingRelId || !slideRels[drawingRelId]) return [];

    const drawingPath = resolvePath('ppt/slides', slideRels[drawingRelId].target);
    const drawingXml = await getNormalizedXmlString(entriesMap, drawingPath);
    if (!drawingXml) return [];

    const drawingDoc = parseXmlString(drawingXml);
    const spTree = drawingDoc.getElementsByTagNameNS('http://schemas.microsoft.com/office/drawing/2008/diagram', 'spTree')[0];
    if (!spTree) return [];

    const colorRelId = diagramRelIds.getAttribute('r:cs');
    const styleRelId = diagramRelIds.getAttribute('r:qs');

    const colorPath = resolvePath('ppt/slides', slideRels[colorRelId].target);
    const stylePath = resolvePath('ppt/slides', slideRels[styleRelId].target);

    const colorXml = await getNormalizedXmlString(entriesMap, colorPath);
    const styleXml = await getNormalizedXmlString(entriesMap, stylePath);

    const colorMap = parseDiagramColors(colorXml);
    const styleMap = parseDiagramStyle(styleXml);

    const dataModel = {};
    const ptNodes = dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'pt');
    for (const ptNode of ptNodes) {
        const modelId = ptNode.getAttribute('modelId');
        if (modelId) {
            const tNode = ptNode.getElementsByTagNameNS(DIAGRAM_NS, 't')[0];
            if (tNode) {
                dataModel[modelId] = tNode;
            }
        }
    }

    const shapes = [];
    for (const dspSpNode of spTree.getElementsByTagNameNS('http://schemas.microsoft.com/office/drawing/2008/diagram', 'sp')) {
        const shape = parseDiagramShape(dspSpNode, dataModel, slideContext, parentMatrix);
        if (shape) {
            shapes.push(shape);
        }
    }

    return shapes;
}

function parseDiagramColors(colorXml) {
    if (!colorXml) return {};

    const colorMap = {};
    const xmlDoc = parseXmlString(colorXml);
    const styleLblNodes = xmlDoc.getElementsByTagNameNS(DIAGRAM_NS, 'styleLbl');

    for (const styleLblNode of styleLblNodes) {
        const name = styleLblNode.getAttribute('name');
        if (name) {
            const fillClrLstNode = styleLblNode.getElementsByTagNameNS(DIAGRAM_NS, 'fillClrLst')[0];
            const linClrLstNode = styleLblNode.getElementsByTagNameNS(DIAGRAM_NS, 'linClrLst')[0];
            const effectClrLstNode = styleLblNode.getElementsByTagNameNS(DIAGRAM_NS, 'effectClrLst')[0];
            const txLinClrLstNode = styleLblNode.getElementsByTagNameNS(DIAGRAM_NS, 'txLinClrLst')[0];
            const txFillClrLstNode = styleLblNode.getElementsByTagNameNS(DIAGRAM_NS, 'txFillClrLst')[0];
            const txEffectClrLstNode = styleLblNode.getElementsByTagNameNS(DIAGRAM_NS, 'txEffectClrLst')[0];

            colorMap[name] = {
                fill: fillClrLstNode ? Array.from(fillClrLstNode.children).map(c => ColorParser.parseColor(c)) : [],
                line: linClrLstNode ? Array.from(linClrLstNode.children).map(c => ColorParser.parseColor(c)) : [],
                effect: effectClrLstNode ? Array.from(effectClrLstNode.children).map(c => ColorParser.parseColor(c)) : [],
                txLine: txLinClrLstNode ? Array.from(txLinClrLstNode.children).map(c => ColorParser.parseColor(c)) : [],
                txFill: txFillClrLstNode ? Array.from(txFillClrLstNode.children).map(c => ColorParser.parseColor(c)) : [],
                txEffect: txEffectClrLstNode ? Array.from(txEffectClrLstNode.children).map(c => ColorParser.parseColor(c)) : [],
            };
        }
    }

    return colorMap;
}

function parseDiagramStyle(styleXml) {
    if (!styleXml) return {};

    const styleMap = {};
    const xmlDoc = parseXmlString(styleXml);
    const styleLblNodes = xmlDoc.getElementsByTagNameNS(DIAGRAM_NS, 'styleLbl');

    for (const styleLblNode of styleLblNodes) {
        const name = styleLblNode.getAttribute('name');
        if (name) {
            const styleNode = styleLblNode.getElementsByTagNameNS(DIAGRAM_NS, 'style')[0];
            if (styleNode) {
                const lnRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'lnRef')[0];
                const fillRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'fillRef')[0];
                const effectRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'effectRef')[0];
                const fontRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'fontRef')[0];

                styleMap[name] = {
                    lnRef: lnRefNode ? { idx: lnRefNode.getAttribute('idx'), color: ColorParser.parseColor(lnRefNode) } : null,
                    fillRef: fillRefNode ? { idx: fillRefNode.getAttribute('idx'), color: ColorParser.parseColor(fillRefNode) } : null,
                    effectRef: effectRefNode ? { idx: effectRefNode.getAttribute('idx'), color: ColorParser.parseColor(effectRefNode) } : null,
                    fontRef: fontRefNode ? { idx: fontRefNode.getAttribute('idx'), color: ColorParser.parseColor(fontRefNode) } : null,
                };
            }
        }
    }

    return styleMap;
}
