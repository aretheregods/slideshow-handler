import { ColorParser } from './colorParser.js';

/**
 * @class SvgRenderer
 * @classdesc A class for rendering shapes as SVG elements.
 */
export class SvgRenderer {
    /**
     * @param {SVGElement} svg - The SVG element to render on.
     * @param {object} slideContext - The context of the slide being rendered.
     */
    constructor( svg, slideContext ) {
        this.svg = svg;
        this.slideContext = slideContext;
        this.defs = this.createDefs();
        this.currentGroup = this.svg;
        this.filterIdCounter = 0;
    }

    /**
     * Creates or retrieves the `<defs>` element in the SVG.
     * @returns {SVGDefsElement} The `<defs>` element.
     */
    createDefs() {
        let defs = this.svg.querySelector( 'defs' );
        if ( !defs ) {
            defs = document.createElementNS( 'http://www.w3.org/2000/svg', 'defs' );
            this.svg.appendChild( defs );
        }
        return defs;
    }

    /**
     * Applies effects, like shadows, to an element.
     * @param {object} options - The rendering options, containing effect data.
     * @returns {string|null} The URL of the filter if an effect was applied, otherwise null.
     */
    applyEffects( options ) {
        if ( options && options.effect ) {
            if ( options.effect.type === 'outerShdw' ) {
                const effect = options.effect;
                const filterId = `drop-shadow-${ this.filterIdCounter++ }`;

                const filter = document.createElementNS( 'http://www.w3.org/2000/svg', 'filter' );
                filter.setAttribute( 'id', filterId );
                filter.setAttribute( 'x', '-50%' );
                filter.setAttribute( 'y', '-50%' );
                filter.setAttribute( 'width', '200%' );
                filter.setAttribute( 'height', '200%' );

                const shadow = document.createElementNS( 'http://www.w3.org/2000/svg', 'feDropShadow' );
                shadow.setAttribute( 'dx', effect.dist * Math.cos( effect.dir * Math.PI / 180 ) );
                shadow.setAttribute( 'dy', effect.dist * Math.sin( effect.dir * Math.PI / 180 ) );
                shadow.setAttribute( 'stdDeviation', effect.blurRad );
                shadow.setAttribute( 'flood-color', effect.color );

                filter.appendChild( shadow );
                this.defs.appendChild( filter );

                return `url(#${ filterId })`;
            }
        }
        return null;
    }

    /**
     * Resets any applied effects. In SVG, this is a no-op as effects are per-element.
     */
    resetEffects() {
        // In SVG, effects are applied per-element, so a global reset is not needed.
    }

    /**
     * Creates a gradient definition in the SVG's `<defs>`.
     * @param {Object} fillData - The fill data containing gradient information.
     * @param {string} [id] - An optional ID for the gradient.
     * @returns {string} The URL of the created gradient.
     * @private
     */
    _createGradient( fillData, pos, id ) {
        const gradientId = `grad-${ this.defs.children.length }`;
        const gradient = document.createElementNS( 'http://www.w3.org/2000/svg', 'linearGradient' );
        if ( id ) {
            gradient.setAttribute( 'id', id );
        }
        gradient.setAttribute( 'id', gradientId );

        let angle = fillData.gradient.angle;
        if ( fillData.gradient.rotWithShape && pos && pos.rotation ) {
            angle += pos.rotation;
        }

        gradient.setAttribute( 'x1', '0%' );
        gradient.setAttribute( 'y1', '0%' );
        gradient.setAttribute( 'x2', '100%' );
        gradient.setAttribute( 'y2', '0%' );
        gradient.setAttribute( 'gradientTransform', `rotate(${ angle }, 0.5, 0.5)` );

        fillData.gradient.stops.forEach( stop => {
            const stopEl = document.createElementNS( 'http://www.w3.org/2000/svg', 'stop' );
            stopEl.setAttribute( 'offset', `${ stop.pos * 100 }%` );
            stopEl.setAttribute( 'stop-color', stop.color.color );
            if ( stop.color.alpha < 1 ) {
                stopEl.setAttribute( 'stop-opacity', stop.color.alpha );
            }
            gradient.appendChild( stopEl );
        } );

        this.defs.appendChild( gradient );
        return `url(#${ gradientId })`;
    }

