import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SlideHandler } from './slideHandler';

vi.mock('utils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        ShapeBuilder: vi.fn(),
        ColorParser: {
            resolveColor: vi.fn(),
            parseColor: vi.fn(),
        },
        parseXmlString: vi.fn(),
        getAutoNumberingChar: vi.fn(),
        resolveFontFamily: vi.fn().mockReturnValue('Arial'),
        parseChart: vi.fn(),
        parseShapeProperties: vi.fn().mockReturnValue({ fill: {}, stroke: {}, effect: {} }),
        parseBodyProperties: vi.fn().mockReturnValue({}),
        parseParagraphProperties: vi.fn().mockReturnValue({ bullet: {}, defRPr: {} }),
        getCellFillColor: vi.fn(),
        getCellTextStyle: vi.fn(),
        getCellBorders: vi.fn(),
        buildPathStringFromGeom: vi.fn(),
        parseSourceRectangle: vi.fn(),
        createImage: vi.fn(),
        resolvePath: vi.fn(),
        getNormalizedXmlString: vi.fn(),
        transformSlide: vi.fn(slideData => ({
            id: slideData.slideId,
            slideNumber: slideData.slideNum,
            shapes: slideData.shapes,
            background: {},
        })),
    };
});

vi.mock('./slideshowDataStore', () => ({
    presentationStore: {
        getState: vi.fn(),
        dispatch: vi.fn(),
        subscribe: vi.fn(),
    },
}));

describe('SlideHandler', () => {
    let slideHandler;
    let mockSlideContainer;
    let SvgRenderer, Matrix;

    beforeEach(async () => {
        // Reset mocks before each test
        vi.clearAllMocks();

        // Import actuals inside beforeEach to ensure mocks are set up
        const utils = await import('utils');
        SvgRenderer = utils.SvgRenderer;
        Matrix = utils.Matrix;

        // Mock DOM environment
        document.body.innerHTML = '<div id="slide-container"></div><div id="container"></div>';
        mockSlideContainer = document.getElementById('slide-container');

        const options = {
            slideXml: '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>',
            slideContainer: 'slide-container',
            masterPlaceholders: {},
            layoutPlaceholders: {},
            slideId: 'slide-1',
            slideNum: 1,
            slideSize: { width: 960, height: 540 },
            defaultTextStyles: { title: {}, body: {}, other: {} },
            tableStyles: {},
            defaultTableStyleId: '1234',
            imageMap: {},
            slideContext: { theme: { fontScheme: { major: { latin: { typeface: 'Arial' } }, minor: { latin: { typeface: 'Calibri' } } } } },
            finalBg: {},
            showMasterShapes: true,
            masterStaticShapes: [],
            layoutStaticShapes: [],
            slideRels: {},
            entriesMap: {},
        };

        slideHandler = new SlideHandler(options);
        // We need to manually instantiate the real SvgRenderer for the handler
        const svgElement = document.getElementById(options.slideContainer).querySelector('svg');
        slideHandler.renderer = new SvgRenderer(svgElement, options.slideContext);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should be defined', () => {
        expect(SlideHandler).toBeDefined();
    });

    it('should instantiate without errors', () => {
        expect(slideHandler).toBeInstanceOf(SlideHandler);
    });

    describe('render', () => {
        beforeEach(() => {
            slideHandler.renderShapeTree = vi.fn();
        });

        it('should render a solid color background from the presentation store', async () => {
            const slideData = { shapes: [] };
            const { presentationStore } = await import('./slideshowDataStore');
            presentationStore.getState.mockReturnValue({
                theme: { colorScheme: { bg1: '#FF0000' } },
            });

            await slideHandler.render(slideData);

            const bgRect = slideHandler.svg.querySelector('rect');
            expect(bgRect).not.toBeNull();
            expect(bgRect.getAttribute('fill')).toBe('#FF0000');
        });
    });

    describe('parseShape and renderShape', () => {
        it('should render a shape with rotation', async () => {
            const shapeData = {
                id: 'shape-1',
                type: 'shape',
                shapeType: 'rect',
                x: 10,
                y: 20,
                width: 100,
                height: 50,
                rotation: 45,
                fillColor: '#FF0000',
                borderColor: '#000000'
            };

            await slideHandler.renderShape(shapeData);

            const group = slideHandler.svg.querySelector('g');
            expect(group).not.toBeNull();
            // This is a simplified check. A real matrix decomposition would be better.
            expect(group.getAttribute('transform')).toMatch(/matrix\(0.707.*, 0.707.*, -0.707.*, 0.707.*\)/);
        });
    });
});
