import { Matrix } from './matrix.js';
import { CanvasRenderer } from './canvas-renderer.js';

export class ShapeBuilder {
    constructor(renderer, slideContext, imageMap, masterPlaceholders, layoutPlaceholders, emuPerPixel, slideSize) {
        this.renderer = renderer;
        this.slideContext = slideContext;
        this.imageMap = imageMap;
        this.masterPlaceholders = masterPlaceholders;
        this.layoutPlaceholders = layoutPlaceholders;
        this.emuPerPixel = emuPerPixel;
        this.slideSize = slideSize;
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

        let localMatrix = new Matrix();
        let pos;
        let flipH = false, flipV = false, rot = 0;

        const xfrmNode = shapeNode.getElementsByTagNameNS(DML_NS, 'xfrm')[0];
        if (xfrmNode) {
            const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
            const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
            if (offNode && extNode) {
                const x = parseInt(offNode.getAttribute("x")) / this.emuPerPixel;
                const y = parseInt(offNode.getAttribute("y")) / this.emuPerPixel;
                const w = parseInt(extNode.getAttribute("cx")) / this.emuPerPixel;
                const h = parseInt(extNode.getAttribute("cy")) / this.emuPerPixel;
                rot = parseInt(xfrmNode.getAttribute('rot') || '0') / 60000;
                flipH = xfrmNode.getAttribute('flipH') === '1';
                flipV = xfrmNode.getAttribute('flipV') === '1';

                pos = { x: 0, y: 0, width: w, height: h };

                localMatrix.translate(x, y);
                localMatrix.translate(w / 2, h / 2);
                localMatrix.rotate(rot * Math.PI / 180);
                localMatrix.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                localMatrix.translate(-w / 2, -h / 2);
            }
        } else if (phKey) {
            // Find layout placeholder by specific key or fall back to generic type
            let layoutPh = this.layoutPlaceholders?.[phKey] || this.layoutPlaceholders?.[phType];

            // Find master placeholder by specific key, or fall back to generic type, or search by type
            let masterPh = this.masterPlaceholders?.[phKey] || this.masterPlaceholders?.[phType];
            if (!masterPh) {
                // Last resort: find the first placeholder on the master with a matching type
                masterPh = Object.values(this.masterPlaceholders).find(p => p.type === phType);
            }

            // Prioritize layout placeholder only if it has position info. Otherwise, fallback to master.
            const placeholder = (layoutPh && layoutPh.pos) ? layoutPh : masterPh;

            if (placeholder && placeholder.pos) {
                pos = { ...placeholder.pos };

                // Special handling for footers to stretch across the slide
                if (phType === 'ftr') {
                    console.log('[WIDTH DEBUG] Original pos:', JSON.stringify(pos, null, 2));
                    console.log('[WIDTH DEBUG] Slide size:', JSON.stringify(this.slideSize, null, 2));
                    pos.width = this.slideSize.width - (pos.x * 2);
                    console.log(`[WIDTH DEBUG] New calculated width: ${pos.width}`);
                }

                localMatrix.translate(pos.x, pos.y);
                pos.x = 0;
                pos.y = 0;
            }
        }

        if (!pos) return { shape: null, pos: null, phKey, phType };

        const finalMatrix = parentMatrix.clone().multiply(localMatrix);


        this.renderer.setTransform(finalMatrix);

        const txBody = shapeNode.getElementsByTagNameNS(PML_NS, 'txBody')[0];

        if (shapeProps && shapeProps.geometry) {
             const geomType = shapeProps.geometry.type === 'preset' ? shapeProps.geometry.preset : shapeProps.geometry.type;
             switch (geomType) {
                case 'rect':
                    this.renderer.drawRect(0, 0, pos.width, pos.height, {
                        fill: shapeProps.fill?.color,
                        stroke: shapeProps.stroke,
                    });
                    break;
                case 'ellipse':
                    this.renderer.drawEllipse(pos.width / 2, pos.height / 2, pos.width / 2, pos.height / 2, {
                        fill: shapeProps.fill?.color,
                        stroke: shapeProps.stroke,
                    });
                    break;
                case 'line':
                    const decomp = finalMatrix.decompose();
                    if (decomp.scale.x === 0 || decomp.scale.y === 0) {
                        break;
                    }
                    const noScaleMatrix = new Matrix();
                    noScaleMatrix.translate(decomp.translation.x, decomp.translation.y);
                    noScaleMatrix.rotate(decomp.rotation);

                    this.renderer.setTransform(noScaleMatrix);

                    const scaledWidth = pos.width * decomp.scale.x;
                    const scaledHeight = pos.height * decomp.scale.y;

                    this.renderer.drawLine(0, 0, scaledWidth, scaledHeight, {
                        stroke: shapeProps.stroke,
                    });

                    this.renderer.setTransform(finalMatrix);
                    break;
                case 'arc':
                    const arcAdj = shapeProps.geometry.adjustments;
                    const arcStartAngle = (arcAdj?.adj1 !== undefined ? arcAdj.adj1 : 5400000) / 60000;
                    const arcSweepAngle = (arcAdj?.adj2 !== undefined ? arcAdj.adj2 : 5400000) / 60000;
                    const arcEndAngle = arcStartAngle + arcSweepAngle;

                    const arcCenterX = pos.width / 2;
                    const arcCenterY = pos.height / 2;
                    const arcRadiusX = pos.width / 2;
                    const arcRadiusY = pos.height / 2;

                    const arcStart = this.polarToCartesianForArc(arcCenterX, arcCenterY, arcRadiusX, arcRadiusY, arcStartAngle);
                    const arcEnd = this.polarToCartesianForArc(arcCenterX, arcCenterY, arcRadiusX, arcRadiusY, arcEndAngle);

                    const arcLargeArcFlag = arcSweepAngle <= 180 ? "0" : "1";
                    const arcSweepFlag = arcSweepAngle >= 0 ? "1" : "0";

                    const arcPath = [
                        "M", arcStart.x, arcStart.y,
                        "A", arcRadiusX, arcRadiusY, 0, arcLargeArcFlag, arcSweepFlag, arcEnd.x, arcEnd.y,
                    ].join(" ");

                    console.log("Drawing Arc:", {
                        shapeName,
                        rotation: rot,
                        flipH,
                        flipV,
                        arcStartAngle,
                        arcSweepAngle,
                        arcPath,
                    });

                    this.renderer.drawPath(arcPath, {
                        stroke: shapeProps.stroke,
                    });
                    break;
                case 'custom':
                    if (shapeProps.geometry.path) {
                        const pathData = shapeProps.geometry.path;
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
                        this.renderer.drawPath(pathString, {
                            fill: shapeProps.fill?.color,
                            stroke: shapeProps.stroke,
                        });
                    }
                    break;
                case 'blockArc':
                    const avLst = shapeProps.geometry.adjustments;
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
                    const innerRadiusX = outerRadiusX * (1 - innerRadiusRatio);
                    const innerRadiusY = outerRadiusY * (1 - innerRadiusRatio);

                    const outerStart = this.polarToCartesian(centerX, centerY, outerRadiusX, outerRadiusY, startAngle);
                    const outerEnd = this.polarToCartesian(centerX, centerY, outerRadiusX, outerRadiusY, endAngle);
                    const innerStart = this.polarToCartesian(centerX, centerY, innerRadiusX, innerRadiusY, startAngle);
                    const innerEnd = this.polarToCartesian(centerX, centerY, innerRadiusX, innerRadiusY, endAngle);

                    const largeArcFlag = sweepAngle <= 180 ? "0" : "1";

                    const path = [
                        "M", outerStart.x, outerStart.y,
                        "A", outerRadiusX, outerRadiusY, 0, largeArcFlag, 1, outerEnd.x, outerEnd.y,
                        "L", innerEnd.x, innerEnd.y,
                        "A", innerRadiusX, innerRadiusY, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
                        "Z"
                    ].join(" ");

                    this.renderer.drawPath(path, {
                        fill: shapeProps.fill?.color,
                        stroke: shapeProps.stroke,
                    });
                    break;
                case 'roundRect':
                    const adj_roundRect = shapeProps.geometry.adjustments?.adj !== undefined ? shapeProps.geometry.adjustments.adj : 16667;
                    const cornerRadiusRatio = adj_roundRect / 100000;
                    const cornerRadius = ((pos.width + pos.height) / 2) * cornerRadiusRatio;

                    const path_roundRect = [
                        "M", cornerRadius, 0,
                        "L", pos.width - cornerRadius, 0,
                        "A", cornerRadius, cornerRadius, 0, 0, 1, pos.width, cornerRadius,
                        "L", pos.width, pos.height - cornerRadius,
                        "A", cornerRadius, cornerRadius, 0, 0, 1, pos.width - cornerRadius, pos.height,
                        "L", cornerRadius, pos.height,
                        "A", cornerRadius, cornerRadius, 0, 0, 1, 0, pos.height - cornerRadius,
                        "L", 0, cornerRadius,
                        "A", cornerRadius, cornerRadius, 0, 0, 1, cornerRadius, 0,
                        "Z"
                    ].join(" ");

                    this.renderer.drawPath(path_roundRect, {
                        fill: shapeProps.fill?.color,
                        stroke: shapeProps.stroke,
                    });
                    break;
                case 'round1Rect':
                case 'round2SameRect':
                case 'round2DiagRect':
                case 'snip1Rect':
                case 'snip2SameRect':
                case 'snip2DiagRect':
                case 'snipRoundRect':
                    const adj1_multi = shapeProps.geometry.adjustments?.adj1 !== undefined ? shapeProps.geometry.adjustments.adj1 : 16667;
                    const adj2_multi = shapeProps.geometry.adjustments?.adj2 !== undefined ? shapeProps.geometry.adjustments.adj2 : 16667;
                    const cornerRadius1 = Math.min(pos.width, pos.height) * (adj1_multi / 100000);
                    const cornerRadius2 = Math.min(pos.width, pos.height) * (adj2_multi / 100000);

                    let path_multi;
                    switch(geomType) {
                        case 'round1Rect':
                            path_multi = `M 0 ${cornerRadius1} A ${cornerRadius1} ${cornerRadius1} 0 0 1 ${cornerRadius1} 0 L ${pos.width} 0 L ${pos.width} ${pos.height} L 0 ${pos.height} Z`;
                            break;
                        case 'round2SameRect':
                            path_multi = `M 0 ${cornerRadius1} A ${cornerRadius1} ${cornerRadius1} 0 0 1 ${cornerRadius1} 0 L ${pos.width - cornerRadius2} 0 A ${cornerRadius2} ${cornerRadius2} 0 0 1 ${pos.width} ${cornerRadius2} L ${pos.width} ${pos.height} L 0 ${pos.height} Z`;
                            break;
                        case 'round2DiagRect':
                            path_multi = `M 0 ${cornerRadius1} A ${cornerRadius1} ${cornerRadius1} 0 0 1 ${cornerRadius1} 0 L ${pos.width} 0 L ${pos.width} ${pos.height - cornerRadius2} A ${cornerRadius2} ${cornerRadius2} 0 0 1 ${pos.width - cornerRadius2} ${pos.height} L 0 ${pos.height} Z`;
                            break;
                        case 'snip1Rect':
                            path_multi = `M ${cornerRadius1} 0 L ${pos.width} 0 L ${pos.width} ${pos.height} L 0 ${pos.height} L 0 ${cornerRadius1} Z`;
                            break;
                        case 'snip2SameRect':
                            path_multi = `M ${cornerRadius1} 0 L ${pos.width - cornerRadius2} 0 L ${pos.width} ${cornerRadius2} L ${pos.width} ${pos.height} L 0 ${pos.height} L 0 ${cornerRadius1} Z`;
                            break;
                        case 'snip2DiagRect':
                            path_multi = `M ${cornerRadius1} 0 L ${pos.width} 0 L ${pos.width} ${pos.height - cornerRadius2} L ${pos.width - cornerRadius2} ${pos.height} L 0 ${pos.height} L 0 ${cornerRadius1} Z`;
                            break;
                        case 'snipRoundRect':
                            path_multi = `M ${cornerRadius1} 0 L ${pos.width} 0 L ${pos.width} ${pos.height} L ${cornerRadius2} ${pos.height} A ${cornerRadius2} ${cornerRadius2} 0 0 1 0 ${pos.height - cornerRadius2} L 0 ${cornerRadius1} Z`;
                            break;
                    }

                    this.renderer.drawPath(path_multi, {
                        fill: shapeProps.fill?.color,
                        stroke: shapeProps.stroke,
                    });
                    break;
             }
        } else if (txBody) {
            // This is a shapeless textbox. Create a transparent rectangle to host the text.
            this.renderer.drawRect(0, 0, pos.width, pos.height, { fill: 'transparent' });
        }

        return { pos, phKey, phType };
    }

    polarToCartesian(centerX, centerY, radiusX, radiusY, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 180) * Math.PI / 180.0;
        return {
            x: centerX + (radiusX * Math.cos(angleInRadians)),
            y: centerY + (radiusY * Math.sin(angleInRadians))
        };
    }

    polarToCartesianForArc(centerX, centerY, radiusX, radiusY, angleInDegrees) {
        const angleInRadians = angleInDegrees * Math.PI / 180.0;
        return {
            x: centerX - (radiusX * Math.cos(angleInRadians)),
            y: centerY - (radiusY * Math.sin(angleInRadians))
        };
    }

}
