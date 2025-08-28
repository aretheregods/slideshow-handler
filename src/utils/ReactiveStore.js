/**
 * Creates a deep, reactive proxy that notifies of changes.
 * Uses a WeakMap to cache proxies for nested objects to ensure performance
 * and reference stability, while preventing memory leaks.
 *
 * @param {object} target - The object to make reactive.
 * @param {function} callback - The function to call when a mutation occurs.
 * @param {WeakMap} cache - The cache for storing created proxies.
 * @returns {Proxy} A reactive proxy of the target object.
 */
function createReactiveProxy( target, callback, cache ) {
    // If the target is not an object or is null, it cannot be proxied.
    if ( typeof target !== 'object' || target === null ) {
        return target;
    }

    // If a proxy for this target already exists in the cache, return it.
    if ( cache.has( target ) ) {
        return cache.get( target );
    }

    const handler = {
        get( obj, prop, receiver ) {
            // Forward the property access to the original object.
            const value = Reflect.get( obj, prop, receiver );
            // Recursively create a proxy for nested objects.
            return createReactiveProxy( value, callback, cache );
        },
        set( obj, prop, value, receiver ) {
            const oldValue = Reflect.get( obj, prop, receiver );
            // Only proceed if the new value is different from the old one.
            if ( !Object.is( oldValue, value ) ) {
                const result = Reflect.set( obj, prop, value, receiver );
                // If the set operation was successful, trigger the notification callback.
                if ( result ) {
                    callback();
                }
                return result;
            }
            return true; // Indicate success for no-op sets.
        },
        deleteProperty( obj, prop ) {
            const result = Reflect.deleteProperty( obj, prop );
            if ( result ) {
                callback();
            }
            return result;
        }
    };

    const proxy = new Proxy( target, handler );
    cache.set( target, proxy ); // Cache the new proxy.
    return proxy;
};

/**
 * A class for creating an instance-based, reactive state store.
 * It combines the Observer pattern with Redux-like state management principles.
 */
export class ReactiveStore {
    /**
     * @param {object} options - The configuration options for the store.
     * @param {object} options.initialState - The initial state of the store.
     * @param {function} options.reducer - A pure function that takes (state, action)
     *   and returns the new state.
     */
    constructor( { initialState, reducer } ) {
        if ( !initialState || typeof initialState !== 'object' ) {
            throw new Error( 'initialState must be a non-null object.' );
        }
        if ( typeof reducer !== 'function' ) {
            throw new Error( 'reducer must be a function.' );
        }

        this.reducer = reducer;
        this.listeners = new Set();
        this.proxyCache = new WeakMap();

        // The state is wrapped in a reactive proxy.
        // The callback passed to the proxy is the store's own notify method.
        this.state = createReactiveProxy(
            initialState,
            () => this.#notify(),
            this.proxyCache
        );
    }

    /**
     * The internal method to notify all subscribers of a change.
     * This method is called by the proxy's `set` trap.
     */
    #notify() {
        for ( const callback of this.listeners ) {
            callback();
        }
    }

    /**
     * @description The internal method to retrieve nested state values efficiently
     * @param {string} key - a string of period separated object keys.
     * The key can be of the form 'key1.key2.key3' in order to retrieve deeply nested state values.
     * @param {object} currentState - the state object from which to retrieve the key's value.
     * @returns {*} Can be any supported JavaScript value
     */
    #getNestedState( key = '', currentState ) {
        const keys = key.trim().split( '.' );
        let state = currentState ?? this.state;
        for ( const k of keys ) {
            if ( k.trim() ) state = state[ k ];
            if ( state === undefined ) {
                return undefined;
            }
        }
        return state;
    }

    /**
     * @description The internal method to set nested state values efficiently
     * @param {object} currentState - The state object to be updated
     * @param {object} update - The object containing the key and value to be updated.
     * @param {string} [update.key=''] - The key path to the value to be updated.
     * The key can be of the form 'key1.key2.key3' in order to update deeply nested state values
     * @param {*} [update.value] - The value to which to update the state key
     */
    #setNestedState( currentState, { key = '', value } ) {
        const keys = key.trim().split( '.' );
        let state = currentState;
        for ( const k of keys.slice( 0, -1 ) ) {
            state = state[ k ];
        }
        state[ keys[ keys.length - 1 ] ] = value;
        return state;
    }

    /**
     * Returns the current state object.
     * The returned object is a deep proxy; direct mutations will be detected
     * and will trigger notifications, though this is an anti-pattern.
     * State should only be changed via dispatch.
     * @returns {object} The current state.
     */
    getState(key = '') {
        return key ? this.#getNestedState( key ) : this.state;
    }

    /**
     * Dispatches an action to the store. The action is processed by the
     * reducer to compute the next state.
     * @param {object} action - A plain object describing the change.
     */
    dispatch( action ) {
        // The raw, un-proxied current state is passed to the reducer.
        // This is an optimization to avoid proxy overhead within the pure reducer logic.
        const currentState = JSON.parse( JSON.stringify( this.state ) );

        const nextState = this.reducer( currentState, action );

        // Instead of replacing the proxy, we merge the new state into the old one.
        // This preserves the root proxy reference and allows its `set` traps
        // to detect all the granular changes.
        Object.keys( nextState ).forEach( key => {
            if ( !Object.is( this.#getNestedState( key ), nextState[ key ] ) ) {
                this.#setNestedState( this.state, { key, value: nextState[ key ] } );
            }
        } );

        // Clean up keys that exist in the old state but not the new one.
        Object.keys( currentState ).forEach( key => {
            if ( !( key in nextState ) ) {
                delete this.state[ key ];
            }
        } );
    }

    /**
     * Registers a callback function to be executed on state changes.
     * Follows the Observer pattern's subscription model.
     * @param {function} callback - The function to call on update.
     * @returns {function} An `unsubscribe` function to remove the listener.
     */
    subscribe( callback ) {
        this.listeners.add( callback );
        // Return a function that allows the consumer to unsubscribe.
        return () => {
            this.listeners.delete( callback );
        };
    }
}