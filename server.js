const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Store current state to sync new clients immediately
const documentState = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send the current state to the newly connected client
    socket.emit('initial_state', documentState);

    // Listen for input changes
    socket.on('input_change', (data) => {
        // data should be { id: elementId, value: value, type: 'text' | 'checkbox' }
        if (data && data.id) {
            documentState[data.id] = { value: data.value, type: data.type };
            // Broadcast the change to all other clients
            socket.broadcast.emit('state_update', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`Teacher View: http://localhost:${PORT}/?role=teacher`);
    console.log(`Student View: http://localhost:${PORT}/?role=student`);
});
