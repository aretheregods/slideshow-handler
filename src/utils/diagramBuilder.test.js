import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagramBuilder } from './diagramBuilder';
import { ShapeBuilder } from './shapeBuilder';
import { getNormalizedXmlString, parseXmlString, Matrix } from 'utils';

vi.mock('utils', async () => {
    const actual = await vi.importActual('utils');
    return {
        ...actual,
        getNormalizedXmlString: vi.fn(),
        parseXmlString: vi.fn((xml) => new DOMParser().parseFromString(xml, 'text/xml')),
    };
});

vi.mock('./shapeBuilder');

describe('DiagramBuilder', () => {
    let diagramBuilder;
    let mockShapeBuilder;
    let mockSlideContext;

    beforeEach(() => {
        mockShapeBuilder = new ShapeBuilder();
        mockSlideContext = {
            theme: {
                colorScheme: {},
                fontScheme: {},
                formatScheme: { fills: [], lines: [], effects: [], bgFills: [] },
            },
            slideRels: {
                'rId2': { target: 'diagrams/data1.xml' },
                'rId3': { target: 'diagrams/layout.xml' },
                'rId4': { target: 'diagrams/quickStyle1.xml' },
                'rId5': { target: 'diagrams/colors1.xml' },
            },
            entriesMap: new Map(),
            emuPerPixel: 1,
        };
        diagramBuilder = new DiagramBuilder(mockShapeBuilder, mockSlideContext);
    });

    it('should parse a layout-based diagram', () => {
        const layoutXml = `
            <dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:layoutNode name="root">
                    <dgm:alg type="lin" />
                    <dgm:forEach name="points" axis="ch" ptType="node">
                        <dgm:layoutNode name="shape">
                             <dgm:alg type="sp" />
                             <dgm:presOf axis="self" />
                             <dgm:constrLst>
                                 <dgm:constr type="w" val="100" />
                                 <dgm:constr type="h" val="50" />
                             </dgm:constrLst>
                        </dgm:layoutNode>
                    </dgm:forEach>
                </dgm:layoutNode>
            </dgm:layoutDef>
        `;

        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt modelId="doc" type="doc" />
                    <dgm:pt modelId="pt1" type="node" />
                    <dgm:pt modelId="pt2" type="node" />
                </dgm:ptLst>
                <dgm:cxnLst>
                    <dgm:cxn srcId="doc" destId="pt1" />
                    <dgm:cxn srcId="doc" destId="pt2" />
                </dgm:cxnLst>
            </dgm:dataModel>
        `;

        getNormalizedXmlString.mockImplementation((entriesMap, path) => {
            if (path.endsWith('data1.xml')) return Promise.resolve(dataXml);
            if (path.endsWith('layout.xml')) return Promise.resolve(layoutXml);
            return Promise.resolve('');
        });

        const frameNode = parseXmlString(`
            <p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <a:graphic>
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                        <dgm:relIds r:dm="rId2" r:lo="rId3" r:qs="rId4" r:cs="rId5" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                    </a:graphicData>
                </a:graphic>
            </p:graphicFrame>
        `).documentElement;

        return diagramBuilder.build(frameNode, new Matrix()).then(shapes => {
            expect(shapes.length).toBe(2);
            expect(shapes[0].pos.x).toBe(0);
            expect(shapes[0].pos.y).toBe(0);
            expect(shapes[1].pos.x).toBe(100);
            expect(shapes[1].pos.y).toBe(0);
        });
    });
});
