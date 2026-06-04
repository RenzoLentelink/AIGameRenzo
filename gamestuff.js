import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// =========================
// SCENE
// =========================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12110d);

// =========================
// CAMERA / RENDERER
// =========================
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

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
const message = document.getElementById('message');

// =========================
// STATE
// =========================
let level = 1;
let transitioning = false;

let velocityY = 0;
let grounded = true;

let keysCollected = 0;
const totalKeys = 3;

const keysDown = new Set();

const walls = [];
const keys = [];

// =========================
// LIGHTING
// =========================
const ambient = new THREE.AmbientLight(0x8a845f, 1.1);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xfff2b0, 250);
flashlight.angle = 0.55;
flashlight.penumbra = 0.7;
scene.add(flashlight);
scene.add(flashlight.target);

let flashlightOn = true;

// =========================
// ENTITY (FIXED + PINK)
// =========================
const entity = new THREE.Mesh(
    new THREE.BoxGeometry(2, 6, 2),
    new THREE.MeshStandardMaterial({
        color: 0xff2bd6,
        emissive: 0xff00ff,
        emissiveIntensity: 1.8
    })
);
scene.add(entity);

const entityLight = new THREE.PointLight(0xff2bd6, 2, 30);
entity.add(entityLight);

// =========================
// WORLD CONSTANTS
// =========================
const SIZE = 200;
const CELL = 10;
const HALF = SIZE / 2;

// =========================
// MAZE GRID
// =========================
let grid = [];

function generateMaze(density = 0.3) {
    const cols = SIZE / CELL;
    const rows = SIZE / CELL;

    grid = Array.from({ length: cols }, () => Array(rows).fill(0));

    for (let x = 0; x < cols; x++) {
        for (let z = 0; z < rows; z++) {

            const border = x === 0 || z === 0 || x === cols - 1 || z === rows - 1;
            if (border) {
                grid[x][z] = 1;
            } else {
                grid[x][z] = Math.random() < density ? 1 : 0;
            }
        }
    }

    // carve path
    let x = Math.floor(cols / 2);
    let z = Math.floor(rows / 2);

    for (let i = 0; i < cols * 2; i++) {
        grid[x][z] = 0;

        const dir = Math.floor(Math.random() * 4);
        if (dir === 0) x++;
        if (dir === 1) x--;
        if (dir === 2) z++;
        if (dir === 3) z--;

        x = Math.max(1, Math.min(cols - 2, x));
        z = Math.max(1, Math.min(rows - 2, z));
    }
}

// =========================
// WALLS (FIXED HITBOX)
// =========================
function createWall(x, y, z, w, h, d, color) {
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
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
                const wx = x * CELL - HALF;
                const wz = z * CELL - HALF;

                createWall(wx, 4, wz, CELL, 8, CELL, color);
            }
        }
    }
}

// =========================
// OUTER BOUNDARY (FIXED)
// =========================
function createBoundary() {
    const h = 8;

    createWall(0, h / 2, -HALF, SIZE, h, 2, 0x333333);
    createWall(0, h / 2, HALF, SIZE, h, 2, 0x333333);
    createWall(-HALF, h / 2, 0, 2, h, SIZE, 0x333333);
    createWall(HALF, h / 2, 0, 2, h, SIZE, 0x333333);
}

// =========================
// COLLISION (FIXED SIZE BUG)
// =========================
function checkCollision(pos) {
    for (const w of walls) {

        const dx = Math.abs(pos.x - w.position.x);
        const dz = Math.abs(pos.z - w.position.z);

        const bx = w.geometry.parameters.width / 2 + 0.8;
        const bz = w.geometry.parameters.depth / 2 + 0.8;

        if (dx < bx && dz < bz) return true;
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
// EXIT (GLOWS)
// =========================
const exitDoor = new THREE.Mesh(
    new THREE.BoxGeometry(6, 7, 1),
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.8
    })
);

const exitLight = new THREE.PointLight(0xffffff, 2.5, 50);
exitDoor.add(exitLight);

scene.add(exitDoor);

// =========================
// KEYS (FIXED PICKUP)
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

    while (spawned < 3 && tries < 200) {
        tries++;

        const x = Math.random() * SIZE - HALF;
        const z = Math.random() * SIZE - HALF;

        const test = new THREE.Vector3(x, 3, z);

        if (checkCollision(test)) continue;
        if (test.distanceTo(exitDoor.position) < 25) continue;

        createKey(x, z);
        spawned++;
    }
}

// =========================
// SAFE SPAWN (FIXED)
// =========================
function safeSpawn() {
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * SIZE - HALF;
        const z = Math.random() * SIZE - HALF;

        const test = new THREE.Vector3(x, 3, z);

        if (!checkCollision(test)) return test;
    }

    return new THREE.Vector3(0, 3, 0);
}

