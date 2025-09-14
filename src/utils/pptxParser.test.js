import { describe, it, expect } from 'vitest';
import * as PptxParser from './pptxParser.js';
import { parseXmlString } from './xml.js';

describe('PptxParser', () => {
    describe('parseColorMap', () => {
        it('should return an empty object if the node is null', () => {
            const result = PptxParser.parseColorMap(null);
            expect(result).toEqual({});
        });

        it('should parse a color map from a node with attributes', () => {
            const xml = `<cmap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink" />`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseColorMap(node);
            expect(result).toEqual({
                bg1: 'lt1',
                tx1: 'dk1',
                bg2: 'lt2',
                tx2: 'dk2',
                accent1: 'accent1',
                accent2: 'accent2',
                accent3: 'accent3',
                accent4: 'accent4',
                accent5: 'accent5',
                accent6: 'accent6',
                hlink: 'hlink',
                folHlink: 'folHlink',
            });
        });

        it('should return an empty object for a node with no attributes', () => {
            const xml = `<cmap />`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseColorMap(node);
            expect(result).toEqual({});
        });
    });

    describe('parseSourceRectangle', () => {
        it('should return null if the blipFillNode is null', () => {
            const result = PptxParser.parseSourceRectangle(null);
            expect(result).toBeNull();
        });

        it('should return null if srcRect node is not found', () => {
            const xml = `<a:blipFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"></a:blipFill>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseSourceRectangle(node);
            expect(result).toBeNull();
        });

        it('should parse the source rectangle attributes', () => {
            const xml = `
                <a:blipFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:srcRect l="10000" t="20000" r="30000" b="40000" />
                </a:blipFill>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseSourceRectangle(node);
            expect(result).toEqual({
                l: 0.1,
                t: 0.2,
                r: 0.3,
                b: 0.4,
            });
        });

        it('should handle missing attributes with default values', () => {
            const xml = `<a:blipFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:srcRect /></a:blipFill>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseSourceRectangle(node);
            expect(result).toEqual({
                l: 0,
                r: 0,
                t: 0,
                b: 0,
            });
        });
    });

    describe('parseCustomGeometry', () => {
        it('should return null if custGeomNode is null', () => {
            const result = PptxParser.parseCustomGeometry(null);
            expect(result).toBeNull();
        });

        it('should return null if pathLst node is not found', () => {
            const xml = `<a:custGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"></a:custGeom>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseCustomGeometry(node);
            expect(result).toBeNull();
        });

        it('should return null if path node is not found', () => {
            const xml = `<a:custGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:pathLst /></a:custGeom>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseCustomGeometry(node);
            expect(result).toBeNull();
        });

        it('should parse custom geometry with various commands', () => {
            const xml = `
                <a:custGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:pathLst>
                        <a:path w="100" h="200">
                            <a:moveTo><a:pt x="0" y="0"/></a:moveTo>
                            <a:lnTo><a:pt x="10" y="20"/></a:lnTo>
                            <a:arcTo wR="5" hR="6" stAng="0" swAng="90" />
                            <a:quadBezTo><a:pt x="30" y="40"/><a:pt x="50" y="60"/></a:quadBezTo>
                            <a:cubicBezTo><a:pt x="70" y="80"/><a:pt x="90" y="100"/><a:pt x="110" y="120"/></a:cubicBezTo>
                            <a:close/>
                        </a:path>
                    </a:pathLst>
                </a:custGeom>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseCustomGeometry(node);
            expect(result).toEqual({
                w: 100,
                h: 200,
                commands: [
                    { cmd: 'moveTo', points: [{ x: 0, y: 0 }] },
                    { cmd: 'lnTo', points: [{ x: 10, y: 20 }] },
                    { cmd: 'arcTo', points: [] },
                    { cmd: 'quadBezTo', points: [{ x: 30, y: 40 }, { x: 50, y: 60 }] },
                    { cmd: 'cubicBezTo', points: [{ x: 70, y: 80 }, { x: 90, y: 100 }, { x: 110, y: 120 }] },
                    { cmd: 'close', points: [] },
                ],
            });
        });

        it('should return null if there are no commands', () => {
            const xml = `
                <a:custGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:pathLst>
                        <a:path w="100" h="200" />
                    </a:pathLst>
                </a:custGeom>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseCustomGeometry(node);
            expect(result).toBeNull();
        });
    });

    describe('parseGradientFill', () => {
        const slideContext = {
            theme: {
                colorScheme: {
                    accent1: '#FF0000',
                },
            },
            colorMap: {},
        };

        it('should parse a linear gradient fill', () => {
            const xml = `
                <a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:gsLst>
                        <a:gs pos="0">
                            <a:srgbClr val="000000" />
                        </a:gs>
                        <a:gs pos="100000">
                            <a:schemeClr val="accent1" />
                        </a:gs>
                    </a:gsLst>
                    <a:lin ang="5400000" scaled="1" />
                </a:gradFill>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseGradientFill(node, slideContext);
            expect(result).toEqual({
                type: 'gradient',
                gradient: {
                    type: 'linear',
                    angle: 90,
                    stops: [
                        { pos: 0, color: { color: '#000000', alpha: 1 } },
                        { pos: 1, color: { color: '#FF0000', alpha: 1 } },
                    ],
                },
            });
        });

        it('should parse a path gradient fill', () => {
            const xml = `
                <a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:gsLst>
                        <a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs>
                    </a:gsLst>
                    <a:path path="rect"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>
                </a:gradFill>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseGradientFill(node, slideContext);
            expect(result.gradient.type).toBe('path');
        });

        it('should handle empty gsLst', () => {
            const xml = `
                <a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:gsLst />
                    <a:lin ang="5400000" scaled="1" />
                </a:gradFill>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseGradientFill(node, slideContext);
            expect(result.gradient.stops).toEqual([]);
        });
    });

    describe('parseLineProperties', () => {
        const slideContext = {
            theme: { colorScheme: { accent1: '#FF0000' } },
            colorMap: {},
        };

        it('should return null if lnNode is null', () => {
            const result = PptxParser.parseLineProperties(null, slideContext);
            expect(result).toBeNull();
        });

        it('should return null if there is a noFill node', () => {
            const xml = `<a:ln xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:noFill/></a:ln>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseLineProperties(node, slideContext);
            expect(result).toBeNull();
        });

        it('should parse basic line properties', () => {
            const xml = `<a:ln w="12700" cap="rnd" cmpd="sng" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseLineProperties(node, slideContext);
            expect(result).toEqual({
                width: 1,
                cap: 'round',
                join: null,
                cmpd: 'sng',
                dash: [],
                color: '#000000',
            });
        });

        it('should parse dash properties', () => {
            const xml = `<a:ln w="9525" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:prstDash val="dash"/></a:ln>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseLineProperties(node, slideContext);
            expect(result.dash[0]).toBeCloseTo(2.25);
            expect(result.dash[1]).toBeCloseTo(3);
        });

        it('should parse join properties', () => {
            const xml = `<a:ln xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:round/></a:ln>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseLineProperties(node, slideContext);
            expect(result.join).toBe('round');
        });
    });

    describe('parseBodyProperties', () => {
        it('should return an empty object if txBodyNode is null', () => {
            const result = PptxParser.parseBodyProperties(null);
            expect(result).toEqual({});
        });

        it('should return an empty object if bodyPr node is not found', () => {
            const xml = `<p:txBody xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"></p:txBody>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseBodyProperties(node);
            expect(result).toEqual({});
        });

        it('should parse all body properties', () => {
            const xml = `
                <p:txBody xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:bodyPr anchor="ctr" lIns="12700" tIns="25400" rIns="38100" bIns="50800">
                        <a:normAutofit fontScale="50000" lnSpcReduction="20000" />
                    </a:bodyPr>
                </p:txBody>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseBodyProperties(node);
            expect(result).toEqual({
                anchor: 'ctr',
                lIns: 1,
                tIns: 2,
                rIns: 3,
                bIns: 4,
                fontScale: 0.5,
                lnSpcReduction: 0.2,
            });
        });
    });

    describe('parseParagraphProperties', () => {
        const slideContext = {
            theme: {
                colorScheme: { accent1: '#FF0000' },
                fontScheme: { major: 'Calibri', minor: 'Arial' },
            },
            colorMap: {},
        };

        it('should return an empty object if pPrNode is null', () => {
            const result = PptxParser.parseParagraphProperties(null, slideContext);
            expect(result).toEqual({});
        });

        it('should parse alignment, margin, and indent', () => {
            const xml = `<a:pPr algn="r" marL="12700" indent="-12700" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" />`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseParagraphProperties(node, slideContext);
            expect(result.align).toBe('r');
            expect(result.marL).toBe(1);
            expect(result.indent).toBe(-1);
        });

        it('should parse char bullet', () => {
            const xml = `
                <a:pPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:buChar char="•"/>
                    <a:buFont typeface="Arial"/>
                    <a:buSzPct val="100000"/>
                    <a:buClr><a:srgbClr val="FF0000"/></a:buClr>
                </a:pPr>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseParagraphProperties(node, slideContext);
            expect(result.bullet).toEqual({
                type: 'char',
                char: '•',
                font: 'Arial',
                size: '100%',
                color: { srgb: '#FF0000' },
            });
        });

        it('should parse auto-numbered bullet', () => {
            const xml = `<a:pPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:buAutoNum type="arabicPeriod" startAt="2"/></a:pPr>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseParagraphProperties(node, slideContext);
            expect(result.bullet).toEqual({
                type: 'auto',
                scheme: 'arabicPeriod',
                startAt: 2,
            });
        });

        it('should parse default run properties', () => {
            const xml = `
                <a:pPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:defRPr sz="1800" b="1" i="0">
                        <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                        <a:latin typeface="+mj-lt"/>
                    </a:defRPr>
                </a:pPr>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseParagraphProperties(node, slideContext);
            expect(result.defRPr).toEqual({
                size: 17.55,
                bold: true,
                italic: false,
                color: { scheme: 'accent1' },
                font: 'Calibri',
            });
        });
    });

    describe('parseTextStyle', () => {
        const slideContext = {
            theme: {
                colorScheme: { accent1: '#FF0000' },
                fontScheme: { major: 'Calibri', minor: 'Arial' },
            },
            colorMap: {},
        };

        it('should return null if styleNode is null', () => {
            const result = PptxParser.parseTextStyle(null, slideContext);
            expect(result).toBeNull();
        });

        it('should parse text styles for different levels', () => {
            const xml = `
                <p:titleStyle xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:lvl1pPr algn="l" />
                    <a:lvl2pPr algn="r" />
                </p:titleStyle>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseTextStyle(node, slideContext);
            expect(result[0].align).toBe('l');
            expect(result[1].align).toBe('r');
            expect(result[2]).toBeUndefined();
        });
    });

    describe('parseBackground', () => {
        const slideContext = {
            theme: {
                colorScheme: { accent1: '#FF0000' },
                formatScheme: {
                    bgFills: [
                        { type: 'solid', color: { scheme: 'accent1' } },
                    ],
                },
            },
            colorMap: {},
        };

        it('should return null if bg node is not found', () => {
            const xml = `<p:cSld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"></p:cSld>`;
            const xmlDoc = parseXmlString(xml, 'test');
            const result = PptxParser.parseBackground(xmlDoc, slideContext);
            expect(result).toBeNull();
        });

        it('should parse a solid color background', () => {
            const xml = `
                <p:cSld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="000000"/></a:solidFill></p:bgPr></p:bg>
                </p:cSld>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const result = PptxParser.parseBackground(xmlDoc, slideContext);
            expect(result).toEqual({ type: 'color', value: '#000000' });
        });

        it('should parse an image background', () => {
            const xml = `
                <p:cSld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                    <p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId2"/></a:blipFill></p:bgPr></p:bg>
                </p:cSld>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const result = PptxParser.parseBackground(xmlDoc, slideContext);
            expect(result).toEqual({ type: 'image', relId: 'rId2' });
        });

        it('should parse a theme background reference', () => {
            const xml = `
                <p:cSld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:bg><p:bgRef idx="1"><a:schemeClr val="accent1"/></p:bgRef></p:bg>
                </p:cSld>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const result = PptxParser.parseBackground(xmlDoc, slideContext);
            expect(result).toEqual({ type: 'color', value: '#FF0000' });
        });
    });

    describe('parseShapeProperties', () => {
        const slideContext = {
            theme: {
                colorScheme: { accent1: '#FF0000' },
                formatScheme: {
                    fills: [{}, { type: 'solid', color: { srgb: '#00FF00' } }],
                    lines: [{}, { type: 'solid', color: { srgb: '#0000FF' }, width: 1, cap: 'rnd', cmpd: 'sng' }],
                    effects: [{}, { type: 'outerShdw', blurRad: 1, dist: 1, dir: 1, color: { srgb: '#FFFF00' } }],
                },
            },
            colorMap: {},
        };

        it('should parse preset geometry', () => {
            const xml = `
                <p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
                </p:sp>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseShapeProperties(node, slideContext, 1);
            expect(result.geometry.type).toBe('preset');
            expect(result.geometry.preset).toBe('rect');
        });

        it('should parse solid fill', () => {
            const xml = `
                <p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:spPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr>
                </p:sp>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseShapeProperties(node, slideContext, 1);
            expect(result.fill).toEqual({ type: 'solid', color: '#FF0000' });
        });

        it('should parse stroke from lnRef', () => {
            const xml = `
                <p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:spPr/>
                    <p:style><a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef></p:style>
                </p:sp>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseShapeProperties(node, slideContext, 1);
            expect(result.stroke.color).toBe('#FF0000');
        });

        it('should parse effect from effectRef', () => {
            const xml = `
                <p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:spPr/>
                    <p:style><a:effectRef idx="2"><a:srgbClr val="000000"/></a:effectRef></p:style>
                </p:sp>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseShapeProperties(node, slideContext, 1);
            expect(result.effect.type).toBe('outerShdw');
            expect(result.effect.color).toBe('#000000');
        });

        it('should apply default fill if no fill is specified', () => {
            const xml = `
                <p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:spPr />
                </p:sp>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseShapeProperties(node, slideContext, 1);
            expect(result.fill).toEqual({ type: 'solid', color: '#00FF00' });
        });
    });

    describe('parseStylePart', () => {
        it('should parse fill, borders, and text styles', () => {
            const xml = `
                <a:wholeTbl xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:tcStyle>
                        <a:fill><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:fill>
                        <a:tcBdr>
                            <a:left><a:ln w="12700"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:ln></a:left>
                        </a:tcBdr>
                    </a:tcStyle>
                    <a:tcTxStyle b="1" i="0">
                        <a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>
                    </a:tcTxStyle>
                </a:wholeTbl>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseStylePart(node);
            expect(result.tcStyle.fill.type).toBe('solid');
            expect(result.tcStyle.borders.left.width).toBe(1);
            expect(result.tcTxStyle.bold).toBe(true);
            expect(result.tcTxStyle.italic).toBe(false);
            expect(result.tcTxStyle.color.srgb).toBe('#00FF00');
        });

        it('should handle noFill', () => {
            const xml = `
                <a:wholeTbl xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:tcStyle><a:fill><a:noFill/></a:fill></a:tcStyle>
                </a:wholeTbl>
            `;
            const xmlDoc = parseXmlString(xml, 'test');
            const node = xmlDoc.documentElement;
            const result = PptxParser.parseStylePart(node);
            expect(result.tcStyle.fill.type).toBe('none');
        });
    });

    describe('parseTableStyles', () => {
        it('should parse a list of table styles and identify the default style', () => {
            const xml = `
                <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}">
                    <a:tblStyle styleId="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}">
                        <a:wholeTbl/>
                    </a:tblStyle>
                    <a:tblStyle styleId="{another-style-id}">
                        <a:band1H/>
                    </a:tblStyle>
                </a:tblStyleLst>
            `;
            const result = PptxParser.parseTableStyles(xml);
            expect(result.defaultStyleId).toBe('{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}');
            expect(Object.keys(result.styles).length).toBe(2);
            expect(result.styles['{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}'].wholeTbl).toBeDefined();
        });

        it('should handle empty table style list', () => {
            const xml = `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" />`;
            const result = PptxParser.parseTableStyles(xml);
            expect(result.defaultStyleId).toBeNull();
            expect(Object.keys(result.styles).length).toBe(0);
        });
    });

    describe('parseTheme', () => {
        it('should parse color scheme, font scheme, and format scheme', () => {
            const xml = `
                <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
                    <a:themeElements>
                        <a:clrScheme name="Office">
                            <a:dk1><a:srgbClr val="000000"/></a:dk1>
                            <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
                        </a:clrScheme>
                        <a:fontScheme name="Office">
                            <a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont>
                            <a:minorFont><a:latin typeface="Calibri"/></a:minorFont>
                        </a:fontScheme>
                        <a:fmtScheme name="Office">
                            <a:fillStyleLst><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:fillStyleLst>
                            <a:lnStyleLst><a:ln w="12700"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:ln></a:lnStyleLst>
                            <a:effectStyleLst><a:effectStyle><a:effectLst><a:outerShdw/></a:effectLst></a:effectStyle></a:effectStyleLst>
                            <a:bgFillStyleLst><a:solidFill><a:srgbClr val="00FF00"/></a:solidFill></a:bgFillStyleLst>
                        </a:fmtScheme>
                    </a:themeElements>
                </a:theme>
            `;
            const result = PptxParser.parseTheme(xml);
            expect(result.colorScheme.dk1).toBe('#000000');
            expect(result.colorScheme.lt1).toBe('#FFFFFF');
            expect(result.fontScheme.major).toBe('Calibri Light');
            expect(result.formatScheme.fills.length).toBe(1);
            expect(result.formatScheme.lines.length).toBe(1);
            expect(result.formatScheme.effects.length).toBe(1);
            expect(result.formatScheme.bgFills.length).toBe(1);
        });
    });

    describe('parseMasterOrLayout', () => {
        const mockTheme = {
            colorScheme: { accent1: '#FF0000' },
            fontScheme: { major: 'Calibri', minor: 'Arial' },
            formatScheme: { fills: [], lines: [], effects: [], bgFills: [] },
        };

        it('should parse a slide master', () => {
            const xml = `
                <p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:clrMap bg1="lt1" tx1="dk1" />
                    <p:spTree><p:sp><p:nvPr><p:ph type="title"/></p:nvPr></p:sp></p:spTree>
                </p:sldMaster>
            `;
            const result = PptxParser.parseMasterOrLayout(xml, mockTheme, null, false);
            expect(result.colorMap).toEqual({ bg1: 'lt1', tx1: 'dk1' });
            expect(result.placeholders.title).toBeDefined();
        });

        it('should parse a slide layout', () => {
            const xml = `
                <p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <p:clrMapOvr><a:overrideClrMapping bg1="lt2" tx1="dk2" /></p:clrMapOvr>
                    <p:spTree><p:sp><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:sp></p:spTree>
                </p:sldLayout>
            `;
            const result = PptxParser.parseMasterOrLayout(xml, mockTheme, null, true);
            expect(result.colorMapOverride).toEqual({ bg1: 'lt2', tx1: 'dk2' });
            expect(result.placeholders.idx_1).toBeDefined();
        });
    });

    describe('parseChart', () => {
        it('should parse a bar chart', () => {
            const xml = `
                <c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
                    <c:chart>
                        <c:title><c:tx><c:rich><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Test Chart</a:t></a:r></a:p></c:rich></c:tx></c:title>
                        <c:plotArea>
                            <c:barChart>
                                <c:ser>
                                    <c:tx><c:v>Series 1</c:v></c:tx>
                                    <c:cat><c:strRef><c:ptCount val="1"/><c:pt idx="0"><c:v>Category 1</c:v></c:pt></c:strRef></c:cat>
                                    <c:val><c:numRef><c:ptCount val="1"/><c:pt idx="0"><c:v>10</c:v></c:pt></c:numRef></c:val>
                                </c:ser>
                            </c:barChart>
                        </c:plotArea>
                    </c:chart>
                </c:chartSpace>
            `;
            const result = PptxParser.parseChart(xml);
            expect(result.type).toBe('bar');
            expect(result.title).toBe('Test Chart');
            expect(result.labels).toEqual(['Category 1']);
            expect(result.datasets[0].label).toBe('Series 1');
            expect(result.datasets[0].data).toEqual([10]);
        });

        it('should return null for invalid chart xml', () => {
            const xml = `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"></c:chartSpace>`;
            const result = PptxParser.parseChart(xml);
            expect(result).toBeNull();
        });
    });
});
