import JSZip from "jszip";
import {
    parseXmlString,
    resolvePath,
    getNormalizedXmlString,
    getRelationships,
    getSlideOrder,
    getSlideSize,
    parseTheme,
    parseTableStyles,
    parseMasterOrLayout,
    parseBackground,
    populateImageMap
} from 'utils';
import { PML_NS, slideshowProcessingActions as actions } from 'constants';
import { SlideHandler } from './slideHandler.js';
import { createSlideStore, presentationStore, slideStores } from './slideshowDataStore.js';

/**
 * Processes a presentation file, parses its contents, and renders the slides.
 * This function orchestrates the entire workflow from file reading to rendering,
 * including handling presentation metadata, slide order, themes, and slide-specific content.
 *
 * @param {object} options - The options for handling the slideshow.
 * @param {File} options.file - The presentation file to process (e.g., a .pptx file).
 * @param {string} options.slideViewerContainer - The ID of the DOM element to render the active slide into.
 * @param {string} options.slideSelectorContainer - The ID of the DOM element to render the slide thumbnails into.
 * @returns {Promise<object>} A promise that resolves with an object containing the slideshow length, the active slide ID, and an unsubscribe function for the presentation store.
 * @throws {Error} If the presentation file cannot be parsed.
 */
export async function slideshowHandler( { file, slideViewerContainer, slideSelectorContainer } ) {
	const slideHandlers = {};
	slideStores.clear();
    presentationStore.dispatch( { type: actions.start.parsing } );

    try {
        const zip = await JSZip.loadAsync(file);
        const entriesMap = zip.files;

        const presRels = await getRelationships( entriesMap, "ppt/_rels/presentation.xml.rels" );
        const sortedPresRels = Object.values( presRels ).sort( ( a, b ) => a.id.localeCompare( b.id, undefined, { numeric: true } ) );

        let theme = null;
        const themeRel = sortedPresRels.find( rel => rel.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme' );
        if ( themeRel ) {
            const themePath = resolvePath( 'ppt', themeRel.target );
            const themeXml = await getNormalizedXmlString( entriesMap, themePath );
            if ( themeXml ) {
                theme = parseTheme( themeXml );
                presentationStore.dispatch( { type: actions.set.presentation.data, payload: { theme } } );
            };
        }

        let tableStyles = {};
        let defaultTableStyleId = null;
        const tableStylesRel = sortedPresRels.find( rel => rel.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles' );
        if ( tableStylesRel ) {
            const tableStylesPath = resolvePath( 'ppt', tableStylesRel.target );
            const tableStylesXml = await getNormalizedXmlString( entriesMap, tableStylesPath );
            if ( tableStylesXml ) {
                const tableStylesResult = parseTableStyles( tableStylesXml, theme );
                tableStyles = tableStylesResult.styles;
                defaultTableStyleId = tableStylesResult.defaultStyleId;
                presentationStore.dispatch( {
                    type: actions.set.presentation.data,
                    payload: { tableStyles, defaultTableStyleId }
                } );
            }
        }

        const presentationXml = await getNormalizedXmlString( entriesMap, "ppt/presentation.xml" );
        const slideIds = getSlideOrder( presentationXml );

        const slideSize = getSlideSize( presentationXml );

        if ( slideIds.length === 0 ) {
            return { slideshowLength: "No slides found in the presentation." };
        }

        const staticParsingData = {
            tableStyles,
            defaultTableStyleId,
            entriesMap
        }

        for ( let i = 0; i < slideIds.length; i++ ) {
            const slideNum = i + 1;
            const slideId = slideIds[ i ];
            const slideRel = presRels[ slideId ];
            if ( !slideRel ) continue;

            const slidePath = resolvePath( 'ppt', slideRel.target );
            const slideRelsPath = `ppt/slides/_rels/${ slidePath.split( '/' ).pop() }.rels`;
            const slideRels = await getRelationships( entriesMap, slideRelsPath );
            const sortedSlideRels = Object.values( slideRels ).sort( ( a, b ) => a.id.localeCompare( b.id, undefined, { numeric: true } ) );

            const slideImageMap = {};
            await populateImageMap( slideImageMap, slideRels, 'ppt/slides', entriesMap );

            const slideContext = {
                theme: theme,
                colorMap: {},
            };

            const layoutRel = sortedSlideRels.find( r => r.type.endsWith( '/slideLayout' ) );

            let masterPlaceholders = {};
            let layoutPlaceholders = {};
            let defaultTextStyles = {};
            let masterXml, layoutXml;
            let masterImageMap = {}, layoutImageMap = {};

            let masterStaticShapes = [], layoutStaticShapes = [];
            if ( layoutRel ) {
                const layoutPath = resolvePath( 'ppt/slides', layoutRel.target );
                const layoutRelsPath = `ppt/slideLayouts/_rels/${ layoutPath.split( '/' ).pop() }.rels`;
                const layoutRels = await getRelationships( entriesMap, layoutRelsPath );
                await populateImageMap( layoutImageMap, layoutRels, 'ppt/slideLayouts', entriesMap );
                const sortedLayoutRels = Object.values( layoutRels ).sort( ( a, b ) => a.id.localeCompare( b.id, undefined, { numeric: true } ) );
                const masterRel = sortedLayoutRels.find( r => r.type.endsWith( '/slideMaster' ) );

                let masterData;
                if ( masterRel ) {
                    const masterPath = resolvePath( 'ppt/slideLayouts', masterRel.target );
                    const masterRelsPath = `ppt/slideMasters/_rels/${ masterPath.split( '/' ).pop() }.rels`;
                    const masterRels = await getRelationships( entriesMap, masterRelsPath );
                    await populateImageMap( masterImageMap, masterRels, 'ppt/slideMasters', entriesMap );

                    masterXml = await getNormalizedXmlString( entriesMap, masterPath );
                    if ( masterXml ) {
                        masterData = parseMasterOrLayout( masterXml, theme, null, false );
                    }
                    masterPlaceholders = masterData.placeholders;
                    masterStaticShapes = masterData.staticShapes;
                    defaultTextStyles = masterData.defaultTextStyles;
                    slideContext.colorMap = masterData.colorMap;
                }

                let layoutData;
                layoutXml = await getNormalizedXmlString( entriesMap, layoutPath );
                if ( layoutXml ) {
                    layoutData = parseMasterOrLayout( layoutXml, theme, masterData ? masterData.colorMap : null, true );
                }
                layoutPlaceholders = layoutData.placeholders;
                layoutStaticShapes = layoutData.staticShapes;
                if ( layoutData.colorMapOverride ) {
                    slideContext.colorMap = { ...slideContext.colorMap, ...layoutData.colorMapOverride };
                }
            }

            const slideXml = await getNormalizedXmlString( entriesMap, slidePath );

            const slideXmlDoc = parseXmlString( slideXml, `slide ${ slideId }` );
            const layoutXmlDoc = layoutXml ? parseXmlString( layoutXml, `layout for slide ${ slideId }` ) : null;
            const masterXmlDoc = masterXml ? parseXmlString( masterXml, `master for slide ${ slideId }` ) : null;

            const sldNode = slideXmlDoc.getElementsByTagNameNS( PML_NS, 'sld' )[ 0 ];
            const showMasterShapes = !sldNode || sldNode.getAttribute( 'showMasterSp' ) !== '0';

            let finalBg;
            const slideBg = parseBackground( slideXmlDoc, slideContext );
            const layoutBg = layoutXmlDoc ? parseBackground( layoutXmlDoc, slideContext ) : null;
            const masterBg = masterXmlDoc ? parseBackground( masterXmlDoc, slideContext ) : null;

            if ( slideBg ) {
                finalBg = { ...slideBg, source: 'slide' };
            } else if ( layoutBg ) {
                finalBg = { ...layoutBg, source: 'layout' };
            } else if ( masterBg ) {
                finalBg = { ...masterBg, source: 'master' };
            }

            const slideContainer = document.createElement( 'div' );
            slideContainer.className = 'slide-selector';
            slideContainer.id = slideId;
            slideContainer.style.aspectRatio = `${ slideSize.width } / ${ slideSize.height }`;
            slideContainer.style.width = `10em`;
            slideContainer.style.height = `${ 10 / ( slideSize.width / slideSize.height ) }em`;
            const slideSelector = document.getElementById( slideSelectorContainer )
            slideSelector.appendChild( slideContainer );
            slideContainer.addEventListener( 'click', ( event ) => {
                presentationStore.dispatch( { type: actions.set.presentation.data, payload: { activeSlide: event.currentTarget.id } } );
            } );

            const parsingData = {
                slideXml,
                slideContainer: slideContainer.id,
                masterPlaceholders,
                layoutPlaceholders,
                slideId,
                slideNum,
                slideSize,
                defaultTextStyles,
                slideImageMap,
                layoutImageMap,
                masterImageMap,
                slideContext,
                finalBg,
                showMasterShapes,
                masterStaticShapes,
                layoutStaticShapes,
                slideRels,
            }

            slideStores.set( slideId, createSlideStore( {
                id: slideId,
                state: { id: slideId, parsingData }
            } ) );

            const slideHandler = new SlideHandler( { ...parsingData, ...staticParsingData } );
			const renderingData = await slideHandler.parse();
			slideHandlers[slideId] = slideHandler;

            const slide = slideStores.get( slideId );
            slide.dispatch( { type: actions.set.slide.data, payload: { renderingData } } );

            if ( presentationStore.getState( 'status' ) !== 'rendering' ) {
                presentationStore.dispatch( { type: actions.start.rendering } );
            }

            await slideHandler.render( renderingData );
        }

        presentationStore.dispatch( { type: actions.set.presentation.data, payload: { id: crypto.randomUUID() } } );
		const unsubscribePresentation = presentationStore.subscribe( {
			key: [ 'id', 'activeSlide' ], callback: ( { id: newId, activeSlide: newActiveSlide }, { id: oldId, activeSlide: oldActiveSlide } ) => {
                if (
                    ( newActiveSlide !== oldActiveSlide || newId !== oldId ) &&
                    slideStores.has( newActiveSlide
                ) ) {
					if ( !slideHandlers[ newActiveSlide ] ) return;
					const activeSlide = newActiveSlide;
					const slide = slideStores.get( activeSlide );
					const slideViewContainer = document.getElementById( slideViewerContainer );
					const availableWidth = slideViewContainer.clientWidth;

					const slideSize = slide.getState( 'parsingData.slideSize' );
					const slideContainer = document.createElement( 'div' );
					slideContainer.className = 'slide-viewer';
					slideContainer.id = `slide-viewer-${ activeSlide }`;
					slideContainer.style.aspectRatio = `${ slideSize.width } / ${ slideSize.height }`;
					slideContainer.style.width = `${ availableWidth - 16 }px`;
					slideContainer.style.height = `${ availableWidth - 16 / ( slideSize.width / slideSize.height ) }px`;
					const currentSlide = slideViewContainer.firstElementChild
					if ( currentSlide ) {
						currentSlide.replaceWith( slideContainer );
					} else {
						slideViewContainer.appendChild( slideContainer );
					}

					const renderingData = slide.getState( 'renderingData' );
					const slideHandler = slideHandlers[ activeSlide ].newSlideContainer( slideContainer.id );
					slideHandler.render( renderingData );
					slideContainer.addEventListener('click', event => {
						event.stopPropagation();
						console.log(event.target.closest('[id]'));
					})
				}
			}
		} );
        presentationStore.dispatch( { type: actions.set.presentation.data, payload: { activeSlide: slideIds[ 0 ], status: 'presenting' } } );

        const activeSlide = presentationStore.getState( 'activeSlide' );

        return { slideshowLength: slideIds.length, activeSlide, unsubscribePresentation }

    } catch ( error ) {
        console.error( 'Error parsing the presentation:', error );
        if ( error instanceof Error ) throw new Error(`Error: Could not parse presentation. ${ error.message }`);
    }
}
