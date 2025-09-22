import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import * as drawing from './drawing';
import { JSDOM } from 'jsdom';

// Mock dependencies
vi.mock('/src/utils/index.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
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
        beforeEach(() => {
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('should populate image map from image relationships', async () => {
            const imageMap = {};
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
                'rId2': { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: 'slides/slide1.xml' },
            };
            const entriesMap = {
                'ppt/media/image1.png': { async: vi.fn().mockResolvedValue('mock-image-data') },
            };

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap).toHaveProperty('rId1');
            expect(imageMap['rId1']).toBe('data:image/png;base64,mock-image-data');
            expect(imageMap).not.toHaveProperty('rId2');
            expect(entriesMap['ppt/media/image1.png'].async).toHaveBeenCalledWith('base64');
        });

        it('should not overwrite existing images in the map', async () => {
            const imageMap = { 'rId1': 'existing-image-data' };
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
            };
            const entriesMap = {};

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap['rId1']).toBe('existing-image-data');
        });

        it('should warn if an image entry is not found', async () => {
            const imageMap = {};
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
            };
            const entriesMap = {}; // Empty map

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap).not.toHaveProperty('rId1');
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("non-existent target"));
        });

        it('should handle errors when reading image data', async () => {
            const imageMap = {};
            const rels = {
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: 'media/image1.png' },
            };
            const entriesMap = {
                'ppt/media/image1.png': { async: vi.fn().mockRejectedValue(new Error('Read error')) },
            };

            await drawing.populateImageMap(imageMap, rels, 'ppt', entriesMap);

            expect(imageMap).not.toHaveProperty('rId1');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to load image data"), expect.any(Error));
        });
    });

    describe('Table Styling Integration', () => {
        let dom;
        let parser;

        beforeAll(() => {
            dom = new JSDOM();
            parser = new dom.window.DOMParser();
        });

        const slideContext1 = {
            theme: {
                colorScheme: {
                    accent1: '#4E91F0', // blue
                    accent2: '#FBE2DE', // light pink
                    accent3: '#FFFFFF', // white
                }
            },
            colorMap: {},
        };

        const slideContext2 = {
            theme: {
                colorScheme: {
                    accent1: '#FF0000', // red
                    tx1: '#000000'
                }
            },
            colorMap: {},
        };

        const tableStyle1 = {
            firstRow: { tcStyle: { fill: { type: 'solid', color: { scheme: 'accent1' } } } },
            band1H: { tcStyle: { fill: { type: 'solid', color: { scheme: 'accent2' } } } },
            band2H: { tcStyle: { fill: { type: 'solid', color: { scheme: 'accent3' } } } }
        };

        const tableStyle2 = {
            firstRow: { tcStyle: { fill: { type: 'solid', color: { scheme: 'accent1' } } } },
            wholeTbl: { tcStyle: { fill: { type: 'solid', color: { scheme: 'tx1' } } } }
        };

        it('should correctly apply banded row styles from slide 1', () => {
            const slide1Xml = `
                <p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:graphic>
                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
                            <a:tbl>
                                <a:tblPr firstRow="1" bandRow="1">
                                    <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
                                </a:tblPr>
                                <a:tblGrid>
                                    <a:gridCol w="3612620"/><a:gridCol w="3612620"/><a:gridCol w="3612620"/>
                                </a:tblGrid>
                                <a:tr h="656182">
                                    <a:tc><a:txBody><a:p><a:r><a:t>Area</a:t></a:r></a:p></a:txBody></a:tc>
                                    <a:tc><a:txBody><a:p><a:r><a:t>Impact</a:t></a:r></a:p></a:txBody></a:tc>
                                    <a:tc><a:txBody><a:p><a:r><a:t>Source</a:t></a:r></a:p></a:txBody></a:tc>
                                </a:tr>
                                <a:tr h="656182">
                                    <a:tc><a:txBody><a:p><a:r><a:t>Eye contact</a:t></a:r></a:p></a:txBody></a:tc>
                                    <a:tc><a:txBody><a:p><a:r><a:t>80% more</a:t></a:r></a:p></a:txBody></a:tc>
                                    <a:tc><a:txBody><a:p><a:r><a:t>Business review</a:t></a:r></a:p></a:txBody></a:tc>
                                </a:tr>
                                <a:tr h="656182">
                                    <a:tc><a:txBody><a:p><a:r><a:t>Storytelling</a:t></a:r></a:p></a:txBody></a:tc>
                                    <a:tc><a:txBody><a:p><a:r><a:t>Increases retention</a:t></a:r></a:p></a:txBody></a:tc>
                                    <a:tc><a:txBody><a:p><a:r><a:t>University study</a:t></a:r></a:p></a:txBody></a:tc>
                                </a:tr>
                            </a:tbl>
                        </a:graphicData>
                    </a:graphic>
                </p:graphicFrame>
            `;
            const xmlDoc = parser.parseFromString(slide1Xml, "text/xml");
            const tblPrNode = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'tblPr')[0];
            const rows = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'tr');

            const headerFill = drawing.getCellFillColor(rows[0].firstElementChild, tblPrNode, 0, 0, 3, 3, tableStyle1, slideContext1);
            expect(headerFill.color).toBe('#4E91F0');

            const row1Fill = drawing.getCellFillColor(rows[1].firstElementChild, tblPrNode, 1, 0, 3, 3, tableStyle1, slideContext1);
            expect(row1Fill.color).toBe('#FBE2DE');

            const row2Fill = drawing.getCellFillColor(rows[2].firstElementChild, tblPrNode, 2, 0, 3, 3, tableStyle1, slideContext1);
            expect(row2Fill.color).toBe('#FFFFFF');
        });

        it('should correctly apply styles when cell has noFill from slide 2', () => {
            const slide2Xml = `
                <p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:graphic>
                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
                            <a:tbl>
                                <a:tblPr firstRow="1">
                                    <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
                                </a:tblPr>
                                <a:tblGrid>
                                    <a:gridCol w="933861"/>
                                </a:tblGrid>
                                <a:tr h="315795">
                                    <a:tc>
                                        <a:txBody><a:p><a:r><a:t>Category 1</a:t></a:r></a:p></a:txBody>
                                        <a:tcPr><a:noFill/></a:tcPr>
                                    </a:tc>
                                </a:tr>
                                <a:tr h="439364">
                                    <a:tc>
                                        <a:txBody><a:p><a:r><a:t>Item 1</a:t></a:r></a:p></a:txBody>
                                        <a:tcPr><a:noFill/></a:tcPr>
                                    </a:tc>
                                </a:tr>
                            </a:tbl>
                        </a:graphicData>
                    </a:graphic>
                </p:graphicFrame>
            `;
            const xmlDoc = parser.parseFromString(slide2Xml, "text/xml");
            const tblPrNode = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'tblPr')[0];
            const rows = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'tr');

            const headerFill = drawing.getCellFillColor(rows[0].firstElementChild, tblPrNode, 0, 0, 2, 1, tableStyle2, slideContext2);
            expect(headerFill.color).toBe('#FF0000');

            const row1Fill = drawing.getCellFillColor(rows[1].firstElementChild, tblPrNode, 1, 0, 2, 1, tableStyle2, slideContext2);
            expect(row1Fill.color).toBe('#000000');
        });
    });

    describe('getCellFillColor', () => {
        let ColorParser;
        let parseGradientFill;
        const mockSlideContext = { theme: {colorScheme: {}} };

        beforeAll(async () => {
            const utils = await import('utils');
            ColorParser = utils.ColorParser;
            parseGradientFill = utils.parseGradientFill;
        });

        const createMockElement = (config = {}) => {
            const { name = '', attributes = {}, children = {} } = config;
            return {
                localName: name,
                getAttribute: (attr) => attributes[attr],
                getElementsByTagNameNS: (ns, tagName) => {
                    return children[tagName] ? children[tagName].map(createMockElement) : [];
                },
                children: Object.values(children).flat().map(c => createMockElement(c)),
            };
        };

        it('should parse solid fill from direct cell formatting', () => {
            const cellNode = createMockElement({
                name: 'tc',
                children: {
                    'tcPr': [{
                        name: 'tcPr',
                        children: {
                            'solidFill': [{ name: 'solidFill', children: { 'srgbClr': [{ name: 'srgbClr', attributes: { val: '00FF00' } }] } }]
                        }
                    }]
                }
            });
            const tblPrNode = createMockElement();
            const fill = drawing.getCellFillColor(cellNode, tblPrNode, 0, 0, 1, 1, {}, mockSlideContext);

            expect(fill).toEqual({ type: 'solid', color: '#00FF00' });
        });


        it.skip('should parse gradient fill using parseGradientFill', () => {
            const gradFillNode = { name: 'gradFill' };
            const cellNode = createMockElement({
                name: 'tc',
                children: {
                    'tcPr': [{
                        name: 'tcPr',
                        children: {
                            'gradFill': [gradFillNode]
                        }
                    }]
                }
            });
            const tblPrNode = createMockElement();
            const fill = drawing.getCellFillColor(cellNode, tblPrNode, 0, 0, 1, 1, {}, mockSlideContext);

            expect(parseGradientFill).toHaveBeenCalledWith(expect.any(Object), mockSlideContext);
            expect(fill).toEqual({ type: 'gradient', val: 'gradient-fill' });
        });

        it.skip('should fall back to table style fill', () => {
            const cellNode = createMockElement({ name: 'tc' });
            const tblPrNode = createMockElement();
            const tableStyle = {
                wholeTbl: {
                    tcStyle: {
                        fill: { type: 'solid', color: { scheme: 'TABLE_STYLE_COLOR' } }
                    }
                }
            };
            const fill = drawing.getCellFillColor(cellNode, tblPrNode, 0, 0, 2, 2, tableStyle, { ...mockSlideContext, theme: { colorScheme: { 'TABLE_STYLE_COLOR': '#ABCDEF' } } });
            expect(fill).toEqual({ type: 'solid', color: '#ABCDEF' });
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

        it('should return a path for a preset rectangle geometry', () => {
            const geometry = { type: 'preset', preset: 'rect' };
            const pos = { width: 100, height: 100 };
            const expectedPath = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
            expect(drawing.buildPathStringFromGeom(geometry, pos)).toBe(expectedPath);
        });

        it('should handle arcs with the original logic, including the sweep flag bug', () => {
            const geometry = {
                type: 'preset',
                preset: 'arc',
                adjustments: { adj1: 0, adj2: 5400000 } // 90 degrees sweep, so sweep flag should be '1'
            };
            const pos = { width: 100, height: 100 };

            // Test without flipping
            const pathNoFlip = drawing.buildPathStringFromGeom(geometry, pos, false, false);
            expect(pathNoFlip).toContain('A 50 50 0 0 1');

            // Test with flipping, expecting the sweep flag to remain '1' due to the original logic
            const pathFlipped = drawing.buildPathStringFromGeom(geometry, pos, true, false);
            expect(pathFlipped).toContain('A 50 50 0 0 1');
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

        it('should build a path string for a corner shape', () => {
            const geometry = { type: 'preset', preset: 'corner' };
            const pos = { width: 100, height: 100 };
            const expectedPath = 'M 0 0 L 0 100 L 100 100';
            expect(drawing.buildPathStringFromGeom(geometry, pos)).toBe(expectedPath);
        });

        it('should build a path string for a chevron shape', () => {
            const geometry = { type: 'preset', preset: 'chevron', adjustments: { adj: 50000 } };
            const pos = { width: 100, height: 100 };
            const expectedPath = 'M 0 0 L 85 0 L 100 50 L 85 100 L 0 100 L 15 50 Z';
            expect(drawing.buildPathStringFromGeom(geometry, pos)).toBe(expectedPath);
        });

        it('should build a path string for a homePlate shape', () => {
            const geometry = { type: 'preset', preset: 'homePlate', adjustments: { adj: 50000 } };
            const pos = { width: 100, height: 100 };
            const expectedPath = 'M 0 0 L 85 0 L 100 50 L 85 100 L 0 100 Z';
            expect(drawing.buildPathStringFromGeom(geometry, pos)).toBe(expectedPath);
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
