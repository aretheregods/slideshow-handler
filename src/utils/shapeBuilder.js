import { DML_NS, PML_NS } from 'constants';
import { findPlaceholder, Matrix } from 'utils';

/**
 * @class ShapeBuilder
 * @description A class for building and rendering shapes.
 */
export class ShapeBuilder {
    /**
     * Creates an instance of ShapeBuilder.
     * @param {SvgRenderer} renderer - The SVG renderer.
     * @param {Object} slideContext - The context of the slide.
     * @param {Object} imageMap - A map of image relationship IDs to image data.
     * @param {Object} masterPlaceholders - Placeholders from the slide master.
     * @param {Object} layoutPlaceholders - Placeholders from the slide layout.
     * @param {number} emuPerPixel - The conversion factor from EMUs to pixels.
     * @param {Object} slideSize - The dimensions of the slide.
     */
    constructor(renderer, slideContext, imageMap, masterPlaceholders, layoutPlaceholders, emuPerPixel, slideSize) {
        this.renderer = renderer;
        this.slideContext = slideContext;
        this.imageMap = imageMap;
        this.masterPlaceholders = masterPlaceholders;
        this.layoutPlaceholders = layoutPlaceholders;
        this.emuPerPixel = emuPerPixel;
        this.slideSize = slideSize;
    }

    /**
     * Gets the properties of a shape, including its position and transformation matrix.
     * @param {Element} shapeNode - The shape's XML node.
     * @param {Matrix} parentMatrix - The transformation matrix of the parent element.
     * @returns {{pos: Object, transform: string, flipH: boolean, flipV: boolean}} The shape's properties.
     */
    getShapeProperties(shapeNode, parentMatrix) {
        const { phKey, phType } = this.#shapeAttr(shapeNode);
        const { pos, localMatrix, flipH, flipV } = this.#localMatrix(phKey, phType, shapeNode);
        if (!pos) return { pos: null, transform: null };

        const finalMatrix = parentMatrix.clone().multiply(localMatrix);
        const transform = `matrix(${finalMatrix.m.join(' ')})`;

        return { pos, transform, flipH, flipV };
    }

