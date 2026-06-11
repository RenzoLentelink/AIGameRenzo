import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// =========================
// SCENE
// =========================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02070a);

// =========================
// CAMERA
// =========================
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// =========================
// RENDERER (FIXED)
// =========================
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x02070a, 1); // IMPORTANT: kills white bleed

document.body.appendChild(renderer.domElement);

// =========================
// FIXED RESIZE HANDLER (IMPORTANT)
// =========================
function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', resize);
resize();

// =========================
// CONTROLS
// =========================
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

document.getElementById('startButton').addEventListener('click', () => controls.lock());

// =========================
// UI
// =========================
const keysUI = document.getElementById('keys');

// =========================
// STATE
// =========================
const keysDown = new Set();
const walls = [];
const keys = [];

let keysCollected = 0;
const totalKeys = 3;

let velocityY = 0;
let grounded = true;

let level = 0;
let levelLoading = false;

// =========================
// LIGHTING
// =========================
scene.add(new THREE.AmbientLight(0x8a845f, 1.1));

const flashlight = new THREE.SpotLight(0xfff2b0, 250, 120, 0.55, 0.7);
scene.add(flashlight);
scene.add(flashlight.target);

let flashlightOn = true;

// =========================
// ENTITY
// =========================
const entity = new THREE.Mesh(
    new THREE.BoxGeometry(2, 6, 2),
    new THREE.MeshStandardMaterial({
        color: 0xff2bd6,
        emissive: 0xff00ff,
        emissiveIntensity: 1.5
    })
);
scene.add(entity);

scene.add(new THREE.PointLight(0xff2bd6, 2, 25));

// =========================
// WORLD
// =========================
const SIZE = 200;
const CELL = 10;
const HALF = SIZE / 2;

let grid = [];

// =========================
// LEVEL COLORS
// =========================
const levelColors = [
    0x444444,
    0x1e4fff,
    0xffd400,
    0x00ff66,
    0xff2a2a
];

// =========================
// MAZE
// =========================
function generateMaze(density = 0.25) {
    const cols = Math.floor(SIZE / CELL);
    const rows = Math.floor(SIZE / CELL);

    grid = Array.from({ length: cols }, () => Array(rows).fill(1));

    let x = Math.floor(cols / 2);
    let z = Math.floor(rows / 2);

    for (let i = 0; i < cols * 4; i++) {
        grid[x][z] = 0;

        const dir = Math.floor(Math.random() * 4);
        if (dir === 0) x++;
        if (dir === 1) x--;
        if (dir === 2) z++;
        if (dir === 3) z--;

        x = Math.max(1, Math.min(cols - 2, x));
        z = Math.max(1, Math.min(rows - 2, z));
    }

    for (let i = 1; i < cols - 1; i++) {
        for (let j = 1; j < rows - 1; j++) {
            if (Math.random() < density) grid[i][j] = 1;
            else grid[i][j] = 0;
        }
    }
}

// =========================
// WORLD BUILD
// =========================
function createWall(x, y, z, color) {
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(CELL, 10, CELL),
        new THREE.MeshStandardMaterial({ color })
    );

    wall.position.set(x, y, z);
    scene.add(wall);
    walls.push(wall);
}

function buildFromGrid(color) {
    for (let x = 0; x < grid.length; x++) {
        for (let z = 0; z < grid[x].length; z++) {
            if (grid[x][z] === 1) {
                createWall(x * CELL - HALF, 5, z * CELL - HALF, color);
            }
        }
    }
}

// =========================
// BOUNDARY
// =========================
function createBoundary() {
    const h = 10;

    const make = (x, z, w, d) => {
        const m = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        m.position.set(x, h / 2, z);
        scene.add(m);
        walls.push(m);
    };

    make(0, -HALF, SIZE, 2);
    make(0, HALF, SIZE, 2);
    make(-HALF, 0, 2, SIZE);
    make(HALF, 0, 2, SIZE);
}

// =========================
// COLLISION
// =========================
const playerRadius = 1.3;

function checkCollision(pos) {
    for (const w of walls) {
        const dx = Math.abs(pos.x - w.position.x);
        const dz = Math.abs(pos.z - w.position.z);

        if (dx < CELL / 2 + playerRadius && dz < CELL / 2 + playerRadius) {
            return true;
        }
    }
    return false;
}

function tryMove(dx, dz) {
    const pos = controls.getObject().position;

    const nx = pos.clone();
    nx.x += dx;
    if (!checkCollision(nx)) pos.x = nx.x;

    const nz = pos.clone();
    nz.z += dz;
    if (!checkCollision(nz)) pos.z = nz.z;
}

// =========================
// INPUT
// =========================
window.addEventListener('keydown', (e) => {
    keysDown.add(e.code);

    if (e.code === 'KeyF') {
        flashlightOn = !flashlightOn;
        flashlight.visible = flashlightOn;
    }

    if (e.code === 'Space' && grounded) {
        velocityY = 0.25;
        grounded = false;
    }
});

