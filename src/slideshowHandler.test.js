import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slideshowHandler } from './slideshowHandler.js';
import * as utils from 'utils';
import JSZip from 'jszip';
import { SlideHandler } from './slideHandler.js';
import { presentationStore, slideStores, createSlideStore } from './slideshowDataStore.js';
import { slideshowProcessingActions as actions } from './constants.js';

// Mock dependencies
const mockFiles = new Map();
vi.mock('jszip', () => ({
    default: {
        loadAsync: vi.fn().mockImplementation(() => Promise.resolve({
            files: mockFiles,
        })),
    },
}));

vi.mock('utils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        parseXmlString: vi.fn(),
        resolvePath: vi.fn((...args) => args.filter(Boolean).join('/')),
        getNormalizedXmlString: vi.fn().mockResolvedValue('<xml/>'),
        getRelationships: vi.fn().mockResolvedValue({}),
        getSlideOrder: vi.fn().mockReturnValue([]),
        getSlideSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
        parseTheme: vi.fn().mockReturnValue({ fontScheme: { major: { latin: { typeface: 'Arial' } }, minor: { latin: { typeface: 'Calibri' } } } }),
        parseTableStyles: vi.fn().mockReturnValue({ styles: {}, defaultStyleId: null }),
        parseMasterOrLayout: vi.fn().mockReturnValue({ placeholders: {}, staticShapes: [], defaultTextStyles: {}, colorMap: {} }),
        parseBackground: vi.fn().mockReturnValue(null),
        populateImageMap: vi.fn().mockResolvedValue(undefined),
    };
});


// Mock SlideHandler
const mockSlideHandlerInstance = {
    parse: vi.fn().mockResolvedValue({ shapes: [], background: null }),
    render: vi.fn().mockResolvedValue(undefined),
    newSlideContainer: vi.fn().mockReturnThis(),
};
vi.mock('./slideHandler.js', () => ({
    SlideHandler: vi.fn(() => mockSlideHandlerInstance),
}));

// Mock Data Stores
vi.mock('./slideshowDataStore.js', () => {
    const mockSlideStore = {
        dispatch: vi.fn(),
        getState: vi.fn((key) => {
            if (key === 'parsingData.slideSize') {
                return { width: 1280, height: 720 };
            }
            return {};
        }),
    };

    let presentationStoreState = {};
    let presentationStoreSubscribers = [];
    const mockPresentationStore = {
        dispatch: vi.fn((action) => {
            const oldState = { ...presentationStoreState };
            if (action.payload) {
                presentationStoreState = { ...presentationStoreState, ...action.payload };
            }
            presentationStoreSubscribers.forEach(sub => sub.callback(presentationStoreState, oldState));
        }),
        subscribe: vi.fn((subscriber) => {
            presentationStoreSubscribers.push(subscriber);
            return () => {
                presentationStoreSubscribers = presentationStoreSubscribers.filter(s => s !== subscriber);
            };
        }),
        getState: vi.fn((key) => presentationStoreState[key]),
        clear: () => {
            presentationStoreState = {};
            presentationStoreSubscribers = [];
        }
    };

    let slideStoresMap = new Map();
    const mockSlideStores = {
        clear: vi.fn(() => slideStoresMap.clear()),
        set: vi.fn((key, value) => slideStoresMap.set(key, value)),
        get: vi.fn((key) => slideStoresMap.get(key) || mockSlideStore),
        has: vi.fn((key) => slideStoresMap.has(key)),
    };

    return {
        createSlideStore: vi.fn(() => mockSlideStore),
        presentationStore: mockPresentationStore,
        slideStores: mockSlideStores,
    };
});

// Mock crypto.randomUUID
if (typeof global.crypto === 'undefined') {
    global.crypto = {};
}
global.crypto.randomUUID = vi.fn(() => 'mock-uuid');

