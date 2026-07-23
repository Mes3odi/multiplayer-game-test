// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const p5Canvas = document.getElementById("p5-transition-canvas");
const p5Ctx = p5Canvas.getContext("2d");
const viewport = document.getElementById("viewport");
const mapContainer = document.getElementById("map-container");
const setupOverlay = document.getElementById("setup-overlay");
const joinBtn = document.getElementById("join-btn");
const setupName = document.getElementById("setup-name");
const setupImage = document.getElementById("setup-image");
const setupDevice = document.getElementById("setup-device");
const displayPlayerInfo = document.getElementById("display-player-info");
const mobileControls = document.getElementById("mobile-controls");
const mapUiOverlay = document.getElementById("map-ui-overlay");
const onlinePlayersListEl = document.getElementById("online-players-list");
const onlineCountEl = document.getElementById("online-count");
const p5Overlay = document.getElementById("p5-overlay");

setupName.value = "Player_" + Math.floor(Math.random() * 900 + 100);

const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
const fallbackColor = '#' + Math.floor(Math.random()*16777215).toString(16);

const SPAWN_LAT = 30.4278;
const SPAWN_LNG = -9.5981;

let myData = {
    x: 400,
    y: 220,
    color: fallbackColor,
    name: "Player",
    avatarUrl: "",
    room: "room_forest", 
    width: 32,
    height: 32,
    lat: SPAWN_LAT,
    lng: SPAWN_LNG
};

let isMobile = false;
let allPlayers = {};
let loadedImages = {};
let leafletMap = null;
let leafletMarkers = {};
let drawingPolylines = {};
let currentTool = "move";
let currentLinePoints = [];
let activeDialogue = null;
let isTransitioning = false; // Persona 5 transition flag

const npcs = {
    "room_dungeon": [
        {
            name: "Botato",
            x: 350,
            y: 180,
            width: 40,
            height: 40,
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTk5iSgpPztUgs3JHZ14RcyIsrFsAEkPuygXVd5Z8MmIA&s=10",
            dialogue: "botato talk"
        }
    ]
};

const rooms = {
    "room_forest": { name: "🌳 Forest Clearing", bg: "#1e3f20" },
    "room_dungeon": { name: "🧱 Stone Dungeon", bg: "#2c3e50" },
    "room_python": { name: "🐍 Python Coding Lab", bg: "#2c1654" },
    "room_portal": { name: "🌀 World Map Portal Hub", bg: "#0f2027" }
};

// --- PERSONA 5 TRANSITION ANIMATION ---
function playP5Transition(callback) {
    isTransitioning = true;
    p5Canvas.style.display = "block";
    let progress = 0;

    function animateCut() {
        progress += 0.08;
        p5Ctx.clearRect(0, 0, p5Canvas.width, p5Canvas.height);

        // Dynamic angular slash bars in P5 red & black style
        let slashWidth = p5Canvas.width * progress;
        
        p5Ctx.fillStyle = "#000000";
        p5Ctx.beginPath();
        p5Ctx.moveTo(0, 0);
        p5Ctx.lineTo(slashWidth, 0);
        p5Ctx.lineTo(slashWidth - 200, p5Canvas.height);
        p5Ctx.lineTo(0, p5Canvas.height);
        p5Ctx.fill();

        p5Ctx.fillStyle = "#e74c3c";
        p5Ctx.fillRect(slashWidth - 8, 0, 10, p5Canvas.height);

        if (progress < 1.6) {
            requestAnimationFrame(animateCut);
        } else {
            p5Canvas.style.display = "none";
            isTransitioning = false;
            if (callback) callback();
        }
    }
    animateCut();
}

// Menu Controls
document.getElementById('p5-menu-toggle').addEventListener('click', () => {
    p5Overlay.style.display = "flex";
});
document.getElementById('p5-resume').addEventListener('click', () => {
    p5Overlay.style.display = "none";
});
document.getElementById('p5-restart').addEventListener('click', () => {
    myData.x = 400;
    myData.y = 220;
    myData.room = "room_forest";
    p5Overlay.style.display = "none";
    set(myPlayerRef, myData);
});

