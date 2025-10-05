import { slideshowProcessingActions as actions, messageType } from './constants.js';
import { SlideRenderer } from './slideRenderer.js';
import { createSlideStore, presentationStore, slideStores } from './slideshowDataStore.js';

export function slideshowHandler( { file, slideViewerContainer, slideSelectorContainer } ) {
    const slideRenderers = {};
    slideStores.clear();
    presentationStore.dispatch( { type: actions.start.parsing } );

    const worker = new Worker( './src/parser.worker.js', { type: 'module' } );

    worker.postMessage( { file } );

    return new Promise( ( resolve, reject ) => {
        worker.onmessage = async ( event ) => {
            if ( event.data.type === messageType.error ) {
                console.error( 'Error parsing the presentation:', event.data.error );
                reject( new Error( `Error: Could not parse presentation. ${ event.data.error }` ) );
                worker.terminate();
                return;
            }

            const { theme, tableStyles, defaultTableStyleId, slideSize, slides } = event.data.data;

            presentationStore.dispatch( { type: actions.set.presentation.data, payload: { theme, tableStyles, defaultTableStyleId, slideSize } } );

            if ( slides.length === 0 ) {
                resolve( { slideshowLength: "No slides found in the presentation." } );
                worker.terminate();
                return;
            }

            const slideIds = slides.map( s => s.id );

            for ( const slideInfo of slides ) {
                const { id: slideId, data: renderingData } = slideInfo;

                const slideContainer = document.createElement( 'div' );
                slideContainer.className = 'slide-selector';
                slideContainer.id = slideId;
                slideContainer.style.aspectRatio = `${ slideSize.width } / ${ slideSize.height }`;
                slideContainer.style.width = `10em`;
                slideContainer.style.height = `${ 10 / ( slideSize.width / slideSize.height ) }em`;
                document.getElementById( slideSelectorContainer ).appendChild( slideContainer );
                slideContainer.addEventListener( 'click', () => {
                    presentationStore.dispatch( { type: actions.change.slide, payload: slideId } );
                } );

                const slideStore = createSlideStore( {
                    id: slideId,
                    state: { id: slideId, renderingData, slideSize }
                } );
                slideStores.set( slideId, slideStore );

                const slideRenderer = new SlideRenderer( {
                    slideContainer: slideContainer.id,
                    slideId,
                    slideSize,
                    slideContext: { theme, colorMap: {} },
                } );

                slideRenderers[ slideId ] = slideRenderer;

                if ( presentationStore.getState( 'status' ) !== 'rendering' ) {
                    presentationStore.dispatch( { type: actions.start.rendering } );
                }

                await slideRenderer.render( renderingData );
            }

            presentationStore.dispatch( { type: actions.set.presentation.data, payload: { id: crypto.randomUUID() } } );

            const unsubscribePresentation = presentationStore.subscribe( {
                key: [ 'id', 'activeSlide', 'activeElement' ],
                callback: ( { id: newId, activeSlide: newActiveSlide, activeElement: newActiveElement }, { id: oldId, activeSlide: oldActiveSlide, activeElement: oldActiveElement } ) => {
                    const slideChanged = newActiveSlide !== oldActiveSlide || newId !== oldId;
                    const activeElementChanged = newActiveElement !== oldActiveElement;

                    if ( ( slideChanged || activeElementChanged ) && slideStores.has( newActiveSlide ) ) {
                        if ( !slideRenderers[ newActiveSlide ] ) return;

                        const activeSlide = newActiveSlide;
                        const slide = slideStores.get( activeSlide );
                        const slideRenderer = slideRenderers[ activeSlide ];
                        const renderingData = slide.getState( 'renderingData' );
                        const slideSize = slide.getState( 'slideSize' );

                        if ( slideChanged ) {
                            const slideViewContainer = document.getElementById( slideViewerContainer );
                            const availableWidth = slideViewContainer.clientWidth;

                            const slideContainer = document.createElement( 'div' );
                            slideContainer.className = 'slide-viewer';
                            slideContainer.id = `slide-viewer-${ activeSlide }`;
                            slideContainer.style.aspectRatio = `${ slideSize.width } / ${ slideSize.height }`;
                            slideContainer.style.width = `${ availableWidth - 16 }px`;
                            slideContainer.style.height = `${ ( availableWidth - 16 ) / ( slideSize.width / slideSize.height ) }px`;

                            const currentSlide = slideViewContainer.firstElementChild;
                            if ( currentSlide ) {
                                currentSlide.replaceWith( slideContainer );
                            } else {
                                slideViewContainer.appendChild( slideContainer );
                            }

                            slideRenderer.newSlideContainer( slideContainer.id );
                            slideContainer.addEventListener( 'click', event => {
                                event.stopPropagation();
                                let targetId = event.target.closest( '[id]' )?.id;
                                if ( targetId ) {
                                    if ( targetId.endsWith( '.text' ) ) {
                                        targetId = targetId.substring( 0, targetId.lastIndexOf( '.text' ) );
                                    } else if ( targetId.endsWith( '.image' ) ) {
                                        targetId = targetId.substring( 0, targetId.lastIndexOf( '.image' ) );
                                    }
                                    presentationStore.dispatch( { type: actions.set.slide.element.active, payload: targetId } );
                                }
                            } );
                        }

                        slideRenderer.render( renderingData, newActiveElement );
                    }
                }
            } );

            presentationStore.dispatch( { type: actions.set.presentation.data, payload: { activeSlide: slideIds[ 0 ], status: 'presenting' } } );

            const activeSlide = presentationStore.getState( 'activeSlide' );
            resolve( { slideshowLength: slideIds.length, activeSlide, unsubscribePresentation } );
            worker.terminate();
        };

        worker.onerror = ( error ) => {
            console.error( 'Worker error:', error );
            reject( new Error( 'A critical error occurred in the parsing worker.' ) );
            worker.terminate();
        };
    } );
}