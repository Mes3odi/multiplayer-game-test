// Import Firebase from the official web cloud delivery network
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect, limitToLast, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCBn-G8DOt82PIVs-j7sdYin3zFv_Z08Uk",
    authDomain: "multiplayer-game-test-e72b8.firebaseapp.com",
    databaseURL: "https://multiplayer-game-test-e72b8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "multiplayer-game-test-e72b8",
    storageBucket: "multiplayer-game-test-e72b8.appspot.com",
    messagingSenderId: "17838862618",
    appId: "1:17838862618:web:385700614b276d764c3ca3",
    measurementId: "G-MXZMBNWZ8B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Generate unique ID and random color for this player
const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
const playerName = 'Player_' + Math.floor(Math.random() * 900 + 100);
const playerColor = '#' + Math.floor(Math.random()*16777215).toString(16);

let myData = {
    x: Math.random() * (canvas.width - 40),
    y: Math.random() * (canvas.height - 40),
    color: playerColor,
    name: playerName
};

let allPlayers = {};

// Keyboard tracking
const keys = {};
window.addEventListener("keydown", (e) => {
    // Prevent typing keys from moving the character if focused on chat
    if (document.activeElement.id === 'chat-input') return;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

// Database references
const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

// Listen to all players in real-time
const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
});

// --- CHAT SYSTEM LOGIC ---
const chatMessagesEl = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatRef = ref(db, 'chats');

// Send message to Firebase forever when user submits form
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text === '') return;

    // push() generates a unique permanent ID for each message so they stack up forever
    push(chatRef, {
        name: playerName,
        text: text,
        timestamp: Date.now()
    });

    chatInput.value = '';
});

// Listen to chat messages from Firebase in real-time
onValue(chatRef, (snapshot) => {
    const chats = snapshot.val() || {};
    chatMessagesEl.innerHTML = ''; // Clear box and redraw all permanent entries

    // Loop through historical messages saved in database
    for (let id in chats) {
        let msg = chats[id];
        let msgDiv = document.createElement('div');
        msgDiv.innerHTML = `<b>${msg.name}:</b> ${msg.text}`;
        chatMessagesEl.appendChild(msgDiv);
    }

    // Auto-scroll chat box to the absolute bottom
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
});
// -------------------------

// Game loop update
function update() {
    let speed = 4;
    let moved = false;

    if (keys['w'] || keys['arrowup']) { myData.y -= speed; moved = true; }
    if (keys['s'] || keys['arrowdown']) { myData.y += speed; moved = true; }
    if (keys['a'] || keys['arrowleft']) { myData.x -= speed; moved = true; }
    if (keys['d'] || keys['arrowright']) { myData.x += speed; moved = true; }

    // Screen bounds
    myData.x = Math.max(0, Math.min(canvas.width - 30, myData.x));
    myData.y = Math.max(0, Math.min(canvas.height - 30, myData.y));

    if (moved) {
        set(myPlayerRef, myData);
    }
}

// Draw graphics
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let id in allPlayers) {
        let p = allPlayers[id];
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 30, 30);
        
        // Draw player name above box
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.fillText(p.name || "Player", p.x, p.y - 6);
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