    /**
     * Creates a pattern definition in the SVG's `<defs>`.
     * @param {Object} fillData - The fill data containing pattern information.
     * @returns {string} The URL of the created pattern.
     * @private
     */
    _createPattern( fillData ) {
        const patternId = `patt-${ this.defs.children.length }`;
        const pattern = document.createElementNS( 'http://www.w3.org/2000/svg', 'pattern' );
        pattern.setAttribute( 'id', patternId );
        pattern.setAttribute( 'patternUnits', 'userSpaceOnUse' );

        // A basic size for the pattern tile. This might need adjustment.
        const patternSize = 10;
        pattern.setAttribute( 'width', patternSize );
        pattern.setAttribute( 'height', patternSize );

        const bgRect = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
        bgRect.setAttribute( 'width', patternSize );
        bgRect.setAttribute( 'height', patternSize );
        bgRect.setAttribute( 'fill', fillData.bgColor );
        pattern.appendChild( bgRect );

        const fg = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
        fg.setAttribute( 'stroke', fillData.fgColor );
        fg.setAttribute( 'stroke-width', 1 );

        // Based on OOXML pattern names
        switch ( fillData.pattern ) {
            case 'dot':
                fg.setAttribute( 'd', `M ${ patternSize / 2 },${ patternSize / 2 } a 1,1 0 1,1 0,-0.01` ); // small circle
                fg.setAttribute( 'fill', fillData.fgColor );
                break;
            case 'dash':
                fg.setAttribute( 'd', `M 0,${ patternSize / 2 } h ${ patternSize }` );
                break;
            case 'diagCross':
                fg.setAttribute( 'd', `M 0,0 L ${ patternSize },${ patternSize } M ${ patternSize },0 L 0,${ patternSize }` );
                break;
            case 'cross':
                fg.setAttribute( 'd', `M ${ patternSize / 2 },0 v ${ patternSize } M 0,${ patternSize / 2 } h ${ patternSize }` );
                break;
            default:
                // default to a simple diagonal line
                fg.setAttribute( 'd', `M 0,0 L ${ patternSize },${ patternSize }` );
                break;
        }
        pattern.appendChild( fg );

        this.defs.appendChild( pattern );
        return `url(#${ patternId })`;
    }

    /**
     * Creates a duotone filter definition in the SVG's `<defs>`.
     * @param {string} color1 - The first color (for dark tones).
     * @param {string} color2 - The second color (for light tones).
     * @returns {string} The URL of the created filter.
     */
    createDuotoneFilter( color1, color2 ) {
        const filterId = `duotone-${ this.filterIdCounter++ }`;
        const filter = document.createElementNS( 'http://www.w3.org/2000/svg', 'filter' );
        filter.setAttribute( 'id', filterId );
        filter.setAttribute( 'color-interpolation-filters', 'sRGB' );

        // Convert to grayscale first using luminance
        const feColorMatrix = document.createElementNS( 'http://www.w3.org/2000/svg', 'feColorMatrix' );
        feColorMatrix.setAttribute( 'type', 'matrix' );
        feColorMatrix.setAttribute( 'values', '0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0' );
        filter.appendChild( feColorMatrix );

        // Map grayscale to the two colors
        const feComponentTransfer = document.createElementNS( 'http://www.w3.org/2000/svg', 'feComponentTransfer' );
        const rgb1 = ColorParser.hexToRgb( color1 );
        const rgb2 = ColorParser.hexToRgb( color2 );

        if ( rgb1 && rgb2 ) {
            const feFuncR = document.createElementNS( 'http://www.w3.org/2000/svg', 'feFuncR' );
            feFuncR.setAttribute( 'type', 'table' );
            feFuncR.setAttribute( 'tableValues', `${ rgb1.r / 255 } ${ rgb2.r / 255 }` );
            feComponentTransfer.appendChild( feFuncR );

            const feFuncG = document.createElementNS( 'http://www.w3.org/2000/svg', 'feFuncG' );
            feFuncG.setAttribute( 'type', 'table' );
            feFuncG.setAttribute( 'tableValues', `${ rgb1.g / 255 } ${ rgb2.g / 255 }` );
            feComponentTransfer.appendChild( feFuncG );

            const feFuncB = document.createElementNS( 'http://www.w3.org/2000/svg', 'feFuncB' );
            feFuncB.setAttribute( 'type', 'table' );
            feFuncB.setAttribute( 'tableValues', `${ rgb1.b / 255 } ${ rgb2.b / 255 }` );
            feComponentTransfer.appendChild( feFuncB );
        }

        filter.appendChild( feComponentTransfer );
        this.defs.appendChild( filter );

        return `url(#${ filterId })`;
    }

