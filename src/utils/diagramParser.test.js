import { describe, it, expect, vi } from 'vitest';
import { parseDiagram } from './diagramParser';
import { getNormalizedXmlString, parseXmlString, resolvePath, ColorParser, buildPathStringFromGeom } from 'utils';

vi.mock('utils', async () => {
    const actual = await vi.importActual('utils');
    return {
        ...actual,
        getNormalizedXmlString: vi.fn(),
        ColorParser: {
            ...actual.ColorParser,
            parseColor: vi.fn(node => {
                const schemeClr = node.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'schemeClr')[0];
                if (schemeClr) {
                    return { scheme: schemeClr.getAttribute('val') };
                }
                return null;
            }),
            resolveColor: vi.fn((color, context) => {
                if (color?.scheme) {
                    return context.theme.colorScheme[color.scheme] || '#000000';
                }
                if (color?.srgb) {
                    return `#${color.srgb}`;
                }
                return '#000000';
            }),
        },
    };
});

describe('diagramParser', () => {
    it('should correctly parse a diagram with complex styles', async () => {
        // Arrange
        const slideXml = `
            <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <p:cSld>
                    <p:spTree>
                        <p:graphicFrame>
                            <a:graphic>
                                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                                    <dgm:relIds r:dm="rId2" r:lo="rId3" r:qs="rId4" r:cs="rId5" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                                </a:graphicData>
                            </a:graphic>
                        </p:graphicFrame>
                    </p:spTree>
                </p:cSld>
            </p:sld>
        `;

        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <dgm:ptLst>
                     <dgm:pt modelId="{AACEAFD5-63CF-4AFC-B46F-BE086C5D447C}"><dgm:prSet presStyleLbl="solidFgAcc1" /><dgm:t><a:p><a:r><a:t>Title</a:t></a:r></a:p></dgm:t></dgm:pt>
                </dgm:ptLst>
                <dgm:extLst>
                    <a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram">
                        <dsp:dataModelExt xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" relId="rId6"/>
                    </a:ext>
                </dgm:extLst>
            </dgm:dataModel>
        `;

        const drawingXml = `
            <dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <dsp:spTree>
                    <dsp:sp modelId="{AACEAFD5-63CF-4AFC-B46F-BE086C5D447C}">
                        <dsp:spPr>
                            <a:xfrm><a:off x="1000" y="2000"/><a:ext cx="1000000" cy="500000"/></a:xfrm>
                            <a:prstGeom prst="rect"/>
                        </dsp:spPr>
                        <dsp:style>
                            <a:lnRef idx="1"><a:schemeClr val="accent2"/></a:lnRef>
                            <a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef>
                            <a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef>
                        </dsp:style>
                    </dsp:sp>
                </dsp:spTree>
            </dsp:drawing>
        `;

        const colorsXml = `
            <dgm:colorsDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <dgm:styleLbl name="solidFgAcc1">
                    <dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"/></dgm:fillClrLst>
                    <dgm:linClrLst meth="repeat"><a:schemeClr val="accent2"/></dgm:linClrLst>
                    <dgm:txFillClrLst meth="repeat"><a:schemeClr val="tx1"/></dgm:txFillClrLst>
                </dgm:styleLbl>
            </dgm:colorsDef>
        `;

        const styleXml = `
            <dgm:styleDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                 <dgm:styleLbl name="solidFgAcc1">
                    <dgm:style>
                        <a:lnRef idx="1"><a:schemeClr val="accent2"/></a:lnRef>
                        <a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef>
                        <a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef>
                    </dgm:style>
                </dgm:styleLbl>
            </dgm:styleDef>
        `;

        getNormalizedXmlString.mockImplementation(async (entriesMap, path) => {
            if (path.endsWith('data1.xml')) return dataXml;
            if (path.endsWith('drawing1.xml')) return drawingXml;
            if (path.endsWith('colors1.xml')) return colorsXml;
            if (path.endsWith('quickStyle1.xml')) return styleXml;
            return '';
        });

        const slideContext = {
            theme: {
                colorScheme: {
                    'accent1': '#FF0000',
                    'accent2': '#00FF00',
                    'tx1': '#0000FF',
                }
            },
            colorMap: {
                'tx1': 'tx1',
                'accent1': 'accent1',
                'accent2': 'accent2',
            },
        };

        const slideRels = {
            'rId2': { target: 'diagrams/data1.xml' },
            'rId3': { target: 'diagrams/layout.xml' },
            'rId4': { target: 'diagrams/quickStyle1.xml' },
            'rId5': { target: 'diagrams/colors1.xml' },
            'rId6': { target: 'diagrams/drawing1.xml' },
        };

        const frameNode = parseXmlString(slideXml).getElementsByTagNameNS('http://schemas.openxmlformats.org/presentationml/2006/main', 'graphicFrame')[0];

        // Act
        const shapes = await parseDiagram(frameNode, slideRels, new Map(), slideContext, new (await vi.importActual('utils')).Matrix());

        // Assert
        expect(shapes.length).toBe(1);
        const shape = shapes[0];
        expect(shape.shapeProps.fill).toEqual({ type: 'solid', color: '#FF0000' });
        expect(shape.shapeProps.stroke).toEqual({ color: '#00FF00', width: 1, dash: 'solid' });
        expect(shape.text).toBeDefined();
        const fullText = shape.text.layout.lines.map(l => l.runs.map(r => r.text).join('')).join('');
        expect(fullText).toBe('Title');
    });
});
