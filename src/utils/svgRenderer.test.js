import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock, mockDeep } from 'vitest-mock-extended';
import { SvgRenderer } from './svgRenderer';

// Mock the global document object
const mockSvgElement = mockDeep();
const mockDefsElement = mockDeep();
const mockGElement = mockDeep();
const mockRectElement = mockDeep();
const mockEllipseElement = mockDeep();
const mockLineElement = mockDeep();
const mockPathElement = mockDeep();
const mockTextElement = mockDeep();
const mockImageElement = mockDeep();
const mockLinearGradientElement = mockDeep();
const mockStopElement = mockDeep();
const mockFilterElement = mockDeep();
const mockFeDropShadowElement = mockDeep();

global.document = {
    createElementNS: vi.fn((namespace, tagName) => {
        if (tagName === 'svg') return mockSvgElement;
        if (tagName === 'defs') return mockDefsElement;
        if (tagName === 'g') return mockGElement;
        if (tagName === 'rect') return mockRectElement;
        if (tagName === 'ellipse') return mockEllipseElement;
        if (tagName === 'line') return mockLineElement;
        if (tagName === 'path') return mockPathElement;
        if (tagName === 'text') return mockTextElement;
        if (tagName === 'image') return mockImageElement;
        if (tagName === 'linearGradient') return mockLinearGradientElement;
        if (tagName === 'stop') return mockStopElement;
        if (tagName === 'filter') return mockFilterElement;
        if (tagName === 'feDropShadow') return mockFeDropShadowElement;
        return mockDeep();
    }),
    querySelector: vi.fn(),
};