describe('slideshowHandler', () => {
    let options;

    beforeEach(() => {
        // Set up mock DOM
        document.body.innerHTML = `
            <div id="slide-viewer-container"></div>
            <div id="slide-selector-container"></div>
        `;

        options = {
            file: new Blob(['']),
            slideViewerContainer: 'slide-viewer-container',
            slideSelectorContainer: 'slide-selector-container',
        };

        // Reset state before each test
        presentationStore.clear();
        slideStores.clear();
        vi.clearAllMocks();
        mockFiles.clear();
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
    });

    it('should be defined', () => {
        expect(slideshowHandler).toBeDefined();
    });

    describe('Happy Path', () => {
        it('should process a presentation with multiple slides and render the active slide', async () => {
            // Arrange: Set up mock return values for a 2-slide presentation
            const mockEntries = new Map([
                ['ppt/_rels/presentation.xml.rels', {}],
                ['ppt/presentation.xml', {}],
                ['ppt/slides/slide1.xml', {}],
                ['ppt/slides/slide2.xml', {}],
                ['ppt/slides/_rels/slide1.xml.rels', {}],
                ['ppt/slides/_rels/slide2.xml.rels', {}],
                ['ppt/theme/theme1.xml', {}],
            ]);
            for (const [filename, data] of mockEntries.entries()) {
                mockFiles.set(filename, data);
            }

            vi.mocked(utils.getRelationships).mockImplementation(async (entries, path) => {
                if (path === 'ppt/_rels/presentation.xml.rels') {
                    return {
                        'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: 'slides/slide1.xml' },
                        'rId2': { id: 'rId2', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: 'slides/slide2.xml' },
                        'rId3': { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', target: 'theme/theme1.xml' },
                    };
                }
                return {};
            });

            vi.mocked(utils.getSlideOrder).mockReturnValue(['rId1', 'rId2']);
            vi.mocked(utils.getSlideSize).mockReturnValue({ width: 960, height: 540 });
            vi.mocked(utils.parseTheme).mockReturnValue({ name: 'mockTheme' });
            vi.mocked(utils.getNormalizedXmlString).mockResolvedValue('<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"></p:sld>');
            vi.mocked(utils.parseXmlString).mockImplementation((xml) => {
                const parser = new DOMParser();
                return parser.parseFromString(xml, 'text/xml');
            });

            // Act: Call the handler
            const result = await slideshowHandler(options);

            // Assert: Verify the overall process
            expect(result.slideshowLength).toBe(2);
            expect(result.activeSlide).toBe('rId1');
            expect(JSZip.loadAsync).toHaveBeenCalled();
            expect(utils.getSlideOrder).toHaveBeenCalled();
            expect(presentationStore.dispatch).toHaveBeenCalledWith({ type: 'START_PARSING' });
            expect(presentationStore.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_PRESENTATION_DATA', payload: { theme: { name: 'mockTheme' } } }));

            // Assert: Verify slide processing loop
            expect(SlideHandler).toHaveBeenCalledTimes(2);
            expect(createSlideStore).toHaveBeenCalledTimes(2);
            expect(slideStores.set).toHaveBeenCalledWith('rId1', expect.any(Object));
            expect(slideStores.set).toHaveBeenCalledWith('rId2', expect.any(Object));
            expect(mockSlideHandlerInstance.parse).toHaveBeenCalledTimes(2);

            // Assert: Verify DOM manipulation for slide selector
            const slideSelectorContainer = document.getElementById(options.slideSelectorContainer);
            expect(slideSelectorContainer.children.length).toBe(2);
            expect(slideSelectorContainer.children[0].id).toBe('rId1');
            expect(slideSelectorContainer.children[1].id).toBe('rId2');

            // Assert: Verify active slide rendering via store subscription
            const slideViewerContainer = document.getElementById(options.slideViewerContainer);
            expect(slideViewerContainer.children.length).toBeGreaterThan(0);
            expect(slideViewerContainer.firstElementChild.id).toBe('slide-viewer-rId1');
            expect(mockSlideHandlerInstance.newSlideContainer).toHaveBeenCalledWith('slide-viewer-rId1', true);

            // Act: Simulate changing the active slide
            presentationStore.dispatch({ payload: { activeSlide: 'rId2' } });

            // Assert: Verify the new slide is rendered
            expect(slideViewerContainer.children.length).toBe(1);
            expect(slideViewerContainer.firstElementChild.id).toBe('slide-viewer-rId2');
            expect(mockSlideHandlerInstance.newSlideContainer).toHaveBeenCalledWith('slide-viewer-rId2', true);
            expect(mockSlideHandlerInstance.render).toHaveBeenCalledTimes(4); // 2 for thumbnails, 2 for main view
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should return a message when no slides are found', async () => {
            // Arrange
            vi.mocked(utils.getSlideOrder).mockReturnValue([]);

            // Act
            const result = await slideshowHandler(options);

            // Assert
            expect(result.slideshowLength).toBe("No slides found in the presentation.");
            expect(SlideHandler).not.toHaveBeenCalled();
        });

        it('should handle presentations with no theme', async () => {
            // Arrange
            vi.mocked(utils.getRelationships).mockResolvedValue({
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: 'slides/slide1.xml' },
            });
            vi.mocked(utils.getSlideOrder).mockReturnValue(['rId1']);
            vi.mocked(utils.parseTheme).mockReturnValue(null);

            // Act & Assert
            await expect(slideshowHandler(options)).resolves.not.toThrow();
            expect(presentationStore.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
                payload: expect.objectContaining({ theme: expect.any(Object) })
            }));
            expect(SlideHandler).toHaveBeenCalledOnce();
        });

        it('should throw a formatted error if parsing fails', async () => {
            // Arrange
            const parsingError = new Error('Failed to get relationships');
            vi.mocked(utils.getRelationships).mockRejectedValue(parsingError);

            // Act & Assert
            await expect(slideshowHandler(options)).rejects.toThrow('Error: Could not parse presentation. Failed to get relationships');
        });

        it('should not process a slide if its relationship is missing', async () => {
            // Arrange
            vi.mocked(utils.getSlideOrder).mockReturnValue(['rId1', 'rId2']); // rId2 is missing from rels
            vi.mocked(utils.getRelationships).mockResolvedValue({
                'rId1': { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: 'slides/slide1.xml' },
            });

            // Act
            await slideshowHandler(options);

            // Assert
            expect(SlideHandler).toHaveBeenCalledOnce();
            expect(slideStores.set).toHaveBeenCalledOnce();
            expect(slideStores.set).toHaveBeenCalledWith('rId1', expect.any(Object));
        });
    });
});
