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
const displayScore = document.getElementById("display-score");
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
    points: 100,
    sevensCount: 0,
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
let isTransitioning = false;
let activeMinigame = null; // "snake", "pacman", "gambling", "puzzle_mind", "puzzle_walk", "halloffame"
let leaderboardData = {};

// Minigame States
let snakeState = { snake: [], food: {}, dir: 'RIGHT', score: 0, gameOver: false, timer: 0 };
let pacmanState = { x: 400, y: 220, dots: [], ghosts: [], score: 0, gameOver: false };
let gambleState = { reel1: 7, reel2: 7, reel3: 7, spinning: false, message: "PRESS SPIN & PRAY!" };
let puzzleMindState = { question: "", options: [], correct: 0, feedback: "" };

const rooms = {
    "room_forest": { name: "🌳 Forest Clearing", bg: "#1e3f20" },
    "room_dungeon": { name: "🧱 Stone Dungeon", bg: "#2c3e50" },
    "room_python": { name: "🐍 Python Coding Lab", bg: "#2c1654" },
    "room_gamble": { name: "🎰 Mes3odi's Rigged Casino", bg: "#4a0e17" },
    "room_halloffame": { name: "🏆 777 Hall of Fame", bg: "#14141f" },
    "room_puzzles": { name: "🧩 Puzzle & Arcade Vault", bg: "#12263a" },
    "room_portal": { name: "🌀 World Map Portal Hub", bg: "#0f2027" }
};

