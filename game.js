// Import Firebase from the official web cloud delivery network
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCBn-G8DOt82PIVs-j7sdYin3zFv_Z08Uk",
    authDomain: "multiplayer-game-test-e72b8.firebaseapp.com",
    databaseURL: "https://multiplayer-game-test-e72b8-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "multiplayer-game-test-e72b8",
    storageBucket: "multiplayer-game-test-e72b8.firebasestorage.app",
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
const playerColor = '#' + Math.floor(Math.random()*16777215).toString(16);

let myData = {
    x: Math.random() * (canvas.width - 40),
    y: Math.random() * (canvas.height - 40),
    color: playerColor
};

let allPlayers = {};

// Keyboard tracking
const keys = {};
window.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

// Database reference for this player
const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

// Listen to all players in real-time
const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
});

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
        
        if (id === playerId) {
            ctx.fillStyle = "#fff";
            ctx.font = "12px sans-serif";
            ctx.fillText("You", p.x + 5, p.y - 8);
        }
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
