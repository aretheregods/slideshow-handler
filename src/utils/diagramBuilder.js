import { JSDOM } from 'jsdom';
import { EMU_PER_PIXEL, DML_NS, DIAGRAM_NS, DSP_NS } from 'constants';
import { ShapeBuilder } from './shapeBuilder.js';

const { window } = new JSDOM('');
const { DOMParser } = window;

export class DiagramBuilder {
    constructor({ slide, slideRels, presentation, shapeBuilder }) {
        this.slide = slide;
        this.slideRels = slideRels;
        this.presentation = presentation;
        this.shapeBuilder = shapeBuilder || new ShapeBuilder({ slide, slideRels, presentation });
    }

    async build(drawingXml, layoutXml, dataXml, colorsXml, styleXml) {
        this.drawingDoc = drawingXml ? new DOMParser().parseFromString(drawingXml, 'text/xml') : null;
        this.layoutDoc = new DOMParser().parseFromString(layoutXml, 'text/xml');
        this.dataDoc = new DOMParser().parseFromString(dataXml, 'text/xml');
        this.colorsDoc = colorsXml ? new DOMParser().parseFromString(colorsXml, 'text/xml') : null;
        this.styleDoc = styleXml ? new DOMParser().parseFromString(styleXml, 'text/xml') : null;

        if (this.drawingDoc && this.drawingDoc.getElementsByTagNameNS(DSP_NS, 'spTree').length > 0) {
             return this.#buildDrawingDiagram();
        } else {
             return this.#buildLayoutDiagram();
        }
    }

    #buildDrawingDiagram() {
        const dspSpTree = this.drawingDoc.getElementsByTagNameNS(DSP_NS, 'spTree')[0];
        if (!dspSpTree) return [];

        const dspShapes = Array.from(dspSpTree.childNodes).filter(node => node.nodeName === 'dsp:sp');

