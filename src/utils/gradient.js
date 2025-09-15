import { ColorParser } from './colorParser.js';
import { DML_NS } from 'constants';

/**
 * Parses a gradient fill from a fill node.
 * @param {Element} fillNode - The XML node containing the gradient fill data.
 * @param {Object} slideContext - The context of the slide.
 * @returns {Object} The parsed gradient fill object.
 */
export function parseGradientFill(fillNode, slideContext) {
    const gsLstNode = fillNode.getElementsByTagNameNS(DML_NS, 'gsLst')[0];
    const stops = [];
    if (gsLstNode) {
        for (const gsNode of gsLstNode.children) {
            const pos = parseInt(gsNode.getAttribute('pos')) / 100000;
            const colorObj = ColorParser.parseColor(gsNode);
            if (colorObj) {
                stops.push({ pos, color: ColorParser.resolveColor(colorObj, slideContext, true) });
            }
        }
    }

    let angle = 0;
    let type = 'linear';
    const linNode = fillNode.getElementsByTagNameNS(DML_NS, 'lin')[0];
    if (linNode) {
        angle = parseInt(linNode.getAttribute('ang')) / 60000;
    }

    const pathNode = fillNode.getElementsByTagNameNS(DML_NS, 'path')[0];
    if(pathNode) {
        type = 'path';
    }

    return { type: 'gradient', gradient: { type, stops, angle } };
}
