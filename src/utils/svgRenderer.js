/**
 * @class SvgRenderer
 * @classdesc A class for rendering shapes as SVG elements.
 */
export class SvgRenderer {
    /**
     * @param {SVGElement} svg - The SVG element to render on.
     * @param {object} slideContext - The context of the slide being rendered.
     */
    constructor(svg, slideContext) {
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
        let defs = this.svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.svg.appendChild(defs);
        }
        return defs;
    }

    /**
     * Applies effects, like shadows, to an element.
     * @param {object} options - The rendering options, containing effect data.
     * @returns {string|null} The URL of the filter if an effect was applied, otherwise null.
     */
    applyEffects(options) {
        if (options && options.effect) {
            if (options.effect.type === 'outerShdw') {
                const effect = options.effect;
                const filterId = `drop-shadow-${this.filterIdCounter++}`;

                const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
                filter.setAttribute('id', filterId);
                filter.setAttribute('x', '-50%');
                filter.setAttribute('y', '-50%');
                filter.setAttribute('width', '200%');
                filter.setAttribute('height', '200%');

                const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
                shadow.setAttribute('dx', effect.dist * Math.cos(effect.dir * Math.PI / 180));
                shadow.setAttribute('dy', effect.dist * Math.sin(effect.dir * Math.PI / 180));
                shadow.setAttribute('stdDeviation', effect.blurRad);
                shadow.setAttribute('flood-color', effect.color);

                filter.appendChild(shadow);
                this.defs.appendChild(filter);

                return `url(#${filterId})`;
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
    _createGradient(fillData, id) {
        const gradientId = `grad-${this.defs.children.length}`;
        const gradient = document.createElementNS( 'http://www.w3.org/2000/svg', 'linearGradient' );
        if ( id ) {
            gradient.setAttribute( 'id', options.id );
        }
        gradient.setAttribute('id', gradientId);
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '0%');
        gradient.setAttribute('gradientTransform', `rotate(${fillData.gradient.angle}, 0.5, 0.5)`);

        fillData.gradient.stops.forEach(stop => {
            const stopEl = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stopEl.setAttribute('offset', `${stop.pos * 100}%`);
            stopEl.setAttribute('stop-color', stop.color.color);
            if (stop.color.alpha < 1) {
                stopEl.setAttribute('stop-opacity', stop.color.alpha);
            }
            gradient.appendChild(stopEl);
        });

        this.defs.appendChild(gradient);
        return `url(#${gradientId})`;
    }

    /**
     * Creates a pattern definition in the SVG's `<defs>`.
     * @param {Object} fillData - The fill data containing pattern information.
     * @returns {string} The URL of the created pattern.
     * @private
     */
    _createPattern(fillData) {
        const patternId = `patt-${this.defs.children.length}`;
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        // A basic size for the pattern tile. This might need adjustment.
        const patternSize = 10;
        pattern.setAttribute('width', patternSize);
        pattern.setAttribute('height', patternSize);

        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', patternSize);
        bgRect.setAttribute('height', patternSize);
        bgRect.setAttribute('fill', fillData.bgColor);
        pattern.appendChild(bgRect);

        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fg.setAttribute('stroke', fillData.fgColor);
        fg.setAttribute('stroke-width', 1);

        // Based on OOXML pattern names
        switch (fillData.pattern) {
            case 'dot':
                fg.setAttribute('d', `M ${patternSize/2},${patternSize/2} a 1,1 0 1,1 0,-0.01`); // small circle
                fg.setAttribute('fill', fillData.fgColor);
                break;
            case 'dash':
                fg.setAttribute('d', `M 0,${patternSize/2} h ${patternSize}`);
                break;
            case 'diagCross':
                fg.setAttribute('d', `M 0,0 L ${patternSize},${patternSize} M ${patternSize},0 L 0,${patternSize}`);
                break;
            case 'cross':
                fg.setAttribute('d', `M ${patternSize/2},0 v ${patternSize} M 0,${patternSize/2} h ${patternSize}`);
                break;
            default:
                // default to a simple diagonal line
                fg.setAttribute('d', `M 0,0 L ${patternSize},${patternSize}`);
                break;
        }
        pattern.appendChild(fg);

        this.defs.appendChild(pattern);
        return `url(#${patternId})`;
    }

    /**
     * Creates an image pattern definition in the SVG's `<defs>`.
     * @param {Object} fillData - The fill data containing image information.
     * @returns {string} The URL of the created pattern.
     * @private
     */
    _createImagePattern(fillData) {
        const patternId = `img-patt-${this.defs.children.length}`;
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('patternContentUnits', 'objectBoundingBox');
        pattern.setAttribute('width', '1');
        pattern.setAttribute('height', '1');

        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('href', fillData.href);
        image.setAttribute('x', 0);
        image.setAttribute('y', 0);
        image.setAttribute('width', 1);
        image.setAttribute('height', 1);
        image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        pattern.appendChild(image);

        this.defs.appendChild(pattern);
        return `url(#${patternId})`;
    }

    /**
     * Clears the SVG.
     */
    clear() {
        while (this.svg.firstChild) {
            if (this.svg.firstChild.tagName !== 'defs') {
                this.svg.removeChild(this.svg.firstChild);
            }
        }
    }

    /**
     * Sets the transformation for subsequent shapes.
     * @param {Matrix} matrix - The transformation matrix.
     * @param {string} id - The ID to assign to the group element.
     */
    setTransform(matrix, id) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        if (id) {
            g.setAttribute('id', id);
        }
        g.setAttribute('transform', `matrix(${matrix.m.join(' ')})`);
        this.svg.appendChild(g);
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
    drawRect(x, y, width, height, options = {}) {
        const rect = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
        if ( options.id ) {
            rect.setAttribute( 'id', options.id );
        }

        const strokeWidth = (options.stroke && options.stroke.width > 0) ? options.stroke.width : 0;

        if (strokeWidth > 0) {
            // Adjust position and size for stroke alignment (SVG strokes are centered)
            rect.setAttribute('x', x + strokeWidth / 2);
            rect.setAttribute('y', y + strokeWidth / 2);
            rect.setAttribute('width', Math.max(0, width - strokeWidth));
            rect.setAttribute('height', Math.max(0, height - strokeWidth));
        } else {
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
        }

        // For debugging positioning issues
        // console.log(`Drawing rect: x=${rect.getAttribute('x')}, y=${rect.getAttribute('y')}, width=${rect.getAttribute('width')}, height=${rect.getAttribute('height')}`, { stroke: options.stroke, fill: options.fill });

        const filterUrl = this.applyEffects(options);
        if (filterUrl) {
            rect.setAttribute('filter', filterUrl);
        }

        if (options.fill) {
            if (typeof options.fill === 'object') {
                if (options.fill.type === 'gradient') {
                    rect.setAttribute('fill', this._createGradient(options.fill));
                } else if (options.fill.type === 'solid') {
                    rect.setAttribute('fill', options.fill.color);
                } else if (options.fill.type === 'pattern') {
                    rect.setAttribute('fill', this._createPattern(options.fill));
                } else if (options.fill.type === 'image') {
                    rect.setAttribute('fill', this._createImagePattern(options.fill));
				} else if (options.fill.type === 'none') {
					rect.setAttribute('fill', 'none');
				}
            } else {
                rect.setAttribute('fill', options.fill);
            }
        } else {
            rect.setAttribute('fill', 'none');
        }

        if (options.stroke && options.stroke.width > 0) {
            rect.setAttribute('stroke', options.stroke.color);
            rect.setAttribute('stroke-width', options.stroke.width);
            if (options.stroke.dash) {
                rect.setAttribute('stroke-dasharray', options.stroke.dash.join(' '));
            }
            if (options.stroke.join) {
                rect.setAttribute('stroke-linejoin', options.stroke.join);
            }
            if (options.stroke.cap) {
                rect.setAttribute('stroke-linecap', options.stroke.cap);
            }
        }

        this.currentGroup.appendChild(rect);
    }

    /**
     * Draws an ellipse.
     * @param {number} cx - The x-coordinate of the center of the ellipse.
     * @param {number} cy - The y-coordinate of the center of the ellipse.
     * @param {number} rx - The horizontal radius of the ellipse.
     * @param {number} ry - The vertical radius of the ellipse.
     * @param {object} [options] - The rendering options.
     */
    drawEllipse(cx, cy, rx, ry, options = {}) {
        const ellipse = document.createElementNS( 'http://www.w3.org/2000/svg', 'ellipse' );
        if ( options.id ) {
            ellipse.setAttribute( 'id', options.id );
        }
        ellipse.setAttribute('cx', cx);
        ellipse.setAttribute('cy', cy);
        ellipse.setAttribute('rx', rx);
        ellipse.setAttribute('ry', ry);

        const filterUrl = this.applyEffects(options);
        if (filterUrl) {
            ellipse.setAttribute('filter', filterUrl);
        }

        if (options.fill) {
            if (typeof options.fill === 'object') {
                if (options.fill.type === 'gradient') {
                    ellipse.setAttribute('fill', this._createGradient(options.fill));
                } else if (options.fill.type === 'solid') {
                    ellipse.setAttribute('fill', options.fill.color);
                } else if (options.fill.type === 'pattern') {
                    ellipse.setAttribute('fill', this._createPattern(options.fill));
                } else if (options.fill.type === 'image') {
                    ellipse.setAttribute('fill', this._createImagePattern(options.fill));
                } else if (options.fill.type === 'none') {
					ellipse.setAttribute('fill', 'none');
				}
            } else {
                ellipse.setAttribute('fill', options.fill);
            }
        } else {
            ellipse.setAttribute('fill', 'none');
        }

        if (options.stroke && options.stroke.width > 0) {
            ellipse.setAttribute('stroke', options.stroke.color);
            ellipse.setAttribute('stroke-width', options.stroke.width);
            if (options.stroke.dash) {
                ellipse.setAttribute('stroke-dasharray', options.stroke.dash.join(' '));
            }
            if (options.stroke.join) {
                ellipse.setAttribute('stroke-linejoin', options.stroke.join);
            }
            if (options.stroke.cap) {
                ellipse.setAttribute('stroke-linecap', options.stroke.cap);
            }
        }

        this.currentGroup.appendChild(ellipse);
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
    _drawCompoundLine(x1, y1, x2, y2, options) {
        const stroke = options.stroke;
        const totalWidth = stroke.width;

        if (!totalWidth || totalWidth <= 0) {
            return;
        }

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;

        const nx = -dy / len;
        const ny = dx / len;

        const drawParallelLine = (offset, width, color, dash) => {
            const offsetX = nx * offset;
            const offsetY = ny * offset;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1 + offsetX);
            line.setAttribute('y1', y1 + offsetY);
            line.setAttribute('x2', x2 + offsetX);
            line.setAttribute('y2', y2 + offsetY);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', width);
            if (dash) {
                line.setAttribute('stroke-dasharray', dash.join(' '));
            }
            if (stroke.cap) {
                line.setAttribute('stroke-linecap', stroke.cap);
            }
            this.currentGroup.appendChild(line);
        };

        const sng = () => {
             drawParallelLine(0, totalWidth, stroke.color, stroke.dash);
        }

        switch (stroke.cmpd) {
            case 'dbl': {
                const w = totalWidth * 3 / 8;
                const s = totalWidth * 2 / 8;
                const offset = (w + s) / 2;
                drawParallelLine(-offset, w, stroke.color);
                drawParallelLine(offset, w, stroke.color);
                break;
            }
            case 'thickThin': {
                const w1 = totalWidth * 3 / 4;
                const w2 = totalWidth * 1 / 4;
                const offset1 = -totalWidth / 2 + w1 / 2;
                const offset2 = totalWidth / 2 - w2 / 2;
                drawParallelLine(offset1, w1, stroke.color);
                drawParallelLine(offset2, w2, stroke.color);
                break;
            }
            case 'thinThick': {
                const w1 = totalWidth * 1 / 4;
                const w2 = totalWidth * 3 / 4;
                const offset1 = -totalWidth / 2 + w1 / 2;
                const offset2 = totalWidth / 2 - w2 / 2;
                drawParallelLine(offset1, w1, stroke.color);
                drawParallelLine(offset2, w2, stroke.color);
                break;
            }
            case 'tri': {
                const w = totalWidth / 5;
                const s = totalWidth / 5;
                const offset = w + s;
                drawParallelLine(-offset, w, stroke.color);
                drawParallelLine(0, w, stroke.color);
                drawParallelLine(offset, w, stroke.color);
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
    drawLine(x1, y1, x2, y2, options = {}) {
        const filterUrl = this.applyEffects(options);

        if (options.stroke && options.stroke.width > 0) {
            if (options.stroke.cmpd && options.stroke.cmpd !== 'sng') {
                this._drawCompoundLine(x1, y1, x2, y2, options);
            } else {
                const line = document.createElementNS( 'http://www.w3.org/2000/svg', 'line' );
                if ( options.id ) {
                    line.setAttribute( 'id', options.id );
                }
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);

                line.setAttribute('stroke', options.stroke.color);
                line.setAttribute('stroke-width', options.stroke.width);

                if (options.stroke.dash) {
                    line.setAttribute('stroke-dasharray', options.stroke.dash.join(' '));
                }
                if (options.stroke.join) {
                    line.setAttribute('stroke-linejoin', options.stroke.join);
                }
                if (options.stroke.cap) {
                    line.setAttribute('stroke-linecap', options.stroke.cap || 'butt');
                }
                 if (filterUrl) {
                    line.setAttribute('filter', filterUrl);
                }
                this.currentGroup.appendChild(line);
            }
        }
    }

    /**
     * Draws a path.
     * @param {string} pathData - The SVG path data.
     * @param {object} [options] - The rendering options.
     */
    drawPath(pathData, options = {}) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);

        const filterUrl = this.applyEffects(options);
        if (filterUrl) {
            path.setAttribute('filter', filterUrl);
        }

        if (options.fill) {
            if (typeof options.fill === 'object') {
                if (options.fill.type === 'gradient') {
                    path.setAttribute('fill', this._createGradient(options.fill));
                } else if (options.fill.type === 'solid') {
                    path.setAttribute('fill', options.fill.color);
                } else if (options.fill.type === 'pattern') {
                    path.setAttribute('fill', this._createPattern(options.fill));
                } else if (options.fill.type === 'image') {
                    path.setAttribute('fill', this._createImagePattern(options.fill));
                } else if (options.fill.type === 'none') {
					path.setAttribute('fill', 'none');
				}
            } else {
                path.setAttribute('fill', options.fill);
            }
        } else {
            path.setAttribute('fill', 'none');
        }

        if (options.stroke && options.stroke.width > 0) {
            path.setAttribute('stroke', options.stroke.color);
            path.setAttribute('stroke-width', options.stroke.width);
            if (options.stroke.dash) {
                path.setAttribute('stroke-dasharray', options.stroke.dash.join(' '));
            }
            if (options.stroke.join) {
                path.setAttribute('stroke-linejoin', options.stroke.join);
            }
            if (options.stroke.cap) {
                path.setAttribute('stroke-linecap', options.stroke.cap);
            }
        }

        this.currentGroup.appendChild(path);
    }

    /**
     * Draws text.
     * @param {string} textContent - The text to draw.
     * @param {number} x - The x-coordinate of the text.
     * @param {number} y - The y-coordinate of the text.
     * @param {object} [options] - The rendering options.
     */
    drawText(textContent, x, y, options = {}) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (options.id) {
            text.setAttribute('id', options.id);
        }
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.textContent = textContent;

        if (options.fill) {
            text.setAttribute('fill', options.fill);
        }
        if (options.fontSize) {
            text.setAttribute('font-size', options.fontSize);
        }
        if (options.fontFamily) {
            text.setAttribute('font-family', options.fontFamily);
        }
        if (options.fontWeight) {
            text.setAttribute('font-weight', options.fontWeight);
        }
        if (options.fontStyle) {
            text.setAttribute('font-style', options.fontStyle);
        }
        if (options.textAnchor) {
            text.setAttribute('text-anchor', options.textAnchor);
        }

        this.currentGroup.appendChild(text);
    }

    /**
     * Draws an image.
     * @param {string} href - The URL of the image.
     * @param {number} x - The x-coordinate of the image.
     * @param {number} y - The y-coordinate of the image.
     * @param {number} width - The width of the image.
     * @param {number} height - The height of the image.
     */
    drawImage(href, x, y, width, height) {
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('href', href);
        image.setAttribute('x', x);
        image.setAttribute('y', y);
        image.setAttribute('width', width);
        image.setAttribute('height', height);
        this.currentGroup.appendChild(image);
    }
}
