const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Quantum state simulation
class QuantumBit {
    constructor(bit = 0, hadamard = false) {
        this.bit = bit;
        this.hadamard = hadamard;
    }

    applyHadamard() {
        this.hadamard = !this.hadamard;
    }

    measure() {
        if (this.hadamard) {
            return Math.random() < 0.5 ? 0 : 1;
        } else {
            return this.bit;
        }
    }

    getState() {
        if (this.hadamard) {
            return this.bit === 0 ? "|0x⟩" : "|1x⟩";
        } else {
            return this.bit === 0 ? "|0⟩" : "|1⟩";
        }
    }
}

// Game state management
class GameState {
    constructor() {
        this.phase = 'alice_prepare';
        this.qubit = null;
        this.players = {
            alice: { connected: false, bit: 0, hadamard: false },
            eve: { connected: false, hadamard: false, measured: null },
            bob: { connected: false, hadamard: false, measured: null }
        };
        this.round = 1;
    }

    reset() {
        this.phase = 'alice_prepare';
        this.qubit = null;
        this.players.alice = { connected: this.players.alice.connected, bit: 0, hadamard: false };
        this.players.eve = { connected: this.players.eve.connected, hadamard: false, measured: null };
        this.players.bob = { connected: this.players.bob.connected, hadamard: false, measured: null };
    }
}

const gameState = new GameState();

// Helper function to serialize game state for Socket.IO
function getSerializableGameState() {
    return {
        ...gameState,
        qubit: gameState.qubit ? {
            bit: gameState.qubit.bit,
            hadamard: gameState.qubit.hadamard,
            getState: gameState.qubit.getState()
        } : null
    };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (role) => {
        try {
            if (role === 'admin') {
                socket.join('admin');
                socket.emit('roleAssigned', 'admin');
            } else {
                if (gameState.players[role].connected) {
                    socket.emit('error', `${role} is already connected`);
                    return;
                }

                gameState.players[role].connected = true;
                socket.role = role;
                socket.emit('roleAssigned', role);
            }
            
            io.emit('gameState', getSerializableGameState());
        } catch (error) {
            socket.emit('error', error.message);
        }
    });

    socket.on('sendQubit', () => {
        if (gameState.phase !== 'alice_prepare') return;

        const alice = gameState.players.alice;
        gameState.qubit = new QuantumBit(alice.bit, false);
        
        if (alice.hadamard) {
            gameState.qubit.applyHadamard();
        }

        gameState.phase = 'eve_intercept';
        io.emit('gameState', getSerializableGameState());
    });

    socket.on('eveSkip', () => {
        if (gameState.phase !== 'eve_intercept') return;

        // Eve skips - just forward the qubit unchanged
        gameState.phase = 'bob_measure';
        io.emit('gameState', getSerializableGameState());
    });

    socket.on('eveMeasure', () => {
        if (gameState.phase !== 'eve_intercept') return;

        const eve = gameState.players.eve;
        
        if (eve.hadamard) {
            gameState.qubit.applyHadamard();
        }

        const result = gameState.qubit.measure();
        eve.measured = result;

        gameState.qubit = new QuantumBit(result, false);
        
        if (eve.hadamard) {
            gameState.qubit.applyHadamard();
        }

        gameState.phase = 'bob_measure';
        io.emit('gameState', getSerializableGameState());
    });

    socket.on('bobMeasure', () => {
        if (gameState.phase !== 'bob_measure') return;

        const bob = gameState.players.bob;
        
        if (bob.hadamard) {
            gameState.qubit.applyHadamard();
        }

        const result = gameState.qubit.measure();
        bob.measured = result;

        gameState.phase = 'complete';
        io.emit('gameState', getSerializableGameState());

        setTimeout(() => {
            nextRound();
        }, 3000);
    });

    socket.on('updatePlayer', (data) => {
        if (gameState.players[data.role]) {
            Object.assign(gameState.players[data.role], data.data);
            io.emit('gameState', getSerializableGameState());
        }
    });

    socket.on('resetGame', () => {
        gameState.reset();
        io.emit('gameState', getSerializableGameState());
    });

    socket.on('nextRound', () => {
        nextRound();
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.role && gameState.players[socket.role]) {
            gameState.players[socket.role].connected = false;
            io.emit('gameState', getSerializableGameState());
        }
    });
});

function nextRound() {
    gameState.round++;
    gameState.phase = 'alice_prepare';
    gameState.qubit = null;
    gameState.players.alice.hadamard = false;
    gameState.players.eve.hadamard = false;
    gameState.players.eve.measured = null;
    gameState.players.bob.hadamard = false;
    gameState.players.bob.measured = null;
    io.emit('gameState', getSerializableGameState());
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});