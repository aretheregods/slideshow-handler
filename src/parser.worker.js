import { parsingOrchestrator } from './parsingOrchestrator.js';
import { messageType } from './constants.js';

self.onmessage = async ( event ) => {
    const { file } = event.data;

    try {
        const parsedData = await parsingOrchestrator( { file } );
        self.postMessage( { type: messageType.success, data: parsedData } );
    } catch ( error ) {
        self.postMessage( { type: messageType.error, error: error.message } );
    }
};