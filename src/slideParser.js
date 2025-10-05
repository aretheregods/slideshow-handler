import {
    Matrix,
    ColorParser,
    parseXmlString,
    getAutoNumberingChar,
    resolveFontFamily,
    parseChart,
    parseShapeProperties,
    parseBodyProperties,
    parseParagraphProperties,
    getCellFillColor,
    getCellTextStyle,
    getCellBorders,
    buildPathStringFromGeom,
    parseSourceRectangle,
    createImage,
    resolvePath,
    getNormalizedXmlString,
    parseExtensions,
    parseBackground,
    DiagramBuilder,
} from 'utils';
import {
    EMU_PER_PIXEL,
    PT_TO_PX,
    LINE_HEIGHT,
    INDENTATION_AMOUNT,
    BULLET_OFFSET,
    PML_NS, DML_NS, CHART_NS, TABLE_NS, DIAGRAM_NS,
} from 'constants';
import { ShapeBuilder } from './shapeBuilder.js';

export class SlideParser {
    constructor( {
        slideXml,
        masterPlaceholders,
        layoutPlaceholders,
        slideId,
        slideNum,
        slideSize,
        defaultTextStyles,
        tableStyles,
        defaultTableStyleId,
        slideImageMap,
        layoutImageMap,
        masterImageMap,
        slideContext,
        masterStaticShapes,
        layoutStaticShapes,
        slideRels,
        entriesMap,
        masterXml,
        layoutXml,
    } ) {
        this.slideXml = slideXml;
        this.masterPlaceholders = masterPlaceholders;
        this.layoutPlaceholders = layoutPlaceholders;
        this.slideId = slideId;
        this.slideNum = slideNum;
        this.slideSize = slideSize;
        this.defaultTextStyles = defaultTextStyles;
        this.tableStyles = tableStyles;
        this.defaultTableStyleId = defaultTableStyleId;
        this.slideImageMap = slideImageMap;
        this.layoutImageMap = layoutImageMap;
        this.masterImageMap = masterImageMap;
        this.slideContext = slideContext;
        this.masterStaticShapes = masterStaticShapes;
        this.layoutStaticShapes = layoutStaticShapes;
        this.slideRels = slideRels;
        this.entriesMap = entriesMap;
        this.masterXml = masterXml;
        this.layoutXml = layoutXml;

        this.shapeBuilder = new ShapeBuilder( {
            slide: this,
            slideRels: this.slideRels,
            presentation: this.presentation,
        } );
        this.diagramBuilder = new DiagramBuilder( {
            slideHandler: this,
            slide: { slideContext, slideNum },
            shapeBuilder: this.shapeBuilder,
            slideRels: this.slideRels,
            entriesMap: this.entriesMap,
        } );
    }