joinBtn.addEventListener('click', () => {
    let nameVal = setupName.value.trim();
    if (nameVal) myData.name = nameVal;
    myData.avatarUrl = setupImage.value.trim();
    isMobile = (setupDevice.value === "mobile");

    displayPlayerInfo.innerText = myData.name;
    setupOverlay.style.display = "none";

    if (isMobile) {
        mobileControls.style.display = "flex";
    }

    set(ref(db, 'players/' + playerId), myData);
});

// --- SATELLITE MAP & PERMANENT DRAWING SETUP ---
function initLeafletMap() {
    if (!leafletMap) {
        leafletMap = L.map('map-container', {
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false
        }).setView([myData.lat, myData.lng], 18);
        
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        }).addTo(leafletMap);

        L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        }).addTo(leafletMap);

        leafletMap.on('click', (e) => {
            if (currentTool === "draw") {
                let newPoint = [e.latlng.lat, e.latlng.lng];
                currentLinePoints.push(newPoint);
                if (currentLinePoints.length >= 2) {
                    push(ref(db, 'drawings'), {
                        points: currentLinePoints,
                        color: myData.color
                    });
                    currentLinePoints = [];
                }
            }
        });
    } else {
        leafletMap.setView([myData.lat, myData.lng], 18);
    }
}

// Back to Rooms Button from Map
document.getElementById('map-back-btn').addEventListener('click', () => {
    playP5Transition(() => {
        myData.room = "room_portal";
        myData.x = 400;
        myData.y = 220;
        mapContainer.style.display = "none";
        mapUiOverlay.style.display = "none";
        canvas.style.display = "block";
        set(myPlayerRef, myData);
    });
});

document.getElementById('tool-move').addEventListener('click', () => {
    currentTool = "move";
    document.getElementById('tool-move').classList.add('active');
    document.getElementById('tool-draw').classList.remove('active');
});
document.getElementById('tool-draw').addEventListener('click', () => {
    currentTool = "draw";
    document.getElementById('tool-draw').classList.add('active');
    document.getElementById('tool-move').classList.remove('active');
});
document.getElementById('clear-drawings').addEventListener('click', () => {
    if (confirm("Clear all permanent map drawings?")) {
        remove(ref(db, 'drawings'));
    }
});

const drawingsRef = ref(db, 'drawings');
onValue(drawingsRef, (snapshot) => {
    let data = snapshot.val() || {};
    for (let id in drawingPolylines) {
        if (leafletMap) leafletMap.removeLayer(drawingPolylines[id]);
    }
    drawingPolylines = {};

    for (let id in data) {
        let lineData = data[id];
        if (lineData && lineData.points && leafletMap) {
            let polyline = L.polyline(lineData.points, { color: lineData.color || '#e74c3c', weight: 4 }).addTo(leafletMap);
            polyline.on('click', () => {
                if (confirm("Delete this drawing line?")) {
                    remove(ref(db, 'drawings/' + id));
                }
            });
            drawingPolylines[id] = polyline;
        }
    }
});

function updateAllMapMarkers() {
    if (!leafletMap) return;

    let onlineListHTML = "";
    let count = 0;

    for (let id in allPlayers) {
        let p = allPlayers[id];
        if (p.room !== "room_portal_active") {
            if (leafletMarkers[id]) {
                leafletMap.removeLayer(leafletMarkers[id]);
                delete leafletMarkers[id];
            }
            continue;
        }

        count++;
        onlineListHTML += `<div>🟢 ${p.name || "Player"}</div>`;

        let pName = p.name || "Player";
        let avatarUrl = p.avatarUrl || "";
        let color = p.color || "#888";

        let iconCanvas = document.createElement('canvas');
        iconCanvas.width = 60;
        iconCanvas.height = 40;
        let iconCtx = iconCanvas.getContext('2d');

        iconCtx.fillStyle = "#fff";
        iconCtx.font = "bold 9px sans-serif";
        iconCtx.textAlign = "center";
        iconCtx.fillText(pName, 30, 9);

        let cubeX = 22;
        let cubeY = 12;
        let cubeSize = 16;

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
            className: 'street-cube-icon',
            html: iconCanvas,
            iconSize: [60, 40],
            iconAnchor: [30, 20]
        });

        let pLat = p.lat || SPAWN_LAT;
        let pLng = p.lng || SPAWN_LNG;

        if (!leafletMarkers[id]) {
            leafletMarkers[id] = L.marker([pLat, pLng], { icon: customIcon }).addTo(leafletMap);
        } else {
            leafletMarkers[id].setLatLng([pLat, pLng]);
            leafletMarkers[id].setIcon(customIcon);
        }
    }

    onlineCountEl.innerText = count;
    onlinePlayersListEl.innerHTML = onlineListHTML;
}

