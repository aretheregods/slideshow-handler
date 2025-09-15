import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import * as drawing from './drawing';

// Mock dependencies
vi.mock('/src/utils/index.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        ColorParser: {
            parseColor: vi.fn(),
            resolveColor: vi.fn(color => color), // Simple pass-through for mock
        },
        resolvePath: vi.fn((base, target) => `${base}/${target}`),
        integerToRoman: vi.fn(num => 'I'.repeat(num)), // Simplified mock
        parseGradientFill: vi.fn(),
    };
});

// Mock constants
vi.mock('constants', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        EMU_PER_PIXEL: 9525, // Keep this override for tests
    };
});

// Mock zipjs
vi.mock('zipjs', () => ({
    BlobWriter: vi.fn(),
}));

describe('drawing.js', () => {
    describe('resolveFontFamily', () => {
        const slideContextWithTheme = {
            theme: {
                fontScheme: {
                    major: 'Times New Roman',
                    minor: 'Verdana',
                },
            },
        };

        const slideContextWithoutTheme = {
            theme: {},
        };

        it('should resolve major font from theme', () => {
            const finalRunProps = { font: '+mj-lt' };
            const result = drawing.resolveFontFamily(finalRunProps, 'title', slideContextWithTheme);
            expect(result).toBe('Times New Roman');
        });

        it('should resolve minor font from theme', () => {
            const finalRunProps = { font: '+mn-lt' };
            const result = drawing.resolveFontFamily(finalRunProps, 'body', slideContextWithTheme);
            expect(result).toBe('Verdana');
        });

        it('should return specific font if provided', () => {
            const finalRunProps = { font: 'Calibri' };
            const result = drawing.resolveFontFamily(finalRunProps, 'body', slideContextWithTheme);
            expect(result).toBe('Calibri');
        });

        it('should fallback to major font for title placeholders', () => {
            const finalRunProps = {};
            expect(drawing.resolveFontFamily(finalRunProps, 'title', slideContextWithTheme)).toBe('Times New Roman');
            expect(drawing.resolveFontFamily(finalRunProps, 'ctrTitle', slideContextWithTheme)).toBe('Times New Roman');
            expect(drawing.resolveFontFamily(finalRunProps, 'subTitle', slideContextWithTheme)).toBe('Times New Roman');
        });

        it('should fallback to minor font for other placeholders', () => {
            const finalRunProps = {};
            const result = drawing.resolveFontFamily(finalRunProps, 'body', slideContextWithTheme);
            expect(result).toBe('Verdana');
        });

        it('should fallback to Arial if theme font is not available for major font', () => {
            const finalRunProps = { font: '+mj-lt' };
            const result = drawing.resolveFontFamily(finalRunProps, 'title', slideContextWithoutTheme);
            expect(result).toBe('Arial');
        });

        it('should fallback to Arial if theme font is not available for minor font', () => {
            const finalRunProps = { font: '+mn-lt' };
            const result = drawing.resolveFontFamily(finalRunProps, 'body', slideContextWithoutTheme);
            expect(result).toBe('Arial');
        });

        it('should fallback to Arial for title placeholder if theme is missing', () => {
            const finalRunProps = {};
            const result = drawing.resolveFontFamily(finalRunProps, 'title', slideContextWithoutTheme);
            expect(result).toBe('Arial');
        });

        it('should fallback to Arial for body placeholder if theme is missing', () => {
            const finalRunProps = {};
            const result = drawing.resolveFontFamily(finalRunProps, 'body', slideContextWithoutTheme);
            expect(result).toBe('Arial');
        });
    });

    describe('getAutoNumberingChar', () => {
        it('should generate correct string for various schemes', () => {
            expect(drawing.getAutoNumberingChar('alphaLcParenBoth', 1)).toBe('(a)');
            expect(drawing.getAutoNumberingChar('alphaLcParenR', 2)).toBe('b)');
            expect(drawing.getAutoNumberingChar('alphaLcPeriod', 3)).toBe('c.');
            expect(drawing.getAutoNumberingChar('alphaUcParenBoth', 1)).toBe('(A)');
            expect(drawing.getAutoNumberingChar('alphaUcParenR', 2)).toBe('B)');
            expect(drawing.getAutoNumberingChar('alphaUcPeriod', 3)).toBe('C.');
            expect(drawing.getAutoNumberingChar('arabicParenBoth', 1)).toBe('(1)');
            expect(drawing.getAutoNumberingChar('arabicParenR', 2)).toBe('2)');
            expect(drawing.getAutoNumberingChar('arabicPeriod', 3)).toBe('3.');
            expect(drawing.getAutoNumberingChar('arabicPlain', 4)).toBe('4');
            expect(drawing.getAutoNumberingChar('romanLcParenBoth', 1)).toBe('(i)');
            expect(drawing.getAutoNumberingChar('romanLcParenR', 2)).toBe('ii)');
            expect(drawing.getAutoNumberingChar('romanLcPeriod', 3)).toBe('iii.');
            expect(drawing.getAutoNumberingChar('romanUcParenBoth', 1)).toBe('(I)');
            expect(drawing.getAutoNumberingChar('romanUcParenR', 2)).toBe('II)');
            expect(drawing.getAutoNumberingChar('romanUcPeriod', 3)).toBe('III.');
        });

        it('should default to arabicPeriod for unknown schemes', () => {
            expect(drawing.getAutoNumberingChar('unknownScheme', 5)).toBe('5.');
        });

        it('should handle different numbers', () => {
            expect(drawing.getAutoNumberingChar('arabicPeriod', 10)).toBe('10.');
            expect(drawing.getAutoNumberingChar('alphaLcPeriod', 26)).toBe('z.');
        });
    });

    describe('createImage', () => {
        let mockImage;

        beforeEach(() => {
            mockImage = {
                onload: () => {},
                onerror: () => {},
                src: '',
            };
            vi.stubGlobal('Image', vi.fn(() => mockImage));
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should resolve with the image on load', async () => {
            const promise = drawing.createImage('test.png');
            mockImage.onload(); // Trigger load
            const image = await promise;
            expect(image).toBe(mockImage);
            expect(Image).toHaveBeenCalledTimes(1);
            expect(mockImage.src).toBe('test.png');
        });

        it('should reject with an error on error', async () => {
            const promise = drawing.createImage('test.png');
            const mockError = new Error('Failed to load');
            mockImage.onerror(mockError); // Trigger error
            await expect(promise).rejects.toBe(mockError);
            expect(Image).toHaveBeenCalledTimes(1);
        });
    });

    describe('populateImageMap', () => {
        let mockFileReader;

        beforeEach(() => {
            mockFileReader = {
                readAsDataURL: vi.fn(function() {
                    this.onloadend();
                }),
                result: 'data:image/png;base64,mock-image-data',
                onloadend: null,
                onerror: null,
            };
            vi.stubGlobal('FileReader', vi.fn(() => mockFileReader));
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.unstubAllGlobals();
            vi.clearAllMocks();
        });

        it('should populate image map from image relationships', async () => {
            const imageMap = {};
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
                'rId2': { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: 'slides/slide1.xml' },
            };
            const mockBlob = new Blob(['image data'], { type: 'image/png' });
            const entriesMap = new Map([
                ['ppt/media/image1.png', { getData: vi.fn().mockResolvedValue(mockBlob) }],
            ]);

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap).toHaveProperty('rId1');
            expect(imageMap['rId1']).toBe('data:image/png;base64,mock-image-data');
            expect(imageMap).not.toHaveProperty('rId2');
            expect(entriesMap.get('ppt/media/image1.png').getData).toHaveBeenCalled();
            expect(FileReader).toHaveBeenCalledTimes(1);
        });

        it('should not overwrite existing images in the map', async () => {
            const imageMap = { 'rId1': 'existing-image-data' };
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
            };
            const entriesMap = new Map();

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap['rId1']).toBe('existing-image-data');
        });

        it('should warn if an image entry is not found', async () => {
            const imageMap = {};
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
            };
            const entriesMap = new Map(); // Empty map

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap).not.toHaveProperty('rId1');
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("non-existent target"));
        });

        it('should handle errors when reading image data', async () => {
            const imageMap = {};
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
            };
            const entriesMap = new Map([
                ['ppt/media/image1.png', { getData: vi.fn().mockRejectedValue(new Error('Read error')) }],
            ]);

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap).not.toHaveProperty('rId1');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to load image data"), expect.any(Error));
        });
    });


    describe('getCellTextStyle', () => {
        const createMockElement = (config = {}) => {
            const { name = '', attributes = {}, children = {} } = config;
            return {
                getAttribute: (attr) => attributes[attr],
            };
        };

        it('should return an empty object if no table style is provided', () => {
            const tblPrNode = createMockElement();
            const style = drawing.getCellTextStyle(tblPrNode, 0, 0, 1, 1, null);
            expect(style).toEqual({});
        });

        it('should return the base text style from wholeTbl', () => {
            const tblPrNode = createMockElement();
            const tableStyle = {
                wholeTbl: { tcTxStyle: { color: 'red', bold: true } }
            };
            const style = drawing.getCellTextStyle(tblPrNode, 0, 0, 2, 2, tableStyle);
            expect(style).toEqual({ color: 'red', bold: true });
        });

        it('should merge conditional styles over the base style', () => {
            const tblPrNode = createMockElement({ attributes: { firstRow: '1' } });
            const tableStyle = {
                wholeTbl: { tcTxStyle: { color: 'red', bold: true } },
                firstRow: { tcTxStyle: { color: 'blue', italic: true } }
            };
            const style = drawing.getCellTextStyle(tblPrNode, 0, 0, 2, 2, tableStyle);
            expect(style).toEqual({ color: 'blue', bold: true, italic: true });
        });

        it('should apply multiple conditional styles with correct precedence', () => {
            // nwCell should override firstRow and firstCol
            const tblPrNode = createMockElement({ attributes: { firstRow: '1', firstCol: '1' } });
            const tableStyle = {
                wholeTbl: { tcTxStyle: { fontSize: 12 } },
                firstRow: { tcTxStyle: { bold: true } },
                firstCol: { tcTxStyle: { italic: true } },
                nwCell: { tcTxStyle: { color: 'green' } }
            };
            const style = drawing.getCellTextStyle(tblPrNode, 0, 0, 3, 3, tableStyle);
            expect(style).toEqual({ fontSize: 12, bold: true, italic: true, color: 'green' });
        });
    });

    describe('buildPathStringFromGeom', () => {
        it('should return null for invalid input', () => {
            expect(drawing.buildPathStringFromGeom(null, {})).toBeNull();
            expect(drawing.buildPathStringFromGeom({}, null)).toBeNull();
        });

        it('should return null for non-custom geometry', () => {
            const geometry = { type: 'preset', preset: 'rect' };
            const pos = { width: 100, height: 100 };
            expect(drawing.buildPathStringFromGeom(geometry, pos)).toBeNull();
        });

        it('should build a path string for custom geometry', () => {
            const geometry = {
                type: 'custom',
                path: {
                    w: 200,
                    h: 100,
                    commands: [
                        { cmd: 'moveTo', points: [{ x: 10, y: 10 }] },
                        { cmd: 'lnTo', points: [{ x: 190, y: 10 }] },
                        { cmd: 'cubicBezTo', points: [{ x: 195, y: 10 }, { x: 200, y: 15 }, { x: 200, y: 20 }] },
                        { cmd: 'close', points: [] }
                    ]
                }
            };
            const pos = { width: 400, height: 200 }; // Scale up by 2x
            const expectedPath = 'M 20 20 L 380 20 C 390 20 400 30 400 40 Z ';
            const path = drawing.buildPathStringFromGeom(geometry, pos);
            expect(path).toBe(expectedPath);
        });
    });

    describe.skip('calculateTextBlockSize', () => {
        it('is not tested due to dependency issues', () => {
            // This function is skipped because it has a direct dependency on `layoutParagraphs`,
            // a method from the `SlideHandler` class, creating a complex and possibly circular
            // dependency that makes it difficult to test in isolation without refactoring the source code.
            // The function also appears to be unused in the codebase.
            expect(true).toBe(true);
        });
    });
});
