import { EMU_PER_PIXEL } from "../constants.js";

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
