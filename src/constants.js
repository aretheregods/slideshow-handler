export const EMU_PER_PIXEL = 12700; // Standard conversion for 96 DPI
export const PT_TO_PX = .975; // Adjusted conversion for web rendering (90/72)
export const LINE_HEIGHT = 24; // A default line height in pixels for SVG text
export const INDENTATION_AMOUNT = 30; // Pixels per indentation level
export const BULLET_OFFSET = 20; // Space between bullet and text

export const PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
export const DML_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
export const TABLE_NS = "http://schemas.openxmlformats.org/drawingml/2006/table";

export const slideshowProcessingActions = {
    start: {
        presentation: 'START_PRESENTATION',
        parsing: 'START_PARSING',
        rendering: 'START_RENDERING'
    },
    set: {
        presentation: {
            data: 'SET_PRESENTATION_DATA',
            status: 'SET_PRESENTATION_STATUS',
			error: 'SET_PRESENTATION_ERROR',
			activeSlide: 'SET_PRESENTATION_ACTIVE_SLIDE'
        },
        slide: {
            data: 'SET_SLIDE_DATA'
        }
    }
}
