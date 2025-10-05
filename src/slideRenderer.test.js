import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SlideRenderer } from './slideRenderer';
import * as allUtils from 'utils';

// Mock the 'utils' module parts that the renderer uses
vi.mock('utils', async (importOriginal) => {
    const actual = await importOriginal();
    const mockShapeBuilderInstance = {
        renderShape: vi.fn(),
    };
    return {
        ...actual,
        SvgRenderer: vi.fn(() => ({
            defs: null,
            currentGroup: null,
            setTransform: vi.fn(),
            drawPath: vi.fn(),
            drawRect: vi.fn(),
            drawLine: vi.fn(),
            drawImage: vi.fn(),
            drawText: vi.fn(),
            createAlphaFilter: vi.fn(),
            createDuotoneFilter: vi.fn(),
            _createGradient: vi.fn(),
        })),
        Matrix: vi.fn(() => ({
            clone: vi.fn().mockReturnThis(),
            multiply: vi.fn().mockReturnThis(),
            translate: vi.fn().mockReturnThis(),
            scale: vi.fn().mockReturnThis(),
            rotate: vi.fn().mockReturnThis(),
            m: [1, 0, 0, 1, 0, 0],
        })),
        ShapeBuilder: vi.fn(() => mockShapeBuilderInstance),
        ColorParser: {
            resolveColor: vi.fn(color => color), // Simple pass-through for testing
            parseColor: vi.fn(),
        },
        createImage: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    };
});


