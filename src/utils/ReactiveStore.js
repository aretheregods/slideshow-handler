/**
 * Creates a deep, reactive proxy that notifies of changes.
 * Uses a WeakMap to cache proxies for nested objects to ensure performance
 * and reference stability, while preventing memory leaks.
 *
 * @param {object} target - The object to make reactive.
 * @param {function} callback - The function to call when a mutation occurs.
 * @param {WeakMap} cache - The cache for storing created proxies.
 * @param {string[]} [path=[]] - The path to the current target in the state tree.
 * @returns {Proxy} A reactive proxy of the target object.
 */
function createReactiveProxy( target, callback, cache, path = [] ) {
    // If the target is not an object or is null, it cannot be proxied.
    if ( typeof target !== 'object' || target === null || target instanceof Date ) {
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
            // Recursively create a proxy for nested objects, passing down the path.
            if (typeof value === 'object' && value !== null) {
                return createReactiveProxy( value, callback, cache, [...path, prop] );
            }
            return value;
        },
        set( obj, prop, value, receiver ) {
            const oldValue = Reflect.get( obj, prop, receiver );
            // Only proceed if the new value is different from the old one.
            if ( !Object.is( oldValue, value ) ) {
                const result = Reflect.set( obj, prop, value, receiver );
                // If the set operation was successful, trigger the notification callback.
                if ( result ) {
                    const fullPath = [...path, prop].join('.');
                    callback(fullPath, value, oldValue);
                }
                return result;
            }
            return true; // Indicate success for no-op sets.
        },
        deleteProperty( obj, prop ) {
            const oldValue = Reflect.get(obj, prop);
            const result = Reflect.deleteProperty( obj, prop );
            if ( result ) {
                const fullPath = [...path, prop].join('.');
                callback(fullPath, undefined, oldValue);
            }
            return result;
        }
    };

    const proxy = new Proxy( target, handler );
    cache.set( target, proxy ); // Cache the new proxy.
    return proxy;
};

