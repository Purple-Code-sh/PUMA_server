import { server as WebSocketServer } from 'websocket';
import http from 'http';

const server = http.createServer((request, response) => {
    console.log(`${new Date()} Received request for ${request.url}`);
    response.writeHead(404);
    response.end();
});

server.listen(5000, '0.0.0.0', () => {
    console.log(`${new Date()} Server is listening on port 5000`);
});

const wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
    // Lógica para verificar si el origen está permitido
    return true;
}

// Array para almacenar todas las conexiones activas
const connections = [];

wsServer.on('request', (request) => {
    if (!originIsAllowed(request.origin)) {
        request.reject();
        console.log(`${new Date()} Connection from origin ${request.origin} rejected.`);
        return;
    }

    const connection = request.accept(null, request.origin);
    console.log(`${new Date()} Connection accepted.`);

    // Añadir la nueva conexión al array
    connections.push(connection);

    connection.on('message', (message) => {
        if (message.type === 'utf8') {
            console.log(`Received Message: ${message.utf8Data}`);
            
            // Enviar el mensaje a todos los clientes conectados
            connections.forEach((client) => {
                if (client.connected) {
                    client.sendUTF(`Emiter: ${message.utf8Data}`);
                }
            });
        } else if (message.type === 'binary') {
            console.log(`Received Binary Message of ${message.binaryData.length} bytes`);
            
            // Enviar el mensaje binario a todos los clientes conectados
            connections.forEach((client) => {
                if (client.connected) {
                    client.sendBytes(message.binaryData);
                }
            });
        }
    });

    connection.on('close', (reasonCode, description) => {
        console.log(`${new Date()} Peer ${connection.remoteAddress} disconnected.`);
        
        // Eliminar la conexión cerrada del array
        const index = connections.indexOf(connection);
        if (index > -1) {
            connections.splice(index, 1);
        }
    });
});