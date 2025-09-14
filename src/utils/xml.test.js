import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseXmlString } from './xml.js';

const mockParseFromString = vi.fn();

global.DOMParser = vi.fn(() => ({
  parseFromString: mockParseFromString,
}));

describe('parseXmlString', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(parseXmlString).toBeDefined();
  });

  it('should return an XML document when parsing is successful', () => {
    const xmlString = '<root><element/></root>';
    const mockXmlDoc = {
      querySelector: () => null,
    };
    mockParseFromString.mockReturnValue(mockXmlDoc);

    const result = parseXmlString(xmlString, 'test');

    expect(result).toBe(mockXmlDoc);
    expect(global.DOMParser).toHaveBeenCalledTimes(1);
    expect(mockParseFromString).toHaveBeenCalledWith(xmlString, 'application/xml');
  });

  it('should throw an error when parsing fails', () => {
    const xmlString = '<root><element></root>';
    const errorNode = {
      textContent: 'This is an error message',
    };
    const mockXmlDoc = {
      querySelector: (selector) => {
        if (selector === 'parsererror') {
          return errorNode;
        }
        return null;
      },
    };
    mockParseFromString.mockReturnValue(mockXmlDoc);

    expect(() => parseXmlString(xmlString, 'test-fail')).toThrow(
      'XML Parsing Error in test-fail: This is an error message'
    );

    try {
        parseXmlString(xmlString, 'test-fail');
    } catch (error) {
        expect(error.xmlString).toBe(xmlString);
        expect(error.identifier).toBe('test-fail');
    }
  });

  it('should throw an error for an empty string', () => {
    const xmlString = '';
    const errorNode = {
      textContent: 'Empty string is not a valid XML.',
    };
    const mockXmlDoc = {
      querySelector: (selector) => {
        if (selector === 'parsererror') {
          return errorNode;
        }
        return null;
      },
    };
    mockParseFromString.mockReturnValue(mockXmlDoc);

    expect(() => parseXmlString(xmlString, 'test-empty')).toThrow(
      'XML Parsing Error in test-empty: Empty string is not a valid XML.'
    );
  });
});
