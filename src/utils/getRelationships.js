import { getNormalizedXmlString } from "utils";

/**
 * Parses relationship data from a .rels file.
 * @param {Map<string, Object>} entriesMap - A map of zip file entries.
 * @param {string} path - The path to the .rels file.
 * @returns {Promise<Object>} A promise that resolves to an object containing the relationships.
 */
export async function getRelationships(entriesMap, path) {
    let xmlString = await getNormalizedXmlString(entriesMap, path);
    if (!xmlString) return {};

    const rels = {};
    // Use regex to parse relationships to be resilient to XML parsing errors.
    const relRegex = /<Relationship\s+([^>]+)\/?>/g;
    const attrRegex = /(\w+)="([^"]+)"/g;

    let match;
    while ((match = relRegex.exec(xmlString)) !== null) {
        const attrs = {};
        const attributesString = match[1];
        for (const attrMatch of attributesString.matchAll(attrRegex)) {
            attrs[attrMatch[1]] = attrMatch[2];
        }

        if (attrs.Id && attrs.Type && attrs.Target) {
            rels[attrs.Id] = {
                id: attrs.Id,
                type: attrs.Type,
                target: attrs.Target
            };
        }
    }
    return rels;
}
