// TODO: Replace this with your own Firebase project configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Canvas Setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Generate a random unique ID for this player and a random color
const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
const playerColor = '#' + Math.floor(Math.random()*16777215).toString(16);

// Player local state
let myData = {
    x: Math.random() * (canvas.width - 40),
    y: Math.random() * (canvas.height - 40),
    color: playerColor
};

// Track all active players on the server
let allPlayers = {};

// Handle Keyboard Inputs
const keys = {};
window.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

// Reference to this player's data in Firebase
const myPlayerRef = db.ref('players/' + playerId);

// Automatically remove player from database when they close the tab
myPlayerRef.onDisconnect().remove();

// Listen to all players from Firebase in real-time
db.ref('players').on('value', (snapshot) => {
    allPlayers = snapshot.val() || {};
});

// Game Loop
function update() {
    let speed = 4;
    let moved = false;

    if (keys['w'] || keys['arrowup']) { myData.y -= speed; moved = true; }
    if (keys['s'] || keys['arrowdown']) { myData.y += speed; moved = true; }
    if (keys['a'] || keys['arrowleft']) { myData.x -= speed; moved = true; }
    if (keys['d'] || keys['arrowright']) { myData.x += speed; moved = true; }

    // Screen boundaries
    myData.x = Math.max(0, Math.min(canvas.width - 30, myData.x));
    myData.y = Math.max(0, Math.min(canvas.height - 30, myData.y));

    // If player moved, push position update to Firebase
    if (moved) {
        myPlayerRef.set(myData);
    }
}

function draw() {
    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all players
    for (let id in allPlayers) {
        let p = allPlayers[id];
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 30, 30);
        
        // Add a small label above current player
        if (id === playerId) {
            ctx.fillStyle = "#fff";
            ctx.font = "10px sans-serif";
            ctx.fillText("You", p.x + 5, p.y - 5);
        }
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Start the loop
loop();
