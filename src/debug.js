import { parseTable } from './parsers/tableParser';
import { getCellFillColor, getCellBorders } from './utils/drawing';
import { ColorParser } from './utils/colorParser';
import { parseSlide } from './parsers/slideParser';

console.log("Debug script started");

async function debugTableStyles() {
    // XML strings will be pasted here
    const slideXml = `...`;
    const slideLayoutXml = `...`;
    const slideMasterXml = `...`;
    const themeXml = `...`;
    const tableStylesXml = `...`;

    const parser = new DOMParser();
    const slideDoc = parser.parseFromString(slideXml, "application/xml");
    const slideLayoutDoc = parser.parseFromString(slideLayoutXml, "application/xml");
    const slideMasterDoc = parser.parseFromString(slideMasterXml, "application/xml");
    const themeDoc = parser.parseFromString(themeXml, "application/xml");
    const tableStylesDoc = parser.parseFromString(tableStylesXml, "application/xml");

    const slideContext = {
        theme: {
            // Simplified theme object for debugging
        },
        tableStyles: {
            // Simplified table styles for debugging
        }
    };

    // Find the table in the slide
    const graphicFrame = slideDoc.getElementsByTagName('p:graphicFrame')[0];
    if (graphicFrame) {
        const tableNode = graphicFrame.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'tbl')[0];
        if (tableNode) {
            console.log("Table node found. Proceeding with debug...");
            // ... rest of the debugging logic ...
        } else {
            console.log("Table node not found in slide XML.");
        }
    } else {
        console.log("Graphic frame not found in slide XML.");
    }
}

debugTableStyles().catch(e => console.error(e));