describe('SvgRenderer', () => {
    let renderer;
    let slideContext;

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();

        // Setup mock implementations
        mockSvgElement.querySelector.mockReturnValue(null);
        mockSvgElement.appendChild.mockImplementation(child => {
            if (child === mockDefsElement) {
                mockSvgElement.querySelector.mockReturnValue(mockDefsElement);
            }
        });

        slideContext = {}; // Mock slide context
        renderer = new SvgRenderer(mockSvgElement, slideContext);
    });

    describe('constructor', () => {
        it('should initialize with the provided SVG element and slide context', () => {
            expect(renderer.svg).toBe(mockSvgElement);
            expect(renderer.slideContext).toBe(slideContext);
        });

        it('should create a <defs> element if one does not exist', () => {
            expect(mockSvgElement.querySelector).toHaveBeenCalledWith('defs');
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'defs');
            expect(mockSvgElement.appendChild).toHaveBeenCalledWith(mockDefsElement);
            expect(renderer.defs).toBe(mockDefsElement);
        });

        it('should use an existing <defs> element if one is present', () => {
            vi.clearAllMocks();
            const existingDefs = mockDeep();
            mockSvgElement.querySelector.mockReturnValueOnce(existingDefs);
            const newRenderer = new SvgRenderer(mockSvgElement, slideContext);
            expect(newRenderer.defs).toBe(existingDefs);
            expect(document.createElementNS).not.toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'defs');
        });

        it('should set the initial currentGroup to the SVG element itself', () => {
            expect(renderer.currentGroup).toBe(mockSvgElement);
        });
    });

    describe('drawRect', () => {
        it('should draw a rectangle with the correct attributes', () => {
            renderer.drawRect(10, 20, 100, 50);
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'rect');
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('x', 10);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('y', 20);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('width', 100);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('height', 50);
            expect(renderer.currentGroup.appendChild).toHaveBeenCalledWith(mockRectElement);
        });

        it('should draw a rectangle with a solid fill', () => {
            renderer.drawRect(10, 20, 100, 50, { fill: 'red' });
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('fill', 'red');
        });

        it('should draw a rectangle with a stroke', () => {
            const strokeOptions = {
                stroke: {
                    color: 'blue',
                    width: 2,
                    dash: [5, 5],
                    join: 'round',
                    cap: 'square',
                }
            };
            renderer.drawRect(10, 20, 100, 50, strokeOptions);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('stroke', 'blue');
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('stroke-width', 2);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('stroke-dasharray', '5 5');
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('stroke-linejoin', 'round');
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('stroke-linecap', 'square');
        });

        it('should adjust position and size for stroke width', () => {
            const strokeOptions = { stroke: { width: 4 } };
            renderer.drawRect(10, 20, 100, 50, strokeOptions);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('x', 12);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('y', 22);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('width', 96);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('height', 46);
        });

        it('should handle zero stroke width gracefully', () => {
            const strokeOptions = { stroke: { width: 0, color: 'blue' } };
            renderer.drawRect(10, 20, 100, 50, strokeOptions);
            expect(mockRectElement.setAttribute).not.toHaveBeenCalledWith('stroke', 'blue');
        });

        it('should draw a rectangle with a gradient fill', () => {
            const fillOptions = {
                fill: {
                    type: 'gradient',
                    gradient: {
                        angle: 90,
                        stops: [
                            { pos: 0, color: { color: 'red', alpha: 1 } },
                            { pos: 1, color: { color: 'blue', alpha: 0.5 } },
                        ],
                    },
                },
            };
            renderer.drawRect(10, 20, 100, 50, fillOptions);
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'linearGradient');
            expect(mockLinearGradientElement.setAttribute).toHaveBeenCalledWith('gradientTransform', 'rotate(90, 0.5, 0.5)');
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'stop');
            expect(renderer.defs.appendChild).toHaveBeenCalledWith(mockLinearGradientElement);
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('fill', expect.stringMatching(/^url\(#grad-\d+\)$/));
        });
    });

    describe('drawEllipse', () => {
        it('should draw an ellipse with the correct attributes', () => {
            renderer.drawEllipse(50, 60, 40, 30);
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'ellipse');
            expect(mockEllipseElement.setAttribute).toHaveBeenCalledWith('cx', 50);
            expect(mockEllipseElement.setAttribute).toHaveBeenCalledWith('cy', 60);
            expect(mockEllipseElement.setAttribute).toHaveBeenCalledWith('rx', 40);
            expect(mockEllipseElement.setAttribute).toHaveBeenCalledWith('ry', 30);
            expect(renderer.currentGroup.appendChild).toHaveBeenCalledWith(mockEllipseElement);
        });
    });

    describe('drawLine', () => {
        it('should draw a simple line', () => {
            const options = { stroke: { color: 'black', width: 1 } };
            renderer.drawLine(10, 10, 100, 100, options);
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'line');

            // The hitbox and the line are appended to the group
            expect(mockGElement.appendChild).toHaveBeenCalledWith(mockLineElement);
            expect(mockGElement.appendChild).toHaveBeenCalledTimes(2);

            // The group is appended to the current group
            expect(renderer.currentGroup.appendChild).toHaveBeenCalledWith(mockGElement);
        });

        it('should draw a line with a gradient fill using a clipped rectangle', () => {
            const gradientFill = {
                type: 'gradient',
                gradient: {
                    angle: 90,
                    stops: [{ pos: 0, color: { color: 'red' } }, { pos: 1, color: { color: 'blue' } }],
                },
            };
            const options = { stroke: { color: gradientFill, width: 2 } };
            renderer.drawLine(10, 10, 10, 110, options);

            // Check that a group is created and appended
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
            expect(renderer.currentGroup.appendChild).toHaveBeenCalledWith(mockGElement);

            // Check for clipPath creation
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'clipPath');

            // Check for path inside clipPath
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
            expect(mockPathElement.setAttribute).toHaveBeenCalledWith('d', 'M 10 10 L 10 110');

            // Check for rect with gradient
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'rect');
            expect(mockRectElement.setAttribute).toHaveBeenCalledWith('fill', expect.stringMatching(/^url\(#grad-\d+\)$/));

            // Check that the rect and hitbox are appended to the group
            expect(mockGElement.appendChild).toHaveBeenCalledWith(mockRectElement);
            expect(mockGElement.appendChild).toHaveBeenCalledWith(mockLineElement);
        });
    });

    describe('drawPath', () => {
        it('should draw a path with the given path data', () => {
            const pathData = 'M 10 10 L 20 20';
            renderer.drawPath(pathData, { fill: 'none', stroke: { color: 'green', width: 2 } });
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'path');
            expect(mockPathElement.setAttribute).toHaveBeenCalledWith('d', pathData);
            expect(renderer.currentGroup.appendChild).toHaveBeenCalledWith(mockPathElement);
        });
    });

    describe('drawText', () => {
        it('should draw text with the correct content and attributes', () => {
            renderer.drawText('Hello SVG', 100, 50, { fontSize: '16px' });
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'text');
            expect(mockTextElement.setAttribute).toHaveBeenCalledWith('x', 100);
            expect(mockTextElement.setAttribute).toHaveBeenCalledWith('y', 50);
            expect(mockTextElement.setAttribute).toHaveBeenCalledWith('font-size', '16px');
            expect(mockTextElement.textContent).toBe('Hello SVG');
            expect(renderer.currentGroup.appendChild).toHaveBeenCalledWith(mockTextElement);
        });
    });

    describe('drawImage', () => {
        it('should draw an image with the correct attributes', () => {
            const href = 'http://example.com/image.png';
            renderer.drawImage(href, 10, 20, 200, 150);
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'image');
            expect(mockImageElement.setAttribute).toHaveBeenCalledWith('href', href);
            expect(mockImageElement.setAttribute).toHaveBeenCalledWith('x', 10);
            expect(mockImageElement.setAttribute).toHaveBeenCalledWith('y', 20);
            expect(mockImageElement.setAttribute).toHaveBeenCalledWith('width', 200);
            expect(mockImageElement.setAttribute).toHaveBeenCalledWith('height', 150);
            expect(renderer.currentGroup.appendChild).toHaveBeenCalledWith(mockImageElement);
        });
    });

    describe('clear', () => {
        it('should remove all elements from the SVG except defs', () => {
            const mockChild1 = mockDeep();
            mockChild1.tagName = 'rect';
            const mockChild2 = mockDeep();
            mockChild2.tagName = 'ellipse';

            // Simulate the behavior of firstChild and removeChild
            let children = [mockChild1, mockChild2];
            mockSvgElement.firstChild = children[0];
            mockSvgElement.removeChild.mockImplementation(child => {
                children = children.filter(c => c !== child);
                mockSvgElement.firstChild = children[0] || null;
            });

            renderer.clear();

            expect(mockSvgElement.removeChild).toHaveBeenCalledWith(mockChild1);
            expect(mockSvgElement.removeChild).toHaveBeenCalledWith(mockChild2);
            expect(children.length).toBe(0);
        });
    });

    describe('setTransform', () => {
        it('should create a group with the given transform matrix', () => {
            const matrix = { m: [1, 0, 0, 1, 10, 20] };
            renderer.setTransform(matrix, 'test-group');
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
            expect(mockGElement.setAttribute).toHaveBeenCalledWith('id', 'test-group');
            expect(mockGElement.setAttribute).toHaveBeenCalledWith('transform', 'matrix(1 0 0 1 10 20)');
            expect(mockSvgElement.appendChild).toHaveBeenCalledWith(mockGElement);
            expect(renderer.currentGroup).toBe(mockGElement);
        });
    });

    describe('applyEffects', () => {
        it('should create a drop shadow filter', () => {
            const effect = {
                type: 'outerShdw',
                dist: 5,
                dir: 90,
                blurRad: 4,
                color: 'rgba(0,0,0,0.5)',
            };
            const filterUrl = renderer.applyEffects({ effect });
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'filter');
            expect(mockFilterElement.setAttribute).toHaveBeenCalledWith('id', expect.stringMatching(/^drop-shadow-\d+$/));
            expect(document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'feDropShadow');
            expect(mockFeDropShadowElement.setAttribute).toHaveBeenCalledWith('stdDeviation', 4);
            expect(renderer.defs.appendChild).toHaveBeenCalledWith(mockFilterElement);
            expect(filterUrl).toMatch(/^url\(#drop-shadow-\d+\)$/);
        });
    });
});
