import express from 'express'; // Importamos Express para crear nuestro servidor web
import logger from 'morgan'; // Importamos Morgan para el registro de solicitudes HTTP
import dotenv from 'dotenv'; // Importamos dotenv para cargar variables de entorno desde un archivo .env
import { createClient } from '@libsql/client'; // Importamos createClient para conectarnos a la base de datos

import { Server } from 'socket.io'; // Importamos Server de 'socket.io' para manejar conexiones WebSocket
import { createServer } from 'node:http'; // Importamos createServer de 'http' para crear un servidor HTTP
import cors from 'cors'

dotenv.config(); // Configuramos dotenv para que cargue las variables de entorno desde un archivo .env

const port = process.env.PORT ?? 3000; // Definimos el puerto en el que el servidor va a escuchar

const app = express(); // Creamos una instancia de Express
const server = createServer(app); // Creamos un servidor HTTP utilizando Express
const io = new Server(server, {
  connectionStateRecovery: {}, // Habilitamos la recuperación del estado de la conexión
  cors: {
    origin: '*', // Aquí especificas el origen permitido
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const db = createClient({
  url: 'libsql://working-huntress-purple-code-sh.turso.io',
  authToken: process.env.DB_TOKEN
});

// Creamos la tabla 'messages' en la base de datos si no existe
await db.execute(`
  CREATE TABLE IF NOT EXISTS motors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    angle TEXT
  )
`);

io.on('connection', async (socket) => {
  console.log('a user has connected!');

  socket.on('disconnect', () => {
    console.log('an user has disconnected');
  });

  socket.on('angle_1_changed', async (angle) => {
    let result;
    const username = socket.handshake.auth.username ?? 'anonymous'; // Obtenemos el nombre de usuario
    console.log({ username });
    const motorId = 1; // Puedes cambiar esto a cualquier otro ID si es necesario
  
    try {
      result = await db.execute({
        sql: 'UPDATE motors SET angle = :angle WHERE id = :id',
        args: { angle, id: motorId }
      });
  
      // Si la fila con el ID especificado no existe, puedes insertar una nueva fila opcionalmente
      if (result.changes === 0) {
        result = await db.execute({
          sql: 'INSERT INTO motors (id, angle) VALUES (:id, :angle)',
          args: { id: motorId, angle }
        });
      }
    } catch (e) {
      console.error(e);
      return;
    }
  
    io.emit('angle_1_changed', angle, motorId.toString(), username);
  });

  if (!socket.recovered) { // Recuperamos los mensajes sin conexión si la conexión no fue recuperada
    try {
      const results = await db.execute({
        sql: 'SELECT id, angle FROM motors WHERE id > ?',
        args: [socket.handshake.auth.serverOffset ?? 0]
      });

      results.rows.forEach(row => {
        socket.emit('angle_1_changed', row.angle, row.id.toString(), 'shm-motor1');
      });
    } catch (e) {
      console.error(e);
    }
  }
});

// Middleware CORS
app.use(cors({
    origin: 'http://localhost:5173', // Aquí especificas el origen permitido
    methods: ['GET', 'POST'],
    credentials: true
  }));

// Usamos Morgan para registrar las solicitudes HTTP
app.use(logger('dev'));

// Definimos una ruta para servir el archivo HTML principal
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index2-public.html'); // Enviamos el archivo index.html al cliente
});

// Hacemos que el servidor escuche en todas las interfaces de red
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
});
