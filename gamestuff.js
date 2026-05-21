import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// =========================
// SCENE
// =========================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f0c);
scene.fog = new THREE.Fog(0x1a1a14, 18, 160);

// =========================
// CAMERA / RENDERER
// =========================

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// =========================
// CONTROLS
// =========================

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const menu = document.getElementById('menu');
const startButton = document.getElementById('startButton');

startButton.addEventListener('click', () => controls.lock());

controls.addEventListener('lock', () => menu.style.display = 'none');
controls.addEventListener('unlock', () => menu.style.display = 'flex');

// =========================
// STATE
// =========================

let level = 1;
let transitioning = false;

let velocityY = 0;
let grounded = true;

let keysCollected = 0;
const totalKeys = 3;

const walls = [];
const doors = [];
const keys = [];

const keysDown = new Set();

// =========================
// UI
// =========================

const keysUI = document.getElementById('keys');
const message = document.getElementById('message');

// =========================
// LIGHTING
// =========================

const ambient = new THREE.AmbientLight(0x6a6a5a, 0.95);
scene.add(ambient);

const flashlight = new THREE.SpotLight(0xfff2b0, 220);
flashlight.angle = 0.5;
flashlight.penumbra = 0.6;
flashlight.distance = 85;
scene.add(flashlight);
scene.add(flashlight.target);

let flashlightOn = true;

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

    if (e.code === 'KeyE') {
        doors.forEach(d => {
            const dist = controls.getObject().position.distanceTo(d.position);
            if (dist < 5) {
                d.rotation.y += d.userData.open ? -Math.PI / 2 : Math.PI / 2;
                d.userData.open = !d.userData.open;
            }
        });
    }
});

window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
});

// =========================
// WORLD OBJECTS
// =========================

function createWall(x, y, z, w, h, d) {
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0xc9c27a })
    );
    wall.position.set(x, y, z);
    scene.add(wall);
    walls.push(wall);
}

function createDoor(x, z) {
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(3, 6, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x3b2412 })
    );
    door.position.set(x, 3, z);
    door.userData.open = false;
    scene.add(door);
    doors.push(door);
}

// =========================
// GLOWING KEYS
// =========================

function createKey(x, z) {
    const key = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.12, 12, 24),
        new THREE.MeshStandardMaterial({
            color: 0xffd84d,
            emissive: 0xffaa00,
            emissiveIntensity: 2.8
        })
    );

    key.position.set(x, 1.5, z);

    const light = new THREE.PointLight(0xffcc55, 2.5, 20);
    key.add(light);

    key.userData.t = Math.random() * 10;
    key.userData.baseY = 1.5;

    scene.add(key);
    keys.push(key);
}

function safeKeySpawn() {
    const p = controls.getObject().position;

    for (let i = 0; i < 20; i++) {
        const x = p.x + (Math.random() * 180 - 90);
        const z = p.z + (Math.random() * 180 - 90);

        let blocked = false;

        for (const w of walls) {
            if (Math.abs(x - w.position.x) < 6 && Math.abs(z - w.position.z) < 6) {
                blocked = true;
                break;
            }
        }

        if (!blocked) {
            createKey(x, z);
            return;
        }
    }
}

// =========================
// EXIT
// =========================

const exitDoor = new THREE.Mesh(
    new THREE.BoxGeometry(5, 7, 1),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
);
scene.add(exitDoor);

// =========================
// COLLISION + MOVEMENT
// =========================

function checkCollision(pos) {
    for (const w of walls) {
        if (
            Math.abs(pos.x - w.position.x) < 6 &&
            Math.abs(pos.z - w.position.z) < 6
        ) return true;
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
// LEVELS
// =========================

function buildLevel1() {

    scene.fog = new THREE.Fog(0x1a1a14, 18, 160);

    exitDoor.position.set(220, 3.5, 220);

    for (let i = 0; i < 35; i++) {
        const x = Math.random() * 420 - 210;
        const z = Math.random() * 420 - 210;

        createWall(x, 4, z, 25, 8, 2);
        createWall(x + 12, 4, z + 12, 2, 8, 25);
        createDoor(x + 6, z);
    }

    safeKeySpawn();
    safeKeySpawn();
    safeKeySpawn();
}

function buildLevel2() {

    scene.fog = new THREE.Fog(0x050505, 15, 90);

    exitDoor.position.set(
        Math.random() * 300 - 150,
        3.5,
        Math.random() * 300 - 150
    );

    for (let i = 0; i < 50; i++) {
        const x = Math.random() * 420 - 210;
        const z = Math.random() * 420 - 210;

        createWall(x, 4, z, 25, 8, 2);
        createWall(x + 10, 4, z + 10, 2, 8, 25);

        if (i % 2 === 0) createDoor(x + 5, z);
    }

    safeKeySpawn();
    safeKeySpawn();
    safeKeySpawn();

    transitioning = false;
}

// =========================
// START
// =========================

buildLevel1();

// =========================
// LOOP
// =========================

function animate() {

    requestAnimationFrame(animate);

    // flashlight follow
    flashlight.position.copy(camera.position);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    flashlight.target.position.copy(camera.position).add(dir);

    // movement
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

    // jump
    velocityY -= 0.012;
    controls.getObject().position.y += velocityY;

    if (controls.getObject().position.y <= 3) {
        controls.getObject().position.y = 3;
        grounded = true;
        velocityY = 0;
    }

    // keys animation + pickup
    for (const k of keys) {

        if (!k.visible) continue;

        k.userData.t += 0.05;

        k.position.y = k.userData.baseY + Math.sin(k.userData.t) * 0.25;

        k.rotation.y += 0.03;

        k.scale.setScalar(1 + Math.sin(k.userData.t * 1.3) * 0.15);

        if (controls.getObject().position.distanceTo(k.position) < 3) {
            k.visible = false;
            keysCollected++;
            keysUI.innerText = `Keys: ${keysCollected} / ${totalKeys}`;
        }
    }

    // exit logic
    const player = controls.getObject().position;
    const exitDist = player.distanceTo(exitDoor.position);

    if (exitDist < 6 && keysCollected >= totalKeys && !transitioning) {

        transitioning = true;

        if (level === 1) {

            level = 2;
            message.innerText = "LEVEL 2...";

            setTimeout(() => {
                clearWorld();
                buildLevel2();
            }, 1000);

        } else {

            message.innerText = "YOU ESCAPED";

            setTimeout(() => {
                controls.unlock();
                location.reload();
            }, 2500);
        }
    }

    renderer.render(scene, camera);
}

// =========================
// CLEAR WORLD
// =========================

function clearWorld() {

    for (const w of walls) scene.remove(w);
    for (const d of doors) scene.remove(d);
    for (const k of keys) scene.remove(k);

    walls.length = 0;
    doors.length = 0;
    keys.length = 0;

    keysCollected = 0;

    controls.getObject().position.set(0, 3, 0);
    velocityY = 0;
    grounded = true;
}

// =========================
// RESIZE
// =========================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();