    async parse() {
        const xmlDoc = parseXmlString( this.slideXml, `slide number ${ this.slideNum }` );
        const spTreeNode = xmlDoc.getElementsByTagNameNS( PML_NS, 'spTree' )[ 0 ];

        const picFilledPlaceholders = new Set();
        if ( spTreeNode ) {
            const picNodes = spTreeNode.getElementsByTagNameNS( PML_NS, 'pic' );
            for ( const picNode of picNodes ) {
                const nvPicPrNode = picNode.getElementsByTagNameNS( PML_NS, 'nvPicPr' )[ 0 ];
                const phNode = nvPicPrNode?.getElementsByTagNameNS( PML_NS, 'nvPr' )[ 0 ]?.getElementsByTagNameNS( PML_NS, 'ph' )[ 0 ];
                if ( phNode ) {
                    const phType = phNode.getAttribute( 'type' );
                    const phIdx = phNode.getAttribute( 'idx' );
                    const phKey = phIdx ? `idx_${ phIdx }` : phType;
                    if ( phKey ) {
                        picFilledPlaceholders.add( phKey );
                    }
                }
            }
        }

        const getPlaceholderKey = ( shapeNode ) => {
            const nvPr = shapeNode.getElementsByTagNameNS( PML_NS, 'nvPr' )[ 0 ];
            if ( nvPr ) {
                const placeholder = nvPr.getElementsByTagNameNS( PML_NS, 'ph' )[ 0 ];
                if ( placeholder ) {
                    const phType = placeholder.getAttribute( 'type' );
                    const phIdx = placeholder.getAttribute( 'idx' );
                    return phIdx ? `idx_${ phIdx }` : ( phType || null );
                }
            }
            return null;
        };

        const filteredMasterShapes = ( this.masterStaticShapes || [] ).filter( shapeNode => {
            const key = getPlaceholderKey( shapeNode );
            return !key || !picFilledPlaceholders.has( key );
        } );

        const filteredLayoutShapes = ( this.layoutStaticShapes || [] ).filter( shapeNode => {
            const key = getPlaceholderKey( shapeNode );
            return !key || !picFilledPlaceholders.has( key );
        } );

        const hfNode = xmlDoc.getElementsByTagNameNS( PML_NS, 'hf' )[ 0 ];
        const slideLevelVisibility = {
            ftr: !hfNode || hfNode.getAttribute( 'ftr' ) !== '0',
            dt: !hfNode || hfNode.getAttribute( 'dt' ) !== '0',
            sldNum: !hfNode || hfNode.getAttribute( 'sldNum' ) !== '0',
        };


        const initialMatrix = new Matrix();
        const masterShapes = this.masterStaticShapes ?
            await this.parseShapeTree(filteredMasterShapes, initialMatrix.clone(), slideLevelVisibility, this.masterImageMap) : [];

        const layoutShapes = this.layoutStaticShapes ?
            await this.parseShapeTree(filteredLayoutShapes, initialMatrix.clone(), slideLevelVisibility, this.layoutImageMap) : [];

        const slideShapes = spTreeNode ?
            await this.parseShapeTree(spTreeNode.children, initialMatrix.clone(), slideLevelVisibility, this.slideImageMap) : [];

        const slideXmlDoc = parseXmlString( this.slideXml, `slide ${ this.slideId }` );
        const layoutXmlDoc = this.layoutXml ? parseXmlString( this.layoutXml, `layout for slide ${ this.slideId }` ) : null;
        const masterXmlDoc = this.masterXml ? parseXmlString( this.masterXml, `master for slide ${ this.slideId }` ) : null;

        const sldNode = slideXmlDoc.getElementsByTagNameNS( PML_NS, 'sld' )[ 0 ];

        let finalBg;
        const slideBg = parseBackground( slideXmlDoc, this.slideContext );
        const layoutBg = layoutXmlDoc ? parseBackground( layoutXmlDoc, this.slideContext ) : null;
        const masterBg = masterXmlDoc ? parseBackground( masterXmlDoc, this.slideContext ) : null;

        if ( slideBg ) {
            finalBg = { ...slideBg, source: 'slide' };
        } else if ( layoutBg ) {
            finalBg = { ...layoutBg, source: 'layout' };
        } else if ( masterBg ) {
            finalBg = { ...masterBg, source: 'master' };
        }

        const slideBackground = slideShapes.find(shape => shape.type === 'picture' && shape.pos.width === this.slideSize.width && shape.pos.height === this.slideSize.height);

        let finalShapes;
        if (slideBackground) {
            const otherSlideShapes = slideShapes.filter(shape => shape !== slideBackground);
            finalShapes = [...masterShapes, slideBackground, ...layoutShapes, ...otherSlideShapes];
        } else {
            finalShapes = [...masterShapes, ...layoutShapes, ...slideShapes];
        }

        return {
            background: finalBg,
            shapes: finalShapes,
            imageMaps: {
                slide: this.slideImageMap,
                layout: this.layoutImageMap,
                master: this.masterImageMap,
            }
        };
    }

    async parseShapeTree( elements, parentMatrix, slideLevelVisibility, imageMap ) {
        const shapes = [];
        const listCounters = {}; // Reset for each shape tree (master, layout, slide)

        for ( const element of elements ) {
            const tagName = element.localName;
            let shapeData;

            if ( tagName === 'sp' || tagName === 'cxnSp' ) {
                shapeData = await this.parseShape( element, listCounters, parentMatrix, slideLevelVisibility );
            } else if ( tagName === 'grpSp' ) {
                shapeData = await this.parseGroupShape( element, listCounters, parentMatrix, slideLevelVisibility, imageMap );
                if ( shapeData ) {
                    shapes.push( ...shapeData.shapes );
                    shapeData = null;
                }
            } else if ( tagName === 'graphicFrame' ) {
                const graphicData = element.getElementsByTagNameNS( DML_NS, 'graphicData' )[ 0 ];
                if ( graphicData?.getAttribute( 'uri' ) === TABLE_NS ) {
                    shapeData = await this.parseTable( element, parentMatrix.clone() );
                } else if ( graphicData?.getAttribute( 'uri' ) === CHART_NS ) {
                    const chartRelId = graphicData.getElementsByTagNameNS( CHART_NS, "chart" )[ 0 ].getAttribute( "r:id" );
                    if ( chartRelId && this.slideRels?.[ chartRelId ] ) {
                        const chartPath = resolvePath( 'ppt/slides', this.slideRels[ chartRelId ].target );
                        const chartXml = await getNormalizedXmlString( this.entriesMap, chartPath );
                        if ( chartXml ) {
                            shapeData = await this.parseChart( element, chartXml, parentMatrix.clone() );
                        }
                    }
                } else if ( graphicData?.getAttribute( 'uri' ) === DIAGRAM_NS ) {
                    shapeData = await this.parseDiagram( element, parentMatrix );
                }
            } else if ( tagName === 'pic' ) {
                shapeData = await this.parsePicture( element, parentMatrix, slideLevelVisibility, imageMap );
            }

            if ( shapeData ) {
                shapes.push( shapeData );
            }
        }
        return shapes;
    }

