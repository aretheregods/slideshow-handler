import { describe, it, expect } from 'vitest';
import { getNormalizedXmlString } from './getNormalizedXmlString';

describe('getNormalizedXmlString', () => {
  const createMockEntry = (content) => ({
    getData: () => Promise.resolve(content),
  });

  it('should return null if the entry is not found', async () => {
    const entriesMap = new Map();
    const result = await getNormalizedXmlString(entriesMap, 'nonexistent.xml');
    expect(result).toBeNull();
  });

  it('should return the XML string if it is well-formed', async () => {
    const xml = '<root><element /></root>';
    const entriesMap = new Map([['test.xml', createMockEntry(xml)]]);
    const result = await getNormalizedXmlString(entriesMap, 'test.xml');
    expect(result).toBe(xml);
  });

  it('should strip BOM from the beginning of the string', async () => {
    const xmlWithBOM = '\uFEFF<root><element /></root>';
    const entriesMap = new Map([['test.xml', createMockEntry(xmlWithBOM)]]);
    const result = await getNormalizedXmlString(entriesMap, 'test.xml');
    expect(result).toBe('<root><element /></root>');
  });

  it('should normalize \\r\\n line endings to \\n', async () => {
    const xml = '<root>\r\n<element />\r\n</root>';
    const entriesMap = new Map([['test.xml', createMockEntry(xml)]]);
    const result = await getNormalizedXmlString(entriesMap, 'test.xml');
    expect(result).toBe('<root>\n<element />\n</root>');
  });

  it('should normalize \\r line endings to \\n', async () => {
    const xml = '<root>\r<element />\r</root>';
    const entriesMap = new Map([['test.xml', createMockEntry(xml)]]);
    const result = await getNormalizedXmlString(entriesMap, 'test.xml');
    expect(result).toBe('<root>\n<element />\n</root>');
  });

  it('should handle a mix of BOM and different line endings', async () => {
    const xml = '\uFEFF<root>\r\n<element />\r</root>';
    const entriesMap = new Map([['test.xml', createMockEntry(xml)]]);
    const result = await getNormalizedXmlString(entriesMap, 'test.xml');
    expect(result).toBe('<root>\n<element />\n</root>');
  });
});
