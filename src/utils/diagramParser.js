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

    // Apply styles in the correct cascading order.
    // 1. Apply the referenced theme style from <dsp:style> as the base.
    const styleNode = dspSpNode.getElementsByTagNameNS(DSP_NS, 'style')[0];
    if (styleNode) {
        const fillRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'fillRef')[0];
        if (fillRefNode) {
            const colorObj = ColorParser.parseColor(fillRefNode);
            if (colorObj) shapeProps.fill = { type: 'solid', color: ColorParser.resolveColor(colorObj, slideContext) };
        }

        const lnRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'lnRef')[0];
        if (lnRefNode) {
            const colorObj = ColorParser.parseColor(lnRefNode);
            if (colorObj) {
                shapeProps.stroke = {
                    color: ColorParser.resolveColor(colorObj, slideContext),
                    width: 1, // default
                    dash: 'solid', // default
                };
            }
        }
    }

    const solidFillNode = spPrNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
    if (solidFillNode) {
        const colorObj = ColorParser.parseColor(solidFillNode);
        if (colorObj) shapeProps.fill = { type: 'solid', color: ColorParser.resolveColor(colorObj, slideContext) };
    }

    const lnNode = spPrNode.getElementsByTagNameNS(DML_NS, 'ln')[0];
    if (lnNode) {
        shapeProps.stroke = parseLineProperties(lnNode, slideContext);
    }

    const modelId = dspSpNode.getAttribute('modelId');
    const tNode = dataModel[modelId];

    let textData = null;
    let txBodyNode = dspSpNode.getElementsByTagNameNS(DSP_NS, 'txBody')[0];
    const useDataModelText = !txBodyNode || txBodyNode.textContent.trim() === '';

    if (useDataModelText && tNode) {
        txBodyNode = document.createElementNS(DML_NS, 'txBody');
        const children = tNode.children;
        for (let i = 0; i < children.length; i++) {
            txBodyNode.appendChild(children[i].cloneNode(true));
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

function getDataPoint(presOfNode, dataContext) {
    const axis = presOfNode.getAttribute('axis');

    if (axis === 'self') {
        return dataContext;
    }

    // TODO: Implement other axis types like 'ch', 'des', 'root' etc.
    console.warn(`Unsupported axis type in getDataPoint: ${axis}`);
    return dataContext; // Fallback to current context
}

function resolveShapeStylesFromLabel(shape, slideContext) {
    const styleLbl = shape.shapeProps.styleLbl;
    if (!styleLbl || !slideContext.diagram || !slideContext.theme.formatScheme) return;

    const { styleMap } = slideContext.diagram;
    const { theme } = slideContext;

    const styleDef = styleMap[styleLbl];
    if (!styleDef) return;

    if (styleDef.fillRef) {
        const fillIdx = parseInt(styleDef.fillRef.idx) - 1;
        if (theme.formatScheme.fills && theme.formatScheme.fills[fillIdx]) {
            const themeFill = theme.formatScheme.fills[fillIdx];
            if (themeFill.type === 'solid') {
                shape.shapeProps.fill = {
                    type: 'solid',
                    color: ColorParser.resolveColor(themeFill.color, slideContext)
                };
            }
        }
    }

    if (styleDef.lnRef) {
        const lineIdx = parseInt(styleDef.lnRef.idx) - 1;
        if (theme.formatScheme.lines && theme.formatScheme.lines[lineIdx]) {
            const themeLine = theme.formatScheme.lines[lineIdx];
            shape.shapeProps.stroke = {
                color: ColorParser.resolveColor(themeLine.color, slideContext),
                width: themeLine.width / EMU_PER_PIXEL,
                cap: themeLine.cap,
                dash: 'solid'
            };
        }
    }

    if (styleDef.fontRef) {
        shape.shapeProps.fontRef = styleDef.fontRef;
    }
}

function handleSp(layoutNode, dataContext, slideContext) {
    const shape = {
        type: 'shape',
        pos: { x: 0, y: 0, w: 0, h: 0 },
        shapeProps: {},
        text: null,
    };

    let styleLblNode = null;
    const constrNodes = [];
    const allChildNodes = layoutNode.getElementsByTagNameNS(DIAGRAM_NS, '*');

    for (let i = 0; i < allChildNodes.length; i++) {
        const child = allChildNodes[i];

        switch (child.localName) {
            case 'constr':
                constrNodes.push(child);
                break;
            case 'styleLbl':
                styleLblNode = child;
                break;
        }
    }

    for (const constrNode of constrNodes) {
        const type = constrNode.getAttribute('type');
        const val = parseInt(constrNode.getAttribute('val'));
        if (type === 'w') shape.pos.w = val / EMU_PER_PIXEL;
        if (type === 'h') shape.pos.h = val / EMU_PER_PIXEL;
    }

    if (styleLblNode) {
        shape.shapeProps.styleLbl = styleLblNode.getAttribute('name');
    }

    resolveShapeStylesFromLabel(shape, slideContext);

    if (dataContext && dataContext.localName === 'pt') {
        const tNode = dataContext.getElementsByTagNameNS(DIAGRAM_NS, 't')[0];
        if (tNode) {
            const txBodyNode = document.createElementNS(DML_NS, 'txBody');
            const children = tNode.children;
            for (let i = 0; i < children.length; i++) {
                txBodyNode.appendChild(children[i].cloneNode(true));
            }

            const bodyPr = parseBodyProperties(txBodyNode);
            const paragraphs = Array.from(txBodyNode.getElementsByTagNameNS(DML_NS, 'p'));

            if (paragraphs.length > 0) {
                const textPos = { x: 0, y: 0, width: shape.pos.w, height: shape.pos.h };
                const fontRef = shape.shapeProps.fontRef;
                const layout = layoutDiagramParagraphs(paragraphs, textPos, bodyPr, slideContext, fontRef);
                shape.text = { layout, bodyPr, pos: textPos };
            }
        }
    }

    return [shape];
}

function handleForEach(forEachNode, dataContext, slideContext) {
    const childShapes = [];
    const axis = forEachNode.getAttribute('axis');
    const ptType = forEachNode.getAttribute('ptType');

    let pointList = [];
    if (axis === 'ch') {
        const listContext = dataContext.localName === 'pt'
            ? dataContext.getElementsByTagNameNS(DIAGRAM_NS, 'ptLst')[0]
            : dataContext;

        if (listContext) {
            const childNodes = listContext.children;
            for (let i = 0; i < childNodes.length; i++) {
                const node = childNodes[i];
                if (node.localName === 'pt' && node.getAttribute('type') === ptType) {
                    pointList.push(node);
                }
            }
        }
    } else {
        console.warn(`Unsupported axis in handleForEach: ${axis}`);
    }

    const childLayoutNode = forEachNode.getElementsByTagNameNS(DIAGRAM_NS, 'layoutNode')[0];
    if (childLayoutNode) {
        for (const dataPointNode of pointList) {
            childShapes.push(...processLayoutNode(childLayoutNode, dataPointNode, slideContext));
        }
    }

    return childShapes;
}

function handleLin(algNode, childShapes) {
    const flow = algNode.getAttribute('flow') || 'horz';
    let currentX = 0;
    let currentY = 0;
    for (const shape of childShapes) {
        shape.pos.x = currentX;
        shape.pos.y = currentY;
        if (flow === 'vert') {
            currentY += shape.pos.h;
        } else {
            currentX += shape.pos.w;
        }
    }
    return childShapes;
}

function processLayoutNode(layoutNode, dataContext, slideContext) {
    const presOfNode = layoutNode.getElementsByTagNameNS(DIAGRAM_NS, 'presOf')[0];
    const currentDataContext = presOfNode ? getDataPoint(presOfNode, dataContext) : dataContext;

    if (!currentDataContext) {
        return [];
    }

    let childShapes = [];
    const childNodes = layoutNode.children;
    for (let i = 0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (child.localName === 'forEach') {
            childShapes.push(...handleForEach(child, currentDataContext, slideContext));
        }
    }

    const algNode = layoutNode.getElementsByTagNameNS(DIAGRAM_NS, 'alg')[0];
    if (algNode) {
        const algType = algNode.getAttribute('type');
        if (algType === 'sp') {
            if (currentDataContext.localName === 'pt') {
                return handleSp(layoutNode, currentDataContext, slideContext);
            }
        } else if (algType === 'lin') {
            return handleLin(algNode, childShapes);
        }
    }

    return childShapes;
}

function parseLayout(layoutDoc, dataDoc, slideContext) {
    const layoutDef = layoutDoc.getElementsByTagNameNS(DIAGRAM_NS, 'layoutDef')[0];
    if (!layoutDef) return [];

    const rootLayoutNode = layoutDef.getElementsByTagNameNS(DIAGRAM_NS, 'layoutNode')[0];
    if (!rootLayoutNode) return [];

    const rootPtLst = dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'ptLst')[0];
    if (!rootPtLst) return [];

    // Find the actual root data node. If there's a single top-level point,
    // that's the root. Otherwise, the list itself is the root context.
    const topLevelPoints = [];
    for(let i = 0; i < rootPtLst.children.length; i++) {
        if (rootPtLst.children[i].localName === 'pt') {
            topLevelPoints.push(rootPtLst.children[i]);
        }
    }

    const dataModelRoot = topLevelPoints.length === 1 ? topLevelPoints[0] : rootPtLst;

    return processLayoutNode(rootLayoutNode, dataModelRoot, slideContext);
}

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

    if (drawingRelId && slideRels[drawingRelId]) {
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
    } else {
        const layoutRelId = diagramRelIds.getAttribute('r:lo');
        if (!layoutRelId || !slideRels[layoutRelId]) return [];

        const layoutPath = resolvePath('ppt/slides', slideRels[layoutRelId].target);
        const layoutXml = await getNormalizedXmlString(entriesMap, layoutPath);
        if (!layoutXml) return [];
        const layoutDoc = parseXmlString(layoutXml);

        const colorRelId = diagramRelIds.getAttribute('r:cs');
        const styleRelId = diagramRelIds.getAttribute('r:qs');

        const colorPath = resolvePath('ppt/slides', slideRels[colorRelId].target);
        const stylePath = resolvePath('ppt/slides', slideRels[styleRelId].target);

        const colorXml = await getNormalizedXmlString(entriesMap, colorPath);
        const styleXml = await getNormalizedXmlString(entriesMap, stylePath);

        const colorMap = parseDiagramColors(colorXml);
        const styleMap = parseDiagramStyle(styleXml);

        const slideCtx = { ...slideContext, diagram: { styleMap, colorMap } };

        return parseLayout(layoutDoc, dataDoc, slideCtx);
    }
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

            const parseColors = (node) => {
                if (!node) return [];
                const colors = [];
                for (let i = 0; i < node.children.length; i++) {
                    const color = ColorParser.parseColor(node.children[i]);
                    if (color) {
                        colors.push(color);
                    }
                }
                return colors;
            };

            colorMap[name] = {
                fill: parseColors(fillClrLstNode),
                line: parseColors(linClrLstNode),
                effect: parseColors(effectClrLstNode),
                txLine: parseColors(txLinClrLstNode),
                txFill: parseColors(txFillClrLstNode),
                txEffect: parseColors(txEffectClrLstNode),
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
