// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const viewport = document.getElementById("viewport");
const mapContainer = document.getElementById("map-container");

const nameInput = document.getElementById('name-input');
nameInput.value = "Player_" + Math.floor(Math.random() * 900 + 100);
const imageInput = document.getElementById('image-input');

const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
const fallbackColor = '#' + Math.floor(Math.random()*16777215).toString(16);

let myData = {
    x: 400,
    y: 220,
    color: fallbackColor,
    name: nameInput.value,
    avatarUrl: "",
    room: "room_forest", 
    width: 32,
    height: 32,
    // Agadir, Morocco coordinates
    lat: 30.4278,
    lng: -9.5981
};

let allPlayers = {};
const loadedImages = {};

const rooms = {
    "room_forest": { name: "🌳 Forest Clearing", bg: "#1e3f20" },
    "room_dungeon": { name: "🧱 Stone Dungeon", bg: "#2c3e50" },
    "room_python": { name: "🐍 Python Coding Lab", bg: "#2c1654" },
    "room_portal": { name: "🌀 World Map Portal Hub", bg: "#0f2027" }
};

// --- SATELLITE MAP & LOBBY-STYLE CUBE MARKER SETUP ---
let leafletMap = null;
let leafletMarker = null;

function initLeafletMap() {
    if (!leafletMap) {
        leafletMap = L.map('map-container', { zoomControl: false }).setView([myData.lat, myData.lng], 16);
        
        // Esri World Imagery Satellite Tile Layer
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(leafletMap);

        createOrUpdateMarker();
    } else {
        leafletMap.setView([myData.lat, myData.lng], 16);
        createOrUpdateMarker();
    }
}

function createOrUpdateMarker() {
    let name = nameInput.value.trim() || "Player";
    let avatarUrl = imageInput.value.trim();
    let color = myData.color || "#888";

    // Create a mini canvas element to dynamically render the exact same lobby cube + name tag
    let iconCanvas = document.createElement('canvas');
    iconCanvas.width = 100;
    iconCanvas.height = 60;
    let iconCtx = iconCanvas.getContext('2d');

    // Draw Name Tag on top
    iconCtx.fillStyle = "#fff";
    iconCtx.font = "bold 11px sans-serif";
    iconCtx.textAlign = "center";
    iconCtx.fillText(name, 50, 12);

    let cubeX = 34;
    let cubeY = 18;
    let cubeSize = 32;

    // Draw Lobby Cube (Image or Color)
    if (avatarUrl && avatarUrl.startsWith('http')) {
        if (!loadedImages[avatarUrl]) {
            let img = new Image();
            img.crossOrigin = "anonymous";
            img.src = avatarUrl;
            loadedImages[avatarUrl] = img;
        }
        let imgObj = loadedImages[avatarUrl];
        if (imgObj.complete && imgObj.naturalWidth !== 0) {
            iconCtx.drawImage(imgObj, cubeX, cubeY, cubeSize, cubeSize);
        } else {
            iconCtx.fillStyle = color;
            iconCtx.fillRect(cubeX, cubeY, cubeSize, cubeSize);
        }
    } else {
        iconCtx.fillStyle = color;
        iconCtx.fillRect(cubeX, cubeY, cubeSize, cubeSize);
    }

    let customIcon = L.divIcon({
        className: 'lobby-cube-icon',
        html: iconCanvas,
        iconSize: [100, 60],
        iconAnchor: [50, 34] // centers the cube right on the GPS coordinate
    });

    if (!leafletMarker) {
        leafletMarker = L.marker([myData.lat, myData.lng], { icon: customIcon }).addTo(leafletMap);
    } else {
        leafletMarker.setLatLng([myData.lat, myData.lng]);
        leafletMarker.setIcon(customIcon);
    }
}
// ---------------------------------------------------

function checkRoomTransition() {
    let changed = false;
    if (myData.x > canvas.width - myData.width) {
        if (myData.room === "room_forest") { myData.room = "room_dungeon"; myData.x = 10; changed = true; }
        else if (myData.room === "room_dungeon") { myData.room = "room_python"; myData.x = 10; changed = true; }
        else if (myData.room === "room_python") { myData.room = "room_portal"; myData.x = 10; changed = true; }
        else { myData.x = canvas.width - myData.width; }
    }
    else if (myData.x < 0) {
        if (myData.room === "room_portal") { myData.room = "room_python"; myData.x = canvas.width - 40; changed = true; }
        else if (myData.room === "room_python") { myData.room = "room_dungeon"; myData.x = canvas.width - 40; changed = true; }
        else if (myData.room === "room_dungeon") { myData.room = "room_forest"; myData.x = canvas.width - 40; changed = true; }
        else { myData.x = 0; }
    }
    else if (myData.y > canvas.height - myData.height) { myData.y = canvas.height - myData.height; }
    else if (myData.y < 0) { myData.y = 0; }
    return changed;
}

