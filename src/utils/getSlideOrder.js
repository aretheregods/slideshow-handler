/**
 * Extracts the slide order from the presentation.xml file.
 * @param {string} xmlString - The XML content of the presentation.xml file.
 * @returns {string[]} An array of slide relationship IDs in order.
 */
export function getSlideOrder(xmlString) {
    const ids = [];
    const regex = /<(?:[^>:]*:)?sldId[^>]+r:id="([^"]+)"/g;
    let match;
    while ((match = regex.exec(xmlString)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}
