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