    /**
     * Renders a shape based on its properties.
     * @param {Object} pos - The position and dimensions of the shape.
     * @param {Object} shapeProps - The properties of the shape, including geometry, fill, and stroke.
     * @param {Matrix} matrix - The transformation matrix of the shape.
     * @param {boolean} flipH - A flag indicating if the shape is flipped horizontally.
     * @param {boolean} flipV - A flag indicating if the shape is flipped vertically.
     */
    renderShape(pos, shapeProps, matrix, flipH, flipV) {
        const txBody = shapeProps.txBody; // Assuming txBody is passed in shapeProps if needed

        if (shapeProps && shapeProps.geometry) {
             const geomType = shapeProps.geometry.type === 'preset' ? shapeProps.geometry.preset : shapeProps.geometry.type;
             switch (geomType) {
                case 'rect':
                    this.renderer.drawRect(0, 0, pos.width, pos.height, {
                        fill: shapeProps.fill,
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
                    });
                    break;
                case 'ellipse':
                    this.renderer.drawEllipse(pos.width / 2, pos.height / 2, pos.width / 2, pos.height / 2, {
                        fill: shapeProps.fill,
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
                    });
                    break;
                case 'line':
                    const m = matrix.m;
                    const sx = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
                    const sy = Math.sqrt(m[2] * m[2] + m[3] * m[3]);

                    const noScaleMatrix = matrix.clone();
                    if (sx !== 0 && sy !== 0) {
                        noScaleMatrix.scale(1 / sx, 1 / sy);
                    }

                    const scaledWidth = pos.width * sx;
                    const scaledHeight = pos.height * sy;

                    const originalGroup = this.renderer.currentGroup;
                    this.renderer.currentGroup = this.renderer.svg;

                    this.renderer.setTransform(noScaleMatrix);
                    this.renderer.drawLine(0, 0, scaledWidth, scaledHeight, {
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                    });

                    this.renderer.currentGroup = originalGroup;
                    break;
                case 'arc':
                    const arcAdj = shapeProps.geometry.adjustments;
                    let arcStartAngle, arcSweepAngle;

                    if (arcAdj?.adj1 !== undefined && arcAdj?.adj2 !== undefined) {
                        const startAngleFromXml = arcAdj.adj1 / 60000;
                        const endAngleFromXml = arcAdj.adj2 / 60000;
                        arcSweepAngle = (endAngleFromXml - startAngleFromXml) / 2;
                        arcStartAngle = startAngleFromXml - 60;
                    } else {
                        arcStartAngle = 90;
                        arcSweepAngle = 90;
                    }

                    const arcEndAngle = arcStartAngle + arcSweepAngle;
                    const arcCenterX = pos.width / 2;
                    const arcCenterY = pos.height / 2;
                    const arcRadiusX = pos.width / 2;
                    const arcRadiusY = pos.height / 2;

                    const arcStart = this.polarToCartesian(arcCenterX, arcCenterY, arcRadiusX, arcRadiusY, arcStartAngle);
                    const arcEnd = this.polarToCartesian(arcCenterX, arcCenterY, arcRadiusX, arcRadiusY, arcEndAngle);

                    const arcLargeArcFlag = Math.abs(arcSweepAngle) <= 180 ? "0" : "1";
                    let arcSweepFlag = arcSweepAngle >= 0 ? "1" : "0";
                    if (flipH ^ flipV) {
                        arcSweepFlag = arcSweepFlag === "0" ? "0" : "1";
                    }

                    const arcPath = [
                        "M", arcStart.x, arcStart.y,
                        "A", arcRadiusX, arcRadiusY, 0, arcLargeArcFlag, arcSweepFlag, arcEnd.x, arcEnd.y,
                    ].join(" ");

                    this.renderer.drawPath(arcPath, {
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
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
                            fill: shapeProps.fill,
                            stroke: shapeProps.stroke,
                            effect: shapeProps.effect,
                            pos,
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
                        fill: shapeProps.fill,
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
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
                        fill: shapeProps.fill,
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
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
                        fill: shapeProps.fill,
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
                    });
                    break;
             }
        } else if (txBody) {
            // This is a shapeless textbox. Create a transparent rectangle to host the text.
            this.renderer.drawRect(0, 0, pos.width, pos.height, { fill: 'transparent', effect: shapeProps.effect });
        }
    }


    /**
     * Extracts attributes from a shape node.
     * @param {Element} shapeNode - The shape's XML node.
     * @returns {{phKey: string, phType: string, shapeName: string}} The extracted attributes.
     * @private
     */
    #shapeAttr( shapeNode ) {
        const nvSpPrNode = shapeNode.getElementsByTagNameNS( PML_NS, 'nvSpPr' )[ 0 ];
        let phKey = null, phType = null, shapeName = 'Unknown';
        if ( nvSpPrNode ) {
            const cNvPrNode = nvSpPrNode.getElementsByTagNameNS( PML_NS, 'cNvPr' )[ 0 ];
            if ( cNvPrNode ) {
                shapeName = cNvPrNode.getAttribute( 'name' );
            }

            const nvPrNode = nvSpPrNode.getElementsByTagNameNS( PML_NS, 'nvPr' )[ 0 ];
            if ( nvPrNode ) {
                const placeholder = nvPrNode.getElementsByTagNameNS( PML_NS, 'ph' )[ 0 ];
                if ( placeholder ) {
                    phType = placeholder.getAttribute( 'type' );
                    const phIdx = placeholder.getAttribute( 'idx' );
                    phKey = phIdx ? `idx_${ phIdx }` : phType;
                    if ( !phType && phIdx ) {
                        phType = 'body';
                    }
                }
            }
        }

