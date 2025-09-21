import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagramBuilder } from './diagramBuilder.js';
import { ShapeBuilder } from './shapeBuilder.js';
import { EMU_PER_PIXEL } from '../constants.js';
import { parseXmlString, getNormalizedXmlString, Matrix } from 'utils';

vi.mock('./shapeBuilder.js', () => {
    return {
        ShapeBuilder: vi.fn().mockImplementation(() => {
            return {
                getShapeProperties: vi.fn().mockReturnValue({
                    pos: { x: 0, y: 0, width: 100, height: 100 },
                    transform: 'matrix(1 0 0 1 0 0)',
                    flipH: false,
                    flipV: false,
                    rot: 0,
                }),
                build: vi.fn().mockImplementation((shapeNode) => {
                    const spPrNode = shapeNode.getElementsByTagName('dsp:spPr')[0];
                    const fill = spPrNode?.getElementsByTagName('a:solidFill')[0];
                    const srgbClr = fill?.getElementsByTagName('a:srgbClr')[0];
                    const color = srgbClr?.getAttribute('val');

                    return {
                        type: 'shape',
                        shapeProps: {
                            fill: color ? { type: 'solid', color: `#${color}` } : null,
                        },
                        text: null,
                    };
                }),
            };
        }),
    };
});

vi.mock('utils', async () => {
    const actual = await vi.importActual('utils');
    return {
        ...actual,
        getNormalizedXmlString: vi.fn(),
        parseShapeProperties: vi.fn().mockReturnValue({
            fill: { type: 'solid', color: '#FF0000' },
        }),
    };
});

describe('DiagramBuilder', () => {
    let shapeBuilder, slideHandler;

    beforeEach(() => {
        shapeBuilder = new ShapeBuilder({});
        slideHandler = {
            parseParagraphs: vi.fn().mockReturnValue({
                layout: { lines: ['mock line'] },
            }),
        };
    });

    const createFrameNode = (relIds) => {
        const slideXml = `
            <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <p:cSld><p:spTree><p:graphicFrame>
                    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                        <dgm:relIds ${relIds} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                    </a:graphicData></a:graphic>
                </p:graphicFrame></p:spTree></p:cSld>
            </p:sld>
        `;
        const xmlDoc = parseXmlString(slideXml);
        return xmlDoc.getElementsByTagName('p:graphicFrame')[0];
    };

    it('should correctly parse a diagram with complex styles', async () => {
        const frameNode = createFrameNode(`r:dm="rId1" r:lo="rId2" r:qs="rId3" r:cs="rId4"`);
        const drawingXml = `
            <dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <dsp:spTree>
                    <dsp:sp modelId="{ED49F632-B418-4382-9214-F65E5852D2B0}">
                        <dsp:spPr>
                            <a:solidFill>
                                <a:srgbClr val="FF0000"/>
                            </a:solidFill>
                        </dsp:spPr>
                    </dsp:sp>
                </dsp:spTree>
            </dsp:drawing>`;
        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt modelId="{ED49F632-B418-4382-9214-F65E5852D2B0}" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Sample Text</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                </dgm:ptLst>
                <dgm:extLst><a:ext uri="http://schemas.microsoft.com/office/drawing/2008/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dsp:dataModelExt xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" relId="rId6"/></a:ext></dgm:extLst>
            </dgm:dataModel>`;
        const layoutXml = `<dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"></dgm:layoutDef>`;

        getNormalizedXmlString.mockImplementation(async (entriesMap, path) => {
            if (path.endsWith('data1.xml')) return dataXml;
            if (path.endsWith('layout1.xml')) return layoutXml;
            if (path.endsWith('drawing1.xml')) return drawingXml;
            return '';
        });

        const slideRels = {
            'rId1': {target: 'data1.xml'},
            'rId2': {target: 'layout1.xml'},
            'rId3': {target: 'quickStyle1.xml'},
            'rId4': {target: 'colors1.xml'},
            'rId6': {target: 'drawing1.xml'}
        };
        const builder = new DiagramBuilder({ slideHandler, shapeBuilder, slideRels, entriesMap: new Map(), slide: { slideContext: {}, slideNum: 1 } });
        const shapes = await builder.build(frameNode, new Matrix());

        expect(shapes.length).toBe(1);
    });

    it('should fall back to layout.xml when drawing.xml is not present', async () => {
        const frameNode = createFrameNode(`r:dm="rId1" r:lo="rId2"`);
        const layoutXml = `
            <dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:layoutNode>
                    <dgm:shape type="rect"/>
                    <dgm:presOf axis="self" ptType="node"/>
                </dgm:layoutNode>
            </dgm:layoutDef>`;
        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt modelId="pt1" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Test</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                </dgm:ptLst>
            </dgm:dataModel>`;

        getNormalizedXmlString.mockImplementation(async (entriesMap, path) => {
            if (path.endsWith('data1.xml')) return dataXml;
            if (path.endsWith('layout1.xml')) return layoutXml;
            return '';
        });

        const slideRels = { 'rId1': {target: 'data1.xml'}, 'rId2': {target: 'layout1.xml'} };
        const builder = new DiagramBuilder({ slideHandler, shapeBuilder, slideRels, entriesMap: new Map(), slide: { slideContext: {}, slideNum: 1 } });
        const shapes = await builder.build(frameNode, new Matrix());

        expect(shapes.length).toBe(1);
        expect(shapes[0].shape).toBe('rect');
    });
});
