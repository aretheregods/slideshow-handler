import { DML_NS, DSP_NS, EMU_PER_PIXEL, PML_NS } from 'constants';
import { findPlaceholder, Matrix, buildPathStringFromGeom } from 'utils';

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
    constructor( renderer, slideContext, imageMap, masterPlaceholders, layoutPlaceholders, emuPerPixel, slideSize ) {
        this.renderer = renderer;
        this.slideContext = slideContext;
        this.imageMap = imageMap;
        this.masterPlaceholders = masterPlaceholders;
        this.layoutPlaceholders = layoutPlaceholders;
        this.emuPerPixel = emuPerPixel || EMU_PER_PIXEL;
        this.slideSize = slideSize;
        this.namespace = PML_NS;
    }

    /**
     * Gets the properties of a shape, including its position and transformation matrix.
     * @param {Element} shapeNode - The shape's XML node.
     * @param {Matrix} parentMatrix - The transformation matrix of the parent element.
     * @returns {{pos: Object, transform: string, flipH: boolean, flipV: boolean}} The shape's properties.
     */
    getShapeProperties( shapeNode, parentMatrix, ns = PML_NS ) {
        const { phKey, phType } = this.shapeAttr( shapeNode, ns );
        const { pos, localMatrix, flipH, flipV, rot } = this.localMatrix( phKey, phType, shapeNode );
        if ( !pos ) return { pos: null, transform: null };

        const finalMatrix = parentMatrix.clone().multiply( localMatrix );
        const transform = `matrix(${ finalMatrix.m.join( ' ' ) })`;

        return { pos, transform, flipH, flipV, rot };
    }

    /**
     * Renders a shape based on its properties.
     * @param {Object} pos - The position and dimensions of the shape.
     * @param {Object} shapeProps - The properties of the shape, including geometry, fill, and stroke.
     * @param {Matrix} matrix - The transformation matrix of the shape.
     * @param {boolean} flipH - A flag indicating if the shape is flipped horizontally.
     * @param {boolean} flipV - A flag indicating if the shape is flipped vertically.
     */
    renderShape( pos, shapeProps, matrix, flipH, flipV ) {
        const txBody = shapeProps.txBody; // Assuming txBody is passed in shapeProps if needed

        if ( shapeProps && shapeProps.geometry ) {
            const geomType = shapeProps.geometry.type === 'preset' ? shapeProps.geometry.preset : shapeProps.geometry.type;

            const path = buildPathStringFromGeom(shapeProps.geometry, pos, flipH, flipV);
            if ( path ) {
                if ( geomType === 'arc') {
                    this.renderer.drawPath( path, {
                        id: shapeProps.id,
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
                    } );
                } else {
                    this.renderer.drawPath( path, {
                        id: shapeProps.id,
                        fill: shapeProps.fill,
                        stroke: shapeProps.stroke,
                        effect: shapeProps.effect,
                        pos,
                    } );
                }
            } else if (geomType === 'line') {
                // Fallback for line shape
                this.renderer.drawLine(0, 0, pos.width, pos.height, {
                    id: shapeProps.id,
                    stroke: shapeProps.stroke,
                    effect: shapeProps.effect,
                });
            }
        } else if ( txBody ) {
            // This is a shapeless textbox. Create a transparent rectangle to host the text.
            this.renderer.drawRect( 0, 0, pos.width, pos.height, { id: shapeProps.id, fill: 'transparent', effect: shapeProps.effect } );
        }
    }


    /**
     * Extracts attributes from a shape node.
     * @param {Element} shapeNode - The shape's XML node.
     * @returns {{phKey: string, phType: string, shapeName: string}} The extracted attributes.
     * @private
     */
    shapeAttr( shapeNode, ns ) {
        const nvSpPrNode = shapeNode.getElementsByTagNameNS( ns, 'nvSpPr' )[ 0 ];
        let phKey = null, phType = null, shapeName = 'Unknown';
        if ( nvSpPrNode ) {
            const cNvPrNode = nvSpPrNode.getElementsByTagNameNS( ns, 'cNvPr' )[ 0 ];
            if ( cNvPrNode ) {
                shapeName = cNvPrNode.getAttribute( 'name' );
            }

            const nvPrNode = nvSpPrNode.getElementsByTagNameNS( ns, 'nvPr' )[ 0 ];
            if ( nvPrNode ) {
                const placeholder = nvPrNode.getElementsByTagNameNS( ns, 'ph' )[ 0 ];
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
    localMatrix( phKey, phType, shapeNode ) {
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

        return { pos, localMatrix, flipH, flipV, rot };
    }
}