/**
 * @description A class for creating an instance-based, reactive state store.
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
        this.keyListeners = new Map();
        this.proxyCache = new WeakMap();

        // The state is wrapped in a reactive proxy.
        // The callback passed to the proxy is the store's own notify method.
        this.state = createReactiveProxy(
            initialState,
            (path, value, oldValue) => this.#notify(path, value, oldValue),
            this.proxyCache
        );
    }

    /**
     * @description The internal method to notify all subscribers of a change.
     * This method is called by the proxy's `set` and `deleteProperty` traps.
     * @param {string} path - The key path of the value that changed.
     * @param {*} value - The new value.
     * @param {*} oldValue - The old value.
     */
    #notify(path, value, oldValue) {
        // Notify global listeners. These get no arguments for simplicity and backward compatibility.
        for ( const callback of this.listeners ) {
            callback(this.state);
        }

        const notifiedPaths = new Set();

        // Notify listeners for the exact path that changed.
        if (this.keyListeners.has(path)) {
            for (const subscription of this.keyListeners.get(path)) {
                subscription.callback(value, oldValue);
            }
            notifiedPaths.add(path);
        }

        // Notify listeners for parent paths.
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            if (this.keyListeners.has(parentPath) && !notifiedPaths.has(parentPath)) {
                const parentValue = this.#getNestedState(parentPath);
                for (const subscription of this.keyListeners.get(parentPath)) {
                    // If the subscriber opted out of bubble events, skip.
                    if (subscription.noBubble) {
                        continue;
                    }
                    // oldValue for parent is not available without deep cloning state on every change.
                    subscription.callback(parentValue, undefined);
                }
                notifiedPaths.add(parentPath);
            }
        }

        // Notify listeners for child paths if an object/array was replaced.
        if ((typeof value === 'object' && value !== null) || (typeof oldValue === 'object' && oldValue !== null)) {
            for (const listenerPath of this.keyListeners.keys()) {
                if (listenerPath.startsWith(`${path}.`) && !notifiedPaths.has(listenerPath)) {
                    const newSubValue = this.#getNestedState(listenerPath);
                    let oldSubValue;
                    if (oldValue && typeof oldValue === 'object') {
                        const subPath = listenerPath.substring(path.length + 1);
                        oldSubValue = subPath.split('.').reduce((obj, key) => obj?.[key], oldValue);
                    }

                    for (const subscription of this.keyListeners.get(listenerPath)) {
                        subscription.callback(newSubValue, oldSubValue);
                    }
                    notifiedPaths.add(listenerPath);
                }
            }
        }
    }

    /**
     * @description The internal method to retrieve nested state values efficiently
     * @param {string} key - a string of period separated object keys.
     * The key can be of the form 'key1.key2.key3' in order to retrieve deeply nested state values.
     * @returns {*} Can be any supported JavaScript value
     */
    #getNestedState( key = '' ) {
        const keys = key.trim().split('.');
        let state = this.state;
        for (const k of keys) {
            const trimmedKey = k.trim();
            if (trimmedKey) {
                if (state === undefined || state === null) {
                    return undefined;
                }
                state = state[trimmedKey];
            } else if (keys.length > 1) {
                // This handles invalid paths like 'a..b' or 'a.b.'
                // An empty key string which results in `keys = ['']` is valid and returns the whole state.
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
     * @param {*} [update.value] - The value with which to update the update key in state
     */
    #setNestedState( currentState, { key = '', value } ) {
        const keys = key.trim().split( '.' );
        let state = currentState;
        for ( let i = 0; i < keys.length - 1; i++ ) {
            const k = keys[i].trim();
            if ( !k ) continue;

            const nextKey = keys[i + 1].trim();
            const nextKeyIsNumber = /^\d+$/.test(nextKey);

            if ( state[ k ] === undefined || typeof state[ k ] !== 'object' || state[ k ] === null ) {
                state[ k ] = nextKeyIsNumber ? [] : {};
            }
            state = state[ k ];
        }
        const lastKey = keys[ keys.length - 1 ].trim();
        if ( lastKey ) {
            state[ lastKey ] = value;
        }
        return state;
    }

    /**
     * @description Returns the current state object.
     * The returned object is a deep proxy; direct mutations will be detected
     * and will trigger notifications, though this is an anti-pattern.
     * State should only be changed via dispatch.
     * @param {string[]} keys - An array of state keys to retrieve
     * @returns {object} The current state.
     */
    getState( ...keys ) {
        let response = {};
        for ( const key of keys ) {
            response[key] = this.#getNestedState( key );
        }
        return Object.keys( response ).length > 1
            ? response
            : response[ Object.keys( response )[ 0 ] ] || this.state;
    }

    /**
     * @description Dispatches an action to the store. The action is processed by the
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
     * @description Registers a callback function to be executed on state changes.
     * Follows the Observer pattern's subscription model.
     * @param {object|function} subscription - The subscription options object or a callback function for global state changes.
     * @param {string|string[]} [subscription.key] - The key path (or array of key paths) to subscribe to. If omitted, subscribes to all state changes.
     * @param {function} subscription.callback - The function to call on update. For single key, it receives `(newValue, oldValue)`.
     * For compound keys, it receives `(newValue, oldValue)` where both are objects containing the subscribed keys and their values.
     * @param {boolean} [subscription.noBubble=false] - If true, this listener will not be notified of changes in nested properties.
     * @returns {function} An `unsubscribe` function to remove the listener.
     */
    subscribe( subscription ) {
        if (typeof subscription === 'function') {
            // Handle subscribe(callback) for global listeners for backward compatibility.
            this.listeners.add(subscription);
            return () => this.listeners.delete(subscription);
        }

        const { key, callback, noBubble = false } = subscription || {};

        if (typeof callback !== 'function') {
            throw new Error('A callback function must be provided to subscribe.');
        }

        if (!key) {
            // Global subscription via subscribe({ callback })
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        }

        const keys = Array.isArray(key) ? key : [key];
        if (!keys.every(k => typeof k === 'string' && k.length > 0)) {
            throw new Error('The key to subscribe to must be a non-empty string or an array of non-empty strings.');
        }

        if (keys.length > 1) {
            // Compound key subscription
            const getCompoundState = () => {
                const state = {};
                for (const k of keys) {
                    state[k] = this.#getNestedState(k);
                }
                return state;
            };

            let lastKnownState = getCompoundState();
            let timeoutId = null;

            const debouncedCallback = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                timeoutId = setTimeout(() => {
                    const newState = getCompoundState();
                    callback(newState, lastKnownState);
                    timeoutId = null;
                    lastKnownState = newState;
                }, 0);
            };

            const sub = { callback: debouncedCallback, noBubble };
            const unsubscribes = keys.map(k => {
                if (!this.keyListeners.has(k)) {
                    this.keyListeners.set(k, new Set());
                }
                const keyListeners = this.keyListeners.get(k);
                keyListeners.add(sub);
                return () => {
                    keyListeners.delete(sub);
                    if (keyListeners.size === 0) {
                        this.keyListeners.delete(k);
                    }
                };
            });

            return () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                unsubscribes.forEach(unsub => unsub());
            };
        }

        // Single key subscription
        const singleKey = keys[0];
        if (!this.keyListeners.has(singleKey)) {
            this.keyListeners.set(singleKey, new Set());
        }
        const keyListeners = this.keyListeners.get(singleKey);
        const sub = { callback, noBubble };
        keyListeners.add(sub);
        return () => {
            keyListeners.delete(sub);
            if (keyListeners.size === 0) {
                this.keyListeners.delete(singleKey);
            }
        };
    }
}