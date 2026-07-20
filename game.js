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

const nameInput = document.getElementById('name-input');
nameInput.value = "Player_" + Math.floor(Math.random() * 900 + 100);
const imageInput = document.getElementById('image-input');

const btnGame = document.getElementById('btn-game');
const btnCinema = document.getElementById('btn-cinema');
const cinemaScreen = document.getElementById('cinema-screen');
const cinemaControls = document.getElementById('cinema-controls');
const ytInput = document.getElementById('yt-input');
const ytSetBtn = document.getElementById('yt-set-btn');

// Unique ID for this browser session
const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
const fallbackColor = '#' + Math.floor(Math.random()*16777215).toString(16);

let myData = {
    x: Math.random() * (canvas.width - 40),
    y: Math.random() * (canvas.height - 40),
    color: fallbackColor,
    name: nameInput.value,
    avatarUrl: "",
    room: "game",
    width: 32,
    height: 32
};

let allPlayers = {};
const loadedImages = {};

// --- YOUTUBE API SYNC LOGIC ---
let ytPlayer = null;
let currentSyncedVideoId = "";
let videoStartTime = 0;

// This function is automatically called by YouTube's API script when it loads
window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
            'autoplay': 1,
            'controls': 1
        }
    });
};

const cinemaRef = ref(db, 'cinema');

ytSetBtn.addEventListener('click', () => {
    let url = ytInput.value.trim();
    let videoId = extractYouTubeId(url);
    if (videoId) {
        // Save both video ID and precise server timestamp so everyone syncs instantly
        set(cinemaRef, {
            videoId: videoId,
            startedAt: Date.now()
        });
        ytInput.value = "";
    } else {
        alert("Please paste a valid YouTube link!");
    }
});

// Listen to cinema updates in Firebase
onValue(cinemaRef, (snapshot) => {
    let data = snapshot.val();
    if (data && data.videoId) {
        currentSyncedVideoId = data.videoId;
        videoStartTime = data.startedAt || Date.now();

        // Calculate exact playback position accounting for network delay
        let elapsedSeconds = (Date.now() - videoStartTime) / 1000;

        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById({
                videoId: currentSyncedVideoId,
                startSeconds: elapsedSeconds
            });
        }
    }
});

function extractYouTubeId(url) {
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    let match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
// -----------------------------

// Keyboard tracking with input block guard
const keys = {};
window.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();
    if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keys[key] = true;
    }
});
window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    keys[key] = false;
});

// Database references
const myPlayerRef = ref(db, 'players/' + playerId);
onDisconnect(myPlayerRef).remove();

const playersRef = ref(db, 'players');
onValue(playersRef, (snapshot) => {
    allPlayers = snapshot.val() || {};
});

// Room Switcher Logic
btnGame.addEventListener('click', () => {
    myData.room = "game";
    btnGame.classList.add('active');
    btnCinema.classList.remove('active');
    canvas.style.display = "block";
    cinemaScreen.style.display = "none";
    cinemaControls.style.display = "none";
    set(myPlayerRef, myData);
});

btnCinema.addEventListener('click', () => {
    myData.room = "cinema";
    btnCinema.classList.add('active');
    btnGame.classList.remove('active');
    canvas.style.display = "block"; 
    cinemaScreen.style.display = "block";
    cinemaControls.style.display = "block";
    set(myPlayerRef, myData);

    // Instantly sync video position when walking into the cinema room
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function' && currentSyncedVideoId) {
        let elapsedSeconds = (Date.now() - videoStartTime) / 1000;
        ytPlayer.loadVideoById({
            videoId: currentSyncedVideoId,
            startSeconds: elapsedSeconds
        });
    }
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

    myData.x = Math.max(0, Math.min(canvas.width - myData.width, myData.x));
    myData.y = Math.max(0, Math.min(canvas.height - myData.height, myData.y));

    myData.name = nameInput.value.trim() || "Player";
    myData.avatarUrl = imageInput.value.trim();

    if (moved || document.activeElement === nameInput || document.activeElement === imageInput) {
        set(myPlayerRef, myData);
    }
}

// Draw graphics based on active room
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (myData.room === "cinema") {
        ctx.fillStyle = "#332211";
        for (let row = 320; row < 420; row += 35) {
            for (let col = 100; col < 750; col += 60) {
                ctx.fillRect(col, row, 40, 20);
            }
        }
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
