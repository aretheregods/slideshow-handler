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
        console.error(`XML Parsing Error in ${identifier}:`, errorNode.innerHTML);
        console.log(`Problematic XML for ${identifier}:`, xmlString);
    }
    return xmlDoc;
}
