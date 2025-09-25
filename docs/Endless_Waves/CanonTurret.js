import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

let canonModel = null;
const mtlLoader = new MTLLoader();
const objLoader = new OBJLoader();

// Lade zuerst die Materialien, dann das Modell
mtlLoader.load(
    './models/Towers/Turret_Pack/OBJ/Cannon_2.mtl',
    (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.load(
            './models/Towers/Turret_Pack/OBJ/Cannon_2.obj',
            (obj) => {
                canonModel = obj;
                canonModel.traverse(node => {
                    if (node.isMesh) node.castShadow = true;
                });
                console.log("Canon Turret Modell für die Klasse geladen!");
                const partNames = [];
                canonModel.traverse(node => { if (node.name && node.name !== 'Root') partNames.push(node.name); });
                console.log("Gefundene benannte Teile im Kanonen-Modell:", partNames);
            },
            undefined,
            (error) => console.error('Fehler beim Laden des Kanonen-Modells:', error)
        );
    }
);

export class CanonTurret {
  constructor(scene, position, state, callbacks) {
    if (!CanonTurret.isReady()) {
      console.error("CanonTurret model is not ready!");
      return null;
    }

    this.scene = scene;
    this.state = state;
    this.callbacks = callbacks;

    this.base = canonModel.clone();
    this.base.scale.set(0.8, 0.8, 0.8); // Skalierung um Faktor 10 erhöht
    this.base.position.copy(position);
    this.base.rotation.y = -Math.PI / 2; // Korrekte Ausrichtung

    // Korrekte Namen für die beweglichen Teile
    this.swivel = this.base.getObjectByName('Cannon_2_Mid_Cylinder.236');   // Rotiert horizontal (Yaw)
    this.barrels = this.base.getObjectByName('Cannon_2_Gun_Cylinder.235'); // Neigt sich vertikal (Pitch)
    // this.gun wird nicht mehr für die Bewegung verwendet.

    this.cooldown = 0;
    this.fireRate = 0.4; // Feuert alle 2.5 Sekunden
    this.damage = 100;   // Hoher Direktschaden
    this.splashDamage = 50; // Flächenschaden
    this.splashRadius = 4;  // Radius des Flächenschadens
    this.range = 45;        // Große Reichweite

    this.scene.add(this.base);
  }

  static isReady() {
    return canonModel !== null;
  }

  update(dt, enemies, worldBVH) {
    if (this.cooldown > 0) this.cooldown -= dt;

    const target = this.findTarget(enemies);
    const isShooting = target && this.cooldown <= 0;

    if (target) {
      const targetPos = target.model.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const hasLineOfSight = this.checkLineOfSight(targetPos, worldBVH);

      if (hasLineOfSight) {
        this.aimAt(targetPos);
        if (isShooting) {
          this.shoot(targetPos);
        }
      }
    }
  }

  findTarget(enemies) {
    let target = null;
    let distBest = Infinity;
    for (const e of enemies) {
      if (e.isDying) continue;
      const d = this.base.position.distanceTo(e.model.position);
      if (d < this.range && d < distBest) {
        distBest = d;
        target = e;
      }
    }
    return target;
  }

  checkLineOfSight(targetPos, worldBVH) {
    if (!worldBVH) return true;
    const turretGunPos = new THREE.Vector3();
    this.barrels.getWorldPosition(turretGunPos); // Position von der Mündung aus prüfen
    const dist = turretGunPos.distanceTo(targetPos);

    const losRay = new THREE.Raycaster(turretGunPos, targetPos.clone().sub(turretGunPos).normalize());
    const wallHit = worldBVH.raycastFirst(losRay.ray);

    return !wallHit || wallHit.distance > dist;
  }

  aimAt(targetPos) {
    // Vereinfachte und robustere Ziel-Logik mit lookAt()
    // Das Schwenkteil (horizontal) und der Lauf (vertikal) schauen auf das Ziel.
    this.swivel.lookAt(targetPos);
    this.barrels.lookAt(targetPos);
  }

  shoot(targetPos) {
    const muzzlePos = new THREE.Vector3();
    this.barrels.getWorldPosition(muzzlePos);
    const projectileDir = new THREE.Vector3().subVectors(targetPos, muzzlePos).normalize();
    
    this.callbacks.spawnProjectile({
        pos: muzzlePos,
        dir: projectileDir,
        damage: this.damage,
        speed: 50,
        life: 4.0,
        size: 0.25,
        color: 0xffa500,
        isPlayer: false,
        gravity: true,
        splash: this.splashRadius,
        splashDamage: this.splashDamage
    });

    this.cooldown = 1 / this.fireRate;
  }

  dispose() {
    this.scene.remove(this.base);
  }
}