    /**
     * Creates an alpha filter definition in the SVG's `<defs>`.
     * @param {number} opacity - The opacity value (0-1).
     * @returns {string} The URL of the created filter.
     */
    createAlphaFilter( opacity ) {
        const filterId = `alpha-${ this.filterIdCounter++ }`;
        const filter = document.createElementNS( 'http://www.w3.org/2000/svg', 'filter' );
        filter.setAttribute( 'id', filterId );

        const feColorMatrix = document.createElementNS( 'http://www.w3.org/2000/svg', 'feColorMatrix' );
        feColorMatrix.setAttribute( 'type', 'matrix' );
        feColorMatrix.setAttribute( 'values', `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${ Number.isNaN( parseInt( opacity ) ) ? 1 : opacity } 0` );
        filter.appendChild( feColorMatrix );

        this.defs.appendChild( filter );

        return `url(#${ filterId })`;
    }

    /**
     * Creates an image pattern definition in the SVG's `<defs>`.
     * @param {Object} fillData - The fill data containing image information.
     * @returns {string} The URL of the created pattern.
     * @private
     */
    _createImagePattern( fillData, rotation ) {
        const patternId = `img-patt-${ this.defs.children.length }`;
        const pattern = document.createElementNS( 'http://www.w3.org/2000/svg', 'pattern' );
        pattern.setAttribute( 'id', patternId );
        pattern.setAttribute( 'patternContentUnits', 'objectBoundingBox' );
        if ( fillData.rotWithShape ) {
            pattern.setAttribute( 'patternTransform', `rotate(${ rotation })` );
        }
        pattern.setAttribute( 'width', '1' );
        pattern.setAttribute( 'height', '1' );

        const image = document.createElementNS( 'http://www.w3.org/2000/svg', 'image' );
        image.setAttribute( 'href', fillData.href );
        image.setAttribute( 'x', 0 );
        image.setAttribute( 'y', 0 );
        image.setAttribute( 'width', 1 );
        image.setAttribute( 'height', 1 );
        image.setAttribute( 'preserveAspectRatio', 'xMidYMid slice' );
        pattern.appendChild( image );

        this.defs.appendChild( pattern );
        return `url(#${ patternId })`;
    }

    /**
     * Clears the SVG.
     */
    clear() {
        while ( this.svg.firstChild ) {
            if ( this.svg.firstChild.tagName !== 'defs' ) {
                this.svg.removeChild( this.svg.firstChild );
            }
        }
    }

    /**
     * Sets the transformation for subsequent shapes.
     * @param {Matrix} matrix - The transformation matrix.
     * @param {object} options - The options for the group element.
     * @param {string} options.id - The ID to assign to the group element.
     * @param {string} [options.className] - The class name to assign to the group element.
     */
    setTransform( matrix, options ) {
        const g = document.createElementNS( 'http://www.w3.org/2000/svg', 'g' );
        if ( options.id ) {
            g.setAttribute( 'id', options.id );
        }
        if ( options.className ) {
            g.setAttribute( 'class', options.className );
        }
        g.setAttribute( 'transform', `matrix(${ matrix.m.join( ' ' ) })` );
        this.svg.appendChild( g );
        this.currentGroup = g;
    }