window.addEventListener('keyup', (e) => keysDown.delete(e.code));

// =========================
// GRAVITY
// =========================
function updateGravity() {
    const p = controls.getObject().position;

    p.y += velocityY;
    velocityY -= 0.01;

    if (p.y <= 3) {
        p.y = 3;
        velocityY = 0;
        grounded = true;
    }
}

// =========================
// EXIT
// =========================
const exitDoor = new THREE.Mesh(
    new THREE.BoxGeometry(6, 8, 1),
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 2
    })
);
scene.add(exitDoor);

function spawnExit() {
    const cols = grid.length;
    const rows = grid[0].length;

    for (let i = 0; i < 1000; i++) {
        const gx = Math.floor(Math.random() * cols);
        const gz = Math.floor(Math.random() * rows);

        if (grid[gx][gz] !== 0) continue;

        exitDoor.position.set(gx * CELL - HALF, 5, gz * CELL - HALF);
        return;
    }
}

// =========================
// KEYS
// =========================
function createKey(x, z) {
    const key = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.12, 12, 24),
        new THREE.MeshStandardMaterial({
            color: 0xffd84d,
            emissive: 0xffaa00,
            emissiveIntensity: 2.5
        })
    );

    key.position.set(x, 1.5, z);
    key.userData.picked = false;

    scene.add(key);
    keys.push(key);
}

function spawnKeys() {
    let spawned = 0;
    let tries = 0;

    while (spawned < totalKeys && tries < 2000) {
        tries++;

        const gx = Math.floor(Math.random() * grid.length);
        const gz = Math.floor(Math.random() * grid[0].length);

        if (grid[gx][gz] !== 0) continue;

        createKey(gx * CELL - HALF, gz * CELL - HALF);
        spawned++;
    }
}

// =========================
// SPAWN
// =========================
function safeSpawn() {
    for (let i = 0; i < 200; i++) {
        const gx = Math.floor(Math.random() * grid.length);
        const gz = Math.floor(Math.random() * grid[0].length);

        if (grid[gx][gz] === 0) {
            return new THREE.Vector3(gx * CELL - HALF, 3, gz * CELL - HALF);
        }
    }
    return new THREE.Vector3(0, 3, 0);
}

// =========================
// ENTITY
// =========================
function spawnEntity() {
    const p = controls.getObject().position;

    for (let i = 0; i < 200; i++) {
        const gx = Math.floor(Math.random() * grid.length);
        const gz = Math.floor(Math.random() * grid[0].length);

        if (grid[gx][gz] !== 0) continue;

        const x = gx * CELL - HALF;
        const z = gz * CELL - HALF;

        if (new THREE.Vector2(x, z).distanceTo(new THREE.Vector2(p.x, p.z)) < 60) continue;

        entity.position.set(x, 3, z);
        return;
    }
}

// =========================
// LEVEL SYSTEM
// =========================
function clearWorld() {
    for (const w of walls) scene.remove(w);
    for (const k of keys) scene.remove(k);

    walls.length = 0;
    keys.length = 0;

    keysCollected = 0;
}

function loadLevel() {
    if (level >= 5) level = 0;

    clearWorld();

    generateMaze(0.25);
    createBoundary();
    buildFromGrid(levelColors[level]);

    controls.getObject().position.copy(safeSpawn());

    spawnKeys();
    spawnExit();
    spawnEntity();

    levelLoading = false;
}

// =========================
// LOOP
// =========================
function animate() {
    requestAnimationFrame(animate);

    flashlight.position.copy(camera.position);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    flashlight.target.position.copy(camera.position).add(dir);

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up);

    const speed = keysDown.has('ShiftLeft') ? 0.22 : 0.12;

    let dx = 0;
    let dz = 0;

    if (keysDown.has('KeyW')) dx += forward.x * speed, dz += forward.z * speed;
    if (keysDown.has('KeyS')) dx -= forward.x * speed, dz -= forward.z * speed;
    if (keysDown.has('KeyA')) dx -= right.x * speed, dz -= right.z * speed;
    if (keysDown.has('KeyD')) dx += right.x * speed, dz += right.z * speed;

    tryMove(dx, dz);
    updateGravity();

    for (const k of keys) {
        if (!k.userData.picked && controls.getObject().position.distanceTo(k.position) < 3) {
            k.userData.picked = true;
            k.visible = false;
            keysCollected++;
            keysUI.innerText = `Keys: ${keysCollected} / ${totalKeys}`;
        }
    }

    if (
        !levelLoading &&
        keysCollected >= totalKeys &&
        controls.getObject().position.distanceTo(exitDoor.position) < 6
    ) {
        level++;
        levelLoading = true;
        loadLevel();
    }

    renderer.render(scene, camera);
}

loadLevel();
animate();