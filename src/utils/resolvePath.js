export function resolvePath( baseDir, target ) {
    // Normalize backslashes to forward slashes for cross-platform compatibility.
    const normalizedTarget = target.replace( /\\/g, '/' );

    // If target is an absolute path (starts with '/'), it's relative to the zip root.
    if ( normalizedTarget.startsWith( '/' ) ) {
        // Just remove the leading slash and return.
        return normalizedTarget.substring( 1 );
    }
    // Otherwise, resolve it relative to the baseDir.
    const path = baseDir + '/' + normalizedTarget;
    const parts = path.split( '/' );
    const resolved = [];
    for ( const part of parts ) {
        if ( part === '..' ) {
            resolved.pop();
        } else if ( part !== '.' && part !== '' ) {
            resolved.push( part );
        }
    }
    return resolved.join( '/' );
}
