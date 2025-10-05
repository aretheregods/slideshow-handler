import {
    SvgRenderer,
    Matrix,
    ShapeBuilder,
    ColorParser,
    createImage,
} from 'utils';

export class SlideRenderer {
    constructor( { slideContainer, slideId, slideSize, slideContext } ) {
        this.slideContainer = slideContainer;
        this.slideId = slideId;
        this.slideSize = slideSize;
        this.slideContext = slideContext;

        this.svg = this.createSvg();
        this.renderer = new SvgRenderer( this.svg, this.slideContext );
        this.shapeBuilder = new ShapeBuilder( {
            slide: this,
        } );
    }

    createSvg() {
        const SVG_NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS( SVG_NS, 'svg' );
        svg.setAttribute( 'viewBox', `0 0 ${ this.slideSize.width } ${ this.slideSize.height }` );
        svg.style.width = '100%';
        svg.style.height = '100%';
        document.getElementById( this.slideContainer ).appendChild( svg );
        return svg;
    }

    newSlideContainer( containerId ) {
        this.slideContainer = containerId;
        this.svg = this.createSvg();
        this.renderer = new SvgRenderer( this.svg, this.slideContext );
        return this;
    }

    async render( slideData, activeElementId ) {
        while ( this.svg.firstChild ) {
            this.svg.removeChild( this.svg.firstChild );
        }

        const SVG_NS = "http://www.w3.org/2000/svg";
        const defs = document.createElementNS( SVG_NS, 'defs' );
        this.svg.appendChild( defs );
        this.renderer.defs = defs;

        if ( slideData.background ) {
            const id = `${ this.slideId }.background`
            if ( slideData.background.type === 'color' ) {
                const bgRect = document.createElementNS( SVG_NS, 'rect' );
                bgRect.setAttribute( 'id', id );
                bgRect.setAttribute( 'width', '100%' );
                bgRect.setAttribute( 'height', '100%' );
                bgRect.setAttribute( 'fill', slideData.background.value );
                this.svg.insertBefore( bgRect, this.svg.firstChild );
            } else if ( slideData.background.type === 'gradient' ) {
                const bgRect = document.createElementNS( SVG_NS, 'rect' );
                bgRect.setAttribute( 'id', id );
                bgRect.setAttribute( 'width', '100%' );
                bgRect.setAttribute( 'height', '100%' );
                const gradientUrl = this.renderer._createGradient( slideData.background );
                bgRect.setAttribute( 'fill', gradientUrl );
                this.svg.insertBefore( bgRect, this.svg.firstChild );
            } else if ( slideData.background.type === 'image' && slideData.background.relId ) {
                const background = slideData.background;
                let imageMap;
                if ( background.source === 'slide' ) imageMap = slideData.imageMaps.slide;
                else if ( background.source === 'layout' ) imageMap = slideData.imageMaps.layout;
                else if ( background.source === 'master' ) imageMap = slideData.imageMaps.master;

                if ( imageMap && imageMap[ background.relId ] ) {
                    const bgImage = document.createElementNS( SVG_NS, 'image' );
                    bgImage.setAttribute( 'id', id );
                    bgImage.setAttribute( 'href', imageMap[ background.relId ] );
                    bgImage.setAttribute( 'width', this.slideSize.width );
                    bgImage.setAttribute( 'height', this.slideSize.height );
                    bgImage.setAttribute( 'preserveAspectRatio', 'xMidYMid slice' );
                    this.svg.insertBefore( bgImage, this.svg.firstChild );
                }
            }
        }

        await this.renderShapeTree( slideData, activeElementId );
    }

    async renderShapeTree( slideData, activeElementId ) {
        for ( const [ index, shapeData ] of slideData.shapes.entries() ) {
            const id = `${ this.slideId }.shapes.${ index }`;
            const isActive = activeElementId && activeElementId.startsWith( id );
            const options = { id, className: isActive ? 'active-element' : '' };
            switch ( shapeData.type ) {
                case 'shape':
                    await this.renderShape( shapeData, options, activeElementId );
                    break;
                case 'group':
                    break;
                case 'table':
                    await this.renderTable( shapeData, options, activeElementId );
                    break;
                case 'chart':
                    await this.renderChart( shapeData, options );
                    break;
                case 'picture':
                    await this.renderPicture( shapeData, options, slideData.imageMaps );
                    break;
                case 'diagram':
                    await this.renderDiagram( shapeData, options, activeElementId );
                    break;
            }
        };
    }

