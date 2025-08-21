import { Matrix } from './matrix.js';
import Konva from 'https://cdn.jsdelivr.net/npm/konva@9.3.6/+esm';

export class ShapeBuilder {
    constructor(layer, slideContext, imageMap, masterPlaceholders, layoutPlaceholders) {
        this.layer = layer;
        this.slideContext = slideContext;
        this.imageMap = imageMap;
        this.masterPlaceholders = masterPlaceholders;
        this.layoutPlaceholders = layoutPlaceholders;
    }

    build(shapeNode, parentMatrix, shapeProps) {
        const PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
        const DML_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

        const nvSpPrNode = shapeNode.getElementsByTagNameNS(PML_NS, 'nvSpPr')[0];
        let phKey = null, phType = null, shapeName = 'Unknown';
        if (nvSpPrNode) {
            const cNvPrNode = nvSpPrNode.getElementsByTagNameNS(PML_NS, 'cNvPr')[0];
            if (cNvPrNode) {
                shapeName = cNvPrNode.getAttribute('name');
            }

            const nvPrNode = nvSpPrNode.getElementsByTagNameNS(PML_NS, 'nvPr')[0];
            if (nvPrNode) {
                const placeholder = nvPrNode.getElementsByTagNameNS(PML_NS, 'ph')[0];
                if (placeholder) {
                    phType = placeholder.getAttribute('type');
                    const phIdx = placeholder.getAttribute('idx');
                    phKey = phIdx ? `idx_${phIdx}` : phType;
                    if (!phType && phIdx) {
                        phType = 'body';
                    }
                }
            }
        }

        const isConnector = shapeName.startsWith('Straight Connector');
        if (isConnector) {
            console.log(`[CONNECTOR DEBUG] Processing shape: "${shapeName}"`);
            console.log('[CONNECTOR DEBUG] Parent Matrix:', parentMatrix.m);
        } else {
            console.log(`[DEBUG] Processing shape: "${shapeName}", phKey: ${phKey}, phType: ${phType}`);
        }

        let localMatrix = new Matrix();
        let pos;

        const xfrmNode = shapeNode.getElementsByTagNameNS(DML_NS, 'xfrm')[0];
        if (xfrmNode) {
            if (shapeName === 'Title 23') console.log('[DEBUG] Found <xfrm> on shape itself.');
            const offNode = xfrmNode.getElementsByTagName('a:off')[0];
            const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
            if (offNode && extNode) {
                const x = parseInt(offNode.getAttribute("x")) / 12700;
                const y = parseInt(offNode.getAttribute("y")) / 12700;
                const w = parseInt(extNode.getAttribute("cx")) / 12700;
                const h = parseInt(extNode.getAttribute("cy")) / 12700;
                const rot = parseInt(xfrmNode.getAttribute('rot') || '0') / 60000;
                const flipH = xfrmNode.getAttribute('flipH') === '1';
                const flipV = xfrmNode.getAttribute('flipV') === '1';

                pos = { x: 0, y: 0, width: w, height: h };

                localMatrix.translate(x, y);
                localMatrix.translate(w / 2, h / 2);
                localMatrix.rotate(rot * Math.PI / 180);
                localMatrix.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                localMatrix.translate(-w / 2, -h / 2);
            }
        } else if (phKey && (this.layoutPlaceholders?.[phKey] || this.masterPlaceholders?.[phKey])) {
            if (shapeName === 'Title 23') console.log(`[DEBUG] No <xfrm> on shape. Looking for placeholder with key: ${phKey}`);
            const layoutPh = this.layoutPlaceholders ? this.layoutPlaceholders[phKey] : null;
            const masterPh = this.masterPlaceholders ? this.masterPlaceholders[phKey] : null;
            const placeholder = layoutPh || masterPh;
            if (placeholder) {
                if (shapeName === 'Title 23') console.log('[DEBUG] Found placeholder:', placeholder);
                pos = { ...placeholder.pos };
                localMatrix.translate(pos.x, pos.y);
                if (shapeName === 'Title 23') console.log(`[DEBUG] Applied translation from placeholder: x=${pos.x}, y=${pos.y}`);
                pos.x = 0;
                pos.y = 0;
            } else {
                if (shapeName === 'Title 23') console.log('[DEBUG] Placeholder key found, but no matching placeholder in layout or master.');
            }
        } else {
            if (shapeName === 'Title 23') console.log('[DEBUG] No <xfrm> and no placeholder key. Cannot determine position.');
        }

        if (!pos) return { konvaShape: null, pos: null, phKey, phType };

        const finalMatrix = parentMatrix.clone().multiply(localMatrix);

        if (isConnector) {
            console.log('[CONNECTOR DEBUG] Local Matrix:', localMatrix.m);
            console.log('[CONNECTOR DEBUG] Final Matrix:', finalMatrix.m);
        }

        let konvaShape;
        const txBody = shapeNode.getElementsByTagNameNS(PML_NS, 'txBody')[0];

        if (shapeProps && shapeProps.geometry) {
             const geomType = shapeProps.geometry.type === 'preset' ? shapeProps.geometry.preset : shapeProps.geometry.type;
             switch (geomType) {
                case 'rect':
                    konvaShape = new Konva.Rect({ width: pos.width, height: pos.height });
                    break;
                case 'ellipse':
                    konvaShape = new Konva.Ellipse({ radiusX: pos.width / 2, radiusY: pos.height / 2, x: pos.width / 2, y: pos.height / 2 });
                    break;
                case 'line':
                    konvaShape = new Konva.Line({ points: [0, 0, pos.width, pos.height] });
                    break;
                case 'arc':
                    const arcPath = `M 0,${pos.height} A ${pos.width},${pos.height} 0 0 1 ${pos.width},0`;
                    konvaShape = new Konva.Path({ data: arcPath });
                    konvaShape.fillEnabled(false);
                    break;
                case 'custom':
                    if (shapeProps.geometry.path) {
                        const pathData = shapeProps.geometry.path;
                        const scaleX = pathData.w === 0 ? 1 : pos.width / pathData.w;
                        const scaleY = pathData.h === 0 ? 1 : pos.height / pathData.h;

                        konvaShape = new Konva.Shape({
                            width: pos.width,
                            height: pos.height,
                            sceneFunc: function (context, shape) {
                                context.beginPath();
                                pathData.commands.forEach(command => {
                                    switch (command.cmd) {
                                        case 'moveTo': {
                                            const p = command.points[0];
                                            context.moveTo(p.x * scaleX, p.y * scaleY);
                                            break;
                                        }
                                        case 'lnTo': {
                                            const p = command.points[0];
                                            context.lineTo(p.x * scaleX, p.y * scaleY);
                                            break;
                                        }
                                        case 'cubicBezTo': {
                                            const p1 = command.points[0];
                                            const p2 = command.points[1];
                                            const p3 = command.points[2];
                                            context.bezierCurveTo(
                                                p1.x * scaleX, p1.y * scaleY,
                                                p2.x * scaleX, p2.y * scaleY,
                                                p3.x * scaleX, p3.y * scaleY
                                            );
                                            break;
                                        }
                                        case 'quadBezTo': {
                                            const p1 = command.points[0];
                                            const p2 = command.points[1];
                                            context.quadraticCurveTo(
                                                p1.x * scaleX, p1.y * scaleY,
                                                p2.x * scaleX, p2.y * scaleY
                                            );
                                            break;
                                        }
                                        case 'close': {
                                            context.closePath();
                                            break;
                                        }
                                    }
                                });
                                context.fillStrokeShape(shape);
                            }
                        });
                    }
                    break;
             }
        } else if (txBody) {
            // This is a shapeless textbox. Create a transparent rectangle to host the text.
            konvaShape = new Konva.Rect({ width: pos.width, height: pos.height, fill: 'transparent' });
        }

        if (konvaShape) {
            const transform = new Konva.Transform(finalMatrix.m);
            const decomposed = transform.decompose();
            konvaShape.setAttrs(decomposed);

            if (shapeProps.fill && shapeProps.fill.type === 'solid') {
                konvaShape.fill(shapeProps.fill.color);
            } else {
                konvaShape.fillEnabled(false);
            }

            if (shapeProps.stroke) {
                konvaShape.stroke(shapeProps.stroke.color);
                konvaShape.strokeWidth(shapeProps.stroke.width || 1);
                if (shapeProps.stroke.dash) {
                    konvaShape.dash(shapeProps.stroke.dash);
                }
                if (shapeProps.stroke.join) {
                    konvaShape.lineJoin(shapeProps.stroke.join);
                }
                if (shapeProps.stroke.cap) {
                    let lineCap = 'butt';
                    if (shapeProps.stroke.cap === 'rnd') lineCap = 'round';
                    if (shapeProps.stroke.cap === 'sq') lineCap = 'square';
                    konvaShape.lineCap(lineCap);
                }
            } else {
                konvaShape.strokeEnabled(false);
            }
            this.layer.add(konvaShape);
        }

        return { konvaShape, pos, phKey, phType };
    }
}