// =========================
// ENTITY SPAWN (FIXED SAFE DISTANCE)
// =========================
function spawnEntity() {
    const p = controls.getObject().position;

    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 30;

    entity.position.set(
        p.x + Math.cos(angle) * dist,
        3,
        p.z + Math.sin(angle) * dist
    );
}

// =========================
// CLEAR WORLD
// =========================
function clearWorld() {
    for (const w of walls) scene.remove(w);
    for (const k of keys) scene.remove(k);

    walls.length = 0;
    keys.length = 0;

    keysCollected = 0;
}

// =========================
// LEVELS
// =========================
function buildLevel1() {
    scene.fog = new THREE.Fog(0x1a1a14, 20, 140);

    generateMaze(0.25);
    createBoundary();
    buildFromGrid(0xc9c27a);

    exitDoor.position.set(70, 4, 70);

    controls.getObject().position.copy(safeSpawn());

    spawnKeys();
    spawnEntity();
}

function buildLevel2() {
    scene.fog = new THREE.Fog(0x0b0b0b, 10, 120);

    generateMaze(0.3);
    createBoundary();
    buildFromGrid(0x444444);

    exitDoor.position.set(-70, 4, 70);

    controls.getObject().position.copy(safeSpawn());

    spawnKeys();
    spawnEntity();
}

function buildLevel3() {
    scene.fog = new THREE.Fog(0x1a3a55, 10, 140);

    generateMaze(0.28);
    createBoundary();
    buildFromGrid(0x2b3d44);

    exitDoor.position.set(60, 4, 60);

    controls.getObject().position.copy(safeSpawn());

    spawnKeys();
    spawnEntity();
}

function buildLevel4() {
    scene.background = new THREE.Color(0x1a0000);
    scene.fog = new THREE.Fog(0x2a0000, 10, 80);

    generateMaze(0.35);
    createBoundary();
    buildFromGrid(0x330000);

    const redLight = new THREE.PointLight(0xff0000, 3, 120);
    redLight.position.set(0, 20, 0);
    scene.add(redLight);

    exitDoor.position.set(80, 4, 80);

    controls.getObject().position.copy(safeSpawn());

    spawnKeys();
    spawnEntity();
}

function buildLevel5() {
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 10, 60);

    generateMaze(0.42);
    createBoundary();
    buildFromGrid(0x111111);

    exitDoor.position.set(100, 4, 100);

    controls.getObject().position.copy(safeSpawn());

    spawnKeys();
    spawnEntity();
}

// =========================
// INPUT
// =========================
window.addEventListener('keydown', (e) => {

    keysDown.add(e.code);

    if (e.code === 'Space' && grounded) {
        velocityY = 0.22;
        grounded = false;
    }

    if (e.code === 'KeyF') {
        flashlightOn = !flashlightOn;
        flashlight.visible = flashlightOn;
    }
});

window.addEventListener('keyup', (e) => keysDown.delete(e.code));

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

    if (keysDown.has('KeyW')) { dx += forward.x * speed; dz += forward.z * speed; }
    if (keysDown.has('KeyS')) { dx -= forward.x * speed; dz -= forward.z * speed; }
    if (keysDown.has('KeyA')) { dx -= right.x * speed; dz -= right.z * speed; }
    if (keysDown.has('KeyD')) { dx += right.x * speed; dz += right.z * speed; }

    tryMove(dx, dz);

    // KEY PICKUP FIX
    for (const k of keys) {
        if (k.userData.picked) continue;

        if (controls.getObject().position.distanceTo(k.position) < 3) {
            k.userData.picked = true;
            k.visible = false;
            keysCollected++;
            keysUI.innerText = `Keys: ${keysCollected} / ${totalKeys}`;
        }
    }

    // ENTITY FIXED RANGE
    const player = controls.getObject().position;
    const toPlayer = new THREE.Vector3().subVectors(player, entity.position);
    const dist = toPlayer.length();

    if (dist < 45) {
        toPlayer.normalize();
        entity.position.add(toPlayer.multiplyScalar(0.02));
    }

    if (dist < 2.5) {
        message.innerText = "CAUGHT";
        setTimeout(() => location.reload(), 2000);
    }

    // EXIT
    if (player.distanceTo(exitDoor.position) < 6 && keysCollected >= totalKeys && !transitioning) {

        transitioning = true;
        level++;

        setTimeout(() => {

            clearWorld();

            if (level === 1) buildLevel1();
            else if (level === 2) buildLevel2();
            else if (level === 3) buildLevel3();
            else if (level === 4) buildLevel4();
            else if (level === 5) buildLevel5();
            else window.location.href = "https://www.youtube.com/@moonsnowtv";

            transitioning = false;

        }, 1200);
    }

    renderer.render(scene, camera);
}

buildLevel1();
animate();