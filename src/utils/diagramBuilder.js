import { EMU_PER_PIXEL, DML_NS, DIAGRAM_NS, DSP_NS, PML_NS } from 'constants';
import { ShapeBuilder } from './shapeBuilder.js';
import { getNormalizedXmlString, parseXmlString, resolvePath, parseShapeProperties, Matrix, parseBodyProperties } from 'utils';

export class DiagramBuilder {
    constructor( { slide, slideHandler, slideRels, presentation, shapeBuilder, entriesMap } ) {
        this.slide = slide;
        this.slideHandler = slideHandler;
        this.slideRels = slideRels;
        this.presentation = presentation;
        this.shapeBuilder = shapeBuilder || new ShapeBuilder( { slide, slideRels, presentation, emuPerPixel: EMU_PER_PIXEL } );
        this.entriesMap = entriesMap;
    }

    async build( frameNode ) {
        const graphicData = frameNode.getElementsByTagNameNS( DML_NS, 'graphicData' )[ 0 ];
        const diagramRelIds = graphicData.getElementsByTagNameNS( DIAGRAM_NS, 'relIds' )[ 0 ];

        const dataRelId = diagramRelIds.getAttribute( 'r:dm' );
        const layoutRelId = diagramRelIds.getAttribute( 'r:lo' );
        const styleRelId = diagramRelIds.getAttribute( 'r:qs' );
        const colorRelId = diagramRelIds.getAttribute( 'r:cs' );

        const dataXml = await getNormalizedXmlString( this.entriesMap, resolvePath( 'ppt/slides', this.slideRels[ dataRelId ].target ) );
        const layoutXml = await getNormalizedXmlString( this.entriesMap, resolvePath( 'ppt/slides', this.slideRels[ layoutRelId ].target ) );
        const styleXml = styleRelId ? await getNormalizedXmlString( this.entriesMap, resolvePath( 'ppt/slides', this.slideRels[ styleRelId ].target ) ) : null;
        const colorsXml = colorRelId ? await getNormalizedXmlString( this.entriesMap, resolvePath( 'ppt/slides', this.slideRels[ colorRelId ].target ) ) : null;

        this.layoutDoc = parseXmlString( layoutXml );
        this.dataDoc = parseXmlString( dataXml );
        this.colorsDoc = colorsXml ? parseXmlString( colorsXml ) : null;
        this.styleDoc = styleXml ? parseXmlString( styleXml ) : null;

        const dataModelExt = this.dataDoc.getElementsByTagNameNS( DSP_NS, 'dataModelExt' )[ 0 ];
        const drawingRelId = dataModelExt?.getAttribute( 'relId' );

        if ( drawingRelId && this.slideRels[ drawingRelId ] ) {
            const drawingXml = await getNormalizedXmlString( this.entriesMap, resolvePath( 'ppt/slides', this.slideRels[ drawingRelId ].target ) );
            this.drawingDoc = parseXmlString( drawingXml );
            return this.#buildDrawingDiagram();
        } else {
            return this.#buildLayoutDiagram();
        }
    }

    #buildDrawingDiagram() {
        const dspSpTree = this.drawingDoc.getElementsByTagNameNS( DSP_NS, 'spTree' )[ 0 ];
        if ( !dspSpTree ) return [];

        const dspShapes = Array.from( dspSpTree.getElementsByTagNameNS( DSP_NS, 'sp' ) );
        const allDataPts = Array.from( this.dataDoc.getElementsByTagNameNS( DIAGRAM_NS, 'pt' ) );