function checkRoomTransition() {
    let nextRoom = null;
    let newX = myData.x;

    if (myData.x > canvas.width - myData.width) {
        if (myData.room === "room_forest") { nextRoom = "room_dungeon"; newX = 10; }
        else if (myData.room === "room_dungeon") { nextRoom = "room_python"; newX = 10; }
        else if (myData.room === "room_python") { nextRoom = "room_portal"; newX = 10; }
        else { myData.x = canvas.width - myData.width; }
    }
    else if (myData.x < 0) {
        if (myData.room === "room_portal") { nextRoom = "room_python"; newX = canvas.width - 40; }
        else if (myData.room === "room_python") { nextRoom = "room_dungeon"; newX = canvas.width - 40; }
        else if (myData.room === "room_dungeon") { nextRoom = "room_forest"; newX = canvas.width - 40; }
        else { myData.x = 0; }
    }

    if (nextRoom && !isTransitioning) {
        playP5Transition(() => {
            myData.room = nextRoom;
            myData.x = newX;
            set(myPlayerRef, myData);
        });
        return true;
    }

    if (myData.y > canvas.height - myData.height) { myData.y = canvas.height - myData.height; }
    else if (myData.y < 0) { myData.y = 0; }
    return false;
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
    if (document.activeElement.tagName === 'INPUT' || p5Overlay.style.display === "flex") return;
    let key = e.key.toLowerCase();

    if (key === 'e') {
        checkNPCInteraction();
        return;
    }

    if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) || e.key === 'Shift') {
        keys[e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift' ? 'shift' : key] = true;
    }
});
window.addEventListener("keyup", (e) => {
    let key = e.key.toLowerCase();
    if (key === 'shift' || e.key === 'Shift') {
        keys['shift'] = false;
    } else {
        keys[key] = false;
    }
});

function bindTouchButton(id, keyName) {
    let el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyName] = true; });
    el.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyName] = false; });
    el.addEventListener('mousedown', (e) => { keys[keyName] = true; });
    el.addEventListener('mouseup', (e) => { keys[keyName] = false; });
}

bindTouchButton('btn-up', 'w');
bindTouchButton('btn-left', 'a');
bindTouchButton('btn-down', 's');
bindTouchButton('btn-right', 'd');
bindTouchButton('btn-sprint', 'shift');

let interactBtn = document.getElementById('btn-interact');
if (interactBtn) {
    interactBtn.addEventListener('touchstart', (e) => { e.preventDefault(); checkNPCInteraction(); });
    interactBtn.addEventListener('mousedown', (e) => { checkNPCInteraction(); });
}

function checkNPCInteraction() {
    if (activeDialogue) {
        activeDialogue = null;
        return;
    }

    let roomNPCs = npcs[myData.room] || [];
    for (let npc of roomNPCs) {
        let dist = Math.hypot((myData.x + myData.width/2) - (npc.x + npc.width/2), (myData.y + myData.height/2) - (npc.y + npc.height/2));
        if (dist < 65) {
            activeDialogue = {
                name: npc.name,
                text: npc.dialogue,
                image: npc.image
            };
            break;
        }
    }
}

