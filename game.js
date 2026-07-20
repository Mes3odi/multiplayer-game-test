// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Canvas & UI Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const viewport = document.getElementById("viewport");

const nameInput = document.getElementById('name-input');
nameInput.value = "Player_" + Math.floor(Math.random() * 900 + 100);
const imageInput = document.getElementById('image-input');

// Unique ID for this browser session
const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
const fallbackColor = '#' + Math.floor(Math.random()*16777215).toString(16);

let myData = {
    x: 400,
    y: 220,
    color: fallbackColor,
    name: nameInput.value,
    avatarUrl: "",
    room: "room_forest", // Zelda-style starting room
    width: 32,
    height: 32
};

let allPlayers = {};
const loadedImages = {};

// Room Theme Backgrounds & Names
const rooms = {
    "room_forest": { name: "🌳 Forest Clearing", bg: "#1e3f20" },
    "room_dungeon": { name: "🧱 Stone Dungeon", bg: "#2c3e50" },
    "room_python": { name: "🐍 Python Coding Lab", bg: "#2c1654" }
};

// --- ZELDA ROOM TRANSITION LOGIC ---
function checkRoomTransition() {
    let changed = false;

    // Hit Right Edge
    if (myData.x > canvas.width - myData.width) {
        if (myData.room === "room_forest") { myData.room = "room_dungeon"; myData.x = 10; changed = true; }
        else if (myData.room === "room_dungeon") { myData.room = "room_python"; myData.x = 10; changed = true; }
        else { myData.x = canvas.width - myData.width; }
    }
    // Hit Left Edge
    else if (myData.x < 0) {
        if (myData.room === "room_python") { myData.room = "room_dungeon"; myData.x = canvas.width - 40; changed = true; }
        else if (myData.room === "room_dungeon") { myData.room = "room_forest"; myData.x = canvas.width - 40; changed = true; }
        else { myData.x = 0; }
    }
    // Hit Bottom Edge
    else if (myData.y > canvas.height - myData.height) {
        myData.y = canvas.height - myData.height;
    }
    // Hit Top Edge
    else if (myData.y < 0) {
        myData.y = 0;
    }

    return changed;
}
// -----------------------------------

// --- SIMPLE PYTHON INTERPRETER LOGIC ---
let pythonOutputLines = [
    "> Python 3.11.4 Environment Initialized",
    "> Type python commands below (e.g., print('Hello'))"
];

function evaluatePythonCode(code) {
    code = code.trim();
    let result = "";

    try {
        // Handle print statement: print("...") or print(5 + 5)
        if (code.startsWith("print(") && code.endsWith(")")) {
            let inner = code.substring(6, code.length - 1).trim();
            // Evaluate inner math or string literals safely
            if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
                result = inner.substring(1, inner.length - 1);
            } else {
                result = eval(inner); // Simple arithmetic evaluation
            }
        } 
        // Handle basic variables: x = 10
        else if (code.includes("=") && !code.includes("==")) {
            result = "Assigned: " + code;
        }
        // Handle simple if-else simulation or expressions
        else if (code.startsWith("if ") || code.includes("==")) {
            let evaluated = eval(code.replace(":", "").replace("if ", ""));
            result = "Condition result: " + evaluated;
        } 
        // Fallback arithmetic evaluation
        else {
            result = eval(code);
        }
    } catch(err) {
        result = "SyntaxError: invalid syntax";
    }

    pythonOutputLines.push(">>> " + code);
    pythonOutputLines.push(String(result));

    // Keep only the last 8 lines on the blackboard
    if (pythonOutputLines.length > 8) {
        pythonOutputLines.shift();
        pythonOutputLines.shift();
    }
}
// ---------------------------------------

// Keyboard tracking with input block guard
const keys = {};
window.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    let key = e.key.toLowerCase();
    if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keys[key] = true;
    }
});
window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Database references
const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
});