        return dspShapes.map(dspShape => {
            const modelId = dspShape.getAttribute('modelId');
            const dataPt = this.dataDoc.querySelector(`[modelId="${modelId}"]`);
            const shape = this.shapeBuilder.build(dspShape, this.slideRels);

            if (dataPt) {
                const text = this.#getText(dataPt);
                if (text) {
                    shape.text = text;
                }
            }

            return shape;
        });
    }

    #buildLayoutDiagram() {
        const rootLayoutNode = this.layoutDoc.getElementsByTagNameNS(DIAGRAM_NS, 'layoutNode')[0];
        const dataModelNode = this.dataDoc.getElementsByTagNameNS(DIAGRAM_NS, 'dataModel')[0];

        if (!rootLayoutNode || !dataModelNode) {
            return [];
        }

        return this.#processLayoutNode(rootLayoutNode, dataModelNode);
    }

    #processLayoutNode(layoutNode, dataContext) {
        let shapes = [];

        const shapeNode = Array.from(layoutNode.childNodes).find(n => n.nodeName === 'dgm:shape');
        const presOf = Array.from(layoutNode.childNodes).find(n => n.nodeName === 'dgm:presOf');

        if (shapeNode && presOf) {
            shapes = this.#createShapeFromLayout(layoutNode, dataContext);
        } else {
            const childNodes = Array.from(layoutNode.childNodes).filter(node => node.nodeType === 1);
            for (const child of childNodes) {
                if (child.nodeName === 'dgm:layoutNode') {
                    shapes.push(...this.#handleLayoutNode(child, dataContext));
                } else if (child.nodeName === 'dgm:forEach') {
                    shapes.push(...this.#handleForEach(child, dataContext));
                } else if (child.nodeName === 'dgm:choose') {
                    shapes.push(...this.#handleChoose(child, dataContext));
                }
            }
        }

        const algNode = Array.from(layoutNode.childNodes).find(n => n.nodeName === 'dgm:alg');
        if (algNode) {
            const algType = algNode.getAttribute('type');
            this.#applyAlgorithm(algType, layoutNode, shapes);
        }

        return shapes;
    }

    #handleLayoutNode(layoutNode, dataContext) {
        return this.#processLayoutNode(layoutNode, dataContext);
    }

    #handleForEach(forEachNode, dataContext) {
        const axis = forEachNode.getAttribute('axis');
        const ptType = forEachNode.getAttribute('ptType');

        const childDataContexts = this.#getDataPoint(dataContext, axis, ptType);

        let shapes = [];
        for (const childContext of childDataContexts) {
            const childLayoutNodes = Array.from(forEachNode.childNodes).filter(node => node.nodeType === 1);
            for (const childLayoutNode of childLayoutNodes) {
                shapes.push(...this.#processLayoutNode(childLayoutNode, childContext));
            }
        }
        return shapes;
    }

    #handleChoose(chooseNode, dataContext) {
        const ifNodes = Array.from(chooseNode.childNodes).filter(n => n.nodeName === 'dgm:if');
        const elseNode = Array.from(chooseNode.childNodes).find(n => n.nodeName === 'dgm:else');

        for (const ifNode of ifNodes) {
            if (this.#evaluateIf(ifNode, dataContext)) {
                let shapes = [];
                const childLayoutNodes = Array.from(ifNode.childNodes).filter(node => node.nodeType === 1);
                for (const childLayoutNode of childLayoutNodes) {
                    shapes.push(...this.#processLayoutNode(childLayoutNode, dataContext));
                }
                return shapes;
            }
        }

        if (elseNode) {
            let shapes = [];
            const childLayoutNodes = Array.from(elseNode.childNodes).filter(node => node.nodeType === 1);
            for (const childLayoutNode of childLayoutNodes) {
                shapes.push(...this.#processLayoutNode(childLayoutNode, dataContext));
            }
            return shapes;
        }

        return [];
    }

    #evaluateIf(ifNode, dataContext) {
        const axis = ifNode.getAttribute('axis');
        const ptType = ifNode.getAttribute('ptType');
        const func = ifNode.getAttribute('func');
        const op = ifNode.getAttribute('op');
        const val = ifNode.getAttribute('val');

        const dataPoints = this.#getDataPoint(dataContext, axis, ptType);

        if (func === 'cnt') {
            const count = dataPoints.length;
            const numVal = parseInt(val, 10);
            if (op === 'equ') return count === numVal;
            if (op === 'neq') return count !== numVal;
            if (op === 'gt') return count > numVal;
            if (op === 'lt') return count < numVal;
            if (op === 'gte') return count >= numVal;
            if (op === 'lte') return count <= numVal;
        }

        return false;
    }

    #createShapeFromLayout(layoutNode, dataContext) {
        const presOf = Array.from(layoutNode.childNodes).find(n => n.nodeName === 'dgm:presOf');
        if (!presOf) {
            return [];
        }

        const axis = presOf.getAttribute('axis');
        const ptType = presOf.getAttribute('ptType');

        const dataPoints = this.#getDataPoint(dataContext, axis, ptType);

        if (dataPoints.length === 0) {
            return [];
        }

        const shapeNode = Array.from(layoutNode.childNodes).find(n => n.nodeName === 'dgm:shape');
        const type = shapeNode.getAttribute('type');

        const shapes = [];
        for (const point of dataPoints) {
            const modelId = point.getAttribute('modelId');
            let shape;

            if (this.drawingDoc) {
                const drawingSp = this.drawingDoc.querySelector(`[modelId="{${modelId}}"]`);
                if (drawingSp) {
                    shape = this.shapeBuilder.build(drawingSp, this.slideRels);
                }
            }

            if (!shape) {
                shape = {
                    type: 'shape',
                    shape: type,
                    text: null,
                    pos: { x: 0, y: 0 },
                    ext: { cx: 1000 * EMU_PER_PIXEL, cy: 1000 * EMU_PER_PIXEL },
                };
            }

            const text = this.#getText(point);
            if (text) {
                shape.text = text;
            }

            this.#applyConstraints(layoutNode, shape);

            shapes.push(shape);
        }

        return shapes;
    }

    #applyAlgorithm(type, layoutNode, shapes) {
        if (type === 'lin') {
            this.#applyLinAlgorithm(layoutNode, shapes);
        }
    }

    #applyLinAlgorithm(layoutNode, shapes) {
        let yOffset = 0; // in EMUs
        for (const shape of shapes) {
            shape.pos.y = yOffset / EMU_PER_PIXEL;
            const height = shape.ext.cy || (1000 * EMU_PER_PIXEL);
            yOffset += height;
        }
    }

    #applyConstraints(layoutNode, shape) {
        const constrLst = Array.from(layoutNode.childNodes).find(n => n.nodeName === 'dgm:constrLst');
        if (!constrLst) {
            return;
        }

        const constrNodes = Array.from(constrLst.childNodes).filter(n => n.nodeName === 'dgm:constr');
        for (const constr of constrNodes) {
            const type = constr.getAttribute('type');
            const val = parseFloat(constr.getAttribute('val'));

            if (type === 'w') {
                shape.ext.cx = val * EMU_PER_PIXEL;
            } else if (type === 'h') {
                shape.ext.cy = val * EMU_PER_PIXEL;
            }
        }
    }

    #getDataPoint(context, axis, ptType) {
        if (!context) {
            return [];
        }

        if (axis === 'ch') {
            let ptLstNode;
            if (context.nodeName === 'dgm:dataModel') {
                ptLstNode = context.getElementsByTagNameNS(DIAGRAM_NS, 'ptLst')[0];
            } else {
                ptLstNode = Array.from(context.childNodes).find(n => n.nodeName === 'dgm:ptLst');
            }

            if (ptLstNode) {
                const children = Array.from(ptLstNode.childNodes).filter(n => n.nodeName === 'dgm:pt');
                if (ptType) {
                    return children.filter(c => c.getAttribute('type') === ptType);
                }
                return children;
            }
            return [];
        }

        if (axis === 'self') {
            if(context.nodeName === 'dgm:dataModel') {
                const ptLst = context.getElementsByTagNameNS(DIAGRAM_NS, 'ptLst')[0];
                if(ptLst) {
                    const firstPt = Array.from(ptLst.childNodes).find(n => n.nodeName === 'dgm:pt');
                    return firstPt ? [firstPt] : [];
                }
                return [];
            }
            return [context];
        }

        return [];
    }

    #getText(dataPt) {
        const textNode = dataPt.getElementsByTagNameNS(DIAGRAM_NS, 't')[0];
        if (!textNode) return null;

        const pNodes = textNode.getElementsByTagNameNS(DML_NS, 'p');
        let text = '';
        for (const pNode of pNodes) {
            const rNodes = pNode.getElementsByTagNameNS(DML_NS, 'r');
            for (const rNode of rNodes) {
                const tNode = rNode.getElementsByTagNameNS(DML_NS, 't')[0];
                if (tNode) {
                    text += tNode.textContent;
                }
            }
        }
        const trimmedText = text.trim();
        if (!trimmedText) return null;

        return {
            layout: {
                lines: [
                    {
                        runs: [{ text: trimmedText, font: { size: 18 }, color: '#000000' }],
                        width: 0,
                        height: 0,
                        paragraphProps: {},
                        isFirstLine: true,
                    },
                ],
                totalHeight: 0,
            },
            bodyPr: {},
            pos: {},
        };
    }
}
