/**
 * Finds a placeholder from a collection of placeholders.
 * @param {string} phKey - The key of the placeholder (e.g., 'idx_1', 'title').
 * @param {string} phType - The type of the placeholder (e.g., 'body', 'title').
 * @param {Object} placeholders - A map of placeholder keys to placeholder data.
 * @returns {Object|null} The found placeholder data, or null if not found.
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