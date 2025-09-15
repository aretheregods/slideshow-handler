import { ColorParser } from './colorParser.js';

export function transformShape(shape, slideContext) {
    if (shape.text && shape.text.layout && shape.text.layout.lines) {
        const newLayout = {
            ...shape.text.layout,
            lines: shape.text.layout.lines.map(line => ({
                ...line,
                runs: line.runs.map(run => {
                    const newRun = { ...run };
                    if (run.highlight) {
                        newRun.highlight = ColorParser.resolveColor(run.highlight, slideContext);
                    }
                    return newRun;
                }),
            })),
        };
        return { ...shape, text: { ...shape.text, layout: newLayout } };
    }
    return shape;
}
