import { describe, it, expect } from 'vitest';
import { getSlideSize } from './getSlideSize';
import { EMU_PER_PIXEL } from '../constants';

describe('getSlideSize', () => {
    it('should parse slide dimensions from a standard presentation.xml string', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cx="12192000" cy="6858000"/>
    </p:presentationPr>`;
        const expectedWidth = 12192000 / EMU_PER_PIXEL;
        const expectedHeight = 6858000 / EMU_PER_PIXEL;
        expect(getSlideSize(xmlString)).toEqual({ width: expectedWidth, height: expectedHeight });
    });

    it('should parse slide dimensions with a different namespace prefix', () => {
        const xmlString = `<a:presentationPr xmlns:a="http://schemas.openxmlformats.org/presentationml/2006/main">
      <a:sldSz cx="12192000" cy="6858000"/>
    </a:presentationPr>`;
        const expectedWidth = 12192000 / EMU_PER_PIXEL;
        const expectedHeight = 6858000 / EMU_PER_PIXEL;
        expect(getSlideSize(xmlString)).toEqual({ width: expectedWidth, height: expectedHeight });
    });

    it('should parse slide dimensions without a namespace prefix', () => {
        const xmlString = `<presentationPr>
      <sldSz cx="12192000" cy="6858000"/>
    </presentationPr>`;
        const expectedWidth = 12192000 / EMU_PER_PIXEL;
        const expectedHeight = 6858000 / EMU_PER_PIXEL;
        expect(getSlideSize(xmlString)).toEqual({ width: expectedWidth, height: expectedHeight });
    });

    it('should return default dimensions if sldSz tag is missing', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    </p:presentationPr>`;
        expect(getSlideSize(xmlString)).toEqual({ width: 960, height: 720 });
    });

    it('should return default dimensions if cx attribute is missing', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cy="6858000"/>
    </p:presentationPr>`;
        expect(getSlideSize(xmlString)).toEqual({ width: 960, height: 720 });
    });

    it('should return default dimensions if cy attribute is missing', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cx="12192000"/>
    </p:presentationPr>`;
        expect(getSlideSize(xmlString)).toEqual({ width: 960, height: 720 });
    });

    it('should handle zero values for cx and cy', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cx="0" cy="0"/>
    </p:presentationPr>`;
        expect(getSlideSize(xmlString)).toEqual({ width: 0, height: 0 });
    });

    it('should handle large values for cx and cy', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cx="999999999999" cy="999999999999"/>
    </p:presentationPr>`;
        const expectedWidth = 999999999999 / EMU_PER_PIXEL;
        const expectedHeight = 999999999999 / EMU_PER_PIXEL;
        expect(getSlideSize(xmlString)).toEqual({ width: expectedWidth, height: expectedHeight });
    });

    it('should return default dimensions for an empty string input', () => {
        expect(getSlideSize('')).toEqual({ width: 960, height: 720 });
    });

    it('should return default dimensions for a malformed XML string', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cx="12192000" cy="6858000"`;
        expect(getSlideSize(xmlString)).toEqual({ width: 960, height: 720 });
    });

    it('should return default dimensions for non-numeric values for cx and cy', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cx="abc" cy="def"/>
    </p:presentationPr>`;
        expect(getSlideSize(xmlString)).toEqual({ width: 960, height: 720 });
    });

    it('should handle negative values for cx and cy', () => {
        const xmlString = `<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
      <p:sldSz cx="-12192000" cy="-6858000"/>
    </p:presentationPr>`;
        const expectedWidth = -12192000 / EMU_PER_PIXEL;
        const expectedHeight = -6858000 / EMU_PER_PIXEL;
        expect(getSlideSize(xmlString)).toEqual({ width: expectedWidth, height: expectedHeight });
    });
});
