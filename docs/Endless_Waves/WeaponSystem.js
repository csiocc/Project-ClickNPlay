import * as THREE from 'three';

export class WeaponSystem {
    constructor(scene, camera, state, callbacks) {
        this.scene = scene;
        this.camera = camera;
        this.state = state;
        this.callbacks = callbacks; // Für updateHUD, showHitmarker

        this.raycaster = new THREE.Raycaster();
        this.sparks = [];

        this._addEventListeners();
    }

    _addEventListeners() {
        window.addEventListener('mousedown', (e) => { if (e.button === 0) this.state._shootHeld = true; });
        window.addEventListener('mouseup', (e) => { if (e.button === 0) this.state._shootHeld = false; });
    }

    shoot(weaponMuzzle) {
        const now = performance.now();
        const interval = 1000 / this.state.fireRate;

        if (this.state.reloading) return;
        if (now - this.state.lastShot < interval) return;

        if (this.state.ammo <= 0) {
            if (!this.state.reloading) {
                this.reload();
            }
            return;
        }

        this.state.lastShot = now;
        this.state.ammo--;

        // Rückstoss auslösen
        this.state.recoil.target.x += 0.3; // Vertikaler Kick (doppelt so stark)
        this.state.recoil.target.y += (Math.random() - 0.5) * 0.01; // Leichter horizontaler Kick

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        const allHitboxes = this.state.enemies.flatMap(e => e.hitboxes);
        const hits = this.raycaster.intersectObjects(allHitboxes);

        let targetPoint;
        if (hits.length > 0) {
            const hit = hits[0];
            const hitObject = hit.object;
            const zombie = hitObject.userData.parentInstance;
            const point = hit.point;
            targetPoint = point.clone();

            if (!zombie) return;


            const isHeadshot = hitObject.userData.isHead === true;
            const damage = isHeadshot ? this.state.damage * 2 : this.state.damage;
            const wasKilled = zombie.takeDamage(damage, isHeadshot);

            this.spawnSpark(point, isHeadshot);
            if (wasKilled && !zombie.isDying) {
                zombie.die();
                setTimeout(() => {
                    zombie.isDead = true;
                }, 60000);
                this.state.credits += Math.floor(10 + Math.random() * 5) + Math.floor(this.state.wave * 2);
            }
            this.callbacks.showHitmarker(isHeadshot);
        } else {
            // Wenn nichts getroffen wird, zielen wir auf einen Punkt 200 Einheiten entfernt
            targetPoint = this.raycaster.ray.at(200, new THREE.Vector3());
        }

        // Projektil-Effekt
        const muzzleWorldPos = new THREE.Vector3();
        weaponMuzzle.getWorldPosition(muzzleWorldPos);
        const projectileDir = new THREE.Vector3().subVectors(targetPoint, muzzleWorldPos).normalize();
        
        this.spawnProjectile({
            pos: muzzleWorldPos,
            dir: projectileDir, // Richtung vom Lauf zum Zielpunkt
            damage: 0, // Spieler-Raycast macht den Schaden
            speed: 120,
            life: 0.8,
            size: 0.04,
            color: 0xffff99,
            isPlayer: true
        });

        this.muzzleFlash(weaponMuzzle);
        this.callbacks.updateHUD();
    }

    reload() {
        if (this.state.reloading || this.state.ammo === this.state.maxAmmo) {
            return;
        }
        this.state.reloading = true;
        this.callbacks.showNotification("Lade nach...", 1500);

        // Hier könnte man eine Nachlade-Animation starten
        setTimeout(() => {
            this.state.ammo = this.state.maxAmmo;
            this.state.reloading = false;
            this.callbacks.updateHUD();
        }, 1500); // 1.5 Sekunden Nachladezeit
    }

    muzzleFlash(weaponMuzzle) {
        const light = new THREE.PointLight(0xffdd99, 2, 6);
        weaponMuzzle.getWorldPosition(light.position);
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 60);
    }

    spawnSpark(pos, isHeadshot = false) {
        const size = isHeadshot ? 0.25 : 0.05;
        const color = isHeadshot ? 0xffff00 : 0xff6b6b;
        const life = isHeadshot ? 0.5 : 0.3;
        const particleCount = isHeadshot ? 8 : 2;

        for (let i = 0; i < particleCount; i++) {
            const g = new THREE.SphereGeometry(size * (Math.random() * 0.5 + 0.75), 6, 6);
            const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color, transparent: true }));
            m.position.copy(pos);
            const v = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(isHeadshot ? 5 : 2);
            this.scene.add(m);
            this.sparks.push({ m, v, life });
        }
    }

    spawnProjectile(options) {
        const { pos, dir, damage = 10, speed = 60, life = 2.0, size = 0.06, color = 0xfff0a3, isPlayer = false, gravity = false, splash = 0, splashDamage = 0 } = options;

        const geo = new THREE.SphereGeometry(size, 6, 4);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);

        const p = { mesh, dir, damage, speed, life, isPlayer, gravity, splash, splashDamage };
        this.state.projectiles.push(p);
        this.scene.add(mesh);
    }

    update(dt) {
        // Sparks
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.m.position.addScaledVector(s.v, dt);
            s.v.y -= 9.8 * dt;
            s.life -= dt;
            s.m.material.opacity = Math.max(0, s.life / 0.3);
            if (s.life <= 0) {
                this.scene.remove(s.m);
                this.sparks.splice(i, 1);
            }
        }

        // Projectiles
        for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
            const p = this.state.projectiles[i];
            p.mesh.position.addScaledVector(p.dir, p.speed * dt);
            if (p.gravity) {
                p.dir.y -= 9.8 * dt * 0.5;
            }
            p.life -= dt;

            let hit = false;
            if (!p.isPlayer) {
                for (let j = this.state.enemies.length - 1; j >= 0; j--) {
                    const e = this.state.enemies[j];
                    if (e.isDying) continue;

                    let hitDetected = false;
                    for (const hitbox of e.hitboxes) {
                        const worldSphere = new THREE.Sphere().copy(hitbox.geometry.boundingSphere).applyMatrix4(hitbox.matrixWorld);
                        if (worldSphere.containsPoint(p.mesh.position)) {
                            hitDetected = true;
                            break;
                        }
                    }
                    if (hitDetected) {
                        const wasKilled = e.takeDamage(p.damage, false);
                        this.spawnSpark(p.mesh.position);
                        if (wasKilled && !e.isDying) {
                            e.die();
                            setTimeout(() => { e.isDead = true; }, 60000);
                            this.state.credits += 8 + Math.floor(this.state.wave * 1.5);
                        }
                        hit = true;
                        break;
                    }
                }
            }

            if (hit || p.life <= 0) {
                if (p.splash > 0) {
                    this.spawnSpark(p.mesh.position, true);
                    for (const otherE of this.state.enemies) {
                        if (otherE.isDying) continue;
                        const dist = otherE.model.position.distanceTo(p.mesh.position);
                        if (dist < p.splash) {
                            const splashDmg = p.splashDamage * (1 - dist / p.splash);
                            const wasKilledSplash = otherE.takeDamage(splashDmg, false);
                            if (wasKilledSplash && !otherE.isDying) {
                                otherE.die();
                                setTimeout(() => { otherE.isDead = true; }, 60000);
                                this.state.credits += 8 + Math.floor(this.state.wave * 1.5);
                            }
                        }
                    }
                }
                this.scene.remove(p.mesh);
                this.state.projectiles.splice(i, 1);
            }
        }
    }
}