const npcs = {
    "room_dungeon": [
        { name: "Botato", x: 350, y: 180, width: 40, height: 40, image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTk5iSgpPztUgs3JHZ14RcyIsrFsAEkPuygXVd5Z8MmIA&s=10", dialogue: "botato talk" }
    ],
    "room_gamble": [
        { name: "Casino Shark", x: 370, y: 160, width: 44, height: 44, image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ4q5Z1fC6n61Gz28Z7mFvG0wZ6aQ8z9Yk1w&s", dialogue: "Welcome to the casino! Press E on the slot machine to gamble your points. Check the Hall of Fame room below us for leaderboards!" }
    ],
    "room_puzzles": [
        { name: "Puzzle Master", x: 370, y: 160, width: 44, height: 44, image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTk5iSgpPztUgs3JHZ14RcyIsrFsAEkPuygXVd5Z8MmIA&s=10", dialogue: "Choose your challenge! Walk into puzzle pads or click to solve mind riddles and arcade classics!" }
    ]
};

function playP5Transition(callback) {
    isTransitioning = true;
    p5Canvas.style.display = "block";
    let progress = 0;

    function animateCut() {
        progress += 0.08;
        p5Ctx.clearRect(0, 0, p5Canvas.width, p5Canvas.height);
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

document.getElementById('p5-menu-toggle').addEventListener('click', () => { p5Overlay.style.display = "flex"; });
document.getElementById('p5-resume').addEventListener('click', () => { p5Overlay.style.display = "none"; });
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
    if (isMobile) mobileControls.style.display = "flex";

    set(ref(db, 'players/' + playerId), myData);
});

function initLeafletMap() {
    if (!leafletMap) {
        leafletMap = L.map('map-container', {
            zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false
        }).setView([myData.lat, myData.lng], 18);
        
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(leafletMap);
        L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(leafletMap);

        leafletMap.on('click', (e) => {
            if (currentTool === "draw") {
                let newPoint = [e.latlng.lat, e.latlng.lng];
                currentLinePoints.push(newPoint);
                if (currentLinePoints.length >= 2) {
                    push(ref(db, 'drawings'), { points: currentLinePoints, color: myData.color });
                    currentLinePoints = [];
                }
            }
        });
    } else {
        leafletMap.setView([myData.lat, myData.lng], 18);
    }
}

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

document.getElementById('tool-move').addEventListener('click', () => { currentTool = "move"; document.getElementById('tool-move').classList.add('active'); document.getElementById('tool-draw').classList.remove('active'); });
document.getElementById('tool-draw').addEventListener('click', () => { currentTool = "draw"; document.getElementById('tool-draw').classList.add('active'); document.getElementById('tool-move').classList.remove('active'); });
document.getElementById('clear-drawings').addEventListener('click', () => { if (confirm("Clear all permanent map drawings?")) remove(ref(db, 'drawings')); });

const drawingsRef = ref(db, 'drawings');
onValue(drawingsRef, (snapshot) => {
    let data = snapshot.val() || {};
    for (let id in drawingPolylines) { if (leafletMap) leafletMap.removeLayer(drawingPolylines[id]); }
    drawingPolylines = {};
    for (let id in data) {
        let lineData = data[id];
        if (lineData && lineData.points && leafletMap) {
            let polyline = L.polyline(lineData.points, { color: lineData.color || '#e74c3c', weight: 4 }).addTo(leafletMap);
            polyline.on('click', () => { if (confirm("Delete this drawing line?")) remove(ref(db, 'drawings/' + id)); });
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
            if (leafletMarkers[id]) { leafletMap.removeLayer(leafletMarkers[id]); delete leafletMarkers[id]; }
            continue;
        }
        count++;
        onlineListHTML += `<div>🟢 ${p.name || "Player"}</div>`;
        let iconCanvas = document.createElement('canvas');
        iconCanvas.width = 60; iconCanvas.height = 40;
        let iconCtx = iconCanvas.getContext('2d');
        iconCtx.fillStyle = "#fff"; iconCtx.font = "bold 9px sans-serif"; iconCtx.textAlign = "center";
        iconCtx.fillText(p.name || "Player", 30, 9);
        iconCtx.fillStyle = p.color || "#888";
        iconCtx.fillRect(22, 12, 16, 16);

        let customIcon = L.divIcon({ className: 'street-cube-icon', html: iconCanvas, iconSize: [60, 40], iconAnchor: [30, 20] });
        let pLat = p.lat || SPAWN_LAT; let pLng = p.lng || SPAWN_LNG;
        if (!leafletMarkers[id]) {
            leafletMarkers[id] = L.marker([pLat, pLng], { icon: customIcon }).addTo(leafletMap);
        } else {
            leafletMarkers[id].setLatLng([pLat, pLng]);
        }
    }
    onlineCountEl.innerText = count;
    onlinePlayersListEl.innerHTML = onlineListHTML;
}

function checkRoomTransition() {
    let nextRoom = null;
    let newX = myData.x;
    let newY = myData.y;

    if (myData.x > canvas.width - myData.width) {
        if (myData.room === "room_forest") { nextRoom = "room_dungeon"; newX = 10; }
        else if (myData.room === "room_dungeon") { nextRoom = "room_python"; newX = 10; }
        else if (myData.room === "room_python") { nextRoom = "room_gamble"; newX = 10; }
        else if (myData.room === "room_gamble") { nextRoom = "room_puzzles"; newX = 10; }
        else if (myData.room === "room_puzzles") { nextRoom = "room_portal"; newX = 10; }
        else { myData.x = canvas.width - myData.width; }
    } else if (myData.x < 0) {
        if (myData.room === "room_portal") { nextRoom = "room_puzzles"; newX = canvas.width - 40; }
        else if (myData.room === "room_puzzles") { nextRoom = "room_gamble"; newX = canvas.width - 40; }
        else if (myData.room === "room_gamble") { nextRoom = "room_python"; newX = canvas.width - 40; }
        else if (myData.room === "room_python") { nextRoom = "room_dungeon"; newX = canvas.width - 40; }
        else if (myData.room === "room_dungeon") { nextRoom = "room_forest"; newX = canvas.width - 40; }
        else { myData.x = 0; }
    }

    // Room down from Gambling machine leads to Hall of Fame
    if (myData.room === "room_gamble" && myData.y > canvas.height - 60 && myData.x >= 340 && myData.x <= 460) {
        nextRoom = "room_halloffame";
        newY = 30;
    } else if (myData.room === "room_halloffame" && myData.y < 10) {
        nextRoom = "room_gamble";
        newY = canvas.height - 70;
    }

    if (nextRoom && !isTransitioning) {
        playP5Transition(() => {
            myData.room = nextRoom;
            myData.x = newX;
            myData.y = newY;
            set(myPlayerRef, myData);
        });
        return true;
    }

    if (myData.y > canvas.height - myData.height) { myData.y = canvas.height - myData.height; }
    else if (myData.y < 0) { myData.y = 0; }
    return false;
}

// --- MINIGAMES & PUZZLES SETUP ---
function startSnake() {
    activeMinigame = "snake";
    snakeState.snake = [{x: 10, y: 10}, {x: 9, y: 10}, {x: 8, y: 10}];
    snakeState.food = {x: Math.floor(Math.random()*25), y: Math.floor(Math.random()*15)};
    snakeState.dir = 'RIGHT';
    snakeState.score = 0;
    snakeState.gameOver = false;
}

function startPacman() {
    activeMinigame = "pacman";
    pacmanState.x = 400; pacmanState.y = 220; pacmanState.score = 0; pacmanState.gameOver = false;
    pacmanState.dots = [];
    for (let i = 0; i < 15; i++) {
        pacmanState.dots.push({ x: 100 + i * 40, y: 100 + (i % 3) * 80, collected: false });
    }
}

function startMindPuzzle() {
    activeMinigame = "puzzle_mind";
    const riddles = [
        { q: "What is 7 * 7 + 7?", options: ["56", "49", "63", "77"], correct: 0 },
        { q: "Which programming language is known for a snake logo?", options: ["Java", "Python", "C++", "HTML"], correct: 1 },
        { q: "What color is Persona 5 UI primarily styled in?", options: ["Blue & White", "Red & Black", "Green & Gold", "Neon Purple"], correct: 1 }
    ];
    let r = riddles[Math.floor(Math.random() * riddles.length)];
    puzzleMindState.question = r.q;
    puzzleMindState.options = r.options;
    puzzleMindState.correct = r.correct;
    puzzleMindState.feedback = "";
}

function startWalkPuzzle() {
    activeMinigame = "puzzle_walk";
    // Place player in a maze-like room
    myData.x = 100; myData.y = 100;
}

const keys = {};
window.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === 'INPUT' || p5Overlay.style.display === "flex") return;
    let key = e.key.toLowerCase();

    if (activeMinigame === "snake") {
        if (key === 'arrowup' && snakeState.dir !== 'DOWN') snakeState.dir = 'UP';
        if (key === 'arrowdown' && snakeState.dir !== 'UP') snakeState.dir = 'DOWN';
        if (key === 'arrowleft' && snakeState.dir !== 'RIGHT') snakeState.dir = 'LEFT';
        if (key === 'arrowright' && snakeState.dir !== 'LEFT') snakeState.dir = 'RIGHT';
        if (key === 'escape') activeMinigame = null;
        return;
    }
    if (activeMinigame === "puzzle_mind") {
        if (['1','2','3','4'].includes(e.key)) {
            let choice = parseInt(e.key) - 1;
            if (choice === puzzleMindState.correct) {
                puzzleMindState.feedback = "CORRECT! +50 Points!";
                myData.points += 50;
                set(myPlayerRef, myData);
                setTimeout(() => { activeMinigame = null; }, 1200);
            } else {
                puzzleMindState.feedback = "Wrong! Try again.";
            }
        }
        if (key === 'escape') activeMinigame = null;
        return;
    }
    if (activeMinigame) {
        if (key === 'escape') activeMinigame = null;
        return;
    }

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
    if (key === 'shift' || e.key === 'Shift') keys['shift'] = false;
    else keys[key] = false;
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
    if (activeDialogue) { activeDialogue = null; return; }

    if (myData.room === "room_gamble") {
        let dist = Math.hypot((myData.x + myData.width/2) - 400, (myData.y + myData.height/2) - 220);
        if (dist < 70) {
            spinSlotMachine();
            return;
        }
    }
    if (myData.room === "room_puzzles") {
        let distMind = Math.hypot((myData.x + myData.width/2) - 250, (myData.y + myData.height/2) - 220);
        let distSnake = Math.hypot((myData.x + myData.width/2) - 550, (myData.y + myData.height/2) - 220);
        if (distMind < 60) { startMindPuzzle(); return; }
        if (distSnake < 60) { startSnake(); return; }
    }

    let roomNPCs = npcs[myData.room] || [];
    for (let npc of roomNPCs) {
        let dist = Math.hypot((myData.x + myData.width/2) - (npc.x + npc.width/2), (myData.y + myData.height/2) - (npc.y + npc.height/2));
        if (dist < 65) {
            activeDialogue = { name: npc.name, text: npc.dialogue, image: npc.image };
            break;
        }
    }
}

function spinSlotMachine() {
    if (gambleState.spinning) return;
    if (myData.points < 10) {
        alert("You need at least 10 points to gamble! Go solve puzzles or collect points!");
        return;
    }
    myData.points -= 10;
    gambleState.spinning = true;
    gambleState.message = "🎰 SPINNING RIGGED REELS...";

    let count = 0;
    let spinInterval = setInterval(() => {
        gambleState.reel1 = Math.floor(Math.random() * 9) + 1;
        gambleState.reel2 = Math.floor(Math.random() * 9) + 1;
        gambleState.reel3 = Math.floor(Math.random() * 9) + 1;
        count++;
        if (count > 12) {
            clearInterval(spinInterval);
            gambleState.spinning = false;
            
            // Rigged / 777 chance
            if (Math.random() < 0.25) {
                gambleState.reel1 = 7; gambleState.reel2 = 7; gambleState.reel3 = 7;
            }

            if (gambleState.reel1 === 7 && gambleState.reel2 === 7 && gambleState.reel3 === 7) {
                gambleState.message = "JACKPOT! 777 !! +500 POINTS!";
                myData.points += 500;
                myData.sevensCount = (myData.sevensCount || 0) + 1;
            } else if (gambleState.reel1 === gambleState.reel2 && gambleState.reel2 === gambleState.reel3) {
                gambleState.message = "THREE OF A KIND! +150 POINTS!";
                myData.points += 150;
            } else {
                gambleState.message = "House wins! Better luck next spin.";
            }
            set(myPlayerRef, myData);
        }
    }, 90);
}

const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
    leaderboardData = allPlayers;
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

    push(chatRef, { name: myData.name, text: text, timestamp: Date.now() });
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

    displayScore.innerText = `⭐ Points: ${myData.points} | 🎰 777s: ${myData.sevensCount || 0}`;

    if (activeMinigame === "snake") {
        snakeState.timer++;
        if (snakeState.timer % 8 === 0) {
            let head = { ...snakeState.snake[0] };
            if (snakeState.dir === 'UP') head.y--;
            if (snakeState.dir === 'DOWN') head.y++;
            if (snakeState.dir === 'LEFT') head.x--;
            if (snakeState.dir === 'RIGHT') head.x++;

            if (head.x < 0 || head.x >= 25 || head.y < 0 || head.y >= 15) {
                snakeState.gameOver = true;
                return;
            }
            if (head.x === snakeState.food.x && head.y === snakeState.food.y) {
                snakeState.score += 20;
                myData.points += 20;
                set(myPlayerRef, myData);
                snakeState.food = {x: Math.floor(Math.random()*25), y: Math.floor(Math.random()*15)};
            } else {
                snakeState.snake.pop();
            }
            snakeState.snake.unshift(head);
        }
        return;
    }

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
            myData.lat = SPAWN_LAT; myData.lng = SPAWN_LNG;
            canvas.style.display = "none";
            mapContainer.style.display = "block";
            mapUiOverlay.style.display = "flex";
            initLeafletMap();
            set(myPlayerRef, myData);
        });
        return;
    }

    if (moved) set(myPlayerRef, myData);
}

