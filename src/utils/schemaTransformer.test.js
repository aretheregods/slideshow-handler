import { describe, it, expect } from 'vitest';
import { transformSlide } from './schemaTransformer.js';

describe('schemaTransformer', () => {
    describe('transformSlide', () => {
        it('should transform a slide with a textbox shape with full text properties', () => {
            const slideData = {
                slideId: 'slide-1',
                slideNum: 1,
                shapes: [
                    {
                        type: 'shape',
                        pos: { x: 10, y: 20, width: 300, height: 100 },
                        shapeProps: {
                            fill: { type: 'solid', color: { value: '#FF0000' } },
                            stroke: { color: '#00FF00', width: 2 },
                        },
                        text: {
                            layout: {
                                lines: [
                                    {
                                        runs: [
                                            {
                                                text: 'Hello, World!',
                                                font: { family: 'Arial', size: 24, weight: 'bold', style: 'italic', caps: 'small', baseline: 30000, spacing: 1200 },
                                                color: '#000000',
                                                underline: 'sng',
                                                strikethrough: 'single',
                                                highlight: '#FFFF00',
                                                hyperlink: 'http://example.com',
                                            }
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
            const shape = transformed.shapes[0];

            expect(shape.type).toBe('textbox');
            const run = shape.content[0].runs[0];
            expect(run.text).toBe('Hello, World!');
            expect(run.fontFamily).toBe('Arial');
            expect(run.fontSize).toBe(24);
            expect(run.bold).toBe(true);
            expect(run.italic).toBe(true);
            expect(run.underline).toBe('sng');
            expect(run.strikethrough).toBe('single');
            expect(run.capitalization).toBe('small');
            expect(run.baseline).toBe(30000);
            expect(run.characterSpacing).toBe(1200);
            expect(run.highlight).toEqual({ type: 'srgb', value: '#FFFF00' });
            expect(run.hyperlink).toBe('http://example.com');
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
                        image: { href: 'image.png', srcRect: { l: 0.1, r: 0.1, t: 0.1, b: 0.1 } },
                        altText: 'An image',
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

        it('should transform a shape with a gradient fill', () => {
            const slideData = {
                slideId: 'slide-5',
                slideNum: 5,
                shapes: [
                    {
                        type: 'shape',
                        pos: { x: 10, y: 20, width: 300, height: 100 },
                        shapeProps: {
                            fill: {
                                type: 'gradient',
                                gradientType: 'linear',
                                angle: 45,
                                stops: [
                                    { color: { value: '#FF0000' }, position: 0 },
                                    { color: { value: '#0000FF' }, position: 1 },
                                ]
                            },
                        },
                    }
                ],
            };

            const transformed = transformSlide(slideData);
            const shape = transformed.shapes[0];
            expect(shape.fill.type).toBe('gradient');
        });

        it('should transform a shape with a picture fill', () => {
            const slideData = {
                slideId: 'slide-6',
                slideNum: 6,
                background: { type: 'solid', color: { value: '#0000FF' } },
                shapes: [
                    {
                        type: 'shape',
                        pos: { x: 10, y: 20, width: 300, height: 100 },
                        shapeProps: {
                            fill: {
                                type: 'picture',
                                src: 'image.png',
                                fit: 'tile',
                                opacity: 0.5,
                            },
                        },
                    }
                ],
            };

            const transformed = transformSlide(slideData);
            const shape = transformed.shapes[0];
            expect(shape.fill.type).toBe('picture');
            expect(transformed.background.fill.type).toBe('solid');
            expect(transformed.background.fill.color.value).toBe('#0000FF');
        });

        it('should transform a shape with custom geometry', () => {
            const slideData = {
                slideId: 'slide-7',
                slideNum: 7,
                shapes: [
                    {
                        type: 'shape',
                        pos: { x: 10, y: 20, width: 300, height: 100 },
                        shapeProps: {
                            geometry: {
                                custom: {
                                    paths: [
                                        {
                                            w: 100,
                                            h: 100,
                                            commands: [
                                                { type: 'moveTo', pts: [{ x: 0, y: 0 }] },
                                                { type: 'lnTo', pts: [{ x: 100, y: 100 }] },
                                                { type: 'close' },
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ]
            }

            const transformed = transformSlide(slideData);
            const shape = transformed.shapes[0];
            expect(shape.type).toBe('shape');
            expect(shape.shapeType).toBe('custom');
            expect(shape.custom.paths.length).toBe(1);
            expect(shape.custom.paths[0].commands.length).toBe(3);
            expect(shape.custom.paths[0].commands[1].type).toBe('lnTo');
            expect(shape.custom.paths[0].commands[1].points[0].y).toBe(100);
        });
    });
});
