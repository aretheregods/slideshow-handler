/**
 * Parses the `extLst` element and its children from a given node.
 * This function specifically looks for `extLst` elements within either the
 * PresentationML (PML) or DrawingML (DML) namespaces.
 *
 * @param {Element} node - The parent XML node that may contain an `extLst` element.
 * @returns {Array<Object>|null} An array of extension objects, each with a 'uri' and 'xml' property,
 * or null if no `extLst` element is found or it contains no valid extensions.
 */
export function parseExtensions(node) {
    if ( !node ) {
        return null;
    }

    // Find the extLst node, checking both PML and DML namespaces just in case, though it's typically in the parent's namespace
    const extLstNode = Array.from(node.children).find(child => child.localName === 'extLst');

    if ( !extLstNode ) {
        return null;
    }

    const extensions = [];
    const extNodes = Array.from(extLstNode.children).filter(child => child.localName === 'ext');

    for ( const extNode of extNodes ) {
        const uri = extNode.getAttribute('uri');
        // Make sure to trim the innerHTML to avoid empty strings with only whitespace
        const xmlContent = extNode.innerHTML.trim();

        if ( uri && xmlContent ) {
            extensions.push({
                uri: uri,
                xml: xmlContent,
            });
        }
    }

    return extensions.length > 0 ? extensions : null;
}
