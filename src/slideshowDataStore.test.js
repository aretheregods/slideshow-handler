import { describe, it, expect, beforeEach } from 'vitest';
import { presentationStore, createSlideStore, slideStores } from './slideshowDataStore';

describe('presentationStore', () => {
  const initialPresentationState = {
    status: 'idle',
    activeSlide: 0,
    slideSize: null,
    theme: null,
    error: null,
  };

  // Reset the store to its initial state before each test
  beforeEach(() => {
    presentationStore.dispatch({ type: 'RESET_FOR_TEST' }); // A dummy action to reset via default case
    // Manually reset state since reducers create new objects
    Object.assign(presentationStore.getState(), initialPresentationState);
    presentationStore.getState().status = 'idle'; // Ensure status is reset
  });

  it('should have the correct initial state', () => {
    expect(presentationStore.getState()).toEqual(initialPresentationState);
  });

  it('should handle start.parsing action', () => {
    presentationStore.dispatch({ type: 'START_PARSING' });
    const state = presentationStore.getState();
    expect(state.status).toBe('parsing');
  });

  it('should handle start.rendering action', () => {
    presentationStore.dispatch({ type: 'START_RENDERING' });
    const state = presentationStore.getState();
    expect(state.status).toBe('rendering');
  });

  it('should handle start.presentation action', () => {
    presentationStore.dispatch({ type: 'START_PRESENTATION', payload: 2 });
    const state = presentationStore.getState();
    expect(state.status).toBe('presenting');
    expect(state.activeSlide).toBe(2);
  });

  it('should handle set.presentation.data action', () => {
    const data = { slideSize: { width: 1024, height: 768 }, theme: 'light' };
    presentationStore.dispatch({ type: 'SET_PRESENTATION_DATA', payload: data });
    const state = presentationStore.getState();
    expect(state.slideSize).toEqual(data.slideSize);
    expect(state.theme).toBe(data.theme);
  });

  it('should handle set.presentation.status action', () => {
    presentationStore.dispatch({ type: 'SET_PRESENTATION_STATUS', payload: 'ready' });
    expect(presentationStore.getState().status).toBe('ready');
  });

  it('should handle set.presentation.error action', () => {
    const error = new Error('Test error');
    presentationStore.dispatch({ type: 'SET_PRESENTATION_ERROR', payload: error });
    const state = presentationStore.getState();
    expect(state.status).toBe('error');
    expect(state.error.message).toBe(error.message);
  });
});

describe('slideStores Map', () => {
  beforeEach(() => {
    slideStores.clear();
  });

  it('should be able to add and retrieve slide stores', () => {
    const slide1Store = createSlideStore({ id: 'slide1' });
    const slide2Store = createSlideStore({ id: 'slide2' });

    slideStores.set('slide1', slide1Store);
    slideStores.set('slide2', slide2Store);

    expect(slideStores.get('slide1')).toBe(slide1Store);
    expect(slideStores.get('slide2')).toBe(slide2Store);
    expect(slideStores.size).toBe(2);
  });

  it('should be able to clear all slide stores', () => {
    const slide1Store = createSlideStore({ id: 'slide1' });
    slideStores.set('slide1', slide1Store);
    expect(slideStores.size).toBe(1);

    slideStores.clear();
    expect(slideStores.size).toBe(0);
  });
});

describe('createSlideStore', () => {
  it('should create a store with a given ID and initial state', () => {
    const slideStore = createSlideStore({ id: 'slide1' });
    const state = slideStore.getState();
    expect(state.id).toBe('slide1');
    expect(state.slideNum).toBe(-1); // default value
    expect(state.background).toBeNull(); // default value
  });

  it('should create a store with additional initial state', () => {
    const initialState = { slideNum: 1, background: 'blue' };
    const slideStore = createSlideStore({ id: 'slide2', state: initialState });
    const state = slideStore.getState();
    expect(state.id).toBe('slide2');
    expect(state.slideNum).toBe(1);
    expect(state.background).toBe('blue');
  });

  it('should handle set.slide.data action', () => {
    const slideStore = createSlideStore({ id: 'slide3' });
    const data = { slideContext: { some: 'data' }, background: 'red' };
    slideStore.dispatch({ type: 'SET_SLIDE_DATA', payload: data });
    const state = slideStore.getState();
    expect(state.slideContext).toEqual(data.slideContext);
    expect(state.background).toBe('red');
  });

  it('should return current state for unknown action types', () => {
    const slideStore = createSlideStore({ id: 'slide4' });
    const initialState = slideStore.getState();
    slideStore.dispatch({ type: 'UNKNOWN_ACTION' });
    const state = slideStore.getState();
    expect(state).toEqual(initialState);
  });
});
