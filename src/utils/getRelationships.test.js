import { describe, it, expect, vi } from 'vitest';
import { getRelationships } from './getRelationships';
import * as utils from 'utils';

vi.mock('utils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getNormalizedXmlString: vi.fn(),
    };
});

describe('getRelationships', () => {
    it('should return an empty object if the file is not found', async () => {
        utils.getNormalizedXmlString.mockResolvedValue('');
        const rels = await getRelationships(new Map(), 'nonexistent.rels');
        expect(rels).toEqual({});
    });

    it('should parse a valid .rels file with multiple relationships', async () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
                <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
                <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
            </Relationships>
        `;
        utils.getNormalizedXmlString.mockResolvedValue(xmlString);
        const rels = await getRelationships(new Map(), 'valid.rels');
        expect(rels).toEqual({
            rId1: { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', target: 'ppt/presentation.xml' },
            rId2: { id: 'rId2', type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', target: 'docProps/core.xml' },
            rId3: { id: 'rId3', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties', target: 'docProps/app.xml' },
        });
    });

    it('should return an empty object for an empty .rels file', async () => {
        utils.getNormalizedXmlString.mockResolvedValue('');
        const rels = await getRelationships(new Map(), 'empty.rels');
        expect(rels).toEqual({});
    });

    it('should return an empty object for a .rels file with no relationships', async () => {
        const xmlString = `
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>
        `;
        utils.getNormalizedXmlString.mockResolvedValue(xmlString);
        const rels = await getRelationships(new Map(), 'no_rels.rels');
        expect(rels).toEqual({});
    });

    it('should handle malformed XML gracefully', async () => {
        const xmlString = `
            <Relationships>
                <Relationship Id="rId1" Type="type1" Target="target1" />
                <Relationship Id="rId2" Type="type2" Target="target2> <!-- Missing closing quote -->
                <Relationship Id="rId3" Type="type3" Target="target3" />
            </Relationships>
        `;
        utils.getNormalizedXmlString.mockResolvedValue(xmlString);
        const rels = await getRelationships(new Map(), 'malformed.rels');
        expect(rels).toEqual({
            rId1: { id: 'rId1', type: 'type1', target: 'target1' },
            rId3: { id: 'rId3', type: 'type3', target: 'target3' },
        });
    });

    it('should ignore relationships with missing Id, Type, or Target attributes', async () => {
        const xmlString = `
            <Relationships>
                <Relationship Type="type1" Target="target1" /> <!-- Missing Id -->
                <Relationship Id="rId2" Target="target2" /> <!-- Missing Type -->
                <Relationship Id="rId3" Type="type3" /> <!-- Missing Target -->
                <Relationship Id="rId4" Type="type4" Target="target4" />
            </Relationships>
        `;
        utils.getNormalizedXmlString.mockResolvedValue(xmlString);
        const rels = await getRelationships(new Map(), 'missing_attrs.rels');
        expect(rels).toEqual({
            rId4: { id: 'rId4', type: 'type4', target: 'target4' },
        });
    });
});