    /**
     * Draws a rectangle.
     * @param {number} x - The x-coordinate of the rectangle.
     * @param {number} y - The y-coordinate of the rectangle.
     * @param {number} width - The width of the rectangle.
     * @param {number} height - The height of the rectangle.
     * @param {object} [options] - The rendering options.
     */
    drawRect( x, y, width, height, options = {} ) {
        const rect = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
        if ( options.id ) {
            rect.setAttribute( 'id', options.id );
        }

        const strokeWidth = ( options.stroke && options.stroke.width > 0 ) ? options.stroke.width : 0;

        if ( strokeWidth > 0 ) {
            // Adjust position and size for stroke alignment (SVG strokes are centered)
            rect.setAttribute( 'x', x + strokeWidth / 2 );
            rect.setAttribute( 'y', y + strokeWidth / 2 );
            rect.setAttribute( 'width', Math.max( 0, width - strokeWidth ) );
            rect.setAttribute( 'height', Math.max( 0, height - strokeWidth ) );
        } else {
            rect.setAttribute( 'x', x );
            rect.setAttribute( 'y', y );
            rect.setAttribute( 'width', width );
            rect.setAttribute( 'height', height );
        }

        const filterUrl = this.applyEffects( options );
        if ( filterUrl ) {
            rect.setAttribute( 'filter', filterUrl );
        }

        if ( options.fill ) {
            if ( typeof options.fill === 'object' ) {
                if ( options.fill.type === 'gradient' ) {
                    rect.setAttribute( 'fill', this._createGradient( options.fill, options.pos ) );
                } else if ( options.fill.type === 'solid' ) {
                    rect.setAttribute( 'fill', options.fill.color );
                } else if ( options.fill.type === 'pattern' ) {
                    rect.setAttribute( 'fill', this._createPattern( options.fill ) );
                } else if ( options.fill.type === 'image' ) {
                    rect.setAttribute( 'fill', this._createImagePattern( options.fill, options.rotation ) );
                } else if ( options.fill.type === 'none' ) {
                    rect.setAttribute( 'fill', 'none' );
                }
            } else {
                rect.setAttribute( 'fill', options.fill );
            }
        } else {
            rect.setAttribute( 'fill', 'none' );
        }

        if ( options.stroke && options.stroke.width > 0 ) {
            rect.setAttribute( 'stroke', options.stroke.color );
            rect.setAttribute( 'stroke-width', options.stroke.width );
            if ( options.stroke.dash ) {
                rect.setAttribute( 'stroke-dasharray', options.stroke.dash.join( ' ' ) );
            }
            if ( options.stroke.join ) {
                rect.setAttribute( 'stroke-linejoin', options.stroke.join );
            }
            if ( options.stroke.cap ) {
                rect.setAttribute( 'stroke-linecap', options.stroke.cap );
            }
        }

        this.currentGroup.appendChild( rect );
    }