    async parseShape( shapeNode, listCounters, parentMatrix, slideLevelVisibility ) {
        const nvSpPrNode = shapeNode.getElementsByTagNameNS( PML_NS, 'nvSpPr' )[ 0 ];
        const cNvPrNode = nvSpPrNode?.getElementsByTagNameNS( PML_NS, 'cNvPr' )[ 0 ];
        const extensions = cNvPrNode ? parseExtensions( cNvPrNode ) : null;

        const nvPr = shapeNode.getElementsByTagNameNS( PML_NS, 'nvPr' )[ 0 ];
        let phKey = null, phType = null, phIdx = null;
        if ( nvPr ) {
            const placeholder = nvPr.getElementsByTagNameNS( PML_NS, 'ph' )[ 0 ];
            if ( placeholder ) {
                phType = placeholder.getAttribute( 'type' );
                phIdx = placeholder.getAttribute( 'idx' );
                phKey = phIdx ? `idx_${ phIdx }` : phType;
                if ( !phType && phIdx ) phType = 'body';
            }
        }

        if ( slideLevelVisibility?.[ phType ] === false ) return null;

        const layoutPh = this.layoutPlaceholders?.[ phKey ];

        let masterPh = this.masterPlaceholders?.[ phKey ];

        if ( masterPh ) {
            const specialTypes = [ 'dt', 'ftr', 'sldNum' ];
            const masterPhType = masterPh.type || ( masterPh.idx ? 'body' : null );
            const slidePhType = phType || ( phIdx ? 'body' : null );

            if ( !specialTypes.includes( slidePhType ) && specialTypes.includes( masterPhType ) ) {
                masterPh = null;
            }
        }

        if ( !masterPh ) {
            masterPh = Object.values( this.masterPlaceholders || {} ).find( p => p.type === phType );
        }

        const masterShapeProps = masterPh?.shapeProps || {};
        const layoutShapeProps = layoutPh?.shapeProps || {};
        const slideShapeProps = parseShapeProperties( shapeNode, this.slideContext, this.slideNum );

        let finalFill, fillSource;
        if ( slideShapeProps.fill ) {
            finalFill = slideShapeProps.fill;
            fillSource = 'slide';
        } else if ( layoutShapeProps.fill ) {
            finalFill = layoutShapeProps.fill;
            fillSource = 'layout';
        } else if ( masterShapeProps.fill ) {
            finalFill = masterShapeProps.fill;
            fillSource = 'master';
        }

        const finalStroke = slideShapeProps.stroke ?? layoutShapeProps.stroke ?? masterShapeProps.stroke;
        const finalEffect = slideShapeProps.effect ?? layoutShapeProps.effect ?? masterShapeProps.effect;

        if ( shapeNode.getAttribute( 'useBgFill' ) === '1' ) {
            if ( this.finalBg?.type === 'color' ) {
                finalFill = { type: 'solid', color: this.finalBg.value };
            } else {
                finalFill = { type: 'none' };
            }
        }

        if ( finalFill?.type === 'image' && finalFill.relId ) {
            let imageMap;
            if ( fillSource === 'slide' ) imageMap = this.slideImageMap;
            else if ( fillSource === 'layout' ) imageMap = this.layoutImageMap;
            else if ( fillSource === 'master' ) imageMap = this.masterImageMap;

            if ( imageMap && imageMap[ finalFill.relId ] ) {
                finalFill.href = imageMap[ finalFill.relId ];
            }
        }

        const shapeProps = {
            geometry: slideShapeProps.geometry ?? layoutShapeProps.geometry ?? masterShapeProps.geometry,
            fill: finalFill,
            stroke: finalStroke,
            effect: finalEffect,
        };

        const shapeBuilder = new ShapeBuilder( null, this.slideContext, this.slideImageMap, this.masterPlaceholders, this.layoutPlaceholders, EMU_PER_PIXEL, this.slideSize );
        const { pos, transform, flipH, flipV, rot } = shapeBuilder.getShapeProperties( shapeNode, parentMatrix );

        let textData = null;
        if ( pos ) {
            const slideTxBody = shapeNode.getElementsByTagNameNS( PML_NS, 'txBody' )[ 0 ];
            let txBodyToParse = slideTxBody;

            const slideTextContent = slideTxBody?.textContent.trim() ?? '';
            if ( slideTextContent === '' ) {
                if ( layoutPh?.txBodyNode ) txBodyToParse = layoutPh.txBodyNode;
                else if ( masterPh?.txBodyNode ) txBodyToParse = masterPh.txBodyNode;
            }

            if ( txBodyToParse ) {
                const slideBodyPr = parseBodyProperties( slideTxBody );
                const masterBodyPr = masterPh?.bodyPr || {};
                const layoutBodyPr = layoutPh?.bodyPr || {};

                const finalBodyPr = { ...masterBodyPr, ...layoutBodyPr, ...slideBodyPr };
                finalBodyPr.anchor = slideBodyPr.anchor ?? layoutBodyPr.anchor ?? masterBodyPr.anchor ?? 't';

                textData = this.parseParagraphs( txBodyToParse, pos, phKey, phType, listCounters, finalBodyPr, {} );
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
            extensions,
        };
    }

    async parseGroupShape( groupNode, listCounters, parentMatrix, slideLevelVisibility, imageMap ) {
        if ( slideLevelVisibility ) {
            const placeholders = Array.from( groupNode.getElementsByTagNameNS( PML_NS, 'ph' ) );
            if ( placeholders.length > 0 ) {
                const placeholderTypes = placeholders.map( ph => ph.getAttribute( 'type' ) ).filter( Boolean );
                if ( placeholderTypes.length > 0 && placeholderTypes.every( phType => slideLevelVisibility[ phType ] === false ) ) {
                    return null;
                }
            }
        }

        const cNvPrNode = groupNode.getElementsByTagNameNS( PML_NS, 'cNvPr' )[ 0 ];
        const groupName = cNvPrNode?.getAttribute( 'name' ) || 'Unknown Group';

        const grpSpPrNode = groupNode.getElementsByTagNameNS( PML_NS, 'grpSpPr' )[ 0 ];
        let finalMatrixForChildren = parentMatrix.clone();

        if ( grpSpPrNode ) {
            const xfrmNode = grpSpPrNode.getElementsByTagNameNS( DML_NS, 'xfrm' )[ 0 ];
            if ( xfrmNode ) {
                const offNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'off' )[ 0 ];
                const extNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'ext' )[ 0 ];
                const x = offNode ? parseInt( offNode.getAttribute( "x" ) ) / EMU_PER_PIXEL : 0;
                const y = offNode ? parseInt( offNode.getAttribute( "y" ) ) / EMU_PER_PIXEL : 0;
                const w = extNode ? parseInt( extNode.getAttribute( "cx" ) ) / EMU_PER_PIXEL : 0;
                const h = extNode ? parseInt( extNode.getAttribute( "cy" ) ) / EMU_PER_PIXEL : 0;
                const rot = parseInt( xfrmNode.getAttribute( 'rot' ) || '0' ) / 60000;
                const flipH = xfrmNode.getAttribute( 'flipH' ) === '1';
                const flipV = xfrmNode.getAttribute( 'flipV' ) === '1';

                const placementMatrix = new Matrix();
                placementMatrix.translate( x, y ).translate( w / 2, h / 2 ).rotate( rot * Math.PI / 180 ).scale( flipH ? -1 : 1, flipV ? -1 : 1 ).translate( -w / 2, -h / 2 );

                const chOffNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'chOff' )[ 0 ];
                const chExtNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'chExt' )[ 0 ];
                const chX = chOffNode ? parseInt( chOffNode.getAttribute( "x" ) ) / EMU_PER_PIXEL : 0;
                const chY = chOffNode ? parseInt( chOffNode.getAttribute( "y" ) ) / EMU_PER_PIXEL : 0;
                const chW = chExtNode ? parseInt( chExtNode.getAttribute( "cx" ) ) / EMU_PER_PIXEL : 1;
                const chH = chExtNode ? parseInt( chExtNode.getAttribute( "cy" ) ) / EMU_PER_PIXEL : 1;