        return { phKey, phType, shapeName };
    }

    /**
     * Calculates the local transformation matrix for a shape.
     * @param {string} phKey - The placeholder key.
     * @param {string} phType - The placeholder type.
     * @param {Element} shapeNode - The shape's XML node.
     * @returns {{pos: Object, localMatrix: Matrix, flipH: boolean, flipV: boolean}} The local matrix and related properties.
     * @private
     */
    #localMatrix( phKey, phType, shapeNode ) {
        let localMatrix = new Matrix();
        let pos;
        let flipH = false, flipV = false, rot = 0;

        const xfrmNode = shapeNode.getElementsByTagNameNS( DML_NS, 'xfrm' )[ 0 ];
        if ( xfrmNode ) {
            const offNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'off' )[ 0 ];
            const extNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'ext' )[ 0 ];
            if ( offNode && extNode ) {
                const x = parseInt( offNode.getAttribute( "x" ) ) / this.emuPerPixel;
                const y = parseInt( offNode.getAttribute( "y" ) ) / this.emuPerPixel;
                const w = parseInt( extNode.getAttribute( "cx" ) ) / this.emuPerPixel;
                const h = parseInt( extNode.getAttribute( "cy" ) ) / this.emuPerPixel;
                rot = parseInt( xfrmNode.getAttribute( 'rot' ) || '0' ) / 60000;
                flipH = xfrmNode.getAttribute( 'flipH' ) === '1';
                flipV = xfrmNode.getAttribute( 'flipV' ) === '1';

                pos = { x: 0, y: 0, width: w, height: h };

                localMatrix.translate( x, y );
                localMatrix.translate( w / 2, h / 2 );
                localMatrix.rotate( rot * Math.PI / 180 );
                localMatrix.scale( flipH ? -1 : 1, flipV ? -1 : 1 );
                localMatrix.translate( -w / 2, -h / 2 );
            }
        } else if ( phKey ) {
            const layoutPh = findPlaceholder( phKey, phType, this.layoutPlaceholders );
            let masterPh = findPlaceholder( phKey, phType, this.masterPlaceholders )
            if ( !masterPh ) {
                // Last resort: find the first placeholder on the master with a matching type
                masterPh = Object.values( this.masterPlaceholders ).find( p => p.type === phType );
            }

            // Prioritize layout placeholder only if it has position info. Otherwise, fallback to master.
            const placeholder = ( layoutPh && layoutPh.pos ) ? layoutPh : masterPh;

            if ( placeholder && placeholder.pos ) {
                pos = { ...placeholder.pos };

                if ( placeholder.transform ) {
                    rot = placeholder.transform.rot / 60000;
                    flipH = placeholder.transform.flipH;
                    flipV = placeholder.transform.flipV;
                }

                localMatrix.translate( pos.x, pos.y );
                localMatrix.translate( pos.width / 2, pos.height / 2 );
                localMatrix.rotate( rot * Math.PI / 180 );
                localMatrix.scale( flipH ? -1 : 1, flipV ? -1 : 1 );
                localMatrix.translate( -pos.width / 2, -pos.height / 2 );

                pos.x = 0;
                pos.y = 0;
            }
        }

        return { pos, localMatrix, flipH, flipV };
    }

    /**
     * Converts polar coordinates to Cartesian coordinates.
     * @param {number} centerX - The x-coordinate of the center.
     * @param {number} centerY - The y-coordinate of the center.
     * @param {number} radiusX - The horizontal radius.
     * @param {number} radiusY - The vertical radius.
     * @param {number} angleInDegrees - The angle in degrees.
     * @returns {{x: number, y: number}} The Cartesian coordinates.
     */
    polarToCartesian(centerX, centerY, radiusX, radiusY, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 180) * Math.PI / 180.0;
        return {
            x: centerX + (radiusX * Math.cos(angleInRadians)),
            y: centerY + (radiusY * Math.sin(angleInRadians))
        };
    }

    /**
     * Converts polar coordinates to Cartesian coordinates, specifically for arcs.
     * @param {number} centerX - The x-coordinate of the center.
     * @param {number} centerY - The y-coordinate of the center.
     * @param {number} radiusX - The horizontal radius.
     * @param {number} radiusY - The vertical radius.
     * @param {number} angleInDegrees - The angle in degrees.
     * @returns {{x: number, y: number}} The Cartesian coordinates.
     */
    polarToCartesianForArc(centerX, centerY, radiusX, radiusY, angleInDegrees) {
        const angleInRadians = angleInDegrees * Math.PI / 180.0;
        return {
            x: centerX - (radiusX * Math.cos(angleInRadians)),
            y: centerY - (radiusY * Math.sin(angleInRadians))
        };
    }

}
