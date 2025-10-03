import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShapeBuilder } from './shapeBuilder';
import { Matrix } from './matrix';
import { findPlaceholder } from './findPlaceholder';
import { mock } from 'vitest-mock-extended';
import { SvgRenderer } from './svgRenderer';

// Mock the dependencies
vi.mock('./matrix');
vi.mock('./findPlaceholder', () => ({
    findPlaceholder: vi.fn(),
}));
vi.mock('./svgRenderer');

describe('ShapeBuilder', () => {
    let renderer;
    let shapeBuilder;
    let slideContext;
    let imageMap;
    let masterPlaceholders;
    let layoutPlaceholders;
    let emuPerPixel;
    let slideSize;

    beforeEach(() => {
        renderer = mock(SvgRenderer);
        slideContext = {};
        imageMap = {};
        masterPlaceholders = {};
        layoutPlaceholders = {};
        emuPerPixel = 1;
        slideSize = { width: 1000, height: 750 };

        // Reset mocks before each test
        vi.clearAllMocks();

        // Mock Matrix methods
        const matrixInstance = {
            m: [1, 0, 0, 1, 0, 0],
            clone: vi.fn().mockReturnThis(),
            multiply: vi.fn().mockReturnThis(),
            translate: vi.fn().mockReturnThis(),
            rotate: vi.fn().mockReturnThis(),
            scale: vi.fn().mockReturnThis(),
        };
        Matrix.mockImplementation(() => matrixInstance);

        shapeBuilder = new ShapeBuilder(
            renderer,
            slideContext,
            imageMap,
            masterPlaceholders,
            layoutPlaceholders,
            emuPerPixel,
            slideSize
        );
    });

    it('should be defined', () => {
        expect(ShapeBuilder).toBeDefined();
    });

    describe('getShapeProperties', () => {
        it('should return shape properties for a shape with its own transform', () => {
            const shapeNode = {
                getElementsByTagNameNS: vi.fn().mockImplementation((ns, tag) => {
                    if (tag === 'nvSpPr') {
                        return [{
                            getElementsByTagNameNS: vi.fn().mockImplementation((ns, tag) => {
                                if (tag === 'cNvPr') {
                                    return [{ getAttribute: vi.fn().mockReturnValue('Shape 1') }];
                                }
                                if (tag === 'nvPr') {
                                    return [{
                                        getElementsByTagNameNS: vi.fn().mockReturnValue([])
                                    }];
                                }
                            })
                        }];
                    }
                    if (tag === 'xfrm') {
                        return [{
                            getAttribute: vi.fn((attr) => {
                                if (attr === 'rot') return '0';
                                if (attr === 'flipH') return '0';
                                if (attr === 'flipV') return '0';
                            }),
                            getElementsByTagNameNS: vi.fn((ns, tag) => {
                                if (tag === 'off') {
                                    return [{ getAttribute: vi.fn((attr) => (attr === 'x' ? '100' : '200')) }];
                                }
                                if (tag === 'ext') {
                                    return [{ getAttribute: vi.fn((attr) => (attr === 'cx' ? '300' : '400')) }];
                                }
                            })
                        }];
                    }
                    return [];
                })
            };

            const parentMatrix = new Matrix();
            const { pos, transform } = shapeBuilder.getShapeProperties(shapeNode, parentMatrix);

            expect(pos).toEqual({ x: 0, y: 0, width: 300, height: 400 });
            expect(transform).toBe('matrix(1 0 0 1 0 0)');
        });

        it('should return shape properties for a placeholder shape', () => {
            const shapeNode = {
                getElementsByTagNameNS: vi.fn().mockImplementation((ns, tag) => {
                    if (tag === 'nvSpPr') {
                        return [{
                            getElementsByTagNameNS: vi.fn().mockImplementation((ns, tag) => {
                                if (tag === 'cNvPr') {
                                    return [{ getAttribute: vi.fn().mockReturnValue('Title 1') }];
                                }
                                if (tag === 'nvPr') {
                                    return [{
                                        getElementsByTagNameNS: vi.fn().mockReturnValue([{
                                            getAttribute: vi.fn((attr) => {
                                                if (attr === 'type') return 'title';
                                                if (attr === 'idx') return '1';
                                            })
                                        }])
                                    }];
                                }
                            })
                        }];
                    }
                    return [];
                })
            };

            const placeholder = {
                pos: { x: 50, y: 60, width: 70, height: 80 }
            };
            findPlaceholder.mockReturnValue(placeholder);

            const parentMatrix = new Matrix();
            const { pos, transform } = shapeBuilder.getShapeProperties(shapeNode, parentMatrix);

            expect(pos).toEqual({ x: 0, y: 0, width: 70, height: 80 });
            expect(transform).toBe('matrix(1 0 0 1 0 0)');
        });
    });

    describe('renderShape', () => {
        it('should render a rect shape', () => {
            const pos = { width: 100, height: 50 };
            const shapeProps = {
                geometry: { type: 'preset', preset: 'rect' },
                fill: 'blue',
                stroke: 'black',
                effect: 'shadow',
            };
            const matrix = new Matrix();

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            const expectedPath = 'M 0 0 L 100 0 L 100 50 L 0 50 Z';
            expect(renderer.drawPath).toHaveBeenCalledWith(expectedPath, {
                fill: 'blue',
                stroke: 'black',
                effect: 'shadow',
                pos,
            });
        });

        it('should render an ellipse shape', () => {
            const pos = { width: 100, height: 50 };
            const shapeProps = {
                geometry: { type: 'preset', preset: 'ellipse' },
                fill: 'red',
                stroke: 'green',
                effect: 'glow',
            };
            const matrix = new Matrix();

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            const expectedPath = 'M 50 0 A 50 25 0 1 0 50 50 A 50 25 0 1 0 50 0 Z';
            expect(renderer.drawPath).toHaveBeenCalledWith(expectedPath, {
                fill: 'red',
                stroke: 'green',
                effect: 'glow',
                pos,
            });
        });

        it('should render a line shape', () => {
            const pos = { width: 100, height: 100 };
            const shapeProps = {
                geometry: { type: 'line' },
                stroke: 'black',
                effect: 'shadow',
            };
            const matrix = new Matrix();
            matrix.m = [1, 0, 0, 1, 10, 20]; // Example matrix with translation

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            expect(renderer.drawLine).toHaveBeenCalledWith(0, 0, 100, 100, {
                stroke: 'black',
                effect: 'shadow',
            });
        });

        it('should render an arc shape', () => {
            const pos = { width: 100, height: 100 };
            const shapeProps = {
                geometry: {
                    type: 'arc',
                    adjustments: { adj1: 5400000, adj2: 10800000 }
                },
                stroke: 'black',
            };
            const matrix = new Matrix();

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            expect(renderer.drawPath).toHaveBeenCalledWith(
                "M 6.698729810778062 25.000000000000004 A 50 50 0 0 1 18.0328253113894 11.553937231130497",
                { stroke: 'black', effect: undefined, pos }
            );
        });

        it('should render a custom shape', () => {
            const pos = { width: 100, height: 100 };
            const shapeProps = {
                geometry: {
                    type: 'custom',
                    path: {
                        w: 100,
                        h: 100,
                        commands: [
                            { cmd: 'moveTo', points: [{ x: 0, y: 0 }] },
                            { cmd: 'lnTo', points: [{ x: 100, y: 100 }] },
                            { cmd: 'close' },
                        ],
                    },
                },
                fill: 'yellow',
            };
            const matrix = new Matrix();

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            expect(renderer.drawPath).toHaveBeenCalledWith('M 0 0 L 100 100 Z ', {
                fill: 'yellow',
                stroke: undefined,
                effect: undefined,
                pos,
            });
        });

        it('should render a blockArc shape', () => {
            const pos = { width: 100, height: 100 };
            const shapeProps = {
                geometry: {
                    type: 'blockArc',
                    adjustments: { adj1: 0, adj2: 10800000, adj3: 25000 },
                },
                fill: 'purple',
            };
            const matrix = new Matrix();

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            expect(renderer.drawPath).toHaveBeenCalledWith(
                "M 0 49.99999999999999 A 50 50 0 0 1 100 50 L 87.5 50 A 37.5 37.5 0 0 0 12.5 49.99999999999999 Z",
                { fill: 'purple', stroke: undefined, effect: undefined, pos }
            );
        });

        it('should render a roundRect shape', () => {
            const pos = { width: 100, height: 50 };
            const shapeProps = {
                geometry: {
                    type: 'roundRect',
                    adjustments: { adj: 25000 },
                },
                fill: 'orange',
            };
            const matrix = new Matrix();

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            expect(renderer.drawPath).toHaveBeenCalledWith(
                "M 18.75 0 L 81.25 0 A 18.75 18.75 0 0 1 100 18.75 L 100 31.25 A 18.75 18.75 0 0 1 81.25 50 L 18.75 50 A 18.75 18.75 0 0 1 0 31.25 L 0 18.75 A 18.75 18.75 0 0 1 18.75 0 Z",
                { fill: 'orange', stroke: undefined, effect: undefined, pos }
            );
        });

        it('should render a round1Rect shape', () => {
            const pos = { width: 100, height: 100 };
            const shapeProps = {
                geometry: { type: 'round1Rect', adjustments: { adj1: 25000 } },
                fill: 'cyan',
            };
            shapeBuilder.renderShape(pos, shapeProps, new Matrix(), false, false);
            expect(renderer.drawPath).toHaveBeenCalledWith(
                'M 0 25 A 25 25 0 0 1 25 0 L 100 0 L 100 100 L 0 100 Z',
                { fill: 'cyan', stroke: undefined, effect: undefined, pos }
            );
        });

        it('should render a shapeless textbox', () => {
            const pos = { width: 200, height: 100 };
            const shapeProps = {
                txBody: {}, // Indicates a textbox
                effect: 'glow'
            };
            shapeBuilder.renderShape(pos, shapeProps, new Matrix(), false, false);
            expect(renderer.drawRect).toHaveBeenCalledWith(0, 0, 200, 100, {
                fill: 'transparent',
                effect: 'glow',
            });
        });

        it('should handle shapes with no geometry or text body', () => {
            const pos = { width: 100, height: 50 };
            const shapeProps = {};
            const matrix = new Matrix();

            shapeBuilder.renderShape(pos, shapeProps, matrix, false, false);

            expect(renderer.drawRect).not.toHaveBeenCalled();
            expect(renderer.drawEllipse).not.toHaveBeenCalled();
            expect(renderer.drawLine).not.toHaveBeenCalled();
            expect(renderer.drawPath).not.toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('getShapeProperties should handle shape node without transform or placeholder', () => {
            const shapeNode = {
                getElementsByTagNameNS: vi.fn().mockImplementation((ns, tag) => {
                    if (tag === 'nvSpPr') {
                        return [{
                            getElementsByTagNameNS: vi.fn().mockImplementation((ns, tag) => {
                                if (tag === 'cNvPr') {
                                    return [{ getAttribute: vi.fn().mockReturnValue('Shape 1') }];
                                }
                                if (tag === 'nvPr') {
                                    return [{
                                        getElementsByTagNameNS: vi.fn().mockReturnValue([])
                                    }];
                                }
                            })
                        }];
                    }
                    return [];
                })
            };

            const parentMatrix = new Matrix();
            const { pos, transform } = shapeBuilder.getShapeProperties(shapeNode, parentMatrix);

            expect(pos).toBeNull();
            expect(transform).toBeNull();
        });
    });
});
