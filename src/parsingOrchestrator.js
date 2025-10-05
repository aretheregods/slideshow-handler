import JSZip from 'jszip';
import {
    getNormalizedXmlString,
    getRelationships,
    getSlideOrder,
    getSlideSize,
    parseTheme,
    parseTableStyles,
    parseMasterOrLayout,
    populateImageMap,
    resolvePath,
} from 'utils';
import { SlideParser } from './slideParser.js';

export async function parsingOrchestrator( { file } ) {
    const zip = await JSZip.loadAsync( file );
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
        }
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
        }
    }

    const presentationXml = await getNormalizedXmlString( entriesMap, "ppt/presentation.xml" );
    const slideIds = getSlideOrder( presentationXml );
    const slideSize = getSlideSize( presentationXml );

    if ( slideIds.length === 0 ) {
        return { slideshowLength: "No slides found in the presentation." };
    }

    const slides = [];
    const staticParsingData = {
        tableStyles,
        defaultTableStyleId,
        entriesMap,
    };

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
        let masterPlaceholders = {}, layoutPlaceholders = {}, defaultTextStyles = {};
        let masterImageMap = {}, layoutImageMap = {};
        let masterStaticShapes = [], layoutStaticShapes = [];
        let masterXml, layoutXml;

        if ( layoutRel ) {
            const layoutPath = resolvePath( 'ppt/slides', layoutRel.target );
            const layoutRelsPath = `ppt/slideLayouts/_rels/${ layoutPath.split( '/' ).pop() }.rels`;
            const layoutRels = await getRelationships( entriesMap, layoutRelsPath );
            await populateImageMap( layoutImageMap, layoutRels, 'ppt/slideLayouts', entriesMap );
            const sortedLayoutRels = Object.values( layoutRels ).sort( ( a, b ) => a.id.localeCompare( b.id, undefined, { numeric: true } ) );
            const masterRel = sortedLayoutRels.find( r => r.type.endsWith( '/slideMaster' ) );

            if ( masterRel ) {
                const masterPath = resolvePath( 'ppt/slideLayouts', masterRel.target );
                const masterRelsPath = `ppt/slideMasters/_rels/${ masterPath.split( '/' ).pop() }.rels`;
                const masterRels = await getRelationships( entriesMap, masterRelsPath );
                await populateImageMap( masterImageMap, masterRels, 'ppt/slideMasters', entriesMap );

                masterXml = await getNormalizedXmlString( entriesMap, masterPath );
                if ( masterXml ) {
                    const masterData = parseMasterOrLayout( masterXml, theme, null, false );
                    masterPlaceholders = masterData.placeholders;
                    masterStaticShapes = masterData.staticShapes;
                    defaultTextStyles = masterData.defaultTextStyles;
                    slideContext.colorMap = masterData.colorMap;
                }
            }

            layoutXml = await getNormalizedXmlString( entriesMap, layoutPath );
            if ( layoutXml ) {
                const layoutData = parseMasterOrLayout( layoutXml, theme, masterData ? masterData.colorMap : null, true );
                layoutPlaceholders = layoutData.placeholders;
                layoutStaticShapes = layoutData.staticShapes;
                if ( layoutData.colorMapOverride ) {
                    slideContext.colorMap = { ...slideContext.colorMap, ...layoutData.colorMapOverride };
                }
            }
        }

        const slideXml = await getNormalizedXmlString( entriesMap, slidePath );
        const slideParser = new SlideParser( {
            ...staticParsingData,
            slideXml,
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
            masterStaticShapes,
            layoutStaticShapes,
            slideRels,
            masterXml,
            layoutXml,
        } );

        const parsedSlideData = await slideParser.parse();
        slides.push( { id: slideId, data: parsedSlideData } );
    }

    return {
        theme,
        tableStyles,
        defaultTableStyleId,
        slideSize,
        slides,
    };
}