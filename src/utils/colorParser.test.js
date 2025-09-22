import { describe, it, expect } from 'vitest';
import { ColorParser } from './colorParser.js';

describe('ColorParser', () => {
  describe('hexToRgb', () => {
    it('should convert a hex color to an RGB object', () => {
      expect(ColorParser.hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(ColorParser.hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(ColorParser.hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle hex colors without a hash', () => {
      expect(ColorParser.hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return null for invalid hex colors', () => {
      expect(ColorParser.hexToRgb('invalid')).toBeNull();
      expect(ColorParser.hexToRgb('#12345')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('should convert an RGB object to a hex color string', () => {
      expect(ColorParser.rgbToHex(255, 255, 255)).toBe('#FFFFFF');
      expect(ColorParser.rgbToHex(0, 0, 0)).toBe('#000000');
      expect(ColorParser.rgbToHex(255, 0, 0)).toBe('#FF0000');
    });
  });

  describe('applyTint', () => {
    it('should apply a tint to a hex color', () => {
      // Tinting red (#FF0000) by 50% should give #FF8080
      expect(ColorParser.applyTint('#FF0000', 50000)).toBe('#FF8080');
    });
  });

  describe('applyShade', () => {
    it('should apply a shade to a hex color', () => {
      // Shading white (#FFFFFF) by 50% should give #808080
      expect(ColorParser.applyShade('#FFFFFF', 50000)).toBe('#808080');
    });
  });

  describe('resolveColor', () => {
    const mockSlideContext = {
      theme: {
        colorScheme: {
          accent1: '#ff0000',
          tx1: '#000000',
          bg1: '#ffffff',
        },
      },
      colorMap: {
        'accent1': 'accent1',
        'tx1': 'tx1',
        'bg1': 'bg1',
      },
    };

    it('should resolve a scheme color', () => {
      const colorObj = { scheme: 'accent1' };
      expect(ColorParser.resolveColor(colorObj, mockSlideContext)).toBe('#ff0000');
    });

    it('should resolve a literal srgb color', () => {
      const colorObj = { srgb: '#00ff00' };
      expect(ColorParser.resolveColor(colorObj, mockSlideContext)).toBe('#00ff00');
    });

    it('should apply a tint to a scheme color', () => {
      const colorObj = { scheme: 'accent1', tint: 50000 }; // 50% tint
      expect(ColorParser.resolveColor(colorObj, mockSlideContext)).toBe('#FF8080');
    });

    it('should apply a shade to a scheme color', () => {
      const colorObj = { scheme: 'bg1', shade: 50000 }; // 50% shade
      expect(ColorParser.resolveColor(colorObj, mockSlideContext)).toBe('#808080');
    });

    it('should handle alpha transparency', () => {
        const colorObj = { srgb: '#ff0000', alpha: 50000 }; // 50% alpha
        expect(ColorParser.resolveColor(colorObj, mockSlideContext)).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('should apply luminance modifications to a scheme color', () => {
        const colorObj = { scheme: 'accent1', lumMod: 20000, lumOff: 80000 }; // lumMod 20%, lumOff 80%
        expect(ColorParser.resolveColor(colorObj, mockSlideContext)).toBe('#FFCCCC');
    });
  });

  describe('parseColor', () => {
    const createMockElement = (config = {}) => {
        const { name = '', attributes = {}, children = {} } = config;
        const element = {
            localName: name,
            getAttribute: (attr) => attributes[attr],
            getElementsByTagNameNS: (ns, tagName) => {
                return children[tagName] ? children[tagName].map(createMockElement) : [];
            },
        };
        return element;
    };

    it('should parse an srgbClr node', () => {
        const colorNode = createMockElement({
            name: 'solidFill',
            children: {
                'srgbClr': [{ name: 'srgbClr', attributes: { val: 'FF0000' } }]
            }
        });
        const expected = { srgb: '#FF0000' };
        expect(ColorParser.parseColor(colorNode)).toEqual(expected);
    });

    it('should parse an srgbClr node with alpha', () => {
        const colorNode = createMockElement({
            name: 'solidFill',
            children: {
                'srgbClr': [{
                    name: 'srgbClr',
                    attributes: { val: '00FF00' },
                    children: { 'alpha': [{ name: 'alpha', attributes: { val: '50000' } }] }
                }]
            }
        });
        const expected = { srgb: '#00FF00', alpha: 50000 };
        expect(ColorParser.parseColor(colorNode)).toEqual(expected);
    });

    it('should parse a schemeClr node', () => {
        const colorNode = createMockElement({
            name: 'solidFill',
            children: {
                'schemeClr': [{ name: 'schemeClr', attributes: { val: 'accent2' } }]
            }
        });
        const expected = { scheme: 'accent2' };
        expect(ColorParser.parseColor(colorNode)).toEqual(expected);
    });

    it('should parse a schemeClr node with tint and shade', () => {
        const colorNode = createMockElement({
            name: 'solidFill',
            children: {
                'schemeClr': [{
                    name: 'schemeClr',
                    attributes: { val: 'tx1' },
                    children: {
                        'tint': [{ name: 'tint', attributes: { val: '80000' } }],
                        'shade': [{ name: 'shade', attributes: { val: '20000' } }]
                    }
                }]
            }
        });
        const expected = { scheme: 'tx1', tint: 80000, shade: 20000 };
        expect(ColorParser.parseColor(colorNode)).toEqual(expected);
    });

    it('should return null for invalid nodes', () => {
        expect(ColorParser.parseColor(null)).toBeNull();
        expect(ColorParser.parseColor(undefined)).toBeNull();
        const emptyNode = createMockElement({ name: 'solidFill' });
        expect(ColorParser.parseColor(emptyNode)).toBeNull();
    });
  });
});
