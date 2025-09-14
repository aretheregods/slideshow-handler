/**
 * Parses an XML string into an XML document.
 * @param {string} xmlString - The XML string to parse.
 * @param {string} identifier - An identifier for the XML source, used for error logging.
 * @returns {XMLDocument} The parsed XML document.
 */
export function parseXmlString(xmlString, identifier) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        const error = new Error(`XML Parsing Error in ${identifier}: ${errorNode.textContent}`);
        error.xmlString = xmlString;
        error.identifier = identifier;
        throw error;
    }
    return xmlDoc;
}