        return dspShapes.map( dspShape => {
            const modelId = dspShape.getAttribute( 'modelId' );
            const shapePt = allDataPts.find( pt => pt.getAttribute( 'modelId' ) === modelId );
            const dataPt = this.#findDataPoint( modelId, allDataPts );

            const { pos, transform, flipH, flipV, rot } = this.shapeBuilder.getShapeProperties( dspShape, new Matrix(), DSP_NS );
            const shapeProps = parseShapeProperties( dspShape, this.slide.slideContext, this.slide.slideNum, DSP_NS );

            const shape = {
                type: 'shape',
                transform,
                pos,
                shapeProps,
                flipH,
                flipV,
                rot,
            };

            if ( dataPt ) {
                const text = this.#getText( dataPt, pos );
                if ( text ) {
                    console.log( { text, dataPt } );
                    shape.text = text;
                }
            }

            return shape;
        } );
    }

    #buildLayoutDiagram() {
        const rootLayoutNode = this.layoutDoc.getElementsByTagNameNS( DIAGRAM_NS, 'layoutNode' )[ 0 ];
        const dataModelNode = this.dataDoc.getElementsByTagNameNS( DIAGRAM_NS, 'dataModel' )[ 0 ];

        if ( !rootLayoutNode || !dataModelNode ) {
            return [];
        }

        return this.#processLayoutNode( rootLayoutNode, dataModelNode );
    }

    #processLayoutNode( layoutNode, dataContext ) {
        let shapes = [];

        const shapeNode = layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'shape' )[ 0 ];
        const presOf = layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'presOf' )[ 0 ] || layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'choose' )[ 0 ]?.getElementsByTagNameNS( DIAGRAM_NS, 'if' )[ 0 ]?.getElementsByTagNameNS( DIAGRAM_NS, 'presOf' )[ 0 ];

        if ( shapeNode && presOf ) {
            shapes = this.#createShapeFromLayout( layoutNode, dataContext );
        } else {
            const childNodes = Array.from( layoutNode.childNodes ).filter( node => node.nodeType === 1 );
            for ( const child of childNodes ) {
                if ( child.nodeName === 'dgm:layoutNode' ) {
                    shapes.push( ...this.#handleLayoutNode( child, dataContext ) );
                } else if ( child.nodeName === 'dgm:forEach' ) {
                    shapes.push( ...this.#handleForEach( child, dataContext ) );
                } else if ( child.nodeName === 'dgm:choose' ) {
                    shapes.push( ...this.#handleChoose( child, dataContext ) );
                }
            }
        }

        const algNode = layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'alg' )[ 0 ];
        if ( algNode ) {
            const algType = algNode.getAttribute( 'type' );
            this.#applyAlgorithm( algType, layoutNode, shapes );
        }

        return shapes;
    }

    #handleLayoutNode( layoutNode, dataContext ) {
        return this.#processLayoutNode( layoutNode, dataContext );
    }

    #handleForEach( forEachNode, dataContext ) {
        const axis = forEachNode.getAttribute( 'axis' );
        const ptType = forEachNode.getAttribute( 'ptType' );

        const childDataContexts = this.#getDataPoint( dataContext, axis, ptType );

        let shapes = [];
        for ( const childContext of childDataContexts ) {
            const childLayoutNodes = Array.from( forEachNode.childNodes ).filter( node => node.nodeType === 1 );
            for ( const childLayoutNode of childLayoutNodes ) {
                shapes.push( ...this.#processLayoutNode( childLayoutNode, childContext ) );
            }
        }
        return shapes;
    }

    #handleChoose( chooseNode, dataContext ) {
        const ifNodes = Array.from( chooseNode.getElementsByTagNameNS( DIAGRAM_NS, 'if' ) );
        const elseNode = chooseNode.getElementsByTagNameNS( DIAGRAM_NS, 'else' )[ 0 ];

        for ( const ifNode of ifNodes ) {
            if ( this.#evaluateIf( ifNode, dataContext ) ) {
                let shapes = [];
                const childLayoutNodes = Array.from( ifNode.childNodes ).filter( node => node.nodeType === 1 );
                for ( const childLayoutNode of childLayoutNodes ) {
                    shapes.push( ...this.#processLayoutNode( childLayoutNode, dataContext ) );
                }
                return shapes;
            }
        }

        if ( elseNode ) {
            let shapes = [];
            const childLayoutNodes = Array.from( elseNode.childNodes ).filter( node => node.nodeType === 1 );
            for ( const childLayoutNode of childLayoutNodes ) {
                shapes.push( ...this.#processLayoutNode( childLayoutNode, dataContext ) );
            }
            return shapes;
        }

        return [];
    }

    #evaluateIf( ifNode, dataContext ) {
        const axis = ifNode.getAttribute( 'axis' );
        const ptType = ifNode.getAttribute( 'ptType' );
        const func = ifNode.getAttribute( 'func' );
        const op = ifNode.getAttribute( 'op' );
        const val = ifNode.getAttribute( 'val' );

        const dataPoints = this.#getDataPoint( dataContext, axis, ptType );

        if ( func === 'cnt' ) {
            const count = dataPoints.length;
            const numVal = parseInt( val, 10 );
            if ( op === 'equ' ) return count === numVal;
            if ( op === 'neq' ) return count !== numVal;
            if ( op === 'gt' ) return count > numVal;
            if ( op === 'lt' ) return count < numVal;
            if ( op === 'gte' ) return count >= numVal;
            if ( op === 'lte' ) return count <= numVal;
        }

        return false;
    }

    #createShapeFromLayout( layoutNode, dataContext ) {
        const presOf = layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'presOf' )[ 0 ] || layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'choose' )[ 0 ]?.getElementsByTagNameNS( DIAGRAM_NS, 'if' )[ 0 ]?.getElementsByTagNameNS( DIAGRAM_NS, 'presOf' )[ 0 ];

        if ( !presOf ) {
            return [];
        }

        const axis = presOf.getAttribute( 'axis' );
        const ptType = presOf.getAttribute( 'ptType' );

        const dataPoints = this.#getDataPoint( dataContext, axis, ptType );

        if ( dataPoints.length === 0 ) {
            return [];
        }

        const shapeNode = layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'shape' )[ 0 ];
        const type = shapeNode.getAttribute( 'type' );

        const shapes = [];
        for ( const point of dataPoints ) {
            const modelId = point.getAttribute( 'modelId' );
            let shape;

            if ( !shape ) {
                shape = {
                    type: 'shape',
                    shape: type,
                    text: null,
                    pos: { x: 0, y: 0 },
                    ext: { cx: 1000 * EMU_PER_PIXEL, cy: 1000 * EMU_PER_PIXEL },
                };
            }

            const textPos = {
                x: 0,
                y: 0,
                width: shape.ext.cx / EMU_PER_PIXEL,
                height: shape.ext.cy / EMU_PER_PIXEL,
            };
            const text = this.#getText( point, textPos );
            if ( text ) {
                shape.text = text;
            }

            this.#applyConstraints( layoutNode, shape );

            shapes.push( shape );
        }

        return shapes;
    }

    #applyAlgorithm( type, layoutNode, shapes ) {
        if ( type === 'lin' ) {
            this.#applyLinAlgorithm( layoutNode, shapes );
        }
    }

    #applyLinAlgorithm( layoutNode, shapes ) {
        let yOffset = 0; // in EMUs
        for ( const shape of shapes ) {
            shape.pos.y = yOffset / EMU_PER_PIXEL;
            const height = shape.ext.cy;
            yOffset += height;
        }
    }

    #applyConstraints( layoutNode, shape ) {
        const constrLst = layoutNode.getElementsByTagNameNS( DIAGRAM_NS, 'constrLst' )[ 0 ];
        if ( !constrLst ) {
            return;
        }

        const constrNodes = Array.from( constrLst.getElementsByTagNameNS( DIAGRAM_NS, 'constr' ) );
        for ( const constr of constrNodes ) {
            const type = constr.getAttribute( 'type' );
            const val = parseFloat( constr.getAttribute( 'val' ) );

            if ( type === 'w' ) {
                shape.ext.cx = val;
            } else if ( type === 'h' ) {
                shape.ext.cy = val;
            }
        }
    }

    #getDataPoint( context, axis, ptType ) {
        if ( !context ) {
            return [];
        }

        if ( axis === 'ch' ) {
            const ptLstNode = context.getElementsByTagNameNS( DIAGRAM_NS, 'ptLst' )[ 0 ];
            if ( ptLstNode ) {
                const children = Array.from( ptLstNode.childNodes ).filter( n => n.nodeName === 'dgm:pt' );
                if ( ptType ) {
                    return children.filter( c => c.getAttribute( 'type' ) === ptType );
                }
                return children;
            }
            return [];
        }

        if ( axis === 'self' ) {
            if ( context.nodeName === 'dgm:dataModel' ) {
                const ptLst = context.getElementsByTagNameNS( DIAGRAM_NS, 'ptLst' )[ 0 ];
                if ( ptLst ) {
                    return Array.from( ptLst.childNodes ).filter( n => n.nodeName === 'dgm:pt' );
                }
                return [];
            }
            return [ context ];
        }

        return [];
    }

    #findDataPoint( modelId, allDataPts, visited = new Set() ) {
        if ( !modelId || visited.has( modelId ) ) {
            return null;
        }
        visited.add( modelId );

        const point = allDataPts.find( ( pt ) => pt.getAttribute( 'modelId' ) === modelId );
        if ( !point ) {
            return null;
        }

        const ptType = point.getAttribute( 'type' );

        if ( ptType === 'parTrans' || ptType === 'sibTrans' ) {
            return null;
        }

        const cxnLst = this.dataDoc.getElementsByTagNameNS( DIAGRAM_NS, 'cxnLst' )[ 0 ];
        const allCxns = cxnLst ? Array.from( cxnLst.getElementsByTagNameNS( DIAGRAM_NS, 'cxn' ) ) : [];

        // If it's a presentation point, it's a proxy. Find the actual data point it represents.
        if ( ptType === 'pres' ) {
            // Find connections that link a data point TO this presentation point.
            const presCxns = allCxns.filter( cxn =>
                cxn.getAttribute( 'type' ) === 'presOf' &&
                cxn.getAttribute( 'destId' ) === modelId
            );

            for ( const cxn of presCxns ) {
                const dataPt = this.#findDataPoint( cxn.getAttribute( 'srcId' ), allDataPts, visited );
                if ( dataPt ) return dataPt;
            }
        }

        // If it's not a presentation point, it's a data point. Check for its own text first.
        const textNode = point.getElementsByTagNameNS( DIAGRAM_NS, 't' )[ 0 ];
        if ( textNode?.textContent.trim() ) {
            return point;
        }

        // If no text, it might be a parent. Search its children.
        const childCxns = allCxns.filter( cxn => cxn.getAttribute( 'srcId' ) === modelId && cxn.getAttribute( 'type' ) !== 'presOf' );
        for ( const cxn of childCxns ) {
            const dataPt = this.#findDataPoint( cxn.getAttribute( 'destId' ), allDataPts, visited );
            if ( dataPt ) return dataPt;
        }

        return null;
    }

    #getText( dataPt, pos ) {
        const textBodyNode = dataPt.getElementsByTagNameNS( DIAGRAM_NS, 't' )[ 0 ];
        if ( !textBodyNode ) {
            return null;
        }

        const bodyPr = parseBodyProperties( textBodyNode );
        const listCounters = {};
        const phKey = null;
        const phType = 'body';

        const textData = this.slideHandler.parseParagraphs(
            textBodyNode,
            pos,
            phKey,
            phType,
            listCounters,
            bodyPr,
            {}, // tableTextStyle
        );

        if ( !textData?.layout?.lines?.length ) {
            return null;
        }

        return textData;
    }
}
