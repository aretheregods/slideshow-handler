import { BlobReader, ZipReader } from "zipjs";
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
import { PPTXHandler } from './pptxHandler.js';
import { createSlideStore, presentationStore, slideStores } from './slideshowDataStore.js';

export async function slideshowHandler( { file, slideshowContainer } ) {
    const zipReader = new ZipReader( new BlobReader( file ) );
    try {
        const entries = await zipReader.getEntries();
        const entriesMap = new Map( entries.map( entry => [ entry.filename, entry ] ) );

        presentationStore.dispatch( { type: actions.start.parsing } );

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
                const tableStylesResult = parseTableStyles( tableStylesXml );
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

        for ( let i = 0; i < slideIds.length; i++ ) {
            const slideNum = i + 1;
            const slideId = slideIds[ i ];
            const slideRel = presRels[ slideId ];
            if ( !slideRel ) continue;

            const slidePath = resolvePath( 'ppt', slideRel.target );
            const slideRelsPath = `ppt/slides/_rels/${ slidePath.split( '/' ).pop() }.rels`;
            const slideRels = await getRelationships( entriesMap, slideRelsPath );
            const sortedSlideRels = Object.values( slideRels ).sort( ( a, b ) => a.id.localeCompare( b.id, undefined, { numeric: true } ) );

            const imageMap = {};
            await populateImageMap( imageMap, slideRels, 'ppt/slides', entriesMap );


            const slideContext = {
                theme: theme,
                colorMap: {},
                tableStyles: tableStyles,
                defaultTableStyleId: defaultTableStyleId,
            };

            const layoutRel = sortedSlideRels.find( r => r.type.endsWith( '/slideLayout' ) );

            let masterPlaceholders = {};
            let layoutPlaceholders = {};
            let defaultTextStyles = {};
            let masterXml, layoutXml;

            let masterStaticShapes = [], layoutStaticShapes = [];
            if ( layoutRel ) {
                const layoutPath = resolvePath( 'ppt/slides', layoutRel.target );
                const layoutRelsPath = `ppt/slideLayouts/_rels/${ layoutPath.split( '/' ).pop() }.rels`;
                const layoutRels = await getRelationships( entriesMap, layoutRelsPath );
                await populateImageMap( imageMap, layoutRels, 'ppt/slideLayouts', entriesMap );
                const sortedLayoutRels = Object.values( layoutRels ).sort( ( a, b ) => a.id.localeCompare( b.id, undefined, { numeric: true } ) );
                const masterRel = sortedLayoutRels.find( r => r.type.endsWith( '/slideMaster' ) );

                let masterData;
                if ( masterRel ) {
                    const masterPath = resolvePath( 'ppt/slideLayouts', masterRel.target );
                    const masterRelsPath = `ppt/slideMasters/_rels/${ masterPath.split( '/' ).pop() }.rels`;
                    const masterRels = await getRelationships( entriesMap, masterRelsPath );
                    await populateImageMap( imageMap, masterRels, 'ppt/slideMasters', entriesMap );

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

            const slideBg = parseBackground( slideXmlDoc, slideContext );
            const layoutBg = layoutXmlDoc ? parseBackground( layoutXmlDoc, slideContext ) : null;
            const masterBg = masterXmlDoc ? parseBackground( masterXmlDoc, slideContext ) : null;
            const finalBg = slideBg || layoutBg || masterBg;
            const { theme: _, ...slideStoreProps } = slideContext;

            slideStores.set( slideId, createSlideStore( {
                id: slideId,
                state: { background: finalBg, slideContext: slideStoreProps, slideNum }
            } ) );
            console.log( ...slideStores.entries() );

            const slideContainer = document.createElement( 'div' );
            slideContainer.className = 'slide-viewer';
            slideContainer.id = `slide-${ i + 1 }`;
            slideContainer.style.aspectRatio = `${ slideSize.width } / ${ slideSize.height }`;
            slideContainer.style.width = `${ slideSize.width }px`;
            slideContainer.style.height = `${ slideSize.height }px`;
            slideshowContainer.appendChild( slideContainer );

            const pptxHandler = new PPTXHandler( {
                slideXml,
                slideContainer,
                masterPlaceholders,
                layoutPlaceholders,
                slideId,
                slideNum,
                slideSize,
                defaultTextStyles,
                imageMap,
                slideContext,
                finalBg,
                showMasterShapes,
                masterStaticShapes,
                layoutStaticShapes,
                slideRels,
                entriesMap
            } );
            await pptxHandler.parse(presentationStore).render();
        }

        return { slideshowLength: slideIds.length }

    } catch ( error ) {
        console.error( 'Error parsing the presentation:', error );
        if ( error instanceof Error ) throw new Error(`Error: Could not parse presentation. ${ error.message }`);
    } finally {
        await zipReader.close();
    }
}