    /**
     * Draws an ellipse.
     * @param {number} cx - The x-coordinate of the center of the ellipse.
     * @param {number} cy - The y-coordinate of the center of the ellipse.
     * @param {number} rx - The horizontal radius of the ellipse.
     * @param {number} ry - The vertical radius of the ellipse.
     * @param {object} [options] - The rendering options.
     */
    drawEllipse( cx, cy, rx, ry, options = {} ) {
        const ellipse = document.createElementNS( 'http://www.w3.org/2000/svg', 'ellipse' );
        if ( options.id ) {
            ellipse.setAttribute( 'id', options.id );
        }
        ellipse.setAttribute( 'cx', cx );
        ellipse.setAttribute( 'cy', cy );
        ellipse.setAttribute( 'rx', rx );
        ellipse.setAttribute( 'ry', ry );

        const filterUrl = this.applyEffects( options );
        if ( filterUrl ) {
            ellipse.setAttribute( 'filter', filterUrl );
        }

        if ( options.fill ) {
            if ( typeof options.fill === 'object' ) {
                if ( options.fill.type === 'gradient' ) {
                    const pos = { x: cx - rx, y: cy - ry, width: 2 * rx, height: 2 * ry, rotation: options.rotation };
                    ellipse.setAttribute( 'fill', this._createGradient( options.fill, pos ) );
                } else if ( options.fill.type === 'solid' ) {
                    ellipse.setAttribute( 'fill', options.fill.color );
                } else if ( options.fill.type === 'pattern' ) {
                    ellipse.setAttribute( 'fill', this._createPattern( options.fill ) );
                } else if ( options.fill.type === 'image' ) {
                    ellipse.setAttribute( 'fill', this._createImagePattern( options.fill, options.rotation ) );
                } else if ( options.fill.type === 'none' ) {
                    ellipse.setAttribute( 'fill', 'none' );
                }
            } else {
                ellipse.setAttribute( 'fill', options.fill );
            }
        } else {
            ellipse.setAttribute( 'fill', 'none' );
        }

        if ( options.stroke && options.stroke.width > 0 ) {
            ellipse.setAttribute( 'stroke', options.stroke.color );
            ellipse.setAttribute( 'stroke-width', options.stroke.width );
            if ( options.stroke.dash ) {
                ellipse.setAttribute( 'stroke-dasharray', options.stroke.dash.join( ' ' ) );
            }
            if ( options.stroke.join ) {
                ellipse.setAttribute( 'stroke-linejoin', options.stroke.join );
            }
            if ( options.stroke.cap ) {
                ellipse.setAttribute( 'stroke-linecap', options.stroke.cap );
            }
        }

        this.currentGroup.appendChild( ellipse );
    }

    /**
     * Draws a compound line (e.g., double, thick-thin).
     * @param {number} x1 - The x-coordinate of the starting point.
     * @param {number} y1 - The y-coordinate of the starting point.
     * @param {number} x2 - The x-coordinate of the ending point.
     * @param {number} y2 - The y-coordinate of the ending point.
     * @param {object} options - The rendering options.
     * @private
     */
    _drawCompoundLine( x1, y1, x2, y2, options, parentGroup ) {
        const stroke = options.stroke;
        const totalWidth = stroke.width;

        if ( !totalWidth || totalWidth <= 0 ) {
            return;
        }

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt( dx * dx + dy * dy );
        if ( len === 0 ) return;

        const nx = -dy / len;
        const ny = dx / len;

        const drawParallelLine = ( offset, width, color, dash ) => {
            const offsetX = nx * offset;
            const offsetY = ny * offset;
            const line = document.createElementNS( 'http://www.w3.org/2000/svg', 'line' );
            line.setAttribute( 'x1', x1 + offsetX );
            line.setAttribute( 'y1', y1 + offsetY );
            line.setAttribute( 'x2', x2 + offsetX );
            line.setAttribute( 'y2', y2 + offsetY );
            line.setAttribute( 'stroke', color );
            line.setAttribute( 'stroke-width', width );
            if ( dash ) {
                line.setAttribute( 'stroke-dasharray', dash.join( ' ' ) );
            }
            if ( stroke.cap ) {
                line.setAttribute( 'stroke-linecap', stroke.cap );
            }
            parentGroup.appendChild( line );
        };

        const sng = () => {
            drawParallelLine( 0, totalWidth, stroke.color, stroke.dash );
        }

        switch ( stroke.cmpd ) {
            case 'dbl': {
                const w = totalWidth * 3 / 8;
                const s = totalWidth * 2 / 8;
                const offset = ( w + s ) / 2;
                drawParallelLine( -offset, w, stroke.color );
                drawParallelLine( offset, w, stroke.color );
                break;
            }
            case 'thickThin': {
                const w1 = totalWidth * 3 / 4;
                const w2 = totalWidth * 1 / 4;
                const offset1 = -totalWidth / 2 + w1 / 2;
                const offset2 = totalWidth / 2 - w2 / 2;
                drawParallelLine( offset1, w1, stroke.color );
                drawParallelLine( offset2, w2, stroke.color );
                break;
            }
            case 'thinThick': {
                const w1 = totalWidth * 1 / 4;
                const w2 = totalWidth * 3 / 4;
                const offset1 = -totalWidth / 2 + w1 / 2;
                const offset2 = totalWidth / 2 - w2 / 2;
                drawParallelLine( offset1, w1, stroke.color );
                drawParallelLine( offset2, w2, stroke.color );
                break;
            }
            case 'tri': {
                const w = totalWidth / 5;
                const s = totalWidth / 5;
                const offset = w + s;
                drawParallelLine( -offset, w, stroke.color );
                drawParallelLine( 0, w, stroke.color );
                drawParallelLine( offset, w, stroke.color );
                break;
            }
            default:
                sng();
                break;
        }
    }