function draw() {
    if (myData.room === "room_portal_active" || setupOverlay.style.display !== "none") return;

    let currentRoomInfo = rooms[myData.room] || rooms["room_forest"];
    viewport.style.background = currentRoomInfo.bg;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(10, 10, 260, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(currentRoomInfo.name, 20, 30);

    // --- MINIGAME OVERLAYS ---
    if (activeMinigame === "snake") {
        ctx.fillStyle = "rgba(10, 10, 15, 0.95)";
        ctx.fillRect(100, 40, 600, 360);
        ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 4;
        ctx.strokeRect(100, 40, 600, 360);

        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("SNAKE ARCADE - Score: " + snakeState.score, 400, 75);

        let cell = 20;
        let startX = 150; let startY = 90;

        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(startX + snakeState.food.x * cell, startY + snakeState.food.y * cell, cell - 2, cell - 2);

        for (let s of snakeState.snake) {
            ctx.fillStyle = "#2ecc71";
            ctx.fillRect(startX + s.x * cell, startY + s.y * cell, cell - 2, cell - 2);
        }

        if (snakeState.gameOver) {
            ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(100, 40, 600, 360);
            ctx.fillStyle = "#e74c3c"; ctx.font = "bold 28px sans-serif";
            ctx.fillText("GAME OVER! Press ESC to Exit", 400, 220);
        }
        return;
    }

    if (activeMinigame === "puzzle_mind") {
        ctx.fillStyle = "rgba(20, 20, 35, 0.95)";
        ctx.fillRect(120, 60, 560, 320);
        ctx.strokeStyle = "#3498db"; ctx.lineWidth = 4;
        ctx.strokeRect(120, 60, 560, 320);

        ctx.fillStyle = "#3498db"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("🧩 MIND PUZZLE CHALLENGE", 400, 100);

        ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif";
        ctx.fillText(puzzleMindState.question, 400, 150);

        for (let i = 0; i < puzzleMindState.options.length; i++) {
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.fillRect(200, 180 + i * 40, 400, 30);
            ctx.fillStyle = "#f1c40f"; ctx.font = "bold 14px sans-serif";
            ctx.fillText(`[${i+1}] ${puzzleMindState.options[i]}`, 400, 200 + i * 40);
        }

        ctx.fillStyle = "#2ecc71"; ctx.font = "bold 16px sans-serif";
        ctx.fillText(puzzleMindState.feedback, 400, 340);
        return;
    }

    // --- ROOM SPECIFIC RENDERS ---
    if (myData.room === "room_gamble") {
        // Draw Slot Machine
        ctx.fillStyle = "#c0392b";
        ctx.fillRect(330, 140, 140, 150);
        ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4;
        ctx.strokeRect(330, 140, 140, 150);

        ctx.fillStyle = "#000";
        ctx.fillRect(345, 160, 110, 50);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 24px monospace"; ctx.textAlign = "center";
        ctx.fillText(`${gambleState.reel1} | ${gambleState.reel2} | ${gambleState.reel3}`, 400, 193);

        ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif";
        ctx.fillText("[Press E to Spin - 10 pts]", 400, 230);
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 10px sans-serif";
        ctx.fillText(gambleState.message, 400, 255);

        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 12px sans-serif";
        ctx.fillText("⬇ Hall of Fame Room Down Below ⬇", 400, 420);
    }

    if (myData.room === "room_halloffame") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(150, 40, 500, 360);
        ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 3;
        ctx.strokeRect(150, 40, 500, 360);

        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("🏆 777 HALL OF FAME LEADERBOARD", 400, 75);

        let startY = 115;
        ctx.fillStyle = "#fff"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
        ctx.fillText("Player Name", 180, startY);
        ctx.fillText("777 Jackpots", 420, startY);
        ctx.fillText("Points", 550, startY);

        startY += 20;
        ctx.strokeStyle = "#444"; ctx.beginPath(); ctx.moveTo(170, startY); ctx.lineTo(630, startY); ctx.stroke();

        startY += 25;
        let sortedPlayers = Object.values(leaderboardData).sort((a,b) => (b.sevensCount||0) - (a.sevensCount||0));
        for (let i = 0; i < Math.min(6, sortedPlayers.length); i++) {
            let p = sortedPlayers[i];
            ctx.fillStyle = i === 0 ? "#f1c40f" : "#fff";
            ctx.fillText(`${i+1}. ${p.name || "Player"}`, 180, startY);
            ctx.fillText(`${p.sevensCount || 0}`, 440, startY);
            ctx.fillText(`${p.points || 0}`, 550, startY);
            startY += 35;
        }

        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("⬆ Walk Up to return to Casino", 400, 385);
        return;
    }

    if (myData.room === "room_puzzles") {
        // Draw Puzzle & Arcade Portals
        ctx.fillStyle = "#3498db";
        ctx.fillRect(210, 180, 80, 80);
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("MIND PUZZLE", 250, 225);

        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(510, 180, 80, 80);
        ctx.fillStyle = "#fff";
        ctx.fillText("SNAKE ARCADE", 550, 225);

        ctx.fillStyle = "#aaa"; ctx.font = "11px sans-serif";
        ctx.fillText("[Stand near & Press E]", 400, 150);
    }

    // --- NPCS & PLAYERS ---
    let roomNPCs = npcs[myData.room] || [];
    for (let npc of roomNPCs) {
        if (!loadedImages[npc.image]) {
            let img = new Image(); img.crossOrigin = "anonymous"; img.src = npc.image;
            loadedImages[npc.image] = img;
        }
        let imgObj = loadedImages[npc.image];
        if (imgObj.complete && imgObj.naturalWidth !== 0) {
            ctx.drawImage(imgObj, npc.x, npc.y, npc.width, npc.height);
        } else {
            ctx.fillStyle = "#e67e22"; ctx.fillRect(npc.x, npc.y, npc.width, npc.height);
        }
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(npc.name, npc.x + npc.width / 2, npc.y - 6);
    }

    for (let id in allPlayers) {
        let p = allPlayers[id];
        if (p.room !== myData.room) continue;

        let pWidth = p.width || 32; let pHeight = p.height || 32;
        ctx.fillStyle = p.color || "#888";
        ctx.fillRect(p.x, p.y, pWidth, pHeight);

        ctx.fillStyle = "#fff"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.name || "Player", p.x + pWidth / 2, p.y - 6);
    }

    if (activeDialogue) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(50, 280, 700, 130);
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.strokeRect(50, 280, 700, 130);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px monospace"; ctx.textAlign = "left";
        ctx.fillText(activeDialogue.name + ":", 175, 315);
        ctx.font = "15px monospace"; ctx.fillStyle = "#f1c40f";
        ctx.fillText(activeDialogue.text, 175, 345);
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
