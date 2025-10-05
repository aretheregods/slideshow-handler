import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slideshowHandler } from './slideshowHandler.js';
import { SlideRenderer } from './slideRenderer.js';
import { presentationStore, slideStores, createSlideStore } from './slideshowDataStore.js';
import { slideshowProcessingActions as actions, messageType } from './constants.js';

// Mock Worker
const mockWorker = {
    postMessage: vi.fn(),
    onmessage: null,
    onerror: null,
    terminate: vi.fn(),
};
vi.stubGlobal('Worker', vi.fn(() => mockWorker));


// Mock SlideRenderer
const mockSlideRendererInstance = {
    render: vi.fn().mockResolvedValue(undefined),
    newSlideContainer: vi.fn().mockReturnThis(),
};
vi.mock('./slideRenderer.js', () => ({
    SlideRenderer: vi.fn(() => mockSlideRendererInstance),
}));

// Mock Data Stores
vi.mock('./slideshowDataStore.js', () => {
    const mockSlideStore = {
        dispatch: vi.fn(),
        getState: vi.fn((key) => {
            if (key === 'renderingData') {
                return { shapes: [], background: null, imageMaps: {} };
            }
            if (key === 'slideSize') {
                return { width: 960, height: 540 };
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
            // Manually trigger subscription for the active slide change
            if (action.type === actions.set.presentation.data && action.payload.activeSlide) {
                presentationStoreSubscribers.forEach(sub => sub.callback({ ...presentationStoreState }, oldState));
            }
             if (action.type === actions.change.slide) {
                const oldActiveSlide = oldState.activeSlide;
                presentationStoreState.activeSlide = action.payload;
                 presentationStoreSubscribers.forEach(sub => sub.callback({ ...presentationStoreState }, { ...oldState, activeSlide: oldActiveSlide }));
            }
        }),
        subscribe: vi.fn((subscriber) => {
            presentationStoreSubscribers.push(subscriber);
            return () => {
                presentationStoreSubscribers = presentationStoreSubscribers.filter(s => s !== subscriber);
            };
        }),
        getState: vi.fn((key) => presentationStoreState[key]),
        clear: () => {
            presentationStoreState = { activeSlide: '' };
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
            <div id="slide-viewer-container" style="width: 800px;"></div>
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
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
    });

    it('should be defined', () => {
        expect(slideshowHandler).toBeDefined();
    });

    describe('Happy Path', () => {
        it('should process a presentation and render slides via worker', async () => {
            // Arrange
            const mockParsedData = {
                theme: { name: 'mockTheme' },
                tableStyles: {},
                defaultTableStyleId: null,
                slideSize: { width: 960, height: 540 },
                slides: [
                    { id: 'rId1', data: { shapes: [], background: null, imageMaps: {} } },
                    { id: 'rId2', data: { shapes: [], background: null, imageMaps: {} } },
                ],
            };

            // Act
            const handlerPromise = slideshowHandler(options);

            // Simulate worker sending data
            mockWorker.onmessage({ data: { type: messageType.success, data: mockParsedData } });

            const result = await handlerPromise;

            // Assert: Verify the overall process
            expect(result.slideshowLength).toBe(2);
            expect(result.activeSlide).toBe('rId1');
            expect(Worker).toHaveBeenCalledWith('./src/parser.worker.js', { type: 'module' });
            expect(mockWorker.postMessage).toHaveBeenCalledWith({ file: options.file });
            expect(presentationStore.dispatch).toHaveBeenCalledWith({ type: actions.start.parsing });
            expect(presentationStore.dispatch).toHaveBeenCalledWith(expect.objectContaining({
                type: actions.set.presentation.data,
                payload: {
                    theme: mockParsedData.theme,
                    tableStyles: mockParsedData.tableStyles,
                    defaultTableStyleId: mockParsedData.defaultTableStyleId,
                    slideSize: mockParsedData.slideSize,
                }
            }));

            // Assert: Verify slide processing loop
            expect(createSlideStore).toHaveBeenCalledTimes(2);
            expect(slideStores.set).toHaveBeenCalledWith('rId1', expect.any(Object));
            expect(slideStores.set).toHaveBeenCalledWith('rId2', expect.any(Object));
            expect(SlideRenderer).toHaveBeenCalledTimes(2);
            expect(mockSlideRendererInstance.render).toHaveBeenCalledTimes(2);

            // Assert: Verify DOM manipulation for slide selector
            const slideSelectorContainer = document.getElementById(options.slideSelectorContainer);
            expect(slideSelectorContainer.children.length).toBe(2);
            expect(slideSelectorContainer.children[0].id).toBe('rId1');
            expect(slideSelectorContainer.children[1].id).toBe('rId2');

            // Assert: Verify active slide rendering via store subscription
            presentationStore.dispatch({ type: actions.set.presentation.data, payload: { activeSlide: 'rId1' } });
            const slideViewerContainer = document.getElementById(options.slideViewerContainer);
            expect(slideViewerContainer.children.length).toBeGreaterThan(0);
            expect(slideViewerContainer.firstElementChild.id).toBe('slide-viewer-rId1');
            expect(mockSlideRendererInstance.newSlideContainer).toHaveBeenCalledWith('slide-viewer-rId1');
            expect(mockSlideRendererInstance.render).toHaveBeenCalledTimes(3);

            // Act: Simulate changing the active slide
            presentationStore.dispatch({ type: actions.change.slide, payload: 'rId2' });

            // Assert: Verify the new slide is rendered
            expect(slideViewerContainer.children.length).toBe(1);
            expect(slideViewerContainer.firstElementChild.id).toBe('slide-viewer-rId2');
            expect(mockSlideRendererInstance.newSlideContainer).toHaveBeenCalledWith('slide-viewer-rId2');
            expect(mockSlideRendererInstance.render).toHaveBeenCalledTimes(4);

            // Assert: Worker is terminated
            expect(mockWorker.terminate).toHaveBeenCalled();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should return a message when no slides are found', async () => {
            // Arrange
            const mockParsedData = { slides: [] };

            // Act
            const handlerPromise = slideshowHandler(options);
            mockWorker.onmessage({ data: { type: messageType.success, data: mockParsedData } });
            const result = await handlerPromise;

            // Assert
            expect(result.slideshowLength).toBe("No slides found in the presentation.");
            expect(SlideRenderer).not.toHaveBeenCalled();
            expect(mockWorker.terminate).toHaveBeenCalled();
        });

        it('should reject with a formatted error if worker sends an error message', async () => {
            // Arrange
            const errorMessage = 'Worker failed to parse';

            // Act
            const handlerPromise = slideshowHandler(options);
            mockWorker.onmessage({ data: { type: messageType.error, error: errorMessage } });

            // Assert
            await expect(handlerPromise).rejects.toThrow(`Error: Could not parse presentation. ${errorMessage}`);
            expect(mockWorker.terminate).toHaveBeenCalled();
        });

        it('should reject with a formatted error if worker fails to load', async () => {
            // Arrange
            const workerError = new Error('Failed to load worker');

            // Act
            const handlerPromise = slideshowHandler(options);
            mockWorker.onerror(workerError);

            // Assert
            await expect(handlerPromise).rejects.toThrow('A critical error occurred in the parsing worker.');
            expect(mockWorker.terminate).toHaveBeenCalled();
        });
    });
});