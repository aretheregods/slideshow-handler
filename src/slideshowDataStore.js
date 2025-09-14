import { ReactiveStore, transformPresentation } from 'utils';

const initialPresentationState = {
    status: 'idle', // idle, parsing, ready, error
    activeSlide: 0,
    slideSize: null,
    theme: null,
    error: null,
    presentation: {
        title: 'Untitled Presentation',
        author: 'Unknown',
        themeSettings: {
            backgroundColor: '#FFFFFF',
            defaultFont: 'Calibri',
        },
        slides: [],
    },
};

function presentationReducer(state = initialPresentationState, action) {
    switch (action.type) {
        case 'START_PARSING':
            return { ...initialPresentationState, status: 'parsing' };
        case 'START_RENDERING':
            return { ...initialPresentationState, status: 'rendering' };
        case 'START_PRESENTATION':
            return { ...initialPresentationState, status: 'presenting', activeSlide: action.payload ?? 0 };
        case 'SET_PRESENTATION_DATA':
            return { ...state, ...action.payload };
        case 'SET_TRANSFORMED_PRESENTATION':
            return { ...state, presentation: action.payload };
        case 'SET_PRESENTATION_STATUS':
            return { ...state, status: action.payload };
        case 'SET_PRESENTATION_ERROR':
            return { ...state, status: 'error', error: action.payload };
        default:
            return state;
    }
}

export const presentationStore = new ReactiveStore({
    initialState: initialPresentationState,
    reducer: presentationReducer,
});

const initialSlideState = {
    id: '',
    parsingData: null,
    renderingData: null
};

export function createSlideStore( { id, state = {} } ) {
    return new ReactiveStore( {
        initialState: {
            id,
            slideNum: -1,
            background: null,
            slideContext: null,
            ...state
        },
        reducer ( state = initialSlideState, action ) {
            switch ( action.type ) {
                case 'SET_SLIDE_DATA':
                    return { ...state, ...action.payload };
                default:
                    return state;
            }
        }
    } );
}

export const slideStores = new Map();
