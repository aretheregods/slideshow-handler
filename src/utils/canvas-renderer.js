/**
 * @class CanvasRenderer
 * @classdesc A class for rendering shapes on a canvas using the native Canvas API.
 */
export class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement} canvas - The canvas element to render on.
     * @param {object} slideContext - The context of the slide being rendered.
     */
    constructor(canvas, slideContext) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.slideContext = slideContext;
    }

    applyEffects(options) {
        if (options && options.effect) {
            if (options.effect.type === 'outerShdw') {
                const effect = options.effect;
                this.ctx.shadowColor = effect.color;
                this.ctx.shadowBlur = effect.blurRad;
                this.ctx.shadowOffsetX = effect.dist * Math.cos(effect.dir * Math.PI / 180);
                this.ctx.shadowOffsetY = effect.dist * Math.sin(effect.dir * Math.PI / 180);
            }
        }
    }

    resetEffects() {
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }

    /**
     * Clears the canvas.
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Sets the transformation matrix for the canvas context.
     * @param {Matrix} matrix - The transformation matrix.
     */
    setTransform(matrix) {
        this.ctx.setTransform(matrix.m[0], matrix.m[1], matrix.m[2], matrix.m[3], matrix.m[4], matrix.m[5]);
    }

    /**
     * Draws a rectangle.
     * @param {number} x - The x-coordinate of the rectangle.
     * @param {number} y - The y-coordinate of the rectangle.
     * @param {number} width - The width of the rectangle.
     * @param {number} height - The height of the rectangle.
     * @param {object} [options] - The rendering options.
     * @param {string} [options.fill] - The fill color.
     * @param {object} [options.stroke] - The stroke properties.
     * @param {string} [options.stroke.color] - The stroke color.
     * @param {number} [options.stroke.width] - The stroke width.
     */
    drawRect(x, y, width, height, options = {}) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);

        this.applyEffects(options);

        if (options.fill) {
            this.ctx.fillStyle = options.fill;
            this.ctx.fill();
        }

        if (options.stroke) {
            this.ctx.strokeStyle = options.stroke.color;
            this.ctx.lineWidth = options.stroke.width;
            if (options.stroke.dash) {
                this.ctx.setLineDash(options.stroke.dash);
            }
            if (options.stroke.join) {
                this.ctx.lineJoin = options.stroke.join;
            }
            if (options.stroke.cap) {
                this.ctx.lineCap = options.stroke.cap;
            }
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Reset line dash
        }

        this.resetEffects();
    }

    /**
     * Draws an ellipse.
     * @param {number} x - The x-coordinate of the center of the ellipse.
     * @param {number} y - The y-coordinate of the center of the ellipse.
     * @param {number} radiusX - The horizontal radius of the ellipse.
     * @param {number} radiusY - The vertical radius of the ellipse.
     * @param {object} [options] - The rendering options.
     * @param {string} [options.fill] - The fill color.
     * @param {object} [options.stroke] - The stroke properties.
     * @param {string} [options.stroke.color] - The stroke color.
     * @param {number} [options.stroke.width] - The stroke width.
     */
    drawEllipse(x, y, radiusX, radiusY, options = {}) {
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, radiusX, radiusY, 0, 0, 2 * Math.PI);

        this.applyEffects(options);

        if (options.fill) {
            this.ctx.fillStyle = options.fill;
            this.ctx.fill();
        }

        if (options.stroke) {
            this.ctx.strokeStyle = options.stroke.color;
            this.ctx.lineWidth = options.stroke.width;
            if (options.stroke.dash) {
                this.ctx.setLineDash(options.stroke.dash);
            }
            if (options.stroke.join) {
                this.ctx.lineJoin = options.stroke.join;
            }
            if (options.stroke.cap) {
                this.ctx.lineCap = options.stroke.cap;
            }
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Reset line dash
        }

        this.resetEffects();
    }

    /**
     * Draws a line.
     * @param {number} x1 - The x-coordinate of the starting point.
     * @param {number} y1 - The y-coordinate of the starting point.
     * @param {number} x2 - The x-coordinate of the ending point.
     * @param {number} y2 - The y-coordinate of the ending point.
     * @param {object} [options] - The rendering options.
     * @param {string} [options.stroke.color] - The stroke color.
     * @param {number} [options.stroke.width] - The stroke width.
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

        const originalLineWidth = this.ctx.lineWidth;
        const originalLineDash = this.ctx.getLineDash();
        this.ctx.setLineDash([]);

        const drawParallelLine = (offset, width) => {
            const offsetX = nx * offset;
            const offsetY = ny * offset;
            this.ctx.lineWidth = width;
            this.ctx.beginPath();
            this.ctx.moveTo(x1 + offsetX, y1 + offsetY);
            this.ctx.lineTo(x2 + offsetX, y2 + offsetY);
            this.ctx.stroke();
        };

        switch (stroke.cmpd) {
            case 'dbl': {
                const w = totalWidth * 3 / 8;
                const s = totalWidth * 2 / 8;
                const offset = (w + s) / 2;
                drawParallelLine(-offset, w);
                drawParallelLine(offset, w);
                break;
            }
            case 'thickThin': {
                const w1 = totalWidth * 3 / 4;
                const w2 = totalWidth * 1 / 4;
                const offset1 = -totalWidth / 2 + w1 / 2;
                const offset2 = totalWidth / 2 - w2 / 2;
                drawParallelLine(offset1, w1);
                drawParallelLine(offset2, w2);
                break;
            }
            case 'thinThick': {
                const w1 = totalWidth * 1 / 4;
                const w2 = totalWidth * 3 / 4;
                const offset1 = -totalWidth / 2 + w1 / 2;
                const offset2 = totalWidth / 2 - w2 / 2;
                drawParallelLine(offset1, w1);
                drawParallelLine(offset2, w2);
                break;
            }
            case 'tri': {
                const w = totalWidth / 5;
                const s = totalWidth / 5;
                const offset = w + s;
                drawParallelLine(-offset, w);
                drawParallelLine(0, w);
                drawParallelLine(offset, w);
                break;
            }
            default:
                this.ctx.lineWidth = totalWidth;
                if (stroke.dash) {
                    this.ctx.setLineDash(stroke.dash);
                }
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
                break;
        }

        this.ctx.lineWidth = originalLineWidth;
        this.ctx.setLineDash(originalLineDash);
    }

    drawLine(x1, y1, x2, y2, options = {}) {
        this.applyEffects(options);

        if (options.stroke && options.stroke.width > 0) {
            this.ctx.strokeStyle = options.stroke.color;
            this.ctx.lineCap = options.stroke.cap || 'butt';

            if (options.stroke.cmpd && options.stroke.cmpd !== 'sng') {
                this._drawCompoundLine(x1, y1, x2, y2, options);
            } else {
                this.ctx.lineWidth = options.stroke.width;
                if (options.stroke.dash) {
                    this.ctx.setLineDash(options.stroke.dash);
                }
                if (options.stroke.join) {
                    this.ctx.lineJoin = options.stroke.join;
                }
                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            }

            this.ctx.setLineDash([]); // Reset line dash
        }

        this.resetEffects();
    }

    /**
     * Draws a path.
     * @param {string} pathData - The SVG path data.
     * @param {object} [options] - The rendering options.
     * @param {string} [options.fill] - The fill color.
     * @param {object} [options.stroke] - The stroke properties.
     * @param {string} [options.stroke.color] - The stroke color.
     * @param {number} [options.stroke.width] - The stroke width.
     */
    drawPath(pathData, options = {}) {
        // TODO: Handle compound lines for paths, which is more complex than straight lines.
        const path = new Path2D(pathData);

        this.applyEffects(options);

        if (options.fill) {
            this.ctx.fillStyle = options.fill;
            this.ctx.fill(path);
        }

        if (options.stroke) {
            this.ctx.strokeStyle = options.stroke.color;
            this.ctx.lineWidth = options.stroke.width;
            if (options.stroke.dash) {
                this.ctx.setLineDash(options.stroke.dash);
            }
            if (options.stroke.join) {
                this.ctx.lineJoin = options.stroke.join;
            }
            if (options.stroke.cap) {
                this.ctx.lineCap = options.stroke.cap;
            }
            this.ctx.stroke(path);
            this.ctx.setLineDash([]); // Reset line dash
        }

        this.resetEffects();
    }
}
