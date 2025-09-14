import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactiveStore } from './ReactiveStore';

describe('ReactiveStore', () => {
    // Reducer function for testing purposes
    const testReducer = (state, action) => {
        switch (action.type) {
            case 'SET_NAME':
                return { ...state, name: action.payload };
            default:
                return state;
        }
    };

    describe('constructor', () => {
        it('should throw an error if initialState is not a non-null object', () => {
            expect(() => new ReactiveStore({ initialState: null, reducer: testReducer })).toThrow('initialState must be a non-null object.');
            expect(() => new ReactiveStore({ initialState: 'string', reducer: testReducer })).toThrow('initialState must be a non-null object.');
            expect(() => new ReactiveStore({ initialState: 123, reducer: testReducer })).toThrow('initialState must be a non-null object.');
        });

        it('should throw an error if reducer is not a function', () => {
            expect(() => new ReactiveStore({ initialState: {}, reducer: null })).toThrow('reducer must be a function.');
            expect(() => new ReactiveStore({ initialState: {}, reducer: 'not-a-function' })).toThrow('reducer must be a function.');
            expect(() => new ReactiveStore({ initialState: {}, reducer: {} })).toThrow('reducer must be a function.');
        });

        it('should initialize successfully with valid parameters', () => {
            expect(() => new ReactiveStore({ initialState: { name: 'Initial' }, reducer: testReducer })).not.toThrow();
        });
    });

    describe('getState', () => {
        const initialState = {
            user: {
                name: 'John Doe',
                email: 'john.doe@example.com',
                address: {
                    city: 'New York',
                    zip: '10001'
                }
            },
            settings: {
                theme: 'dark',
                notifications: true
            }
        };
        const store = new ReactiveStore({ initialState, reducer: testReducer });

        it('should return the entire state object when called with no arguments', () => {
            expect(store.getState()).toEqual(initialState);
        });

        it('should return the value of a single top-level property', () => {
            expect(store.getState('settings')).toEqual(initialState.settings);
        });

        it('should return the value of a deeply nested property', () => {
            expect(store.getState('user.address.city')).toBe('New York');
        });

        it('should return undefined for a non-existent key', () => {
            expect(store.getState('user.age')).toBeUndefined();
        });

        it('should return undefined for a deeply nested non-existent key', () => {
            expect(store.getState('user.address.street')).toBeUndefined();
        });

        // Note: The current implementation of getState does not support multiple arguments.
        // The implementation is:
        // getState(...keys) {
        //   let response = {};
        //   for (const key of keys) {
        //     response[key] = this.#getNestedState(key);
        //   }
        //   return Object.keys(response).length > 1
        //     ? response
        //     : response[Object.keys(response)[0]] || this.state;
        // }
        // When called with multiple keys, it returns an object. When called with one, it returns the value.
        // This part of the plan needs adjustment. I will test the multi-key functionality as it is implemented.
        it('should return an object with the specified keys and their values for multiple arguments', () => {
            const result = store.getState('user.name', 'settings.theme');
            expect(result).toEqual({
                'user.name': 'John Doe',
                'settings.theme': 'dark'
            });
        });
    });

    describe('dispatch', () => {
        let store;
        const testReducer = (state, action) => {
            switch (action.type) {
                case 'UPDATE_USER_NAME':
                    return { ...state, user: { ...state.user, name: action.payload } };
                case 'ADD_PROPERTY':
                    return { ...state, newProp: action.payload };
                case 'REMOVE_PROPERTY':
                    const { settings, ...rest } = state;
                    return rest;
                default:
                    return state;
            }
        };

        beforeEach(() => {
            const initialState = {
                user: { name: 'John' },
                settings: { theme: 'light' }
            };
            store = new ReactiveStore({ initialState, reducer: testReducer });
        });

        it('should update the state based on the dispatched action', () => {
            store.dispatch({ type: 'UPDATE_USER_NAME', payload: 'Jane' });
            expect(store.getState('user.name')).toBe('Jane');
        });

        it('should add a new property to the state', () => {
            store.dispatch({ type: 'ADD_PROPERTY', payload: 'hello world' });
            expect(store.getState('newProp')).toBe('hello world');
        });

        it('should remove a property from the state', () => {
            expect(store.getState('settings')).toBeDefined();
            store.dispatch({ type: 'REMOVE_PROPERTY' });
            expect(store.getState('settings')).toBeUndefined();
        });

        it('should notify a global listener on dispatch', () => {
            const listener = vi.fn();
            store.subscribe(listener);

            store.dispatch({ type: 'UPDATE_USER_NAME', payload: 'Mike' });

            expect(listener).toHaveBeenCalled();
            // The global listener is called with the full state proxy
            expect(listener).toHaveBeenCalledWith(store.getState());
        });
    });

    describe('direct state mutation (anti-pattern)', () => {
        let store;
        const testReducer = (state, action) => state; // Reducer does nothing for this test

        beforeEach(() => {
            const initialState = {
                user: { profile: { name: 'Alex' } },
                counter: 0,
            };
            store = new ReactiveStore({ initialState, reducer: testReducer });
        });

        it('should notify listeners on direct assignment to a root property', () => {
            const listener = vi.fn();
            store.subscribe({ key: 'counter', callback: listener });

            store.state.counter = 1;

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(1, 0);
            expect(store.getState('counter')).toBe(1);
        });

        it('should notify listeners on direct assignment to a nested property', () => {
            const listener = vi.fn();
            store.subscribe({ key: 'user.profile.name', callback: listener });

            store.state.user.profile.name = 'Sam';

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith('Sam', 'Alex');
            expect(store.getState('user.profile.name')).toBe('Sam');
        });

        it('should notify listeners on direct deletion of a property', () => {
            const listener = vi.fn();
            store.subscribe({ key: 'counter', callback: listener });

            delete store.state.counter;

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(undefined, 0);
            expect(store.getState('counter')).toBeUndefined();
        });

        it('should notify parent listeners on nested property change (bubbling)', () => {
            const parentListener = vi.fn();
            store.subscribe({ key: 'user.profile', callback: parentListener });

            store.state.user.profile.name = 'Taylor';

            expect(parentListener).toHaveBeenCalledTimes(1);
            // The new value of the parent object is passed, but the old value is undefined due to performance reasons
            expect(parentListener).toHaveBeenCalledWith(store.getState('user.profile'), undefined);
        });
    });

    describe('subscribe', () => {
        let store;
        const testReducer = (state, action) => {
            if (action.type === 'SET') {
                return { ...state, ...action.payload };
            }
            return state;
        };

        beforeEach(() => {
            const initialState = {
                a: 1,
                b: { c: 2 },
                d: 4,
            };
            store = new ReactiveStore({ initialState, reducer: testReducer });
        });

        it('should throw an error if callback is not a function', () => {
            expect(() => store.subscribe({ key: 'a' })).toThrow('A callback function must be provided to subscribe.');
        });

        it('should throw an error for invalid key types', () => {
            expect(() => store.subscribe({ key: 123, callback: () => {} })).toThrow('The key to subscribe to must be a non-empty string or an array of non-empty strings.');
            expect(() => store.subscribe({ key: ['a', ''], callback: () => {} })).toThrow('The key to subscribe to must be a non-empty string or an array of non-empty strings.');
        });

        it('should handle global subscription and unsubscription', () => {
            const globalListener = vi.fn();
            const unsubscribe = store.subscribe(globalListener);

            store.dispatch({ type: 'SET', payload: { a: 10 } });
            expect(globalListener).toHaveBeenCalledTimes(1);

            unsubscribe();
            store.dispatch({ type: 'SET', payload: { a: 20 } });
            expect(globalListener).toHaveBeenCalledTimes(1); // Should not be called again
        });

        it('should handle single-key subscription and unsubscription', () => {
            const keyListener = vi.fn();
            const unsubscribe = store.subscribe({ key: 'a', callback: keyListener });

            store.state.a = 10;
            expect(keyListener).toHaveBeenCalledTimes(1);
            expect(keyListener).toHaveBeenCalledWith(10, 1);

            unsubscribe();
            store.state.a = 20;
            expect(keyListener).toHaveBeenCalledTimes(1); // Should not be called again
        });

        it('should not notify a listener if the value has not changed', () => {
            const listener = vi.fn();
            store.subscribe({ key: 'a', callback: listener });
            store.state.a = 1; // Same value as initial state
            expect(listener).not.toHaveBeenCalled();
        });

        it('should support the noBubble option', () => {
            const parentListener = vi.fn();
            store.subscribe({ key: 'b', callback: parentListener, noBubble: true });

            store.state.b.c = 3; // Change a nested property

            expect(parentListener).not.toHaveBeenCalled();
        });

        it('should notify listener for a child path if parent object is replaced', () => {
            const childListener = vi.fn();
            store.subscribe({ key: 'b.c', callback: childListener });

            const oldB = store.state.b;
            store.state.b = { c: 3 };

            expect(childListener).toHaveBeenCalledTimes(1);
            expect(childListener).toHaveBeenCalledWith(3, 2);
        });

        describe('compound key subscriptions', () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it('should handle compound-key subscription and unsubscription', async () => {
                const compoundListener = vi.fn();
                const unsubscribe = store.subscribe({
                    key: ['a', 'd'],
                    callback: compoundListener
                });

                const oldState = { a: 1, d: 4 };
                store.state.a = 10;
                store.state.d = 40;

                // The callback is debounced with setTimeout(..., 0)
                expect(compoundListener).not.toHaveBeenCalled();
                await vi.runAllTimersAsync();

                expect(compoundListener).toHaveBeenCalledTimes(1);
                const expectedNewState = { a: 10, d: 40 };
                expect(compoundListener).toHaveBeenCalledWith(expectedNewState, oldState);

                unsubscribe();
                store.state.a = 100;
                await vi.runAllTimersAsync();
                expect(compoundListener).toHaveBeenCalledTimes(1); // Should not be called again
            });
        });
    });
});
