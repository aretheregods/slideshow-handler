/**
 * Function to find a placeholder from within an object of placeholders identified by their idx or key or element type
 * 
 * @param {string} phKey - The identifier key of the placeholder to be found 
 * @param {string} phType - The element attribute type of the placeholder
 * @param {Object<string, HTMLElement>} placeholders - A object containing string key identifiers to placeholder elements from an XML document 
 * @returns {string|null} The placeholder found or null if no placeholder was found
 */
export function findPlaceholder( phKey, phType, placeholders ) {
    if ( !placeholders ) {
        return null;
    }

    const ph = placeholders[ phKey ] || placeholders[ phType ];
    // Direct match by key (e.g., 'idx_1' or 'title')
    if ( ph ) {
        return ph;
    }
    // Fallback for generic body placeholders by type
    if ( phType && phType.startsWith( 'body' ) ) {
        return placeholders[ 'body' ];
    }
    // Fallback for generic title placeholders by type
    if ( phType && ( phType === 'title' || phType === 'ctrTitle' ) ) {
        return placeholders[ 'title' ];
    }
    return null;
}