    /**
     * Draws a line.
     * @param {number} x1 - The x-coordinate of the starting point.
     * @param {number} y1 - The y-coordinate of the starting point.
     * @param {number} x2 - The x-coordinate of the ending point.
     * @param {number} y2 - The y-coordinate of the ending point.
     * @param {object} [options] - The rendering options.
     */
    drawLine( x1, y1, x2, y2, options = {} ) {
        const filterUrl = this.applyEffects( options );

        if ( options.stroke && options.stroke.width > 0 ) {
            // Create a parent group for the line and its hitbox
            const g = document.createElementNS( 'http://www.w3.org/2000/svg', 'g' );
            if ( options.id ) {
                g.setAttribute( 'id', options.id );
            }

            // Hitbox for better clickability
            const hitbox = document.createElementNS( 'http://www.w3.org/2000/svg', 'line' );
            hitbox.setAttribute( 'x1', x1 );
            hitbox.setAttribute( 'y1', y1 );
            hitbox.setAttribute( 'x2', x2 );
            hitbox.setAttribute( 'y2', y2 );
            hitbox.setAttribute( 'stroke', 'transparent' );
            // Make hitbox wider than the actual line
            hitbox.setAttribute( 'stroke-width', Math.max( 10, options.stroke.width + 5 ) );
            if ( options.stroke.cap ) {
                hitbox.setAttribute( 'stroke-linecap', options.stroke.cap || 'butt' );
            }
            g.appendChild( hitbox );

            if ( options.stroke.cmpd && options.stroke.cmpd !== 'sng' ) {
                this._drawCompoundLine( x1, y1, x2, y2, options, g );
            } else {
                if ( typeof options.stroke.color === 'object' && options.stroke.color?.type === 'gradient' ) {
                    const lineId = options.id || `line-${ this.defs.children.length }`;
                    const clipId = `clip-${ lineId }`;

                    const clipPath = document.createElementNS( 'http://www.w3.org/2000/svg', 'clipPath' );
                    clipPath.setAttribute( 'id', clipId );
                    const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
                    path.setAttribute( 'd', `M ${ x1 } ${ y1 } L ${ x2 } ${ y2 }` );
                    path.setAttribute( 'stroke', '#000000' ); // stroke color doesn't matter for clipping
                    path.setAttribute( 'stroke-width', options.stroke.width );
                    if ( options.stroke.cap ) {
                        path.setAttribute( 'stroke-linecap', options.stroke.cap || 'butt' );
                    }
                    clipPath.appendChild( path );
                    this.defs.appendChild( clipPath );

                    const boundingBox = {
                        x: Math.min( x1, x2 ) - options.stroke.width,
                        y: Math.min( y1, y2 ) - options.stroke.width,
                        width: Math.abs( x2 - x1 ) + 2 * options.stroke.width,
                        height: Math.abs( y2 - y1 ) + 2 * options.stroke.width,
                    };

                    const rect = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
                    rect.setAttribute( 'x', String( boundingBox.x ) );
                    rect.setAttribute( 'y', String( boundingBox.y ) );
                    rect.setAttribute( 'width', String( boundingBox.width - 2 ) );
                    rect.setAttribute( 'height', String( boundingBox.height - 2 ) );
                    rect.setAttribute( 'fill', this._createGradient( options.stroke.color ) );
                    if ( filterUrl ) {
                        rect.setAttribute( 'filter', filterUrl );
                    }
                    g.appendChild( rect );

                } else {
                    const line = document.createElementNS( 'http://www.w3.org/2000/svg', 'line' );
                    line.setAttribute( 'x1', x1 );
                    line.setAttribute( 'y1', y1 );
                    line.setAttribute( 'x2', x2 );
                    line.setAttribute( 'y2', y2 );
                    line.setAttribute( 'stroke', options.stroke.color );
                    line.setAttribute( 'stroke-width', options.stroke.width );
                    if ( options.stroke.dash ) {
                        line.setAttribute( 'stroke-dasharray', options.stroke.dash.join( ' ' ) );
                    }
                    if ( options.stroke.join ) {
                        line.setAttribute( 'stroke-linejoin', options.stroke.join );
                    }
                    if ( options.stroke.cap ) {
                        line.setAttribute( 'stroke-linecap', options.stroke.cap || 'butt' );
                    }
                    if ( filterUrl ) {
                        line.setAttribute( 'filter', filterUrl );
                    }
                    g.appendChild( line );
                }
            }

            this.currentGroup.appendChild( g );
        }
    }

