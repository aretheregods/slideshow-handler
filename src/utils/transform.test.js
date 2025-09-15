import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { transformShape } from './transform';
import * as allUtils from 'utils';

// Mock dependencies
vi.mock('utils', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        ColorParser: {
            parseColor: vi.fn(),
            resolveColor: vi.fn(color => color.val || 'resolved-color'),
        },
        parseGradientFill: vi.fn(),
    };
});

describe('transform.js', () => {
    describe('transformShape for tables', () => {
        let ColorParser;
        const mockSlideContext = { theme: {} };

        beforeAll(async () => {
            const utils = await import('utils');
            ColorParser = utils.ColorParser;
        });

        beforeEach(() => {
            vi.mocked(ColorParser.parseColor).mockClear();
            vi.mocked(ColorParser.resolveColor).mockClear();
            ColorParser.resolveColor.mockImplementation(colorObj => colorObj ? (colorObj.val || 'resolved-color') : 'fallback-color');
            ColorParser.parseColor.mockImplementation(solidFillNode => {
                if (!solidFillNode) return undefined;
                const srgbClrArr = solidFillNode.getElementsByTagNameNS(null, 'srgbClr');
                if (srgbClrArr.length > 0) {
                    const srgbClr = srgbClrArr[0];
                    const val = srgbClr.getAttribute('val');
                    if (val) return { val };
                }
                return undefined;
            });
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

        it('should resolve table cell borders', () => {
            const shape = {
                type: 'table',
                numRows: 1,
                numCols: 1,
                tblPrNode: createMockElement(),
                tableStyle: {},
                cells: [{
                    tcPrNode: createMockElement({
                        name: 'tcPr',
                        children: {
                            'lnL': [{
                                name: 'lnL',
                                attributes: { w: '12700' },
                                children: { 'solidFill': [{ name: 'solidFill', children: { 'srgbClr': [{ name: 'srgbClr', attributes: { val: 'FF0000' } }] } }] }
                            }]
                        }
                    })
                }]
            };

            const transformed = transformShape(shape, mockSlideContext);
            const borders = transformed.cells[0].borders;
            expect(borders.left.color).toBe('FF0000');
        });

        it('should resolve table cell fill', () => {
            const shape = {
                type: 'table',
                numRows: 1,
                numCols: 1,
                tblPrNode: createMockElement(),
                tableStyle: {},
                cells: [{
                    tcPrNode: createMockElement({
                        name: 'tcPr',
                        children: {
                            'solidFill': [{ name: 'solidFill', children: { 'srgbClr': [{ name: 'srgbClr', attributes: { val: '00FF00' } }] } }]
                        }
                    })
                }]
            };

            const transformed = transformShape(shape, mockSlideContext);
            const fill = transformed.cells[0].fill;
            expect(fill.color).toBe('00FF00');
        });
    });
});