    async renderShape( shapeData, options, activeElementId ) {
        const matrix = new Matrix();
        if ( shapeData.transform ) {
            const transformString = shapeData.transform.replace( 'matrix(', '' ).replace( ')', '' );
            const transformValues = transformString.split( ' ' ).map( Number );
            matrix.m = transformValues;
        }
        this.renderer.setTransform( matrix, options );

        if ( shapeData.shapeProps.path ) {
            this.renderer.drawPath( shapeData.shapeProps.path, {
                fill: shapeData.shapeProps.fill,
                stroke: shapeData.shapeProps.stroke,
            } );
        } else {
            shapeData.pos.rotation = shapeData.rot;
            this.shapeBuilder.renderShape( shapeData.pos, shapeData.shapeProps, matrix, shapeData.flipH, shapeData.flipV );
        }

        if ( shapeData.text ) {
            await this.renderParagraphs( shapeData.text, `${ options.id }.text`, activeElementId );
        }
    }

    async renderPicture( picData, options, imageMaps ) {
        const matrix = new Matrix();
        if ( picData.transform ) {
            const transformString = picData.transform.replace( 'matrix(', '' ).replace( ')', '' );
            const transformValues = transformString.split( ' ' ).map( Number );
            matrix.m = transformValues;
        }
        this.renderer.setTransform( matrix, options );
        let pathString = '';

        if ( picData.placeholderProps?.fill?.type === 'solid' || picData.placeholderProps?.fill?.type === 'gradient' ) {
            const fillOptions = {
                fill: picData.placeholderProps.fill.type === 'gradient' ? picData.placeholderProps.fill : picData.placeholderProps.fill.color,
                pos: { ...picData.pos, rotation: picData.rot },
            };
            if ( picData.pathString ) this.renderer.drawPath( picData.pathString, fillOptions );
            else this.renderer.drawRect( 0, 0, picData.pos.width, picData.pos.height, fillOptions );
        }

        if ( picData.image ) {
            const imageOptions = {
                id: `${ options.id }.image`,
            };

            const filters = [];
            if ( picData.image.opacity !== undefined ) {
                filters.push( this.renderer.createAlphaFilter( picData.image.opacity ) );
            }

            if ( picData.image.duotone ) {
                const color1 = ColorParser.resolveColor( picData.image.duotone[ 0 ], this.slideContext );
                const color2 = ColorParser.resolveColor( picData.image.duotone[ 1 ], this.slideContext );
                if ( color1 && color2 ) {
                    filters.push( this.renderer.createDuotoneFilter( color1, color2 ) );
                }
            }

            if ( filters.length > 0 ) {
                imageOptions.filter = filters.join( ' ' );
            }

            pathString = picData.pathString;

            if ( picData.image.srcRect ) {
                const img = await createImage( picData.image.href );
                const crop = picData.image.srcRect;
                const viewBox = `${ img.width * crop.l } ${ img.height * crop.t } ${ img.width * ( 1 - crop.l - crop.r ) } ${ img.height * ( 1 - crop.t - crop.b ) }`;
                imageOptions.viewBox = viewBox;
                imageOptions.preserveAspectRatio = 'none';
            }

            if ( pathString ) {
                const clipId = `clip-${ Math.random().toString( 36 ).slice( 2, 11 ) }`;
                const clipPath = document.createElementNS( 'http://www.w3.org/2000/svg', 'clipPath' );
                clipPath.id = clipId;
                const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
                path.setAttribute( 'd', pathString );
                clipPath.appendChild( path );
                this.renderer.defs.appendChild( clipPath );
                imageOptions.clipPath = `url(#${ clipId })`;
            }

            this.renderer.drawImage(
                picData.image.href,
                0,
                0,
                picData.pos.width,
                picData.pos.height,
                imageOptions,
            );
        }

        if ( picData.placeholderProps?.stroke ) {
            const strokeOpts = { stroke: picData.placeholderProps.stroke };
            if ( pathString ) this.renderer.drawPath( pathString, strokeOpts );
            else this.renderer.drawRect( 0, 0, picData.pos.width, picData.pos.height, strokeOpts );
        }
    }

