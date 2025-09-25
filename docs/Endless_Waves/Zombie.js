    import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'GLTFLoader';

let zombieModel = null;
let zombieAnimations = [];
const loader = new GLTFLoader();

loader.load(
  './models/Zombie_kit/Characters/glTF/Zombie_Chubby.gltf',
  (gltf) => {
    zombieModel = gltf.scene;
    zombieAnimations = gltf.animations;
    zombieModel.scale.set(0.8, 0.8, 0.8);
    console.log("Zombie-Modell für die Klasse geladen!");
  },
  undefined,
  (error) => console.error('Fehler beim Laden des Zombie-Modells für die Klasse:', error)
);

export class Zombie {
  constructor(scene, waveConfig, playerPosition, worldBVH) {
    if (!Zombie.isReady()) {
      console.error("Zombie-Modell ist noch nicht geladen!");
      return null;
    }

    this.scene = scene;

    this.model = SkeletonUtils.clone(zombieModel);
    this.model.traverse(node => {
      if (node.isMesh && node.material) {
        node.material = node.material.clone();
      }
    });
    this.model.userData.parentInstance = this;

    this.spawn(playerPosition, worldBVH);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.currentAnimation = null;
    this.setupAnimation(waveConfig.typeDistribution);

    this.hp = (40 + Math.floor(waveConfig.wave * 4)) * waveConfig.hpMultiplier;
    this.hitTint = 0;
    this.headHitTint = 0;
    this.vel = new THREE.Vector3();
    this.isDying = false;
    this.isDead = false;
    this.isInitialized = false;
    this.hitboxes = [];

    this.scene.add(this.model);
  }

  static isReady() {
    return zombieModel !== null && zombieAnimations.length > 0;
  }

