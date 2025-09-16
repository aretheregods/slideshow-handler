import { describe, it, expect } from 'vitest';
import { parseExtensions } from './extensionParser';
import { parseXmlString } from './xml';

describe('parseExtensions', () => {
    it('should return null if no node is provided', () => {
        expect(parseExtensions(null)).toBeNull();
    });

    it('should return null if no extLst node is found', () => {
        const xmlString = '<root><child/></root>';
        const xmlDoc = parseXmlString(xmlString, 'test');
        const rootNode = xmlDoc.documentElement;
        expect(parseExtensions(rootNode)).toBeNull();
    });

    it('should parse a single extension from a node', () => {
        const xmlString = `
            <root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:extLst>
                    <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
                        <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"/>
                    </a:ext>
                </a:extLst>
            </root>
        `;
        const xmlDoc = parseXmlString(xmlString, 'test');
        const rootNode = xmlDoc.documentElement;
        const extensions = parseExtensions(rootNode);

        expect(extensions).toEqual([
            {
                uri: '{28A0092B-C50C-407E-A947-70E740481C1C}',
                xml: '<a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"/>'
            }
        ]);
    });

    it('should parse multiple extensions from a node', () => {
        const xmlString = `
            <p:cNvPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:extLst>
                    <a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}">
                        <a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{D1BA6450-E291-DC40-F198-C02B485137B0}"/>
                    </a:ext>
                    <a:ext uri="{C183D7F6-B498-43B3-948B-1728B52AA6E4}">
                        <adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/>
                    </a:ext>
                </a:extLst>
            </p:cNvPr>
        `;
        const xmlDoc = parseXmlString(xmlString, 'test');
        const cNvPrNode = xmlDoc.documentElement;
        const extensions = parseExtensions(cNvPrNode);

        expect(extensions).toEqual([
            {
                uri: '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}',
                xml: '<a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{D1BA6450-E291-DC40-F198-C02B485137B0}"/>'
            },
            {
                uri: '{C183D7F6-B498-43B3-948B-1728B52AA6E4}',
                xml: '<adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/>'
            }
        ]);
    });

    it('should return null if extLst is empty', () => {
        const xmlString = `
            <root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:extLst></a:extLst>
            </root>
        `;
        const xmlDoc = parseXmlString(xmlString, 'test');
        const rootNode = xmlDoc.documentElement;
        expect(parseExtensions(rootNode)).toBeNull();
    });

    it('should ignore ext elements without a uri', () => {
        const xmlString = `
            <root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:extLst>
                    <a:ext>
                        <someXml/>
                    </a:ext>
                </a:extLst>
            </root>
        `;
        const xmlDoc = parseXmlString(xmlString, 'test');
        const rootNode = xmlDoc.documentElement;
        expect(parseExtensions(rootNode)).toBeNull();
    });
});
