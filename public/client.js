// Socket.IO connection
const socket = io();
let currentRole = null;
let gameState = {
    phase: 'alice_prepare',
    qubit: null,
    players: {
        alice: { connected: false, bit: 0, hadamard: false },
        eve: { connected: false, hadamard: false, measured: null },
        bob: { connected: false, hadamard: false, measured: null }
    },
    round: 1
};

// DOM elements
const app = document.getElementById('app');

// Initialize the application
function init() {
    showLoginScreen();
}

function showLoginScreen() {
    app.innerHTML = `
        <div class="logo"></div>
        <div class="container">
            <div class="login-screen">
                <h1 style="font-size: 2em; margin-bottom: 20px;">BB84 QKD Game</h1>
                <p style="margin-bottom: 30px;">Escolhe um papel para a experiência BB84</p>
                <div class="role-buttons">
                    <button class="role-button" onclick="joinGame('alice')">Alice</button>
                    <button class="role-button" onclick="joinGame('eve')">Eve</button>
                    <button class="role-button" onclick="joinGame('bob')">Bob</button>
                    <button class="role-button" onclick="joinGame('admin')">Painel de admin</button>
                </div>
            </div>
        </div>
    `;
}

function joinGame(role) {
    currentRole = role;
    socket.emit('join', role);
}

function showAliceInterface() {
    const isActive = gameState.phase === 'alice_prepare';
    const status = getStatusText();
    
    app.innerHTML = `
        <div class="logo"></div>
        <div class="container">
            <div class="header">
                <div class="role">Alice</div>
                <div class="status">${status}</div>
                <div class="qubit-state">Ronda ${gameState.round}</div>
            </div>
            
            ${isActive ? `
                <div class="game-area">
                    <div class="bit-selector" onclick="toggleBit()">
                        <div class="bit-value">${gameState.players.alice.bit}</div>
                    </div>
                    
                    <button class="h-gate-button ${gameState.players.alice.hadamard ? 'active' : ''}" onclick="toggleHadamard()">
                        ${gameState.players.alice.hadamard ? 'H aplicado' : 'Aplicar H'}
                    </button>
                    
                    <button class="action-button" onclick="sendQubit()">Enviar Qubit</button>
                </div>
            ` : `
                <div class="waiting">
                    ${gameState.phase === 'eve_intercept' ? 'Em trânsito...' : 
                      gameState.phase === 'bob_measure' ? 'Em trânsito...' : 'Bob mediu'}
                </div>
            `}
        </div>
    `;
}

function showEveInterface() {
    const isActive = gameState.phase === 'eve_intercept';
    const status = getStatusText();
    
    app.innerHTML = `
        <div class="logo"></div>
        <div class="container">
            <div class="header">
                <div class="role">Eve</div>
                <div class="status">${status}</div>
                <div class="qubit-state">Ronda ${gameState.round}</div>
            </div>
            
            ${isActive ? `
                <div class="game-area">
                    <button class="h-gate-button ${gameState.players.eve.hadamard ? 'active' : ''}" onclick="toggleEveHadamard()">
                        ${gameState.players.eve.hadamard ? 'H aplicado' : 'Aplicar H'}
                    </button>
                    
                    <div style="display: flex; gap: 10px;">
                        <button class="action-button" style="flex: 1; background: #4CAF50;" onclick="eveSkip()">Passar</button>
                        <button class="action-button" style="flex: 1;" onclick="eveMeasure()">Medir & Reencaminhar</button>
                    </div>
                </div>
            ` : gameState.players.eve.measured !== null ? `
                <div class="result-display">
                    <div class="result-bit">${gameState.players.eve.measured}</div>
                    <div>Resultado da medição da Eve</div>
                </div>
                <div class="waiting">Aguardando pelo Bob...</div>
            ` : `
                <div class="waiting">
                    ${gameState.phase === 'alice_prepare' ? 'Aguardando...' : 
                      gameState.phase === 'bob_measure' ? 'Enviado' : 'Aguardando...'}
                </div>
            `}
        </div>
    `;
}

function showBobInterface() {
    const isActive = gameState.phase === 'bob_measure';
    const status = getStatusText();
    
    app.innerHTML = `
        <div class="logo"></div>
        <div class="container">
            <div class="header">
                <div class="role">Bob</div>
                <div class="status">${status}</div>
                <div class="qubit-state">Ronda ${gameState.round}</div>
            </div>
            
            ${isActive ? `
                <div class="game-area">
                    <button class="h-gate-button ${gameState.players.bob.hadamard ? 'active' : ''}" onclick="toggleBobHadamard()">
                        ${gameState.players.bob.hadamard ? 'H aplicado' : 'Aplicar H'}
                    </button>
                    
                    <button class="action-button" onclick="bobMeasure()">Measure</button>
                </div>
            ` : gameState.players.bob.measured !== null ? `
                <div class="result-display">
                    <div class="result-bit">${gameState.players.bob.measured}</div>
                    <div>Resultado da medida do Bob</div>
                </div>
                <div class="waiting">Ronda completa! Aguardando a próxima...</div>
            ` : `
                <div class="waiting">
                    ${gameState.phase === 'alice_prepare' ? 'Aguardando...' : 
                      gameState.phase === 'eve_intercept' ? 'Aguardando...' : 'Aguardando...'}
                </div>
            `}
        </div>
    `;
}

