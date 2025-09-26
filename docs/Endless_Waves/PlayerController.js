import * as THREE from 'three';

const PLAYER_RADIUS = 0.4;
const CAMERA_HEIGHT = 1.6;

export class PlayerController {
    constructor(camera, controls, state, worldBVH, callbacks) {
        this.camera = camera;
        this.controls = controls;
        this.state = state;
        this.worldBVH = worldBVH;
        this.keys = Object.create(null);

        // Callbacks für Funktionen, die außerhalb des Controllers liegen
        this.callbacks = callbacks;

        this._addEventListeners();
    }

    _isColliding(pos) {
        if (!this.worldBVH) return false;
        const checkDirections = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
        for (const dir of checkDirections) {
            const raycaster = new THREE.Raycaster(pos, dir);
            const hit = this.worldBVH.raycastFirst(raycaster.ray);
            if (hit && hit.distance < PLAYER_RADIUS) {
                return true;
            }
        }
        return false;
    }

    _addEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyP') this.callbacks.togglePause();
            if (e.code === 'KeyR') this.callbacks.restart();
            if (e.code === 'F12') {
                e.preventDefault();
                this.state.credits += 99999;
                this.callbacks.showNotification("Cheat aktiviert: +99999 Credits!", 2000, 'info');
                this.callbacks.updateHUD();
            }

            // Shop-Logik
            if (e.code === 'Digit1') {
                if (this.state.credits >= this.state.costs.turret) {
                    this.state.credits -= this.state.costs.turret;
                    this.callbacks.placeTurret('gatling'); // Specify type
                    this.state.costs.turret = Math.floor(this.state.costs.turret * 1.45 + 25);
                    this.callbacks.updateHUD();
                }
            }
            if (e.code === 'Digit2') {
                if (this.state.credits >= this.state.costs.canon) {
                    this.state.credits -= this.state.costs.canon;
                    this.callbacks.placeTurret('canon'); // Specify type
                    this.state.costs.canon = Math.floor(this.state.costs.canon * 1.3 + 50); // Increase cost
                    this.callbacks.updateHUD();
                }
            }
            if (e.code === 'Digit3') { // Heal-Pack kaufen
                if (this.state.credits >= this.state.costs.heal && !this.callbacks.el('buyHeal').disabled) {
                    this.state.credits -= this.state.costs.heal;
                    this.state.hp = Math.min(100, this.state.hp + 50);
                    this.callbacks.showNotification("Heilung! +50 HP", 1500, 'info');
                    this.callbacks.updateHUD();
                }
            }
            if (e.code === 'Digit4') { // Schaden upgraden
                if (this.state.credits >= this.state.costs.dmg) {
                    this.state.credits -= this.state.costs.dmg;
                    this.state.damage += 5;
                    this.state.costs.dmg = Math.floor(this.state.costs.dmg * 1.55 + 10);
                    this.callbacks.showNotification(`Schaden erhöht auf ${this.state.damage}!`, 1500, 'info');
                    this.callbacks.updateHUD();
                }
            }
            if (e.code === 'Digit5') { // Feuerrate upgraden
                if (this.state.credits >= this.state.costs.rate && this.state.fireRate < 16) {
                    this.state.credits -= this.state.costs.rate;
                    this.state.fireRate = Math.min(16, this.state.fireRate + 1);
                    this.state.costs.rate = Math.floor(this.state.costs.rate * 1.6 + 10);
                    this.callbacks.showNotification(`Feuerrate erhöht auf ${this.state.fireRate.toFixed(1)}/s!`, 1500, 'info');
                    this.callbacks.updateHUD();
                }
            }

            if (e.code === 'KeyT') { // 'T' is also for Gatling
                if (this.state.credits >= this.state.costs.turret) {
                    this.state.credits -= this.state.costs.turret;
                    this.callbacks.placeTurret('gatling');
                    this.state.costs.turret = Math.floor(this.state.costs.turret * 1.45 + 25);
                    this.callbacks.updateHUD();
                }
            }

            // Springen
            if (e.code === 'Space' && this.state.onGround) {
                this.state.vel.y = 6; // Sprunghöhe/-kraft
                this.state.onGround = false;
            }
            if (this.state.running && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    update(dt) {
        const obj = this.controls.getObject();

        // Schwerkraft und Bodenkollision
        this.state.vel.y -= 9.8 * dt * 2.5;
        obj.position.y += this.state.vel.y * dt;

        const groundRay = new THREE.Raycaster(obj.position, new THREE.Vector3(0, -1, 0));
        const hit = this.worldBVH ? this.worldBVH.raycastFirst(groundRay.ray) : null;
        if (hit && hit.distance < CAMERA_HEIGHT) {
            obj.position.y = hit.point.y + CAMERA_HEIGHT;
            this.state.vel.y = 0;
            this.state.onGround = true;
        } else {
            this.state.onGround = false;
        }

        const base = this.state.speed;
        const speed = (this.keys.ShiftLeft || this.keys.ShiftRight) ? base * 1.7 : base;

        let moveX = 0, moveZ = 0;
        if (this.keys.KeyW) moveZ += 1;
        if (this.keys.KeyS) moveZ -= 1;
        if (this.keys.KeyA) moveX -= 1;
        if (this.keys.KeyD) moveX += 1;

        if (moveX !== 0 || moveZ !== 0) {
            const len = Math.hypot(moveX, moveZ);
            moveX /= len;
            moveZ /= len;
        }

        // Richtungen aus Kamera, nur XZ
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const step = speed * dt;
        const dX = right.x * moveX * step + forward.x * moveZ * step;
        const dZ = right.z * moveX * step + forward.z * moveZ * step;

        // Achsenweise bewegen + kollidieren
        const oldX = obj.position.x;
        obj.position.x += dX;
        if (this._isColliding(obj.position)) {
            obj.position.x = oldX;
        }
        const oldZ = obj.position.z;
        obj.position.z += dZ;
        if (this._isColliding(obj.position)) {
            obj.position.z = oldZ;
        }
    }
}