// --- CHAT & PYTHON COMMAND SYNC SYSTEM ---
const chatMessagesEl = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatRef = ref(db, 'chats');

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let text = chatInput.value.trim();
    if (text === '') return;

    // Check if message is python code
    if (text.startsWith("print(") || text.includes("=") || text.startsWith("if ") || text.match(/^\d+[\+\-\*\/]\d+$/)) {
        evaluatePythonCode(text);
    }

    push(chatRef, {
        name: nameInput.value.trim() || "Player",
        text: text,
        timestamp: Date.now()
    });

    chatInput.value = '';
});

onValue(chatRef, (snapshot) => {
    let chats = snapshot.val() || {};
    chatMessagesEl.innerHTML = '';
    for (let id in chats) {
        let msg = chats[id];
        let msgDiv = document.createElement('div');
        msgDiv.innerHTML = `<b>${msg.name}:</b> ${msg.text}`;
        chatMessagesEl.appendChild(msgDiv);
    }
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
});
// -----------------------------------------

// Game loop update
function update() {
    let speed = 4;
    let moved = false;

    if (keys['w'] || keys['arrowup']) { myData.y -= speed; moved = true; }
    if (keys['s'] || keys['arrowdown']) { myData.y += speed; moved = true; }
    if (keys['a'] || keys['arrowleft']) { myData.x -= speed; moved = true; }
    if (keys['d'] || keys['arrowright']) { myData.x += speed; moved = true; }

    let roomChanged = checkRoomTransition();

    myData.name = nameInput.value.trim() || "Player";
    myData.avatarUrl = imageInput.value.trim();

    if (moved || roomChanged || document.activeElement === nameInput || document.activeElement === imageInput) {
        set(myPlayerRef, myData);
    }
}

// Draw graphics based on active room
function draw() {
    let currentRoomInfo = rooms[myData.room] || rooms["room_forest"];
    viewport.style.background = currentRoomInfo.bg;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Room Name Header on Canvas
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(10, 10, 210, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(currentRoomInfo.name, 20, 30);

    // If inside the Python Coding Lab room, draw the big code terminal board!
    if (myData.room === "room_python") {
        ctx.fillStyle = "#111";
        ctx.fillRect(180, 50, 440, 220);
        ctx.strokeStyle = "#8e44ad";
        ctx.lineWidth = 3;
        ctx.strokeRect(180, 50, 440, 220);

        // Terminal Header
        ctx.fillStyle = "#8e44ad";
        ctx.fillRect(180, 50, 440, 25);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px monospace";
        ctx.fillText("🐍 python3 terminal_lab.py", 190, 67);

        // Terminal Output Lines
        ctx.font = "12px monospace";
        ctx.fillStyle = "#2ecc71";
        let startY = 95;
        for (let line of pythonOutputLines) {
            ctx.fillText(line, 195, startY);
            startY += 20;
        }
    }

    // Draw all players who are in the SAME Zelda room
    for (let id in allPlayers) {
        let p = allPlayers[id];
        if (p.room !== myData.room) continue;

        let pName = p.name || "Player";
        let pWidth = p.width || 32;
        let pHeight = p.height || 32;

        if (p.avatarUrl && p.avatarUrl.startsWith('http')) {
            if (!loadedImages[p.avatarUrl]) {
                let img = new Image();
                img.src = p.avatarUrl;
                loadedImages[p.avatarUrl] = img;
            }

            let imgObj = loadedImages[p.avatarUrl];
            if (imgObj.complete && imgObj.naturalWidth !== 0) {
                ctx.drawImage(imgObj, p.x, p.y, pWidth, pHeight);
            } else {
                ctx.fillStyle = p.color || "#888";
                ctx.fillRect(p.x, p.y, pWidth, pHeight);
            }
        } else {
            ctx.fillStyle = p.color || "#888";
            ctx.fillRect(p.x, p.y, pWidth, pHeight);
        }

        ctx.fillStyle = "#fff";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(pName, p.x + pWidth / 2, p.y - 6);
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