    /**
     * Draws a path.
     * @param {string} pathData - The SVG path data.
     * @param {object} [options] - The rendering options.
     */
    drawPath( pathData, options = {} ) {
        const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
        if ( options.id ) {
            path.setAttribute( 'id', options.id );
        }
        path.setAttribute( 'd', pathData );

        const filterUrl = this.applyEffects( options );
        if ( filterUrl ) {
            path.setAttribute( 'filter', filterUrl );
        }

        if ( options.fill ) {
            if ( typeof options.fill === 'object' ) {
                if ( options.fill.type === 'gradient' ) {
                    path.setAttribute( 'fill', this._createGradient( options.fill, options.pos ) );
                } else if ( options.fill.type === 'solid' ) {
                    path.setAttribute( 'fill', options.fill.color );
                } else if ( options.fill.type === 'pattern' ) {
                    path.setAttribute( 'fill', this._createPattern( options.fill ) );
                } else if ( options.fill.type === 'image' ) {
                    path.setAttribute( 'fill', this._createImagePattern( options.fill, options.rotation ) );
                } else if ( options.fill.type === 'none' ) {
                    path.setAttribute( 'fill', 'none' );
                }
            } else {
                path.setAttribute( 'fill', options.fill );
            }
        } else {
            path.setAttribute( 'fill', 'none' );
        }

        if ( options.stroke && options.stroke.width > 0 ) {
            path.setAttribute( 'stroke', options.stroke.color );
            path.setAttribute( 'stroke-width', options.stroke.width );
            if ( options.stroke.dash ) {
                path.setAttribute( 'stroke-dasharray', options.stroke.dash.join( ' ' ) );
            }
            if ( options.stroke.join ) {
                path.setAttribute( 'stroke-linejoin', options.stroke.join );
            }
            if ( options.stroke.cap ) {
                path.setAttribute( 'stroke-linecap', options.stroke.cap );
            }
        }

        this.currentGroup.appendChild( path );
    }

    /**
     * Draws a chevron shape.
     * @param {number} x - The x-coordinate of the chevron's bounding box.
     * @param {number} y - The y-coordinate of the chevron's bounding box.
     * @param {number} width - The width of the chevron.
     * @param {number} height - The height of the chevron.
     * @param {number} adjRatio - The adjustment ratio for the chevron's point, corresponding to `adj / 100000`.
     * @param {object} [options] - The rendering options.
     */
    drawChevron( x, y, width, height, adjRatio, options = {} ) {
        // The adjRatio corresponds to the OOXML 'adj' value divided by 100000.
        // It controls the indentation of the chevron point.
        const x1 = width * adjRatio * ( 3 / 10 );
        const x2 = width - x1;
        const midY = y + height / 2;

        const pathData = [
            "M", x, y,
            "L", x + x2, y,
            "L", x + width, midY,
            "L", x + x2, y + height,
            "L", x, y + height,
            "L", x + x1, midY,
            "Z"
        ].join( " " );

        this.drawPath( pathData, options );
    }

