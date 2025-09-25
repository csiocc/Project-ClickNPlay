import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let turretModel = null;
const loader = new GLTFLoader();

loader.load(
  './models/Towers/gatling_turret/scene.gltf',
  (gltf) => {
    turretModel = gltf.scene;
    turretModel.traverse(node => {
      if (node.isMesh) node.castShadow = true;
    });
    console.log("✅ Gatling Turret Modell geladen!");
  },
  undefined,
  (error) => console.error('❌ Fehler beim Laden des Turm-Modells:', error)
);

// Hilfsfunktion für Yaw-Interpolation
function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff >  Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

export class Turret {
  constructor(scene, position, state, callbacks) {
    if (!Turret.isReady()) {
      console.error("⚠️ Turret-Modell ist noch nicht geladen!");
      return null;
    }

    this.callbacks = callbacks;
    this.scene = scene;
    this.state = state;

    this.base = SkeletonUtils.clone(turretModel);
    this.base.scale.set(0.12, 0.12, 0.12);
    this.base.position.copy(position);

    this.deployablePart = this.base.getObjectByName('rootgun_00');
    this.swivel = this.base.getObjectByName('turretmid_02');
    this.gun = this.base.getObjectByName('pivot');
    this.barrels = this.base.getObjectByName('rotor');

    if (!this.deployablePart || !this.swivel || !this.gun || !this.barrels) {
      console.error("❌ Fehlende Teile: rootgun_00, turretmid_02, pivot, rotor");
      return null;
    }

    // --- Deploy ---
    this.turretState = 'IDLE';
    this.deployHeight = 1.0;
    this.deployProgress = 0.0;

    this.deployedY = this.deployablePart.position.y;
    this.retractedY = this.deployedY - this.deployHeight;
    this.deployablePart.position.y = this.retractedY; // eingefahren starten

    // --- Zielwinkel ---
    this.targetYaw = 0;
    this.targetPitch = 0;

    // --- Rotor ---
    this.isSpinning = false;
    this.spinSpeed = 0;

    // --- Waffen ---
    this.cooldown = 0;
    this.fireRate = 4.5;
    this.damage = Math.max(4, Math.floor(state.damage * 0.4));
    this.range = 22;

    this.scene.add(this.base);
  }

  static isReady() {
    return turretModel !== null;
  }

  update(dt, enemies, worldBVH) {
    if (this.cooldown > 0) this.cooldown -= dt;

    const target = this.findTarget(enemies);

    // --- State Machine ---
    switch (this.turretState) {
      case 'IDLE':
        if (target) this.turretState = 'DEPLOYING';
        break;

      case 'DEPLOYING':
        this.deployProgress = Math.min(1.0, this.deployProgress + dt * 2.0);
        this.deployablePart.position.y = THREE.MathUtils.lerp(this.retractedY, this.deployedY, this.deployProgress);
        if (this.deployProgress >= 1.0) this.turretState = 'ACTIVE';
        break;

      case 'ACTIVE':
        if (!target) {
          this.turretState = 'RETRACTING';
        } else {
          const targetPos = target.model.position.clone().add(new THREE.Vector3(0, 0.8, 0));
          const hasLineOfSight = this.checkLineOfSight(targetPos, worldBVH);
          const isShooting = hasLineOfSight && this.cooldown <= 0;

          if (hasLineOfSight) {
            this.aimAt(targetPos);
            if (isShooting) this.shoot(targetPos);
          }
          this.isSpinning = isShooting;
        }
        break;

      case 'RETRACTING':
        this.deployProgress = Math.max(0.0, this.deployProgress - dt * 2.0);
        this.deployablePart.position.y = THREE.MathUtils.lerp(this.retractedY, this.deployedY, this.deployProgress);
        if (this.deployProgress <= 0.0) this.turretState = 'IDLE';
        if (target) this.turretState = 'DEPLOYING';
        break;
    }

    // --- Smooth Yaw (Z-Achse) ---
    const yawNow = this.swivel.rotation.z;
    this.swivel.rotation.z = lerpAngle(yawNow, this.targetYaw, dt * 5);

    // --- Smooth Pitch (Y-Achse) ---
    const pitchNow = this.gun.rotation.y;
    this.gun.rotation.y = THREE.MathUtils.lerp(pitchNow, this.targetPitch, dt * 5);

    // --- Rotor Spin (X-Achse) ---
    if (this.isSpinning) {
      this.spinSpeed = Math.min(30.0, this.spinSpeed + 80 * dt);
    } else {
      this.spinSpeed = Math.max(0.0, this.spinSpeed - 40 * dt);
    }
    if (this.spinSpeed > 0) {
      this.barrels.rotation.x += this.spinSpeed * dt;
    }
  }

  findTarget(enemies) {
    if (this.turretState === 'RETRACTING') return null;
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
    this.gun.getWorldPosition(turretGunPos);
    const dist = turretGunPos.distanceTo(targetPos);

    const losRay = new THREE.Raycaster(turretGunPos, targetPos.clone().sub(turretGunPos).normalize());
    const wallHit = worldBVH.raycastFirst(losRay.ray);

    return !wallHit || wallHit.distance > dist;
  }

  aimAt(targetPos) {
    // --- YAW (Swivel um Z) ---
    const swivelWorldPos = new THREE.Vector3();
    this.swivel.getWorldPosition(swivelWorldPos);

    const dx = targetPos.x - swivelWorldPos.x;
    const dy = targetPos.y - swivelWorldPos.y;
    this.targetYaw = Math.atan2(dx, dy);

    // --- PITCH (Gun um Y) ---
    const localTarget = this.gun.parent.worldToLocal(targetPos.clone());
    const dirLocal = new THREE.Vector3().subVectors(localTarget, this.gun.position).normalize();
    this.targetPitch = Math.atan2(dirLocal.z, dirLocal.x);
  }

  shoot(targetPos) {
    const muzzlePos = new THREE.Vector3();
    if (this.barrels.children.length > 0) {
      this.barrels.children[0].getWorldPosition(muzzlePos);
    } else {
      this.barrels.getWorldPosition(muzzlePos);
    }

    const projectileDir = new THREE.Vector3().subVectors(targetPos, muzzlePos).normalize();
    this.callbacks.spawnProjectile({
      pos: muzzlePos,
      dir: projectileDir,
      damage: this.damage,
      isPlayer: false
    });

    const light = new THREE.PointLight(0xfff0a3, 3, 4);
    light.position.copy(muzzlePos);
    this.scene.add(light);
    setTimeout(() => this.scene.remove(light), 60);

    this.cooldown = 1 / this.fireRate;
  }

  dispose() {
    this.scene.remove(this.base);
  }
}
