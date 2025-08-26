export function getSlideOrder(xmlString) {
    const ids = [];
    const regex = /<[^>:]*:sldId[^>]+r:id="([^"]+)"/g;
    let match;
    while ((match = regex.exec(xmlString)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}