    async renderTable( tableData, options, activeElementId ) {
        const matrix = new Matrix();
        if ( tableData.transform ) {
            const transformString = tableData.transform.replace( 'matrix(', '' ).replace( ')', '' );
            const transformValues = transformString.split( ' ' ).map( Number );
            matrix.m = transformValues;
        }
        this.renderer.setTransform( matrix, options );

        for ( const [ index, cell ] of tableData.cells.entries() ) {
            const cellId = `${ options.id }.cells.${ index }`;
            const isCellActive = activeElementId && activeElementId.startsWith( cellId );
            const cellOptions = {
                fill: cell.fill || 'transparent',
                id: cellId,
                className: isCellActive ? 'active-element' : '',
            };
            this.renderer.drawRect( cell.pos.x, cell.pos.y, cell.pos.width, cell.pos.height, cellOptions );

            const { x, y, width, height } = cell.pos;
            if ( cell.borders.top ) this.renderer.drawLine( x, y, x + width, y, { stroke: cell.borders.top } );
            if ( cell.borders.right ) this.renderer.drawLine( x + width, y, x + width, y + height, { stroke: cell.borders.right } );
            if ( cell.borders.bottom ) this.renderer.drawLine( x + width, y + height, x, y + height, { stroke: cell.borders.bottom } );
            if ( cell.borders.left ) this.renderer.drawLine( x, y + height, x, y, { stroke: cell.borders.left } );

            if ( cell.text ) {
                const clipId = `clip-${ Math.random().toString( 36 ).slice( 2, 11 ) }`;
                const clipPath = document.createElementNS( 'http://www.w3.org/2000/svg', 'clipPath' );
                clipPath.id = clipId;
                const rect = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
                rect.setAttribute( 'x', x );
                rect.setAttribute( 'y', y );
                rect.setAttribute( 'width', width );
                rect.setAttribute( 'height', height );
                clipPath.appendChild( rect );
                this.renderer.defs.appendChild( clipPath );

                const group = document.createElementNS( 'http://www.w3.org/2000/svg', 'g' );
                group.setAttribute( 'clip-path', `url(#${ clipId })` );
                this.renderer.currentGroup.appendChild( group );

                const originalGroup = this.renderer.currentGroup;
                this.renderer.currentGroup = group;
                await this.renderParagraphs( cell.text, `${ cellId }.text`, activeElementId );
                this.renderer.currentGroup = originalGroup;
            }
        }
    }