const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
    if (myData.room === "room_portal_active") {
        updateAllMapMarkers();
    }
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
        name: myData.name,
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
    if (setupOverlay.style.display !== "none" || activeDialogue || isTransitioning || p5Overlay.style.display === "flex") return;

    if (myData.room === "room_portal_active") {
        if (currentTool === "draw") return;

        let baseStep = 0.00008;
        let sprintMultiplier = keys['shift'] ? 2.5 : 1.0;
        let step = baseStep * sprintMultiplier;
        let movedMap = false;

        if (keys['w'] || keys['arrowup']) { myData.lat += step; movedMap = true; }
        if (keys['s'] || keys['arrowdown']) { myData.lat -= step; movedMap = true; }
        if (keys['a'] || keys['arrowleft']) { myData.lng -= step; movedMap = true; }
        if (keys['d'] || keys['arrowright']) { myData.lng += step; movedMap = true; }

        if (movedMap && leafletMap) {
            leafletMap.panTo([myData.lat, myData.lng], { animate: true, duration: 0.1 });
            set(myPlayerRef, myData);
        }
        return;
    }

    let speed = keys['shift'] ? 7 : 4;
    let moved = false;

    if (keys['w'] || keys['arrowup']) { myData.y -= speed; moved = true; }
    if (keys['s'] || keys['arrowdown']) { myData.y += speed; moved = true; }
    if (keys['a'] || keys['arrowleft']) { myData.x -= speed; moved = true; }
    if (keys['d'] || keys['arrowright']) { myData.x += speed; moved = true; }

    let roomChanged = checkRoomTransition();
    if (roomChanged) return;

    if (myData.room === "room_portal" && myData.x > 350 && myData.x < 450 && myData.y > 180 && myData.y < 260) {
        playP5Transition(() => {
            myData.room = "room_portal_active";
            myData.lat = SPAWN_LAT;
            myData.lng = SPAWN_LNG;
            canvas.style.display = "none";
            mapContainer.style.display = "block";
            mapUiOverlay.style.display = "flex";
            initLeafletMap();
            set(myPlayerRef, myData);
        });
        return;
    }

    if (moved) {
        set(myPlayerRef, myData);
    }
}

function draw() {
    if (myData.room === "room_portal_active" || setupOverlay.style.display !== "none") return;

    let currentRoomInfo = rooms[myData.room] || rooms["room_forest"];
    viewport.style.background = currentRoomInfo.bg;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(10, 10, 240, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(currentRoomInfo.name, 20, 30);

    let roomNPCs = npcs[myData.room] || [];
    for (let npc of roomNPCs) {
        if (!loadedImages[npc.image]) {
            let img = new Image();
            img.crossOrigin = "anonymous";
            img.src = npc.image;
            loadedImages[npc.image] = img;
        }
        let imgObj = loadedImages[npc.image];
        if (imgObj.complete && imgObj.naturalWidth !== 0) {
            ctx.drawImage(imgObj, npc.x, npc.y, npc.width, npc.height);
        } else {
            ctx.fillStyle = "#e67e22";
            ctx.fillRect(npc.x, npc.y, npc.width, npc.height);
        }

        ctx.fillStyle = "#f1c40f";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(npc.name, npc.x + npc.width / 2, npc.y - 6);

        let dist = Math.hypot((myData.x + myData.width/2) - (npc.x + npc.width/2), (myData.y + myData.height/2) - (npc.y + npc.height/2));
        if (dist < 65) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 10px sans-serif";
            ctx.fillText("[Press E]", npc.x + npc.width / 2, npc.y - 20);
        }
    }

    if (myData.room === "room_python") {
        ctx.fillStyle = "#111";
        ctx.fillRect(180, 50, 440, 220);
        ctx.strokeStyle = "#e74c3c";
        ctx.lineWidth = 3;
        ctx.strokeRect(180, 50, 440, 220);
        ctx.fillStyle = "#e74c3c";
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

    if (activeDialogue) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(50, 280, 700, 130);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeRect(50, 280, 700, 130);

        if (activeDialogue.image) {
            if (!loadedImages[activeDialogue.image]) {
                let img = new Image();
                img.crossOrigin = "anonymous";
                img.src = activeDialogue.image;
                loadedImages[activeDialogue.image] = img;
            }
            let imgObj = loadedImages[activeDialogue.image];
            if (imgObj.complete && imgObj.naturalWidth !== 0) {
                ctx.drawImage(imgObj, 75, 305, 80, 80);
                ctx.strokeStyle = "#ffffff";
                ctx.strokeRect(75, 305, 80, 80);
            }
        }

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "left";
        ctx.fillText(activeDialogue.name + ":", 175, 315);

        ctx.font = "15px monospace";
        ctx.fillStyle = "#f1c40f";
        ctx.fillText(activeDialogue.text, 175, 345);

        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#aaa";
        ctx.fillText("[Press E or Click to continue]", 580, 395);
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
