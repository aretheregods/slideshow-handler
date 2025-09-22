/**
 * Retrieves and normalizes an XML string from a zip entry.
 * @param {Map<string, Object>} entriesMap - A map of zip file entries.
 * @param {string} path - The path to the XML file within the zip.
 * @returns {Promise<string|null>} A promise that resolves to the normalized XML string, or null if the entry is not found.
 */
export async function getNormalizedXmlString( entriesMap, path ) {
    const entry = entriesMap.get(path);
    if ( !entry ) return null;

    let xmlString = await entry.async("string");

    // Strip BOM if present, as it can interfere with XML parsing on some platforms.
    if ( xmlString.charCodeAt( 0 ) === 0xFEFF ) {
        xmlString = xmlString.substring( 1 );
    }

    // Normalize line endings to prevent cross-platform parsing issues.
    return xmlString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