    renderParagraphs( textData, id, activeElementId ) {
        const { layout, bodyPr, pos } = textData;
        const paddedPos = {
            x: pos.x + ( bodyPr.lIns || 0 ),
            y: pos.y + ( bodyPr.tIns || 0 ),
            width: pos.width - ( bodyPr.lIns || 0 ) - ( bodyPr.rIns || 0 ),
            height: pos.height - ( bodyPr.tIns || 0 ) - ( bodyPr.bIns || 0 ),
        };

        let startY = paddedPos.y;
        if ( bodyPr.anchor === 'ctr' ) startY += ( paddedPos.height - layout.totalHeight ) / 2;
        else if ( bodyPr.anchor === 'b' ) startY += paddedPos.height - layout.totalHeight;

        const textGroup = document.createElementNS( 'http://www.w3.org/2000/svg', 'g' );
        if ( id ) {
            textGroup.setAttribute( 'id', id );
        }

        for ( const [ lineIndex, line ] of layout.lines.entries() ) {
            const lineGroupId = `${id}.line.${lineIndex}`;
            const isLineActive = activeElementId === lineGroupId;
            const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            lineGroup.setAttribute('id', lineGroupId);
            if (isLineActive) {
                lineGroup.setAttribute('class', 'active-element');
            }

            const { paragraphProps: finalProps } = line;
            if ( line.isFirstLine && finalProps.bullet?.type && finalProps.bullet.type !== 'none' ) {
                const bulletColor = ColorParser.resolveColor( finalProps.bullet.color, this.slideContext ) || ColorParser.resolveColor( finalProps.defRPr.color, this.slideContext ) || '#000';
                const firstRunSize = line.runs[ 0 ]?.font.size || ( finalProps.defRPr.size || 18 * PT_TO_PX );
                const bulletBaselineY = startY + line.startY + firstRunSize;
                const bulletX = line.x - BULLET_OFFSET;

                const originalGroup = this.renderer.currentGroup;
                this.renderer.currentGroup = lineGroup;

                if ( finalProps.bullet.type === 'char' ) {
                    this.renderer.drawText( finalProps.bullet.char, bulletX, bulletBaselineY, { fill: bulletColor, fontSize: `${ finalProps.defRPr.size || 18 * PT_TO_PX }px`, fontFamily: finalProps.bullet.font || 'Arial' } );
                } else if ( finalProps.bullet.type === 'auto' ) {
                    this.renderer.drawText( line.bulletChar, bulletX, bulletBaselineY, { fill: bulletColor, fontSize: `${ finalProps.defRPr.size || 18 * PT_TO_PX }px`, fontFamily: finalProps.bullet.font || 'Arial' } );
                }

                this.renderer.currentGroup = originalGroup;
            }

            const textElement = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );
            const align = finalProps.align || 'l';
            let xPos = line.x;
            if ( align === 'ctr' ) {
                textElement.setAttribute( 'x', xPos + line.width / 2 );
                textElement.setAttribute( 'text-anchor', 'middle' );
            } else if ( align === 'r' ) {
                textElement.setAttribute( 'x', xPos + line.width );
                textElement.setAttribute( 'text-anchor', 'end' );
            } else {
                textElement.setAttribute( 'x', xPos );
                textElement.setAttribute( 'text-anchor', 'start' );
            }
            textElement.setAttribute( 'y', startY + line.startY + ( line.runs[ 0 ]?.font.size || 0 ) );

            for ( const run of line.runs ) {
                const tspan = document.createElementNS( 'http://www.w3.org/2000/svg', 'tspan' );
                tspan.setAttribute( 'font-family', run.font.family );
                tspan.setAttribute( 'font-size', `${ run.font.size }px` );
                tspan.setAttribute( 'font-style', run.font.style );
                tspan.setAttribute( 'font-weight', run.font.weight );
                tspan.setAttribute( 'fill', run.color || ( typeof line?.paragraphProps?.defRPr.color === 'string' ? line.paragraphProps.defRPr.color : '#000' ) );
                tspan.textContent = run.text;
                textElement.appendChild( tspan );
            }
            lineGroup.appendChild( textElement );
            textGroup.appendChild( lineGroup );
        }
        this.renderer.currentGroup.appendChild( textGroup );
    }

    async renderChart( chartData, options ) {
        const matrix = new Matrix();
        if ( chartData.transform ) {
            const transformString = chartData.transform.replace( 'matrix(', '' ).replace( ')', '' );
            const transformValues = transformString.split( ' ' ).map( Number );
            matrix.m = transformValues;
        }
        this.renderer.setTransform( matrix, options );

        const { pos, chartData: data } = chartData;
        const foreignObject = document.createElementNS( 'http://www.w3.org/2000/svg', 'foreignObject' );

        foreignObject.setAttribute( 'x', 0 );
        foreignObject.setAttribute( 'y', 0 );
        foreignObject.setAttribute( 'width', pos.width );
        foreignObject.setAttribute( 'height', pos.height );

        const chartContainer = document.createElement( 'div' );
        chartContainer.style.width = `${ pos.width }px`;
        chartContainer.style.height = `${ pos.height }px`;
        const canvas = document.createElement( 'canvas' );
        chartContainer.appendChild( canvas );
        foreignObject.appendChild( chartContainer );
        this.renderer.currentGroup.appendChild( foreignObject );

        new Chart( canvas.getContext( '2d' ), {
            type: data.type,
            plugins: [ ChartDataLabels ],
            data: { labels: data.labels, datasets: data.datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: !!data.title, text: data.title },
                    datalabels: { anchor: 'center', align: 'center', formatter: Math.round, font: { weight: 'bold', size: 14 }, color: '#fff' }
                }
            }
        } );
    }

    async renderDiagram( diagramData, options, activeElementId ) {
        const diagramGroup = document.createElementNS( 'http://www.w3.org/2000/svg', 'g' );
        diagramGroup.setAttribute( 'id', options.id );
        if ( options.className ) {
            diagramGroup.setAttribute( 'class', options.className );
        }
        this.renderer.currentGroup.appendChild( diagramGroup );

        const originalGroup = this.renderer.currentGarget;
        this.renderer.currentGroup = diagramGroup;

        for ( const [ index, shapeData ] of diagramData.shapes.entries() ) {
            const shapeId = `${ options.id }.shapes.${ index }`;
            const isActive = activeElementId && activeElementId.startsWith(shapeId);
            const shapeOptions = { id: shapeId, className: isActive ? 'active-element' : '' };
            await this.renderShape( shapeData, shapeOptions, activeElementId );
        }

        this.renderer.currentGroup = originalGroup;
    }
}