  spawn(playerPosition, worldBVH) {
    let spawnFound = false;
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 40 + Math.random() * 30;
      const x = playerPosition.x + Math.cos(angle) * radius;
      const z = playerPosition.z + Math.sin(angle) * radius;

      const groundRay = new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0));
      const groundHit = worldBVH ? worldBVH.raycastFirst(groundRay.ray) : null;

      if (groundHit) {
        this.model.position.set(x, groundHit.point.y, z);
        spawnFound = true;
        break;
      }
    }
    if (!spawnFound) {
      console.warn("Konnte keine gültige Spawn-Position für Zombie finden. Nutze Fallback.");
      const angle = Math.random() * Math.PI * 2;
      const radius = 35 + Math.random() * 20;
      this.model.position.x = playerPosition.x + Math.cos(angle) * radius;
      this.model.position.z = playerPosition.z + Math.sin(angle) * radius;
      this.model.position.y = playerPosition.y - 1.6; // 1.6 = CAMERA_HEIGHT
    }
  }

  setupAnimation(distribution) {
    const runAnims = zombieAnimations.filter(anim => /run/i.test(anim.name));
    const walkAnims = zombieAnimations.filter(anim => /walk/i.test(anim.name));
    const crawlAnims = zombieAnimations.filter(anim => /crawl/i.test(anim.name));

    let animToPlay;
    const rand = Math.random();

    if (rand < distribution.run && runAnims.length > 0) {
      animToPlay = runAnims[Math.floor(Math.random() * runAnims.length)];
      this.speed = 8.0;
    } else if (rand < distribution.run + distribution.crawl && crawlAnims.length > 0) {
      animToPlay = crawlAnims[Math.floor(Math.random() * crawlAnims.length)];
      this.speed = 2.0;
      this.model.position.y += 0.5;
    } else if (walkAnims.length > 0) {
      animToPlay = walkAnims[Math.floor(Math.random() * walkAnims.length)];
      this.speed = 4.0;
    } else {
      animToPlay = zombieAnimations[0];
      this.speed = 1.0;
    }

    if (animToPlay) {
      this.currentAnimation = animToPlay;
      this.mixer.clipAction(animToPlay).play();
    }
  }

  setupHitboxes() {
    const headBone = this.model.getObjectByName('Head');
    const torsoBone = this.model.getObjectByName('Torso');
    if (headBone) {
      const headHitbox = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      headHitbox.userData.isHead = true;
      headHitbox.geometry.computeBoundingSphere();
      headHitbox.userData.parentInstance = this;
      headBone.add(headHitbox);
      this.hitboxes.push(headHitbox);
    }
    if (torsoBone) {
      const bodyHitbox = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      bodyHitbox.position.y = -0.4;
      bodyHitbox.geometry.computeBoundingSphere();
      bodyHitbox.userData.isHead = false;
      bodyHitbox.userData.parentInstance = this;
      torsoBone.add(bodyHitbox);
      this.hitboxes.push(bodyHitbox);
    }
  }

  takeDamage(damage, isHeadshot) {
    this.hp -= damage;
    if (isHeadshot) this.headHitTint = 0.15;
    else this.hitTint = 0.15;

    const hitReactClip = zombieAnimations.find(anim => anim.name === "HitReact");
    if (hitReactClip && this.currentAnimation && !this.isDying) {
      const currentAction = this.mixer.clipAction(this.currentAnimation);
      const hitAction = this.mixer.clipAction(hitReactClip);
      hitAction.reset().setLoop(THREE.LoopOnce).clampWhenFinished = true;
      currentAction.crossFadeTo(hitAction, 0.1, true);
      hitAction.play();
      this.mixer.addEventListener('finished', (e) => {
        if (e.action === hitAction) hitAction.crossFadeTo(currentAction, 0.3, true);
      }, { once: true });
    }
    return this.hp <= 0;
  }

  die() {
    if (this.isDying) return;
    this.isDying = true;
    this.mixer.stopAllAction();
    const deathClip = zombieAnimations.find(anim => anim.name === "Death");
    if (deathClip) {
      const action = this.mixer.clipAction(deathClip);
      action.setLoop(THREE.LoopOnce).clampWhenFinished = true;
      action.play();
    }
  }

  update(dt, playerPosition, worldBVH) {
    if (this.isDying) {
      this.mixer.update(dt);
      return;
    }
    if (!this.isInitialized) {
      this.setupHitboxes();
      this.isInitialized = true;
    }

    this.vel.y -= 9.8 * dt * 2.5;
    this.model.position.y += this.vel.y * dt;

    const groundRayOrigin = this.model.position.clone().add(new THREE.Vector3(0, 2.0, 0));
    const groundRay = new THREE.Raycaster(groundRayOrigin, new THREE.Vector3(0, -1, 0));
    const groundHit = worldBVH ? worldBVH.raycastFirst(groundRay.ray) : null;
    if (groundHit && groundHit.distance < 3.0) {
      this.model.position.y = groundHit.point.y;
      this.vel.y = 0;
    }

    const toPlayer = new THREE.Vector3().subVectors(playerPosition, this.model.position);
    toPlayer.y = 0;
    if (toPlayer.length() > 0.01) {
      toPlayer.normalize();
      this.model.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      const moveVec = toPlayer.multiplyScalar(this.speed * dt);
      const ZOMBIE_RADIUS = 0.4;
      const checkDistance = ZOMBIE_RADIUS + moveVec.length();
      let closestHit = null;
      for (const h of [0.2, 1.0, 1.6]) {
        const origin = this.model.position.clone().add(new THREE.Vector3(0, h, 0));
        const collisionRay = new THREE.Raycaster(origin, toPlayer);
        const wallHit = worldBVH ? worldBVH.raycastFirst(collisionRay.ray) : null;
        if (wallHit && wallHit.distance < checkDistance && (!closestHit || wallHit.distance < closestHit.distance)) {
          closestHit = wallHit;
        }
      }
      if (closestHit) {
        moveVec.sub(closestHit.face.normal.multiplyScalar(moveVec.dot(closestHit.face.normal)));
      }
      this.model.position.add(moveVec);
    }

    if (this.hitTint > 0 || this.headHitTint > 0) {
      this.hitTint -= dt; this.headHitTint -= dt;
      this.model.traverse(node => {
        if (node.isMesh && node.material) {
          if (!node.userData.originalColor) node.userData.originalColor = node.material.color.clone();
          node.material.color.setHex(0xff6b6b);
        }
      });
    } else {
      this.model.traverse(node => {
        if (node.isMesh && node.material && node.userData.originalColor) {
          node.material.color.copy(node.userData.originalColor);
          delete node.userData.originalColor;
        }
      });
    }
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.scene.remove(this.model);
  }
}