    /**
     * Draws a corner (L-shaped) shape.
     * @param {number} x - The x-coordinate of the corner's bounding box.
     * @param {number} y - The y-coordinate of the corner's bounding box.
     * @param {number} width - The width of the corner shape.
     * @param {number} height - The height of the corner shape.
     * @param {object} [options] - The rendering options.
     */
    drawCorner( x, y, width, height, options = {} ) {
        const pathData = [
            "M", x, y,
            "L", x, y + height,
            "L", x + width, y + height,
        ].join( " " );

        this.drawPath( pathData, options );
    }

    /**
     * Draws a home plate shape (pentagon).
     * @param {number} x - The x-coordinate of the home plate's bounding box.
     * @param {number} y - The y-coordinate of the home plate's bounding box.
     * @param {number} width - The width of the home plate.
     * @param {number} height - The height of the home plate.
     * @param {number} adjRatio - The adjustment ratio for the top point's height.
     * @param {object} [options] - The rendering options.
     */
    drawHomePlate( x, y, width, height, adjRatio, options = {} ) {
        const shoulderX = width * adjRatio * ( 3 / 10 );
        const x2 = width - shoulderX;

        const pathData = [
            "M", x, y,
            "L", x + x2, y,
            "L", width, height / 2,
            "L", x + x2, y + height,
            "L", x, height,
            "Z"
        ].join( " " );

        this.drawPath( pathData, options );
    }

    /**
     * Draws text.
     * @param {string} textContent - The text to draw.
     * @param {number} x - The x-coordinate of the text.
     * @param {number} y - The y-coordinate of the text.
     * @param {object} [options] - The rendering options.
     */
    drawText( textContent, x, y, options = {} ) {
        const text = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );
        if ( options.id ) {
            text.setAttribute( 'id', options.id );
        }
        text.setAttribute( 'x', x );
        text.setAttribute( 'y', y );
        text.textContent = textContent;

        if ( options.fill ) {
            text.setAttribute( 'fill', options.fill );
        }
        if ( options.fontSize ) {
            text.setAttribute( 'font-size', options.fontSize );
        }
        if ( options.fontFamily ) {
            text.setAttribute( 'font-family', options.fontFamily );
        }
        if ( options.fontWeight ) {
            text.setAttribute( 'font-weight', options.fontWeight );
        }
        if ( options.fontStyle ) {
            text.setAttribute( 'font-style', options.fontStyle );
        }
        if ( options.textAnchor ) {
            text.setAttribute( 'text-anchor', options.textAnchor );
        }

        this.currentGroup.appendChild( text );
    }

    /**
     * Draws an image.
     * @param {string} href - The URL of the image.
     * @param {number} x - The x-coordinate of the image.
     * @param {number} y - The y-coordinate of the image.
     * @param {number} width - The width of the image.
     * @param {number} height - The height of the image.
     * @param {object} [options] - The rendering options.
     */
    drawImage( href, x, y, width, height, options = {} ) {
        const image = document.createElementNS( 'http://www.w3.org/2000/svg', 'image' );
        if ( options.id ) {
            image.setAttribute( 'id', options.id );
        }
        image.setAttribute( 'href', href );
        image.setAttribute( 'x', x );
        image.setAttribute( 'y', y );
        image.setAttribute( 'width', width );
        image.setAttribute( 'height', height );

        if ( options.opacity !== undefined ) {
            image.setAttribute( 'opacity', options.opacity );
        }

        if ( options.filter ) {
            image.setAttribute( 'filter', options.filter );
        }

        if ( options.clipPath ) {
            image.setAttribute( 'clip-path', options.clipPath );
        }

        if ( options.viewBox ) {
            image.setAttribute( 'viewBox', options.viewBox );
        }

        if ( options.preserveAspectRatio ) {
            image.setAttribute( 'preserveAspectRatio', options.preserveAspectRatio );
        }

        this.currentGroup.appendChild( image );
    }
}