// Python Interpreter
let pythonOutputLines = [
    "> Python 3.11.4 Environment Initialized",
    "> Type python commands below (e.g., print('Hello'))"
];

function evaluatePythonCode(code) {
    code = code.trim();
    let result = "";
    try {
        if (code.startsWith("print(") && code.endsWith(")")) {
            let inner = code.substring(6, code.length - 1).trim();
            if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
                result = inner.substring(1, inner.length - 1);
            } else { result = eval(inner); }
        } else if (code.includes("=") && !code.includes("==")) {
            result = "Assigned: " + code;
        } else { result = eval(code); }
    } catch(err) { result = "SyntaxError: invalid syntax"; }

    pythonOutputLines.push(">>> " + code);
    pythonOutputLines.push(String(result));
    if (pythonOutputLines.length > 8) { pythonOutputLines.shift(); pythonOutputLines.shift(); }
}

const keys = {};
window.addEventListener("keydown", (e) => {
    // If in Satellite Map view, pan around Agadir using WASD or arrow keys!
    if (myData.room === "room_portal_active") {
        let step = 0.0008;
        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') myData.lat += step;
        if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') myData.lat -= step;
        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') myData.lng -= step;
        if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') myData.lng += step;
        
        if (leafletMap) {
            leafletMap.setView([myData.lat, myData.lng]);
            createOrUpdateMarker();
        }
        return;
    }

    if (document.activeElement.tagName === 'INPUT') return;
    let key = e.key.toLowerCase();
    if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keys[key] = true;
    }
});
window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
});

// Chat & Python Commands
const chatMessagesEl = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatRef = ref(db, 'chats');

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let text = chatInput.value.trim();
    if (text === '') return;

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

function update() {
    if (myData.room === "room_portal_active") return;

    let speed = 4;
    let moved = false;

    if (keys['w'] || keys['arrowup']) { myData.y -= speed; moved = true; }
    if (keys['s'] || keys['arrowdown']) { myData.y += speed; moved = true; }
    if (keys['a'] || keys['arrowleft']) { myData.x -= speed; moved = true; }
    if (keys['d'] || keys['arrowright']) { myData.x += speed; moved = true; }

    let roomChanged = checkRoomTransition();

    // Portal activation check in Portal Hub room
    if (myData.room === "room_portal" && myData.x > 350 && myData.x < 450 && myData.y > 180 && myData.y < 260) {
        myData.room = "room_portal_active";
        canvas.style.display = "none";
        mapContainer.style.display = "block";
        initLeafletMap();
    }

    myData.name = nameInput.value.trim() || "Player";
    myData.avatarUrl = imageInput.value.trim();

    if (moved || roomChanged || document.activeElement === nameInput || document.activeElement === imageInput) {
        set(myPlayerRef, myData);
    }
}

function draw() {
    if (myData.room === "room_portal_active") return;

    let currentRoomInfo = rooms[myData.room] || rooms["room_forest"];
    viewport.style.background = currentRoomInfo.bg;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(10, 10, 240, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(currentRoomInfo.name, 20, 30);

    if (myData.room === "room_python") {
        ctx.fillStyle = "#111";
        ctx.fillRect(180, 50, 440, 220);
        ctx.strokeStyle = "#8e44ad";
        ctx.lineWidth = 3;
        ctx.strokeRect(180, 50, 440, 220);
        ctx.fillStyle = "#8e44ad";
        ctx.fillRect(180, 50, 440, 25);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px monospace";
        ctx.fillText("🐍 python3 terminal_lab.py", 190, 67);

        ctx.font = "12px monospace";
        ctx.fillStyle = "#2ecc71";
        let startY = 95;
        for (let line of pythonOutputLines) {
            ctx.fillText(line, 195, startY);
            startY += 20;
        }
    }

    if (myData.room === "room_portal") {
        ctx.fillStyle = "#00ffff";
        ctx.beginPath();
        ctx.arc(400, 220, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ENTER SATELLITE", 400, 224);
    }

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
