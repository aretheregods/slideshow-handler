import { DML_NS } from '../constants.js';

/**
 * @class ColorParser
 * @description A utility class for parsing and manipulating colors.
 */
export class ColorParser {
    /**
     * Converts a hex color string to an RGB object.
     * @param {string} hex - The hex color string.
     * @returns {{r: number, g: number, b: number}|null} The RGB object, or null if the hex is invalid.
     */
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Converts an RGB color to a hex string.
     * @param {number} r - The red component.
     * @param {number} g - The green component.
     * @param {number} b - The blue component.
     * @returns {string} The hex color string.
     */
    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1).toUpperCase();
    }

    /**
     * Applies a tint to a hex color.
     * @param {string} hex - The hex color string.
     * @param {number} tint - The tint value (0-100000).
     * @returns {string} The tinted hex color string.
     */
    static applyTint(hex, tint) {
        const base = ColorParser.hexToRgb(hex);
        if (!base) return hex;
        const amount = tint / 100000; // Tint is provided as e.g. 80000 for 80%
        const r = base.r * (1 - amount) + 255 * amount;
        const g = base.g * (1 - amount) + 255 * amount;
        const b = base.b * (1 - amount) + 255 * amount;
        return ColorParser.rgbToHex(r, g, b);
    }

    /**
     * Applies a shade to a hex color.
     * @param {string} hex - The hex color string.
     * @param {number} shade - The shade value (0-100000).
     * @returns {string} The shaded hex color string.
     */
    static applyShade(hex, shade) {
        const base = ColorParser.hexToRgb(hex);
        if (!base) return hex;
        const amount = shade / 100000; // Shade is provided as e.g. 80000 for 80%
        const r = base.r * (1 - amount);
        const g = base.g * (1 - amount);
        const b = base.b * (1 - amount);
        return ColorParser.rgbToHex(r, g, b);
    }

    /**
     * Converts an RGB color to HSL.
     * @param {number} r - The red component.
     * @param {number} g - The green component.
     * @param {number} b - The blue component.
     * @returns {{h: number, s: number, l: number}} The HSL object.
     */
    static rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h, s, l };
    }

    /**
     * Converts an HSL color to RGB.
     * @param {number} h - The hue component.
     * @param {number} s - The saturation component.
     * @param {number} l - The lightness component.
     * @returns {{r: number, g: number, b: number}} The RGB object.
     */
    static hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    /**
     * Applies luminance modifications to a hex color.
     * @param {string} hex - The hex color string.
     * @param {number} lumMod - The luminance modification factor.
     * @param {number} lumOff - The luminance offset factor.
     * @returns {string} The modified hex color string.
     */
    static applyLuminance(hex, lumMod, lumOff) {
        const rgb = ColorParser.hexToRgb(hex);
        if (!rgb) return hex;

        const hsl = ColorParser.rgbToHsl(rgb.r, rgb.g, rgb.b);
        let newL = hsl.l;

        if (lumMod) {
            newL *= (lumMod / 100000);
        }
        if (lumOff) {
            newL += (lumOff / 100000);
        }

        // Clamp luminance to the valid range [0, 1]
        newL = Math.max(0, Math.min(1, newL));

        const newRgb = ColorParser.hslToRgb(hsl.h, hsl.s, newL);
        return ColorParser.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    }

    /**
     * Applies saturation modification to a hex color.
     * @param {string} hex - The hex color string.
     * @param {number} satMod - The saturation modification factor.
     * @returns {string} The modified hex color string.
     */
    static applySaturation(hex, satMod) {
        const rgb = ColorParser.hexToRgb(hex);
        if (!rgb) return hex;

        const hsl = ColorParser.rgbToHsl(rgb.r, rgb.g, rgb.b);
        let newS = hsl.s;

        if (satMod) {
            newS *= (satMod / 100000);
        }

        // Clamp saturation to the valid range [0, 1]
        newS = Math.max(0, Math.min(1, newS));

        const newRgb = ColorParser.hslToRgb(hsl.h, newS, hsl.l);
        return ColorParser.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    }

    /**
     * Parses a color from a color node.
     * @param {Element} colorNode - The XML node containing the color data.
     * @returns {Object|null} The parsed color object, or null if invalid.
     */
    static parseColor(colorNode) {
        if (!colorNode) return null;

        const srgbClrNode = colorNode.getElementsByTagNameNS(DML_NS, 'srgbClr')[0];
        if (srgbClrNode) {
            const color = { srgb: `#${srgbClrNode.getAttribute('val')}` };
            const alphaNode = srgbClrNode.getElementsByTagNameNS(DML_NS, 'alpha')[0];
            if (alphaNode) color.alpha = parseInt(alphaNode.getAttribute('val'));
            return color;
        }

        const schemeClrNode = colorNode.getElementsByTagNameNS(DML_NS, 'schemeClr')[0];
        if (schemeClrNode) {
            const color = { scheme: schemeClrNode.getAttribute('val') };
            const tintNode = schemeClrNode.getElementsByTagNameNS(DML_NS, 'tint')[0];
            if (tintNode) color.tint = parseInt(tintNode.getAttribute('val'));

            const shadeNode = schemeClrNode.getElementsByTagNameNS(DML_NS, 'shade')[0];
            if (shadeNode) color.shade = parseInt(shadeNode.getAttribute('val'));

            const alphaNode = schemeClrNode.getElementsByTagNameNS(DML_NS, 'alpha')[0];
            if (alphaNode) color.alpha = parseInt(alphaNode.getAttribute('val'));

            const lumModNode = schemeClrNode.getElementsByTagNameNS(DML_NS, 'lumMod')[0];
            if (lumModNode) color.lumMod = parseInt(lumModNode.getAttribute('val'));

            const lumOffNode = schemeClrNode.getElementsByTagNameNS(DML_NS, 'lumOff')[0];
            if (lumOffNode) color.lumOff = parseInt(lumOffNode.getAttribute('val'));

            const satModNode = schemeClrNode.getElementsByTagNameNS(DML_NS, 'satMod')[0];
            if (satModNode) color.satMod = parseInt(satModNode.getAttribute('val'));

            return color;
        }

        const prstClrNode = colorNode.getElementsByTagNameNS(DML_NS, 'prstClr')[0];
        if (prstClrNode) {
            const color = { prst: prstClrNode.getAttribute('val') };
            // Preset colors can also have transformations, although it's less common.
            // You can add more parsing here if needed for things like tint, shade on preset colors.
            return color;
        }

        return null;
    }

    /**
     * Resolves a color object to a final color value (hex or rgba).
     * @param {Object} colorObj - The color object to resolve.
     * @param {Object} slideContext - The context of the slide.
     * @param {boolean} [returnObject=false] - Whether to return a color object instead of a string.
     * @returns {string|Object|null} The resolved color string or object, or null if the color cannot be resolved.
     */
    static resolveColor(colorObj, slideContext, returnObject = false) {
        if (!colorObj || !slideContext.theme) {
            return null;
        }

        const PRESET_COLORS = {
            'white': '#FFFFFF',
            'black': '#000000',
            // Add other preset colors as needed
        };

        let hex;
        if (colorObj.srgb) {
            hex = colorObj.srgb;
        } else if (colorObj.scheme) {
            let themeColorName = slideContext.colorMap[colorObj.scheme] || colorObj.scheme;
            if (themeColorName === 'phClr') {
                // phClr is context-dependent. For a robust default, we'll map it
                // to a visible accent color like accent1.
                themeColorName = 'accent1';
            }
            if (themeColorName && slideContext.theme.colorScheme[themeColorName]) {
                hex = slideContext.theme.colorScheme[themeColorName];
                if (colorObj.tint) hex = ColorParser.applyTint(hex, colorObj.tint);
                if (colorObj.shade) hex = ColorParser.applyShade(hex, colorObj.shade);
                if (colorObj.lumMod || colorObj.lumOff) hex = ColorParser.applyLuminance(hex, colorObj.lumMod, colorObj.lumOff);
                if (colorObj.satMod) hex = ColorParser.applySaturation(hex, colorObj.satMod);
            }
        } else if (colorObj.prst) {
            hex = PRESET_COLORS[colorObj.prst] || null;
        }

        if (hex) {
            const alpha = colorObj.alpha !== undefined ? colorObj.alpha / 100000 : 1.0;
            if (returnObject) {
                return { color: hex, alpha: alpha };
            }

            if (alpha < 1.0) {
                const rgb = ColorParser.hexToRgb(hex);
                if (rgb) {
                    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
                }
            }
            return hex;
        }

        return null; // Return null if color can't be resolved
    }
}
