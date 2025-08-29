import { ReactiveStore } from 'utils';
import { slideshowProcessingActions as actions } from 'constants';

const initialPresentationState = {
    status: 'idle', // idle, parsing, ready, error
    activeSlide: 0,
    slideSize: null,
    theme: null,
    error: null,
};

function presentationReducer( state = initialPresentationState, action ) {
    switch ( action.type ) {
        case actions.start.parsing:
            return { ...initialPresentationState, status: 'parsing' };
        case actions.start.rendering:
            return { ...initialPresentationState, status: 'rendering' };
        case actions.start.presentation:
            return { ...initialPresentationState, status: 'presenting', activeSlide: action.payload ?? 0 };
        case actions.set.presentation.data:
            return { ...state, ...action.payload };
        case actions.set.presentation.status:
            return { ...state, status: action.payload };
        case actions.set.presentation.error:
            return { ...state, status: 'error', error: action.payload };
        default:
            return state;
    }
}

const initialSlideState = {
    id: '',
    parsingData: null,
    renderingData: null
};

export const presentationStore = new ReactiveStore( {
    initialState: initialPresentationState,
    reducer: presentationReducer,
} );

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
                case actions.set.slide.data:
                    return { ...state, ...action.payload };
                default:
                    return state;
            }
        }
    } );
}

export const slideStores = new Map();
