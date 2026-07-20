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

// Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Unique ID for this browser tab
const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
const fallbackColor = '#' + Math.floor(Math.random()*16777215).toString(16);

// UI Elements
const nameInput = document.getElementById('name-input');
nameInput.value = "Player_" + Math.floor(Math.random() * 900 + 100);

const imageInput = document.getElementById('image-input');

let myData = {
    x: Math.random() * (canvas.width - 40),
    y: Math.random() * (canvas.height - 40),
    color: fallbackColor,
    name: nameInput.value,
    avatarUrl: "",
    width: 32,
    height: 32
};

let allPlayers = {};
const loadedImages = {}; // Cache for player character images

// Keyboard tracking
const keys = {};
window.addEventListener("keydown", (e) => {
    // Don't move character if typing in name or chat boxes
    if (document.activeElement.tagName === 'INPUT') return;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

// Database references
const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
});

// --- CHAT SYSTEM LOGIC ---
const chatMessagesEl = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatRef = ref(db, 'chats');

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text === '') return;

    push(chatRef, {
        name: nameInput.value.trim() || "Player",
        text: text,
        timestamp: Date.now()
    });

    chatInput.value = '';
});

onValue(chatRef, (snapshot) => {
    const chats = snapshot.val() || {};
    chatMessagesEl.innerHTML = '';
    for (let id in chats) {
        let msg = chats[id];
        let msgDiv = document.createElement('div');
        msgDiv.innerHTML = `<b>${msg.name}:</b> ${msg.text}`;
        chatMessagesEl.appendChild(msgDiv);
    }
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
    myData.x = Math.max(0, Math.min(canvas.width - myData.width, myData.x));
    myData.y = Math.max(0, Math.min(canvas.height - myData.height, myData.y));

    // Update custom name & avatar link from input fields live
    myData.name = nameInput.value.trim() || "Player";
    myData.avatarUrl = imageInput.value.trim();

    if (moved || nameInput === document.activeElement || imageInput === document.activeElement) {
        set(myPlayerRef, myData);
    }
}

// Draw graphics & character pictures
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let id in allPlayers) {
        let p = allPlayers[id];
        let pName = p.name || "Player";
        let pWidth = p.width || 32;
        let pHeight = p.height || 32;

        // Check if player provided a valid image URL
        if (p.avatarUrl && p.avatarUrl.startsWith('http')) {
            // Load and cache the image
            if (!loadedImages[p.avatarUrl]) {
                let img = new Image();
                img.src = p.avatarUrl;
                loadedImages[p.avatarUrl] = img;
            }

            let imgObj = loadedImages[p.avatarUrl];
            if (imgObj.complete && imgObj.naturalWidth !== 0) {
                // Draw custom character image
                ctx.drawImage(imgObj, p.x, p.y, pWidth, pHeight);
            } else {
                // Fallback box while image loads
                ctx.fillStyle = p.color || "#888";
                ctx.fillRect(p.x, p.y, pWidth, pHeight);
            }
        } else {
            // Default colored square if no image link is provided
            ctx.fillStyle = p.color || "#888";
            ctx.fillRect(p.x, p.y, pWidth, pHeight);
        }

        // Draw player name above the character
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