describe('SlideRenderer', () => {
    let slideRenderer;
    let mockSlideContainer;
    let mockRenderer;
    let mockShapeBuilder;

    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = '<div id="slide-container"></div>';
        mockSlideContainer = document.getElementById('slide-container');

        const options = {
            slideContainer: 'slide-container',
            slideId: 'slide-1',
            slideSize: { width: 960, height: 540 },
            slideContext: { theme: {}, colorMap: {} },
        };

        slideRenderer = new SlideRenderer(options);

        // Make mocks accessible
        mockRenderer = slideRenderer.renderer;
        mockShapeBuilder = slideRenderer.shapeBuilder; // This is now an instance of the mock

        // Mock the renderer's currentGroup to be the SVG element itself for testing
        mockRenderer.currentGroup = slideRenderer.svg;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should be defined', () => {
        expect(SlideRenderer).toBeDefined();
    });

    it('should instantiate without errors', () => {
        expect(slideRenderer).toBeInstanceOf(SlideRenderer);
    });

    describe('constructor and createSvg', () => {
        it('should correctly initialize properties', () => {
            expect(slideRenderer.slideContainer).toBe('slide-container');
            expect(slideRenderer.slideId).toBe('slide-1');
            expect(slideRenderer.slideSize).toEqual({ width: 960, height: 540 });
            expect(slideRenderer.slideContext).toEqual({ theme: {}, colorMap: {} });
            expect(slideRenderer.svg).toBeDefined();
            expect(slideRenderer.renderer).toBeDefined();
            expect(slideRenderer.shapeBuilder).toBeDefined();
        });

        it('should create an SVG element and append it to the container', () => {
            expect(mockSlideContainer.children.length).toBe(1);
            const svgElement = mockSlideContainer.querySelector('svg');
            expect(svgElement).not.toBeNull();
            expect(svgElement.getAttribute('viewBox')).toBe('0 0 960 540');
            expect(svgElement.style.width).toBe('100%');
            expect(svgElement.style.height).toBe('100%');
        });
    });

    describe('render', () => {
        it('should render a solid color background', async () => {
            const slideData = {
                background: { type: 'color', value: '#FF0000' },
                shapes: [],
            };
            await slideRenderer.render(slideData);

            const bgRect = slideRenderer.svg.querySelector('rect');
            expect(bgRect).not.toBeNull();
            expect(bgRect.getAttribute('fill')).toBe('#FF0000');
        });

        it('should render a gradient background', async () => {
            const slideData = {
                background: { type: 'gradient', value: 'gradient-data' },
                shapes: [],
            };
            mockRenderer._createGradient.mockReturnValue('url(#gradient-1)');

            await slideRenderer.render(slideData);

            const bgRect = slideRenderer.svg.querySelector('rect');
            expect(bgRect).not.toBeNull();
            expect(mockRenderer._createGradient).toHaveBeenCalledWith(slideData.background);
            expect(bgRect.getAttribute('fill')).toBe('url(#gradient-1)');
        });

        it('should render an image background from the correct image map', async () => {
            const slideData = {
                background: { type: 'image', relId: 'rId1', source: 'layout' },
                shapes: [],
                imageMaps: {
                    slide: {},
                    layout: { 'rId1': 'layout-image.png' },
                    master: {},
                }
            };
            await slideRenderer.render(slideData);

            const bgImage = slideRenderer.svg.querySelector('image');
            expect(bgImage).not.toBeNull();
            expect(bgImage.getAttribute('href')).toBe('layout-image.png');
        });

        it('should call renderShapeTree with the correct shapes', async () => {
            const slideData = {
                background: null,
                shapes: [{ type: 'shape', pos: { x:0, y:0, width:10, height:10 }, rot: 0, shapeProps: {}, text: null }, { type: 'group' }],
                imageMaps: {}
            };
            // Spy on the method within the instance
            const renderShapeTreeSpy = vi.spyOn(slideRenderer, 'renderShapeTree');

            await slideRenderer.render(slideData, 'active-element-id');

            expect(renderShapeTreeSpy).toHaveBeenCalledWith(slideData, 'active-element-id');
        });
    });

    describe('renderShapeTree', () => {
        it('should call the correct render method for each shape type', async () => {
            const renderShapeSpy = vi.spyOn(slideRenderer, 'renderShape').mockResolvedValue();
            const renderTableSpy = vi.spyOn(slideRenderer, 'renderTable').mockResolvedValue();
            const renderChartSpy = vi.spyOn(slideRenderer, 'renderChart').mockResolvedValue();
            const renderPictureSpy = vi.spyOn(slideRenderer, 'renderPicture').mockResolvedValue();
            const renderDiagramSpy = vi.spyOn(slideRenderer, 'renderDiagram').mockResolvedValue();

            const slideData = {
                shapes: [
                    { type: 'shape', pos: {}, rot: 0, shapeProps: {} },
                    { type: 'table', data: 2 },
                    { type: 'chart', data: 3 },
                    { type: 'picture', data: 4 },
                    { type: 'diagram', data: 5 },
                    { type: 'group' }, // Groups are ignored
                    { type: 'unknown' }, // Unknowns are ignored
                ],
                imageMaps: {}
            };

            await slideRenderer.renderShapeTree(slideData, 'active-id');

            expect(renderShapeSpy).toHaveBeenCalledWith(slideData.shapes[0], expect.any(Object), 'active-id');
            expect(renderTableSpy).toHaveBeenCalledWith(slideData.shapes[1], expect.any(Object), 'active-id');
            expect(renderChartSpy).toHaveBeenCalledWith(slideData.shapes[2], expect.any(Object));
            expect(renderPictureSpy).toHaveBeenCalledWith(slideData.shapes[3], expect.any(Object), slideData.imageMaps);
            expect(renderDiagramSpy).toHaveBeenCalledWith(slideData.shapes[4], expect.any(Object), 'active-id');
            expect(renderShapeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('renderShape', () => {
        it('should render a shape and its text', async () => {
            const renderParagraphsSpy = vi.spyOn(slideRenderer, 'renderParagraphs');
            const shapeData = {
                type: 'shape',
                transform: 'matrix(1 0 0 1 10 20)',
                pos: { x: 1, y: 2, width: 3, height: 4, rotation: 30 },
                shapeProps: {},
                text: { content: 'Hello', pos: { x: 1, y: 2, width: 3, height: 4 }, bodyPr: {}, layout: { lines: [], totalHeight: 0 } },
                flipH: false,
                flipV: false,
                rot: 30
            };

            await slideRenderer.renderShape(shapeData, { id: 'shape-1' }, 'active-id');

            expect(mockRenderer.setTransform).toHaveBeenCalled();
            expect(mockShapeBuilder.renderShape).toHaveBeenCalledWith(
                shapeData.pos,
                shapeData.shapeProps,
                expect.anything(), // matrix
                shapeData.flipH,
                shapeData.flipV
            );
            expect(renderParagraphsSpy).toHaveBeenCalledWith(shapeData.text, 'shape-1.text', 'active-id');
        });
    });

    describe('renderParagraphs', () => {
        it('should render text with correct attributes and tspans', () => {
            const layout = {
                totalHeight: 50,
                lines: [
                    {
                        x: 10,
                        startY: 20,
                        width: 180,
                        height: 25,
                        runs: [
                            { text: 'Hello, ', font: { size: 24, family: 'Arial', style: 'normal', weight: 'bold' }, color: '#FF0000' },
                            { text: 'World!', font: { size: 24, family: 'Calibri', style: 'italic', weight: 'normal' }, color: '#0000FF' },
                        ],
                        paragraphProps: { defRPr: { color: 'default-color' }, align: 'ctr' },
                        isFirstLine: true,
                    },
                ],
            };
            const textData = { layout, bodyPr: { anchor: 't' }, pos: { x: 0, y: 0, width: 200, height: 100 } };

            slideRenderer.renderParagraphs(textData, 'text-1', 'active-id');

            const textElement = slideRenderer.svg.querySelector('text');
            expect(textElement).not.toBeNull();
            expect(textElement.getAttribute('text-anchor')).toBe('middle');

            const tspans = textElement.querySelectorAll('tspan');
            expect(tspans.length).toBe(2);

            expect(tspans[0].textContent).toBe('Hello, ');
            expect(tspans[0].getAttribute('font-family')).toBe('Arial');
            expect(tspans[0].getAttribute('font-size')).toBe('24px');
            expect(tspans[0].getAttribute('font-weight')).toBe('bold');
            expect(tspans[0].getAttribute('fill')).toBe('#FF0000');

            expect(tspans[1].textContent).toBe('World!');
            expect(tspans[1].getAttribute('font-family')).toBe('Calibri');
            expect(tspans[1].getAttribute('font-style')).toBe('italic');
            expect(tspans[1].getAttribute('fill')).toBe('#0000FF');
        });

        it('should create individual group for each line for selection', () => {
            const layout = {
                totalHeight: 50,
                lines: [
                    { x: 10, startY: 20, width: 180, height: 25, runs: [{ text: 'Line 1', font: { size: 12 } }], paragraphProps: { bullet: { type: 'none' }, defRPr: {} }, isFirstLine: true },
                    { x: 10, startY: 45, width: 180, height: 25, runs: [{ text: 'Line 2', font: { size: 12 } }], paragraphProps: { bullet: { type: 'none' }, defRPr: {} }, isFirstLine: false },
                ],
            };
            const textData = { layout, bodyPr: {}, pos: { x: 0, y: 0, width: 200, height: 100 } };

            slideRenderer.renderParagraphs(textData, 'text-1', 'text-1.line.1');

            const textGroup = slideRenderer.svg.querySelector('g[id="text-1"]');
            expect(textGroup).not.toBeNull();

            const lineGroups = textGroup.querySelectorAll('g');
            expect(lineGroups.length).toBe(2);

            const lineGroup1 = textGroup.querySelector('g[id="text-1.line.0"]');
            expect(lineGroup1).not.toBeNull();
            expect(lineGroup1.getAttribute('class')).toBeFalsy();

            const lineGroup2 = textGroup.querySelector('g[id="text-1.line.1"]');
            expect(lineGroup2).not.toBeNull();
            expect(lineGroup2.getAttribute('class')).toBe('active-element');
        });
    });
});