function showAdminInterface() {
    app.innerHTML = `
        <div class="logo"></div>
        <div class="admin-container">
            <div class="header">
                <div class="role" style="font-size: 2em;">Admin Panel</div>
                <div class="status">Controlo da experiência BB84 QKD</div>
            </div>
            
            <div class="admin-panel">
                <div class="admin-controls">
                    <button class="admin-button reset" onclick="resetGame()">Reiniciar jogo</button>
                    <button class="admin-button" onclick="nextRound()">Próxima ronda</button>
                </div>
                
                <div class="game-state">
                    <div class="player-state">
                        <div class="player-name">Alice</div>
                        <div class="state-info">Connected: ${gameState.players.alice.connected ? '✓' : '✗'}</div>
                        <div class="state-info">Bit: ${gameState.players.alice.bit}</div>
                        <div class="state-info">H Gate: ${gameState.players.alice.hadamard ? '✓' : '✗'}</div>
                    </div>
                    
                    <div class="player-state">
                        <div class="player-name">Eve</div>
                        <div class="state-info">Connected: ${gameState.players.eve.connected ? '✓' : '✗'}</div>
                        <div class="state-info">H Gate: ${gameState.players.eve.hadamard ? '✓' : '✗'}</div>
                        <div class="state-info">Measured: ${gameState.players.eve.measured !== null ? gameState.players.eve.measured : '-'}</div>
                    </div>
                    
                    <div class="player-state">
                        <div class="player-name">Bob</div>
                        <div class="state-info">Connected: ${gameState.players.bob.connected ? '✓' : '✗'}</div>
                        <div class="state-info">H Gate: ${gameState.players.bob.hadamard ? '✓' : '✗'}</div>
                        <div class="state-info">Measured: ${gameState.players.bob.measured !== null ? gameState.players.bob.measured : '-'}</div>
                    </div>
                </div>
                
                <div class="admin-panel" style="margin-top: 20px;">
                    <div class="player-name">Estado do jogo</div>
                    <div class="state-info">Fase: ${gameState.phase}</div>
                    <div class="state-info">Ronda: ${gameState.round}</div>
                    <div class="state-info">Estado do qubit: ${gameState.qubit ? gameState.qubit.getState : 'None'}</div>
                </div>
            </div>
        </div>
    `;
}

function getStatusText() {
    switch (gameState.phase) {
        case 'alice_prepare': return 'Qubit pronto';
        case 'eve_intercept': return 'Qubit em trânsito';
        case 'bob_measure': return 'Qubit Recebido';
        case 'complete': return 'Ronda completa';
        default: return 'Aguardando...';
    }
}

// Player actions
function toggleBit() {
    if (gameState.phase === 'alice_prepare') {
        gameState.players.alice.bit = gameState.players.alice.bit === 0 ? 1 : 0;
        socket.emit('updatePlayer', { role: 'alice', data: gameState.players.alice });
    }
}

function toggleHadamard() {
    if (gameState.phase === 'alice_prepare') {
        gameState.players.alice.hadamard = !gameState.players.alice.hadamard;
        socket.emit('updatePlayer', { role: 'alice', data: gameState.players.alice });
    }
}

function sendQubit() {
    if (gameState.phase === 'alice_prepare') {
        socket.emit('sendQubit');
    }
}

function toggleEveHadamard() {
    if (gameState.phase === 'eve_intercept') {
        gameState.players.eve.hadamard = !gameState.players.eve.hadamard;
        socket.emit('updatePlayer', { role: 'eve', data: gameState.players.eve });
    }
}

function eveSkip() {
    if (gameState.phase === 'eve_intercept') {
        socket.emit('eveSkip');
    }
}

function eveMeasure() {
    if (gameState.phase === 'eve_intercept') {
        socket.emit('eveMeasure');
    }
}

function toggleBobHadamard() {
    if (gameState.phase === 'bob_measure') {
        gameState.players.bob.hadamard = !gameState.players.bob.hadamard;
        socket.emit('updatePlayer', { role: 'bob', data: gameState.players.bob });
    }
}

function bobMeasure() {
    if (gameState.phase === 'bob_measure') {
        socket.emit('bobMeasure');
    }
}

// Admin actions
function resetGame() {
    socket.emit('resetGame');
}

function nextRound() {
    socket.emit('nextRound');
}

// Socket event handlers
socket.on('gameState', (state) => {
    gameState = state;
    updateInterface();
});

socket.on('roleAssigned', (role) => {
    currentRole = role;
    updateInterface();
});

socket.on('error', (message) => {
    alert(message);
});

function updateInterface() {
    if (!currentRole) return;
    
    switch (currentRole) {
        case 'alice':
            showAliceInterface();
            break;
        case 'eve':
            showEveInterface();
            break;
        case 'bob':
            showBobInterface();
            break;
        case 'admin':
            showAdminInterface();
            break;
    }
}

// Initialize the app
init();