import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagramBuilder } from './diagramBuilder.js';
import { ShapeBuilder } from './shapeBuilder.js';
import { EMU_PER_PIXEL } from '../constants.js';

vi.mock('./shapeBuilder.js', () => {
    return {
        ShapeBuilder: vi.fn().mockImplementation(() => {
            return {
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

describe('DiagramBuilder', () => {
    let shapeBuilder;

    beforeEach(() => {
        shapeBuilder = new ShapeBuilder({});
    });

    it('should correctly parse a diagram with complex styles', async () => {
        const drawingXml = `
            <dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram">
                <dsp:spTree>
                    <dsp:sp modelId="{ED49F632-B418-4382-9214-F65E5852D2B0}">
                        <dsp:spPr>
                            <a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
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
            </dgm:dataModel>`;
        const layoutXml = `<dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"></dgm:layoutDef>`;
        const colorsXml = `<dgm:colorsDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"></dgm:colorsDef>`;
        const styleXml = `<dgm:styleDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"></dgm:styleDef>`;

        const builder = new DiagramBuilder({ shapeBuilder });
        const shapes = await builder.build(drawingXml, layoutXml, dataXml, colorsXml, styleXml);

        // Assert
        expect(shapes.length).toBe(1);
        const shape = shapes[0];
        expect(shape.shapeProps.fill).toEqual({ type: 'solid', color: '#FF0000' });
        expect(shape.text).not.toBeNull();
        expect(shape.text.layout.lines[0].runs[0].text).toBe('Sample Text');
    });

    it('should fall back to layout.xml when drawing.xml is not present', async () => {
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

        const builder = new DiagramBuilder({ shapeBuilder });
        const shapes = await builder.build(null, layoutXml, dataXml, null, null);

        expect(shapes.length).toBe(1);
        expect(shapes[0].shape).toBe('rect');
    });

    it('should handle "sp" algorithm to create a shape with constraints and styles', async () => {
        const layoutXml = `
            <dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:layoutNode>
                    <dgm:alg type="sp" />
                    <dgm:shape type="rect" />
                    <dgm:presOf axis="self" ptType="node" />
                    <dgm:constrLst>
                        <dgm:constr type="w" val="1000" />
                    </dgm:constrLst>
                </dgm:layoutNode>
            </dgm:layoutDef>`;
        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt modelId="pt1" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>First item</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                </dgm:ptLst>
            </dgm:dataModel>`;

        const builder = new DiagramBuilder({ shapeBuilder });
        const shapes = await builder.build(null, layoutXml, dataXml, null, null);

        // Assert
        expect(shapes.length).toBe(1);
        const shape = shapes[0];
        expect(shape.type).toBe('shape');
        expect(shape.shape).toBe('rect');
        expect(shape.ext.cx).toBe(1000 * EMU_PER_PIXEL);
    });

    it('should handle "forEach" element to create multiple shapes', async () => {
        const layoutXml = `
            <dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:layoutNode>
                    <dgm:forEach axis="ch" ptType="node">
                        <dgm:layoutNode name="shapeNode">
                            <dgm:shape type="rect"/>
                            <dgm:presOf axis="self" ptType="node"/>
                        </dgm:layoutNode>
                    </dgm:forEach>
                </dgm:layoutNode>
            </dgm:layoutDef>`;
        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt modelId="pt1" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>First</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                    <dgm:pt modelId="pt2" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Second</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                </dgm:ptLst>
            </dgm:dataModel>`;

        const builder = new DiagramBuilder({ shapeBuilder });
        const shapes = await builder.build(null, layoutXml, dataXml, null, null);

        // Assert
        expect(shapes.length).toBe(2);
        expect(shapes[0].text.layout.lines[0].runs[0].text).toBe('First');
        expect(shapes[1].text.layout.lines[0].runs[0].text).toBe('Second');
    });

    it('should handle "lin" algorithm for vertical layout', async () => {
        const layoutXml = `
            <dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:layoutNode>
                    <dgm:alg type="lin" />
                    <dgm:forEach axis="ch" ptType="node">
                        <dgm:layoutNode name="shapeNode">
                            <dgm:shape type="rect"/>
                            <dgm:presOf axis="self" ptType="node"/>
                        </dgm:layoutNode>
                    </dgm:forEach>
                </dgm:layoutNode>
            </dgm:layoutDef>`;
        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt modelId="pt1" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>First</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                    <dgm:pt modelId="pt2" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Second</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                </dgm:ptLst>
            </dgm:dataModel>`;

        const builder = new DiagramBuilder({ shapeBuilder });
        const shapes = await builder.build(null, layoutXml, dataXml, null, null);

        // Assert
        expect(shapes.length).toBe(2);
        expect(shapes[0].text.layout.lines[0].runs[0].text).toBe('First');
        expect(shapes[1].text.layout.lines[0].runs[0].text).toBe('Second');
        expect(shapes[1].pos.y).toBeGreaterThan(shapes[0].pos.y);
    });

    it('should correctly parse text from the data model when txBody is empty', async () => {
        const drawingXml = `
            <dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram">
                <dsp:spTree>
                    <dsp:sp modelId="{MODEL_ID}">
                        <dsp:txBody />
                    </dsp:sp>
                </dsp:spTree>
            </dsp:drawing>`;
        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt modelId="{MODEL_ID}" type="node">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Data Model Text</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                </dgm:ptLst>
            </dgm:dataModel>`;
        const layoutXml = `<dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"></dgm:layoutDef>`;

        const builder = new DiagramBuilder({ shapeBuilder });
        const shapes = await builder.build(drawingXml, layoutXml, dataXml, null, null);

        // Assert
        expect(shapes.length).toBe(1);
        const shape = shapes[0];
        expect(shape.text).not.toBeNull();
        expect(shape.text.layout.lines[0].runs[0].text).toBe('Data Model Text');
    });

    it('should handle a complex layout with nested data and mixed styles', async () => {
        const layoutXml = `
            <dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:layoutNode name="root">
                    <dgm:alg type="lin" />
                    <dgm:forEach axis="ch" ptType="node">
                        <dgm:layoutNode name="outerShape">
                            <dgm:shape type="rect" />
                            <dgm:presOf axis="self" ptType="node" />
                        </dgm:layoutNode>
                    </dgm:forEach>
                </dgm:layoutNode>
            </dgm:layoutDef>`;

        const dataXml = `
            <dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram">
                <dgm:ptLst>
                    <dgm:pt type="node" modelId="child1">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Child 1</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                    <dgm:pt type="node" modelId="child2">
                        <dgm:t><a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:r><a:t>Child 2</a:t></a:r></a:p></dgm:t>
                    </dgm:pt>
                </dgm:ptLst>
            </dgm:dataModel>`;

        const builder = new DiagramBuilder({ shapeBuilder });
        const shapes = await builder.build(null, layoutXml, dataXml, null, null);

        // Assert
        expect(shapes.length).toBe(2);

        const shape1 = shapes[0];
        const fullText1 = shape1.text.layout.lines.map(l => l.runs.map(r => r.text).join('')).join('');
        expect(fullText1).toBe('Child 1');

        const shape2 = shapes[1];
        const fullText2 = shape2.text.layout.lines.map(l => l.runs.map(r => r.text).join('')).join('');
        expect(fullText2).toBe('Child 2');
        expect(shape2.pos.y).toBe(1000 / EMU_PER_PIXEL);
    });
});
