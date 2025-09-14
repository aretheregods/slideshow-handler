import { describe, it, expect } from 'vitest';
import { getSlideOrder } from './getSlideOrder.js';

describe('getSlideOrder', () => {
    it('should extract slide order from a standard presentation xml', () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <p:sldIdLst>
                    <p:sldId id="256" r:id="rId2"/>
                    <p:sldId id="257" r:id="rId3"/>
                    <p:sldId id="258" r:id="rId4"/>
                </p:sldIdLst>
            </p:presentation>
        `;
        expect(getSlideOrder(xmlString)).toEqual(['rId2', 'rId3', 'rId4']);
    });

    it('should return an empty array if no sldId tags are present', () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
                <p:sldIdLst>
                </p:sldIdLst>
            </p:presentation>
        `;
        expect(getSlideOrder(xmlString)).toEqual([]);
    });

    it('should return an empty array for an empty xml string', () => {
        const xmlString = '';
        expect(getSlideOrder(xmlString)).toEqual([]);
    });

    it('should handle malformed xml strings gracefully', () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
                <p:sldIdLst>
                    <p:sldId id="256" r:id="rId2"/>
                    <p:sldId id="257" r:id="rId3"
                </p:sldIdLst>
            </p:presentation>
        `;
        expect(getSlideOrder(xmlString)).toEqual(['rId2', 'rId3']);
    });

    it('should handle different namespace prefixes', () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <presentation>
                <sldIdLst>
                    <sldId id="256" r:id="rId2"/>
                    <a:sldId xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" id="257" r:id="rId3"/>
                </sldIdLst>
            </presentation>
        `;
        expect(getSlideOrder(xmlString)).toEqual(['rId2', 'rId3']);
    });

    it('should handle sldId tags with extra attributes', () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <p:sldIdLst>
                    <p:sldId id="256" r:id="rId2" customAttr="value1"/>
                    <p:sldId id="257" r:id="rId3" anotherAttr="value2"/>
                </p:sldIdLst>
            </p:presentation>
        `;
        expect(getSlideOrder(xmlString)).toEqual(['rId2', 'rId3']);
    });

    it('should ignore sldId tags without an r:id attribute', () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <p:sldIdLst>
                    <p:sldId id="256" />
                    <p:sldId id="257" r:id="rId3"/>
                    <p:sldId id="258" no_rid="some_value"/>
                </p:sldIdLst>
            </p:presentation>
        `;
        expect(getSlideOrder(xmlString)).toEqual(['rId3']);
    });
});
