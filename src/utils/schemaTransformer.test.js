import { describe, it, expect } from 'vitest';
import { transformSlide } from './schemaTransformer.js';

describe('schemaTransformer', () => {
    describe('transformSlide', () => {
        it('should transform a slide with a textbox shape', () => {
            const slideData = {
                slideId: 'slide-1',
                slideNum: 1,
                shapes: [
                    {
                        type: 'shape',
                        pos: { x: 10, y: 20, width: 300, height: 100 },
                        shapeProps: {
                            fill: { color: '#FF0000' },
                            stroke: { color: '#00FF00' },
                        },
                        text: {
                            layout: {
                                lines: [
                                    {
                                        runs: [
                                            { text: 'Hello, World!', font: { family: 'Arial', size: 24, weight: 'bold' }, color: '#000000' }
                                        ],
                                        paragraphProps: { align: 'center' },
                                    }
                                ],
                            },
                        },
                    }
                ],
            };

            const transformed = transformSlide(slideData);

            expect(transformed.id).toBe('slide-1');
            expect(transformed.slideNumber).toBe(1);
            expect(transformed.shapes.length).toBe(1);
            const shape = transformed.shapes[0];
            expect(shape.type).toBe('textbox');
            expect(shape.content).toBe('Hello, World!');
            expect(shape.fontFamily).toBe('Arial');
        });

        it('should transform a slide with an image shape', () => {
            const slideData = {
                slideId: 'slide-2',
                slideNum: 2,
                shapes: [
                    {
                        type: 'picture',
                        pos: { x: 50, y: 60, width: 200, height: 150 },
                        shapeProps: {},
                        image: { href: 'image.png' },
                    }
                ],
            };

            const transformed = transformSlide(slideData);
            const shape = transformed.shapes[0];
            expect(shape.type).toBe('image');
            expect(shape.src).toBe('image.png');
        });

        it('should transform a slide with a basic shape', () => {
            const slideData = {
                slideId: 'slide-3',
                slideNum: 3,
                shapes: [
                    {
                        type: 'shape',
                        pos: { x: 10, y: 20, width: 300, height: 100 },
                        shapeProps: {
                            geometry: { preset: 'oval' },
                        },
                    }
                ],
            };

            const transformed = transformSlide(slideData);
            const shape = transformed.shapes[0];
            expect(shape.type).toBe('shape');
            expect(shape.shapeType).toBe('oval');
        });

        it('should handle slides with no shapes', () => {
            const slideData = {
                slideId: 'slide-4',
                slideNum: 4,
                shapes: [],
            };

            const transformed = transformSlide(slideData);
            expect(transformed.shapes.length).toBe(0);
        });

        it('should pass the transform property', () => {
            const slideData = {
                slideId: 'slide-5',
                slideNum: 5,
                shapes: [
                    {
                        type: 'shape',
                        pos: { x: 10, y: 20, width: 300, height: 100 },
                        shapeProps: {},
                        transform: 'matrix(0.866 -0.5 0.5 0.866 0 0)',
                    }
                ],
            };

            const transformed = transformSlide(slideData);
            const shape = transformed.shapes[0];
            expect(shape.transform).toBe('matrix(0.866 -0.5 0.5 0.866 0 0)');
        });
    });
});
