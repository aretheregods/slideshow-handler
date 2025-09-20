import {
    parseXmlString,
    ColorParser,
    Matrix,
    parseLineProperties,
    parseParagraphProperties,
    parseBodyProperties,
    resolvePath,
    getNormalizedXmlString,
} from 'utils';
import {
    EMU_PER_PIXEL,
    PT_TO_PX,
    LINE_HEIGHT,
    DML_NS,
    DIAGRAM_NS,
    DSP_NS
} from '../constants';
import { ShapeBuilder } from './shapeBuilder';

/**
 * @class DiagramBuilder
 * @description A class for building and rendering diagrams.
 */
export class DiagramBuilder {
    /**
     * Creates an instance of DiagramBuilder.
     * @param {ShapeBuilder} shapeBuilder - The shape builder.
     * @param {Object} slideContext - The context of the slide.
     */
    constructor(shapeBuilder, slideContext) {
        this.shapeBuilder = shapeBuilder;
        this.renderer = shapeBuilder.renderer;
        this.slideContext = slideContext;
        this.slideRels = slideContext.slideRels;
        this.entriesMap = slideContext.entriesMap;
        this.emuPerPixel = slideContext.emuPerPixel;
    }

    /**
     * Builds a diagram from a frame node.
     * @param {Element} frameNode - The frame node containing the diagram.
     * @param {Matrix} parentMatrix - The parent transformation matrix.
     * @returns {Promise<Array>} A promise that resolves with an array of shapes.
     */
    build(frameNode, parentMatrix) {
        const graphicData = frameNode.getElementsByTagNameNS(DML_NS, 'graphicData')[0];
        if (!graphicData) return Promise.resolve([]);

        const diagramRelIds = graphicData.getElementsByTagNameNS(DIAGRAM_NS, 'relIds')[0];
        if (!diagramRelIds) return Promise.resolve([]);

        const dataRelId = diagramRelIds.getAttribute('r:dm');
        const dataPath = resolvePath('ppt/slides', this.slideRels[dataRelId].target);

        return getNormalizedXmlString(this.entriesMap, dataPath)
            .then(dataXml => {
                if (!dataXml) return [];

                const dataDoc = parseXmlString(dataXml);
                const extLst = dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'extLst')[0];
                const ext = extLst?.getElementsByTagNameNS(DML_NS, 'ext')[0];
                const dataModelExt = ext?.getElementsByTagNameNS(DSP_NS, 'dataModelExt')[0];
                const drawingRelId = dataModelExt?.getAttribute('relId');

                if (drawingRelId && this.slideRels[drawingRelId]) {
                    return this.buildDrawingDiagram(dataDoc, diagramRelIds, parentMatrix);
                } else {
                    return this.buildLayoutDiagram(dataDoc, diagramRelIds);
                }
            });
    }

    buildDrawingDiagram(dataDoc, diagramRelIds, parentMatrix) {
        const drawingRelId = diagramRelIds.getAttribute('r:dm');
        const drawingPath = resolvePath('ppt/slides', this.slideRels[drawingRelId].target);

        return getNormalizedXmlString(this.entriesMap, drawingPath)
            .then(drawingXml => {
                if (!drawingXml) return [];

                const drawingDoc = parseXmlString(drawingXml);
                const spTree = drawingDoc.getElementsByTagNameNS(DSP_NS, 'spTree')[0];
                if (!spTree) return [];

                const dataModel = this.buildDataModel(dataDoc);
                const shapes = [];
                for (const dspSpNode of spTree.getElementsByTagNameNS(DSP_NS, 'sp')) {
                    const shape = this.parseDiagramShape(dspSpNode, dataModel, parentMatrix);
                    if (shape) {
                        shapes.push(shape);
                    }
                }
                return shapes;
            });
    }

    buildLayoutDiagram(dataDoc, diagramRelIds) {
        const layoutRelId = diagramRelIds.getAttribute('r:lo');
        if (!layoutRelId || !this.slideRels[layoutRelId]) return Promise.resolve([]);

        const layoutPath = resolvePath('ppt/slides', this.slideRels[layoutRelId].target);
        const colorRelId = diagramRelIds.getAttribute('r:cs');
        const styleRelId = diagramRelIds.getAttribute('r:qs');

        const layoutPromise = getNormalizedXmlString(this.entriesMap, layoutPath);
        const colorPromise = getNormalizedXmlString(this.entriesMap, resolvePath('ppt/slides', this.slideRels[colorRelId].target));
        const stylePromise = getNormalizedXmlString(this.entriesMap, resolvePath('ppt/slides', this.slideRels[styleRelId].target));

        return Promise.all([layoutPromise, colorPromise, stylePromise])
            .then(([layoutXml, colorXml, styleXml]) => {
                if (!layoutXml) return [];

                const layoutDoc = parseXmlString(layoutXml);
                const colorMap = this.parseDiagramColors(colorXml);
                const styleMap = this.parseDiagramStyle(styleXml);

                const diagramContext = { ...this.slideContext, diagram: { styleMap, colorMap } };

                return this.parseLayout(layoutDoc, dataDoc, diagramContext);
            });
    }

    buildDataModel(dataDoc) {
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
        return dataModel;
    }

    parseDiagramShape(dspSpNode, dataModel, parentMatrix) {
        const spPrNode = dspSpNode.getElementsByTagNameNS(DSP_NS, 'spPr')[0];
        if (!spPrNode) return null;

        const xfrmNode = spPrNode.getElementsByTagNameNS(DML_NS, 'xfrm')[0];
        if (!xfrmNode) return null;

        const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
        const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
        if (!offNode || !extNode) return null;

        const x = parseInt(offNode.getAttribute("x")) / this.emuPerPixel;
        const y = parseInt(offNode.getAttribute("y")) / this.emuPerPixel;
        const w = parseInt(extNode.getAttribute("cx")) / this.emuPerPixel;
        const h = parseInt(extNode.getAttribute("cy")) / this.emuPerPixel;
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
                const colorObj = ColorParser.parseColor(fillRefNode);
                if (colorObj) shapeProps.fill = { type: 'solid', color: ColorParser.resolveColor(colorObj, this.slideContext) };
            }

            const lnRefNode = styleNode.getElementsByTagNameNS(DML_NS, 'lnRef')[0];
            if (lnRefNode) {
                const colorObj = ColorParser.parseColor(lnRefNode);
                if (colorObj) {
                    shapeProps.stroke = {
                        color: ColorParser.resolveColor(colorObj, this.slideContext),
                        width: 1,
                        dash: 'solid',
                    };
                }
            }
        }

        const solidFillNode = spPrNode.getElementsByTagNameNS(DML_NS, 'solidFill')[0];
        if (solidFillNode) {
            const colorObj = ColorParser.parseColor(solidFillNode);
            if (colorObj) shapeProps.fill = { type: 'solid', color: ColorParser.resolveColor(colorObj, this.slideContext) };
        }

        const lnNode = spPrNode.getElementsByTagNameNS(DML_NS, 'ln')[0];
        if (lnNode) {
            shapeProps.stroke = parseLineProperties(lnNode, this.slideContext);
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
            const paragraphs = Array.from(txBodyNode.getElementsByTagNameNS(DML_NS, 'p'));

            if (paragraphs.length > 0) {
                const textPos = { ...pos };
                const txXfrmNode = dspSpNode.getElementsByTagNameNS(DML_NS, 'txXfrm')[0];
                if (txXfrmNode) {
                    const txOffNode = txXfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
                    const txExtNode = txXfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
                    if (txOffNode && txExtNode) {
                        textPos.x = parseInt(txOffNode.getAttribute("x")) / this.emuPerPixel;
                        textPos.y = parseInt(txOffNode.getAttribute("y")) / this.emuPerPixel;
                        textPos.width = parseInt(extNode.getAttribute("cx")) / this.emuPerPixel;
                        textPos.height = parseInt(extNode.getAttribute("cy")) / this.emuPerPixel;
                    }
                }
                const styleNode = dspSpNode.getElementsByTagNameNS(DSP_NS, 'style')[0];
                const fontRefNode = styleNode?.getElementsByTagNameNS(DML_NS, 'fontRef')[0];
                const fontRef = fontRefNode ? { idx: fontRefNode.getAttribute('idx'), color: ColorParser.parseColor(fontRefNode) } : null;
                const layout = this.layoutDiagramParagraphs(paragraphs, textPos, bodyPr, fontRef);
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

    layoutDiagramParagraphs(paragraphs, pos, bodyPr, fontRef) {
        const paddedPos = {
            x: pos.x + (bodyPr.lIns || 0), y: pos.y + (bodyPr.tIns || 0),
            width: pos.width - (bodyPr.lIns || 0) - (bodyPr.rIns || 0),
            height: pos.height - (bodyPr.tIns || 0) - (bodyPr.bIns || 0),
        };

        const lines = [];
        let currentY = 0;

        for (const pNode of paragraphs) {
            const pPrNode = pNode.getElementsByTagNameNS(DML_NS, 'pPr')[0];
            const finalProps = parseParagraphProperties(pPrNode, this.slideContext) || { bullet: {}, defRPr: {} };
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
                        color: ColorParser.resolveColor(runProps.color, this.slideContext) || '#000000'
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

    getDataPoint(presOfNode, dataContext, dataDoc) {
        const axis = presOfNode.getAttribute('axis');

        if (axis === 'self') {
            return [dataContext];
        }

        if (axis === 'ch') {
            const modelId = dataContext.getAttribute('modelId');
            if (!modelId) return [];

            const children = [];
            const cxnLstNode = dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'cxnLst')[0];
            if (cxnLstNode) {
                const cxnNodes = cxnLstNode.getElementsByTagNameNS(DIAGRAM_NS, 'cxn');
                for (const cxnNode of cxnNodes) {
                    if (cxnNode.getAttribute('srcId') === modelId) {
                        const destId = cxnNode.getAttribute('destId');
                        const destNode = dataDoc.querySelector(`[modelId="${destId}"]`);
                        if (destNode) {
                            children.push(destNode);
                        }
                    }
                }
            }
            return children;
        }

        console.warn(`Unsupported axis type in getDataPoint: ${axis}`);
        return [dataContext];
    }

    resolveShapeStylesFromLabel(shape, diagramContext) {
        const styleLbl = shape.shapeProps.styleLbl;
        if (!styleLbl || !diagramContext.diagram || !diagramContext.theme.formatScheme) return;

        const { styleMap } = diagramContext.diagram;
        const { theme } = diagramContext;

        const styleDef = styleMap[styleLbl];
        if (!styleDef) return;

        if (styleDef.fillRef) {
            const fillIdx = parseInt(styleDef.fillRef.idx) - 1;
            if (theme.formatScheme.fills && theme.formatScheme.fills[fillIdx]) {
                const themeFill = theme.formatScheme.fills[fillIdx];
                if (themeFill.type === 'solid') {
                    shape.shapeProps.fill = {
                        type: 'solid',
                        color: ColorParser.resolveColor(themeFill.color, diagramContext)
                    };
                }
            }
        }

        if (styleDef.lnRef) {
            const lineIdx = parseInt(styleDef.lnRef.idx) - 1;
            if (theme.formatScheme.lines && theme.formatScheme.lines[lineIdx]) {
                const themeLine = theme.formatScheme.lines[lineIdx];
                shape.shapeProps.stroke = {
                    color: ColorParser.resolveColor(themeLine.color, diagramContext),
                    width: themeLine.width / this.emuPerPixel,
                    cap: themeLine.cap,
                    dash: 'solid'
                };
            }
        }

        if (styleDef.fontRef) {
            shape.shapeProps.fontRef = styleDef.fontRef;
        }
    }

    createShapeFromLayoutNode(layoutNode, dataContext, diagramContext) {
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
            if (type === 'w') shape.pos.w = val / this.emuPerPixel;
            if (type === 'h') shape.pos.h = val / this.emuPerPixel;
        }

        if (styleLblNode) {
            shape.shapeProps.styleLbl = styleLblNode.getAttribute('name');
        }

        this.resolveShapeStylesFromLabel(shape, diagramContext);

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
                    const layout = this.layoutDiagramParagraphs(paragraphs, textPos, bodyPr, fontRef);
                    shape.text = { layout, bodyPr, pos: textPos };
                }
            }
        }

        return [shape];
    }

    handleSp(algNode, childShapes) {
        const numShapes = childShapes.length;
        if (numShapes === 0) return [];

        const radius = 100; // This should be calculated based on constraints
        const angleStep = (2 * Math.PI) / numShapes;

        for (let i = 0; i < numShapes; i++) {
            const shape = childShapes[i];
            const angle = i * angleStep;
            shape.pos.x = radius * Math.cos(angle);
            shape.pos.y = radius * Math.sin(angle);
        }

        return childShapes;
    }

    handleForEach(forEachNode, dataContext, diagramContext, dataDoc) {
        const childShapes = [];
        const axis = forEachNode.getAttribute('axis');
        const ptType = forEachNode.getAttribute('ptType');

        let pointList = [];
        if (axis === 'ch') {
            const modelId = dataContext.getAttribute('modelId');
            if (modelId) {
                const cxnLstNode = dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'cxnLst')[0];
                if (cxnLstNode) {
                    const cxnNodes = cxnLstNode.getElementsByTagNameNS(DIAGRAM_NS, 'cxn');
                    for (const cxnNode of cxnNodes) {
                        if (cxnNode.getAttribute('srcId') === modelId) {
                            const destId = cxnNode.getAttribute('destId');
                            const destNode = dataDoc.querySelector(`[modelId="${destId}"]`);
                            if (destNode && (!ptType || destNode.getAttribute('type') === ptType)) {
                                pointList.push(destNode);
                            }
                        }
                    }
                }
            }
        } else {
            console.warn(`Unsupported axis in handleForEach: ${axis}`);
        }

        const childLayoutNode = forEachNode.getElementsByTagNameNS(DIAGRAM_NS, 'layoutNode')[0];
        if (childLayoutNode) {
            for (const dataPointNode of pointList) {
                childShapes.push(...this.processLayoutNode(childLayoutNode, dataPointNode, diagramContext, dataDoc));
            }
        }

        return childShapes;
    }

    handleTx(algNode, childShapes, layoutNode, dataContext, diagramContext) {
        const shape = this.createShapeFromLayoutNode(layoutNode, dataContext, diagramContext);
        return shape;
    }

    handleComposite(algNode, childShapes) {
        return childShapes;
    }

    handleLin(algNode, childShapes) {
        let flow = 'horz';
        let linDir = 'fromL';

        const paramNodes = algNode.getElementsByTagNameNS(DIAGRAM_NS, 'param');
        for (const paramNode of paramNodes) {
            if (paramNode.getAttribute('type') === 'flow') {
                flow = paramNode.getAttribute('val');
            }
            if (paramNode.getAttribute('type') === 'linDir') {
                linDir = paramNode.getAttribute('val');
            }
        }

        let currentX = 0;
        let currentY = 0;
        const totalWidth = childShapes.reduce((sum, shape) => sum + shape.pos.w, 0);
        const totalHeight = childShapes.reduce((sum, shape) => sum + shape.pos.h, 0);

        if (linDir === 'fromR') {
            currentX = totalWidth;
        }
        if (linDir === 'fromB') {
            currentY = totalHeight;
        }

        for (const shape of childShapes) {
            if (linDir === 'fromR') {
                currentX -= shape.pos.w;
            }
            if (linDir === 'fromB') {
                currentY -= shape.pos.h;
            }

            shape.pos.x = currentX;
            shape.pos.y = currentY;

            if (flow === 'vert') {
                if (linDir !== 'fromB') {
                    currentY += shape.pos.h;
                }
            } else {
                if (linDir !== 'fromR') {
                    currentX += shape.pos.w;
                }
            }
        }
        return childShapes;
    }

    processLayoutNode(layoutNode, dataContext, diagramContext, dataDoc) {
        const presOfNode = layoutNode.getElementsByTagNameNS(DIAGRAM_NS, 'presOf')[0];
        const algNode = layoutNode.getElementsByTagNameNS(DIAGRAM_NS, 'alg')[0];
        const forEachNode = layoutNode.getElementsByTagNameNS(DIAGRAM_NS, 'forEach')[0];

        if (forEachNode) {
            const childShapes = this.handleForEach(forEachNode, dataContext, diagramContext, dataDoc);
            if (algNode) {
                const algType = algNode.getAttribute('type');
                if (algType === 'lin') {
                    return this.handleLin(algNode, childShapes);
                }
            }
            return childShapes;
        }

        if (presOfNode) {
            const currentDataContexts = this.getDataPoint(presOfNode, dataContext, dataDoc);
            if (currentDataContexts && currentDataContexts.length > 0) {
                const shapes = [];
                for (const currentDataContext of currentDataContexts) {
                    shapes.push(...this.createShapeFromLayoutNode(layoutNode, currentDataContext, diagramContext));
                }
                return shapes;
            }
        }

        return [];
    }

    parseLayout(layoutDoc, dataDoc, diagramContext) {
        const layoutDef = layoutDoc.getElementsByTagNameNS(DIAGRAM_NS, 'layoutDef')[0];
        if (!layoutDef) return [];

        const rootLayoutNode = layoutDef.getElementsByTagNameNS(DIAGRAM_NS, 'layoutNode')[0];
        if (!rootLayoutNode) return [];

        const rootPtLst = dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'ptLst')[0];
        if (!rootPtLst) return [];

        const topLevelPoints = [];
        for (let i = 0; i < rootPtLst.children.length; i++) {
            if (rootPtLst.children[i].localName === 'pt') {
                topLevelPoints.push(rootPtLst.children[i]);
            }
        }

        const dataModelRoot = topLevelPoints.find(p => p.getAttribute('type') === 'doc') || (topLevelPoints.length === 1 ? topLevelPoints[0] : rootPtLst);

        return this.processLayoutNode(rootLayoutNode, dataModelRoot, diagramContext, dataDoc);
    }

    parseDiagramColors(colorXml) {
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

    parseDiagramStyle(styleXml) {
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
}