                const scaleX = w && chW ? w / chW : 1;
                const scaleY = h && chH ? h / chH : 1;
                const mappingMatrix = new Matrix().scale( scaleX, scaleY ).translate( -chX, -chY );

                finalMatrixForChildren = parentMatrix.clone().multiply( placementMatrix ).multiply( mappingMatrix );
            }
        }

        const childShapes = await this.parseShapeTree( groupNode.children, finalMatrixForChildren, slideLevelVisibility, imageMap );

        return {
            type: 'group',
            name: groupName,
            shapes: childShapes,
        };
    }

    async parsePicture( picNode, parentMatrix, slideLevelVisibility, imageMap ) {
        let localMatrix = new Matrix();
        let pos;

        const nvPicPrNode = picNode.getElementsByTagNameNS( PML_NS, 'nvPicPr' )[ 0 ];
        const cNvPrNode = nvPicPrNode?.getElementsByTagNameNS( PML_NS, 'cNvPr' )[ 0 ];
        let extensions = cNvPrNode ? parseExtensions( cNvPrNode ) : null;
        const phNode = nvPicPrNode?.getElementsByTagNameNS( PML_NS, 'nvPr' )[ 0 ]?.getElementsByTagNameNS( PML_NS, 'ph' )[ 0 ];

        if ( phNode ) {
            const phType = phNode.getAttribute( 'type' );
            if ( slideLevelVisibility?.[ phType ] === false ) return null;
        }

        const spPrNode = picNode.getElementsByTagNameNS( PML_NS, 'spPr' )[ 0 ];
        const xfrmNode = spPrNode?.getElementsByTagNameNS( DML_NS, 'xfrm' )[ 0 ];

        let rot = 0;
        let flipH = false, flipV = false;
        if ( xfrmNode ) {
            const offNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'off' )[ 0 ];
            const extNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'ext' )[ 0 ];
            if ( offNode && extNode ) {
                const x = parseInt( offNode.getAttribute( "x" ) ) / EMU_PER_PIXEL;
                const y = parseInt( offNode.getAttribute( "y" ) ) / EMU_PER_PIXEL;
                const w = parseInt( extNode.getAttribute( "cx" ) ) / EMU_PER_PIXEL;
                const h = parseInt( extNode.getAttribute( "cy" ) ) / EMU_PER_PIXEL;
                rot = parseInt( xfrmNode.getAttribute( 'rot' ) || '0' );
                flipH = xfrmNode.getAttribute( 'flipH' ) === '1';
                flipV = xfrmNode.getAttribute( 'flipV' ) === '1';
                pos = { width: w, height: h };
                localMatrix.translate( x, y ).translate( w / 2, h / 2 ).rotate( rot / 60000 * Math.PI / 180 ).scale( flipH ? -1 : 1, flipV ? -1 : 1 ).translate( -w / 2, -h / 2 );
            }
        } else if ( phNode ) {
            const phKey = phNode.getAttribute( 'idx' ) ? `idx_${ phNode.getAttribute( 'idx' ) }` : phNode.getAttribute( 'type' );
            const placeholder = this.layoutPlaceholders?.[ phKey ] || this.masterPlaceholders?.[ phKey ];
            if ( placeholder?.pos ) {
                pos = { ...placeholder.pos };
                localMatrix.translate( pos.x, pos.y );
            }
        }

        if ( !pos ) return null;

        const finalMatrix = parentMatrix.clone().multiply( localMatrix );
        const transform = `matrix(${ finalMatrix.m.join( ' ' ) })`;

        let placeholderProps = null;
        if ( phNode ) {
            const phKey = phNode.getAttribute( 'idx' ) ? `idx_${ phNode.getAttribute( 'idx' ) }` : phNode.getAttribute( 'type' );
            const masterPh = this.masterPlaceholders?.[ phKey ];
            const layoutPh = this.layoutPlaceholders?.[ phKey ];
            placeholderProps = { ...( masterPh?.shapeProps || {} ), ...( layoutPh?.shapeProps || {} ) };
        }

        const pathString = placeholderProps?.geometry ? buildPathStringFromGeom( placeholderProps.geometry, pos, flipH, flipV ) : null;

        let imageInfo = null;
        const blipFillNode = picNode.getElementsByTagNameNS( PML_NS, 'blipFill' )[ 0 ];
        if ( blipFillNode ) {
            const blipNode = blipFillNode.getElementsByTagNameNS( DML_NS, 'blip' )[ 0 ];
            const blipExtensions = blipNode ? parseExtensions( blipNode ) : null;
            if ( blipExtensions ) {
                extensions = ( extensions || [] ).concat( blipExtensions );
            }

            const relId = blipNode?.getAttribute( 'r:embed' );
            if ( relId && imageMap[ relId ] ) {
                imageInfo = {
                    href: imageMap[ relId ],
                    srcRect: parseSourceRectangle( blipFillNode ),
                };

                const alphaModFixNode = blipNode.getElementsByTagNameNS( DML_NS, 'alphaModFix' )[ 0 ];
                if ( alphaModFixNode ) {
                    imageInfo.opacity = parseInt( alphaModFixNode.getAttribute( 'amt' ) ) / 100000;
                }

                const duotoneNode = blipNode.getElementsByTagNameNS( DML_NS, 'duotone' )[ 0 ];
                if ( duotoneNode ) {
                    const colors = Array.from( duotoneNode.children ).map( node => ColorParser.parseColor( node ) );
                    if ( colors.length === 2 ) {
                        imageInfo.duotone = colors;
                    }
                }
            }
        }

        return {
            type: 'picture',
            transform,
            pathString,
            pos,
            placeholderProps,
            image: imageInfo,
            rot,
            extensions,
        };
    }

    async parseTable( frameNode, parentMatrix ) {
        const xfrmNode = frameNode.getElementsByTagNameNS( PML_NS, 'xfrm' )[ 0 ];
        let pos = { x: 0, y: 0, width: 0, height: 0 };
        const localMatrix = new Matrix();

        if ( xfrmNode ) {
            const off = xfrmNode.getElementsByTagNameNS( DML_NS, 'off' )[ 0 ];
            const ext = xfrmNode.getElementsByTagNameNS( DML_NS, 'ext' )[ 0 ];
            if ( off && ext ) {
                const x = parseInt( off.getAttribute( "x" ) ) / EMU_PER_PIXEL;
                const y = parseInt( off.getAttribute( "y" ) ) / EMU_PER_PIXEL;
                const w = parseInt( ext.getAttribute( "cx" ) ) / EMU_PER_PIXEL;
                const h = parseInt( ext.getAttribute( "cy" ) ) / EMU_PER_PIXEL;
                pos = { x: 0, y: 0, width: w, height: h };
                localMatrix.translate( x, y );
            }
        }
        const finalMatrix = parentMatrix.clone().multiply( localMatrix );
        const transform = `matrix(${ finalMatrix.m.join( ' ' ) })`;

        const tblNode = frameNode.getElementsByTagNameNS( DML_NS, 'tbl' )[ 0 ];
        if ( !tblNode ) return null;

        const tblPrNode = tblNode.getElementsByTagNameNS( DML_NS, 'tblPr' )[ 0 ];
        const styleId = tblPrNode?.getElementsByTagNameNS( DML_NS, 'tableStyleId' )[ 0 ]?.textContent;
        const tableStyle = styleId ? this.tableStyles[ styleId ] : {};

        const colWidths = Array.from( tblNode.getElementsByTagNameNS( DML_NS, 'gridCol' ) ).map( n => parseInt( n.getAttribute( 'w' ) ) / EMU_PER_PIXEL );
        const rowNodes = Array.from( tblNode.getElementsByTagNameNS( DML_NS, 'tr' ) );
        const numRows = rowNodes.length;
        const numCols = colWidths.length;
        if ( numRows === 0 || numCols === 0 ) return null;

        const cells = [];
        const renderedGrid = Array( numRows ).fill( 0 ).map( () => Array( numCols ).fill( false ) );

        for ( let r = 0; r < numRows; r++ ) {
            const cellNodes = Array.from( rowNodes[ r ].getElementsByTagNameNS( DML_NS, 'tc' ) );
            for ( let c = 0; c < numCols; c++ ) {
                if ( renderedGrid[ r ][ c ] ) continue;
                const cellNode = cellNodes[ c ];
                if ( !cellNode || cellNode.getAttribute( 'hMerge' ) || cellNode.getAttribute( 'vMerge' ) ) continue;

                const gridSpan = parseInt( cellNode.getAttribute( 'gridSpan' ) || '1' );
                const rowSpan = parseInt( cellNode.getAttribute( 'rowSpan' ) || '1' );

                let cellWidth = colWidths.slice( c, c + gridSpan ).reduce( ( a, b ) => a + b, 0 );
                let cellHeight = rowNodes.slice( r, r + rowSpan ).reduce( ( acc, row ) => acc + parseInt( row.getAttribute( 'h' ) ) / EMU_PER_PIXEL, 0 );
                let cellX = colWidths.slice( 0, c ).reduce( ( a, b ) => a + b, 0 );
                let cellY = rowNodes.slice( 0, r ).reduce( ( acc, row ) => acc + parseInt( row.getAttribute( 'h' ) ) / EMU_PER_PIXEL, 0 );

                for ( let i = 0; i < rowSpan; i++ ) for ( let j = 0; j < gridSpan; j++ ) {
                    if ( r + i < numRows && c + j < numCols ) renderedGrid[ r + i ][ c + j ] = true;
                }

                cells.push( {
                    pos: { x: cellX, y: cellY, width: cellWidth, height: cellHeight },
                    fill: getCellFillColor( cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, this.slideContext ),
                    borders: getCellBorders( cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, this.slideContext ),
					text: this.parseCellText( cellNode, { x: cellX, y: cellY, width: cellWidth, height: cellHeight }, getCellTextStyle( tblPrNode, r, c, numRows, numCols, tableStyle, cellNode, this.slideContext ) ),
                } );
            }
        }
        return { type: 'table', transform, pos, cells };
    }

    parseCellText( cellNode, pos, tableTextStyle ) {
        const txBodyNode = cellNode.getElementsByTagNameNS( DML_NS, 'txBody' )[ 0 ];
        if ( !txBodyNode ) return null;

        const tcPrNode = cellNode.getElementsByTagNameNS( DML_NS, 'tcPr' )[ 0 ];
        const bodyPrFromTxBody = parseBodyProperties( txBodyNode );

        const bodyPrFromTcPr = {
            lIns: 91440 / EMU_PER_PIXEL, rIns: 91440 / EMU_PER_PIXEL,
            tIns: 45720 / EMU_PER_PIXEL, bIns: 45720 / EMU_PER_PIXEL,
        };
        if ( tcPrNode ) {
            bodyPrFromTcPr.anchor = tcPrNode.getAttribute( 'anchor' );
            if ( tcPrNode.getAttribute( 'marL' ) ) bodyPrFromTcPr.lIns = parseInt( tcPrNode.getAttribute( 'marL' ) ) / EMU_PER_PIXEL;
            if ( tcPrNode.getAttribute( 'marR' ) ) bodyPrFromTcPr.rIns = parseInt( tcPrNode.getAttribute( 'marR' ) ) / EMU_PER_PIXEL;
            if ( tcPrNode.getAttribute( 'marT' ) ) bodyPrFromTcPr.tIns = parseInt( tcPrNode.getAttribute( 'marT' ) ) / EMU_PER_PIXEL;
            if ( tcPrNode.getAttribute( 'marB' ) ) bodyPrFromTcPr.bIns = parseInt( tcPrNode.getAttribute( 'marB' ) ) / EMU_PER_PIXEL;
        }
        const finalBodyPr = { ...bodyPrFromTxBody, ...bodyPrFromTcPr };

        const listCounters = {};
        const defaultTextStyles = { title: {}, body: {}, other: {} };
        const masterPlaceholders = {};
        const layoutPlaceholders = {};

        return this.parseParagraphs( txBodyNode, pos, null, 'body', listCounters, finalBodyPr, tableTextStyle, defaultTextStyles, masterPlaceholders, layoutPlaceholders );
    }

    parseParagraphs( txBody, pos, phKey, phType, listCounters, bodyPr, tableTextStyle, defaultTextStyles, masterPlaceholders, layoutPlaceholders ) {
        const paragraphs = Array.from( txBody.getElementsByTagNameNS( DML_NS, 'p' ) );
        if ( paragraphs.length === 0 ) return null;

        const dts = defaultTextStyles || this.defaultTextStyles;
        const mph = masterPlaceholders || this.masterPlaceholders;
        const lph = layoutPlaceholders || this.layoutPlaceholders;

        const layout = this.layoutParagraphs( paragraphs, pos, phKey, phType, bodyPr, tableTextStyle, dts, mph, lph, listCounters );
        return { layout, bodyPr, pos };
    }

    layoutParagraphs( paragraphs, pos, phKey, phType, bodyPr, tableTextStyle, defaultTextStyles, masterPlaceholders, layoutPlaceholders, listCounters ) {
        const paddedPos = {
            x: pos.x + ( bodyPr.lIns || 0 ), y: pos.y + ( bodyPr.tIns || 0 ),
            width: pos.width - ( bodyPr.lIns || 0 ) - ( bodyPr.rIns || 0 ),
            height: pos.height - ( bodyPr.tIns || 0 ) - ( bodyPr.bIns || 0 ),
        };

        const lines = [];
        let currentY = 0;

        for ( const pNode of paragraphs ) {
            const pPrNode = pNode.getElementsByTagNameNS( DML_NS, 'p' )[ 0 ];
            const level = pPrNode ? parseInt( pPrNode.getAttribute( 'lvl' ) || '0' ) : 0;
            const defaultStyle = ( phType === 'title' || phType === 'ctrTitle' || phType === 'subTitle' ) ? defaultTextStyles.title : ( phType === 'body' ? defaultTextStyles.body : defaultTextStyles.other );
            const defaultLevelProps = defaultStyle?.[ level ] || {};
            let masterPh = masterPlaceholders?.[ phKey ];
            if ( masterPh && phType && masterPh.type !== phType ) {
                masterPh = undefined;
            }
            if ( !masterPh ) {
                masterPh = Object.values( masterPlaceholders || {} ).find( p => p.type === phType );
            }
            const masterListStyle = masterPh?.listStyle?.[ level ] || {};
            const layoutPh = layoutPlaceholders?.[ phKey ];
            const layoutListStyle = layoutPh?.listStyle?.[ level ] || {};
            const slideLevelProps = parseParagraphProperties( pPrNode, this.slideContext ) || { bullet: {}, defRPr: {} };

            const finalProps = {
                level, ...defaultLevelProps, ...masterListStyle, ...layoutListStyle, ...slideLevelProps,
                bullet: { ...defaultLevelProps.bullet, ...masterListStyle.bullet, ...layoutListStyle.bullet, ...slideLevelProps.bullet },
                defRPr: { ...defaultLevelProps.defRPr, ...masterListStyle.defRPr, ...layoutListStyle.defRPr, ...slideLevelProps.defRPr, ...tableTextStyle }
            };

            const marL = finalProps.marL ?? ( level > 0 ? ( level * INDENTATION_AMOUNT ) : 0 );
            const indent = finalProps.indent ?? 0;
            const bulletOffset = ( finalProps.bullet?.type && finalProps.bullet.type !== 'none' ) ? BULLET_OFFSET : 0;

            let currentLine = { runs: [], width: 0, height: 0, paragraphProps: finalProps, startY: currentY, isFirstLine: true };
            const pushLine = () => {
                if ( currentLine.runs.length > 0 ) {
                    lines.push( currentLine );
                    currentY += currentLine.height || LINE_HEIGHT;
                }
                currentLine = { runs: [], width: 0, height: 0, paragraphProps: finalProps, startY: currentY, isFirstLine: false };
            };

            if ( finalProps.bullet?.type === 'auto' ) {
                if ( listCounters[ level ] === undefined ) listCounters[ level ] = finalProps.bullet.startAt || 1; else listCounters[ level ]++;
                currentLine.bulletChar = getAutoNumberingChar( finalProps.bullet.scheme, listCounters[ level ] );
            }

            for ( const childNode of Array.from( pNode.childNodes ).filter( n => [ 'r', 'fld', 'br' ].includes( n.localName ) ) ) {
                if ( childNode.localName === 'br' ) { pushLine(); continue; }
                const text = childNode.textContent;
                if ( !text ) continue;

                const rPr = childNode.getElementsByTagNameNS( DML_NS, 'rPr' )[ 0 ];
                const runProps = { ...finalProps.defRPr };
                if ( rPr ) {
                    if ( rPr.getAttribute( 'sz' ) ) runProps.size = ( parseInt( rPr.getAttribute( 'sz' ) ) / 100 ) * PT_TO_PX;
                    if ( rPr.getAttribute( 'b' ) === '1' ) runProps.bold = true; else if ( rPr.getAttribute( 'b' ) === '0' ) runProps.bold = false;
                    if ( rPr.getAttribute( 'i' ) === '1' ) runProps.italic = true; else if ( rPr.getAttribute( 'i' ) === '0' ) runProps.italic = false;
                    const solidFillNode = rPr.getElementsByTagNameNS( DML_NS, 'solidFill' )[ 0 ];
                    if ( solidFillNode ) runProps.color = ColorParser.parseColor( solidFillNode );
                    const latinFontNode = rPr.getElementsByTagNameNS( DML_NS, 'latin' )[ 0 ];
                    if ( latinFontNode?.getAttribute( 'typeface' ) ) runProps.font = latinFontNode.getAttribute( 'typeface' );
                }

                let fontSize = runProps.size || ( 18 * PT_TO_PX );
                if ( bodyPr.fontScale ) fontSize *= bodyPr.fontScale;
                const fontFamily = resolveFontFamily( runProps, phType, this.slideContext );
                const tempCtx = document.createElement( 'canvas' ).getContext( '2d' );
                tempCtx.font = `${ runProps.italic ? 'italic' : 'normal' } ${ runProps.bold ? 'bold' : 'normal' } ${ fontSize }px ${ fontFamily }`;

                for ( const word of text.split( /(\s+)/ ) ) {
                    if ( !word ) continue;
                    const wordWidth = tempCtx.measureText( word ).width;
                    const effectiveWidth = paddedPos.width - ( currentLine.isFirstLine ? marL + indent : marL ) - bulletOffset;
                    if ( currentLine.width + wordWidth > effectiveWidth && currentLine.runs.length > 0 ) pushLine();
                    currentLine.runs.push( {
                        text: word,
                        font: { style: runProps.italic ? 'italic' : 'normal', weight: runProps.bold ? 'bold' : 'normal', size: fontSize, family: fontFamily },
                        color: ColorParser.resolveColor( runProps.color, this.slideContext ) || '#000000'
                    } );
                    currentLine.width += wordWidth;
                    currentLine.height = Math.max( currentLine.height, fontSize * ( bodyPr.lnSpcReduction ? 1 - bodyPr.lnSpcReduction : 1.25 ) );
                }
            }
            pushLine();
        }

        for ( const line of lines ) {
            const { align, level, marL: pMarL, indent: pIndent } = line.paragraphProps;
            const marL = pMarL ?? ( level > 0 ? ( level * INDENTATION_AMOUNT ) : 0 );
            const indent = pIndent ?? 0;
            const bulletOffset = ( line.paragraphProps.bullet?.type && line.paragraphProps.bullet.type !== 'none' ) ? BULLET_OFFSET : 0;
            const lineIndent = marL + indent;
            const effectiveWidth = paddedPos.width - lineIndent - bulletOffset;
            let lineXOffset = 0;
            if ( align === 'ctr' ) lineXOffset = ( effectiveWidth - line.width ) / 2;
            else if ( align === 'r' ) lineXOffset = effectiveWidth - line.width;
            line.x = paddedPos.x + lineIndent + bulletOffset + lineXOffset;
        }

        return { totalHeight: currentY, lines };
    }

    async parseChart( frameNode, chartXml, parentMatrix ) {
        const xfrmNode = frameNode.getElementsByTagNameNS( PML_NS, 'xfrm' )[ 0 ];
        if ( !xfrmNode ) return null;
        const off = xfrmNode.getElementsByTagNameNS( DML_NS, 'off' )[ 0 ];
        const ext = xfrmNode.getElementsByTagNameNS( DML_NS, 'ext' )[ 0 ];
        if ( !off || !ext ) return null;

        const x = parseInt( off.getAttribute( "x" ) ) / EMU_PER_PIXEL;
        const y = parseInt( off.getAttribute( "y" ) ) / EMU_PER_PIXEL;
        const w = parseInt( ext.getAttribute( "cx" ) ) / EMU_PER_PIXEL;
        const h = parseInt( ext.getAttribute( "cy" ) ) / EMU_PER_PIXEL;
        const rot = parseInt( xfrmNode.getAttribute( 'rot' ) || '0' );
        const flipH = xfrmNode.getAttribute( 'flipH' ) === '1';
        const flipV = xfrmNode.getAttribute( 'flipV' ) === '1';

        const localMatrix = new Matrix();
        localMatrix.translate( x, y )
            .translate( w / 2, h / 2 )
            .rotate( rot / 60000 * Math.PI / 180 )
            .scale( flipH ? -1 : 1, flipV ? -1 : 1 )
            .translate( -w / 2, -h / 2 );

        const finalMatrix = parentMatrix.clone().multiply( localMatrix );
        const transform = `matrix(${ finalMatrix.m.join( ' ' ) })`;

        const pos = {
            width: w,
            height: h,
        };

        return {
            type: 'chart',
            pos,
            transform,
            chartData: parseChart( chartXml ),
        };
    }

    async parseDiagram( frameNode, parentMatrix ) {
        const shapes = await this.diagramBuilder.build( frameNode, parentMatrix );

        if ( !shapes || shapes.length === 0 ) {
            return null;
        }

        return {
            type: 'diagram',
            shapes,
        };
    }
}