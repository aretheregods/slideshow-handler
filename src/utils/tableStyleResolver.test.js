import { beforeEach, describe, it, expect } from 'vitest';
import { TableStyleResolver } from './tableStyleResolver';
import { ColorParser } from './colorParser';
import { parseTableStyles } from './pptxParser';

describe('TableStyleResolver', () => {
    let slideContext;

    beforeEach(() => {
        slideContext = {
            theme: {
                colorScheme: {
                    accent1: '#4472C4',
                    tx1: '#000000',
                },
            },
            colorMap: {
                'accent1': 'accent1',
                'tx1': 'tx1',
            }
        };
    });

    it('should be instantiated correctly', () => {
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, {}, 5, 5, slideContext);
        expect(resolver).toBeDefined();
    });

    it('should resolve first row fill color', () => {
        const tableStylesXml = `
            <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:tblStyle styleId="{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}">
                    <a:firstRow>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:firstRow>
                </a:tblStyle>
            </a:tblStyleLst>`;
        const tableStyles = parseTableStyles(tableStylesXml, slideContext.theme);
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;
        const cellXml = `<a:tc xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:tcPr/></a:tc>`;
        const cellDoc = parser.parseFromString(cellXml, "application/xml");
        const cellNode = cellDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, tableStyles.styles['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}'], 5, 5, slideContext);
        const fill = resolver.getFill(cellNode, 0, 0);

        expect(fill).toEqual({ type: 'solid', color: '#4472C4' });
    });

    it('should resolve alternating banded row fill colors', () => {
        const tableStylesXml = `
            <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:tblStyle styleId="{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}">
                    <a:band1H>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"><a:tint val="40000"/></a:schemeClr></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:band1H>
                    <a:band2H>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"><a:tint val="60000"/></a:schemeClr></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:band2H>
                </a:tblStyle>
            </a:tblStyleLst>`;
        const tableStyles = parseTableStyles(tableStylesXml, slideContext.theme);
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;
        const cellXml = `<a:tc xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:tcPr/></a:tc>`;
        const cellDoc = parser.parseFromString(cellXml, "application/xml");
        const cellNode = cellDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, tableStyles.styles['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}'], 5, 5, slideContext);

        const fill1 = resolver.getFill(cellNode, 1, 0); // band1H
        const fill2 = resolver.getFill(cellNode, 2, 0); // band2H
        const fill3 = resolver.getFill(cellNode, 3, 0); // band1H again

        expect(fill1.color).not.toEqual(fill2.color);
        expect(fill1.color).toEqual(fill3.color);
    });

    it('should fall back to banded row style when first row has no fill', () => {
        const tableStylesXml = `
            <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:tblStyle styleId="{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}">
                    <a:firstRow>
                        <a:tcStyle>
                            <a:fill>
                                <a:noFill/>
                            </a:fill>
                        </a:tcStyle>
                    </a:firstRow>
                    <a:band1H>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:band1H>
                </a:tblStyle>
            </a:tblStyleLst>`;
        const tableStyles = parseTableStyles(tableStylesXml, slideContext.theme);
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;
        const cellXml = `<a:tc xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:tcPr/></a:tc>`;
        const cellDoc = parser.parseFromString(cellXml, "application/xml");
        const cellNode = cellDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, tableStyles.styles['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}'], 5, 5, slideContext);
        const fill = resolver.getFill(cellNode, 0, 0);

        expect(fill).toEqual({ type: 'solid', color: '#4472C4' });
    });

    it('should resolve banded row fill color', () => {
        const tableStylesXml = `
            <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:tblStyle styleId="{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}">
                    <a:band1H>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"><a:tint val="40000"/></a:schemeClr></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:band1H>
                </a:tblStyle>
            </a:tblStyleLst>`;
        const tableStyles = parseTableStyles(tableStylesXml, slideContext.theme);
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;
        const cellXml = `<a:tc xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:tcPr/></a:tc>`;
        const cellDoc = parser.parseFromString(cellXml, "application/xml");
        const cellNode = cellDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, tableStyles.styles['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}'], 5, 5, slideContext);
        const fill = resolver.getFill(cellNode, 1, 0);

        expect(fill.color).toBeDefined();
    });

    it('should resolve wholeTbl fill color', () => {
        const tableStylesXml = `
            <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:tblStyle styleId="{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}">
                    <a:wholeTbl>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:wholeTbl>
                </a:tblStyle>
            </a:tblStyleLst>`;
        const tableStyles = parseTableStyles(tableStylesXml, slideContext.theme);
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;
        const cellXml = `<a:tc xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:tcPr/></a:tc>`;
        const cellDoc = parser.parseFromString(cellXml, "application/xml");
        const cellNode = cellDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, tableStyles.styles['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}'], 5, 5, slideContext);
        const fill = resolver.getFill(cellNode, 0, 0);

        expect(fill).toEqual({ type: 'solid', color: '#4472C4' });
    });

    it('should prioritize direct fill over table style', () => {
        const tableStylesXml = `
            <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:tblStyle styleId="{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}">
                    <a:firstRow>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:firstRow>
                </a:tblStyle>
            </a:tblStyleLst>`;
        const tableStyles = parseTableStyles(tableStylesXml, slideContext.theme);
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;
        const cellXml = `<a:tc xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:tcPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:tcPr></a:tc>`;
        const cellDoc = parser.parseFromString(cellXml, "application/xml");
        const cellNode = cellDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, tableStyles.styles['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}'], 5, 5, slideContext);
        const fill = resolver.getFill(cellNode, 0, 0);

        expect(fill).toEqual({ type: 'solid', color: '#FF0000' });
    });

    it('should handle noFill by falling back to table style', () => {
        const tableStylesXml = `
            <a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:tblStyle styleId="{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}">
                    <a:firstRow>
                        <a:tcStyle>
                            <a:fill>
                                <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                            </a:fill>
                        </a:tcStyle>
                    </a:firstRow>
                </a:tblStyle>
            </a:tblStyleLst>`;
        const tableStyles = parseTableStyles(tableStylesXml, slideContext.theme);
        const tblPrXml = `<a:tblPr firstRow="1" bandRow="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:tableStyleId>{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}</a:tableStyleId>
        </a:tblPr>`;
        const parser = new DOMParser();
        const tblPrDoc = parser.parseFromString(tblPrXml, "application/xml");
        const tblPrNode = tblPrDoc.documentElement;
        const cellXml = `<a:tc xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:tcPr><a:noFill/></a:tcPr></a:tc>`;
        const cellDoc = parser.parseFromString(cellXml, "application/xml");
        const cellNode = cellDoc.documentElement;

        const resolver = new TableStyleResolver(tblPrNode, tableStyles.styles['{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}'], 5, 5, slideContext);
        const fill = resolver.getFill(cellNode, 0, 0);

        expect(fill).toEqual({ type: 'solid', color: '#4472C4' });
    });
});
