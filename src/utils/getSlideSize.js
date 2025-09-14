import { EMU_PER_PIXEL } from "constants";

/**
 * Extracts the slide dimensions from the presentation.xml file.
 * @param {string} xmlString - The XML content of the presentation.xml file.
 * @returns {{width: number, height: number}} An object containing the width and height of the slides.
 */
export function getSlideSize(xmlString) {
    // Two-step regex for robustness: first find the tag, then find the attributes within it.
    const sldSzTagMatch = xmlString.match(/<[^>:]*:sldSz\s+([^>]+)\/?>/);
    if (sldSzTagMatch) {
        const attrs = sldSzTagMatch[1];
        const cxMatch = attrs.match(/cx="([^"]+)"/);
        const cyMatch = attrs.match(/cy="([^"]+)"/);
        if (cxMatch && cyMatch) {
            const cx = parseInt(cxMatch[1]);
            const cy = parseInt(cyMatch[1]);
            return { width: cx / EMU_PER_PIXEL, height: cy / EMU_PER_PIXEL };
        }
    }
    return { width: 960, height: 720 }; // Default size
}
