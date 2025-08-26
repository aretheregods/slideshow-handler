import { TextWriter } from "https://deno.land/x/zipjs/index.js";

export async function getNormalizedXmlString( entriesMap, path ) {
    const entry = entriesMap.get( path );
    if ( !entry ) return null;

    const writer = new TextWriter();
    let xmlString = await entry.getData( writer );

    // Strip BOM if present, as it can interfere with XML parsing on some platforms.
    if ( xmlString.charCodeAt( 0 ) === 0xFEFF ) {
        xmlString = xmlString.substring( 1 );
    }

    // Normalize line endings to prevent cross-platform parsing issues.
    return xmlString.replace( /\\r\\n/g, '\n' ).replace( /\\r/g, '\n' );
}
