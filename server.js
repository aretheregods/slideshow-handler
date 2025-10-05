import http from 'http';
import fs from 'fs';
import path from 'path';

const getContentType = ( ext ) => {
    switch ( ext ) {
        case '.js':
            return 'text/javascript';
        case '.css':
            return 'text/css';
        case '.json':
            return 'application/json';
        case '.png':
            return 'image/png';
        case '.jpg':
            return 'image/jpeg';
        case '.html':
            return 'text/html';
        default:
            return 'application/octet-stream';
    }
};

const args = process.argv.slice( 2 ).reduce( ( acc, arg ) => {
    const [ key, value ] = arg.split( '=' );
    acc[ key.replace( '--', '' ) ] = value;
    return acc;
}, {} );

const port = args.port || 3000;

const handle404Read = ( res, err404, content404 ) => {
    res.writeHead( 404, { 'Content-Type': 'text/html' } );
    if ( err404 ) {
        res.end( '404 Not Found', 'utf-8' );
    } else {
        res.end( content404, 'utf-8' );
    }
};

const handleFileRead = ( res, contentType, err, content ) => {
    if ( err ) {
        if ( err.code === 'ENOENT' ) {
            fs.readFile( path.join( process.cwd(), '404.html' ), ( err404, content404 ) => handle404Read( res, err404, content404 ) );
        } else {
            res.writeHead( 500 );
            res.end( 'Sorry, check with the site admin for error: ' + err.code + ' ..\n' );
        }
    } else {
        res.writeHead( 200, { 'Content-Type': contentType } );
        res.end( content, 'utf-8' );
    }
};

const server = http.createServer( ( req, res ) => {
    const originalEnd = res.end;
    res.end = function ( ...args ) {
        const logMessage = `${ new Date().toISOString() } - ${ req.method } ${ req.url } - ${ res.statusCode }`;
        console.log( logMessage );
        return originalEnd.apply( this, args );
    };

    let filePath = req.url === '/' ? '/index.html' : req.url;
    const extname = String( path.extname( filePath ) ).toLowerCase();
    const contentType = getContentType( extname );

    // The file path should be relative to the project root
    const fullPath = path.join( process.cwd(), filePath );

    fs.readFile( fullPath, ( err, content ) => handleFileRead( res, contentType, err, content ) );
} );

server.listen( port, () => {
    console.log( `Server running at http://localhost:${ port }/` );
} );