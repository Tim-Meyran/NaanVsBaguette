import * as THREE from 'three';
import { type FlightState, type WindState } from './Physics';
import { createNaanTextures, createBaguetteTextures, createGrassTexture } from './TextureGenerator';
import { audioManager } from './AudioManager';

export class SimulationScene {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  
  // Scene elements
  private sunLight!: THREE.DirectionalLight;
  private groundPlane!: THREE.Mesh;
  private clouds: THREE.Mesh[] = [];
  private signposts: THREE.Group[] = [];
  
  // Projectile representation
  private projectileGroup!: THREE.Group;
  private naanMesh!: THREE.Mesh;
  private baguetteMesh!: THREE.Group;
  private trailLine!: THREE.Line;
  private trailGeometry!: THREE.BufferGeometry;
  
  // Trajectory prediction representation
  private predictionLine!: THREE.Line;
  private predictionGeometry!: THREE.BufferGeometry;

  // Particle systems
  private windParticles!: THREE.Points;
  private windParticleCount = 120;
  private crumbParticles: THREE.Points[] = [];
  
  // Gameplay parameters
  private currentType: 'naan' | 'baguette' = 'naan';
  private cameraMode: 'follow' | 'side' | 'orbit' = 'follow';

  constructor(container: HTMLElement, canvas: HTMLCanvasElement) {
    this.container = container;
    this.canvas = canvas;
    this.init();
  }

  private init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a8dbfc'); // Beautiful sky blue
    this.scene.fog = new THREE.FogExp2('#a8dbfc', 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 3, -6);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.45);
    this.scene.add(ambientLight);

    // Sun directional light
    this.sunLight = new THREE.DirectionalLight('#fff5e6', 1.0);
    this.sunLight.position.set(40, 60, -30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 250;
    
    const d = 30;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    
    this.scene.add(this.sunLight);

    // Subtle sky light (hemisphere light)
    const hemiLight = new THREE.HemisphereLight('#a8dbfc', '#659c35', 0.35);
    this.scene.add(hemiLight);

    // 5. Environment
    this.createEnvironment();

    // 6. Projectiles
    this.projectileGroup = new THREE.Group();
    this.scene.add(this.projectileGroup);

    this.naanMesh = this.createNaanMesh();
    this.baguetteMesh = this.createBaguetteMesh();

    // Add trail line
    const maxTrailPoints = 300;
    const trailPositions = new Float32Array(maxTrailPoints * 3);
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    
    // Stylized dotted/glowing trail material
    const trailMaterial = new THREE.LineBasicMaterial({
      color: '#ffffff',
      linewidth: 3,
      transparent: true,
      opacity: 0.6
    });
    this.trailLine = new THREE.Line(this.trailGeometry, trailMaterial);
    this.scene.add(this.trailLine);

    // Add prediction line (dashed)
    const maxPredPoints = 120;
    const predPositions = new Float32Array(maxPredPoints * 3);
    this.predictionGeometry = new THREE.BufferGeometry();
    this.predictionGeometry.setAttribute('position', new THREE.BufferAttribute(predPositions, 3));
    
    const predMaterial = new THREE.LineBasicMaterial({
      color: '#00ffcc', // bright neon cyan
      linewidth: 3,     // keeps it clean, fallback is 1px
      transparent: false,
      depthTest: false, // always render on top!
      depthWrite: false
    });
    this.predictionLine = new THREE.Line(this.predictionGeometry, predMaterial);
    this.predictionLine.renderOrder = 999; // draw last on top
    this.predictionLine.visible = false;
    this.scene.add(this.predictionLine);

    // 7. Wind Particles
    this.createWindParticles();

    // 8. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private createEnvironment() {
    // Ground
    const groundGeom = new THREE.PlaneGeometry(100, 1000);
    const grassTex = createGrassTexture();
    grassTex.repeat.set(16, 160); // Tiles grass
    
    const groundMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.9,
      metalness: 0.05
    });
    this.groundPlane = new THREE.Mesh(groundGeom, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    // Shift ground forward so the runway is ahead (extends from 0 to 500m)
    this.groundPlane.position.z = 250;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    // Create clouds
    const cloudGeom = new THREE.DodecahedronGeometry(3, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.9,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 15; i++) {
      const cloud = new THREE.Mesh(cloudGeom, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 80,
        15 + Math.random() * 10,
        Math.random() * 400
      );
      const scale = 0.5 + Math.random() * 1.5;
      cloud.scale.set(scale, scale * 0.6, scale * 1.2);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }

    // Add milestone signposts
    const milestones = [
      { dist: 10, text: '🥖 Lehrlings-Wurf' },
      { dist: 25, text: '🧀 Picknick-Zone' },
      { dist: 50, text: '🇮🇳 Tandoor-Thermik' },
      { dist: 75, text: '🇫🇷 Paris grüßt!' },
      { dist: 100, text: '🚀 Interkontinental' },
      { dist: 150, text: '🌌 Stratosphäre' },
      { dist: 200, text: '🌙 Zum Mond!' }
    ];

    milestones.forEach(m => {
      // Flat high-contrast ground markings across the runway
      const marking = this.createGroundMarking(m.dist, `${m.dist} m`);
      this.scene.add(marking);
      this.signposts.push(marking); // reuse array for cleanup
    });
  }

  private createGroundMarking(distance: number, text: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // Transparent background
    ctx.clearRect(0, 0, 512, 128);
    
    // Draw a thick white line across the middle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(10, 64);
    ctx.lineTo(502, 64);
    ctx.stroke();
    
    // Draw a clean dark backing pill for the text to make it extremely readable
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.beginPath();
    ctx.roundRect(176, 24, 160, 80, 20);
    ctx.fill();
    
    // Draw text in the middle
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Segoe UI", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    const geom = new THREE.PlaneGeometry(8, 2); // 8m wide, 2m deep
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false, // prevents alpha clipping issues
      polygonOffset: true, // prevents z-fighting
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.PI; // rotate 180 deg so it reads left-to-right from player view
    mesh.position.set(0, 0.015, distance); // slightly raised above ground
    return mesh;
  }

  private createNaanMesh(): THREE.Mesh {
    const geom = new THREE.CylinderGeometry(0.16, 0.16, 0.015, 32, 2);
    
    // Deform cylinder to make it organic and "bumpy" (naan bread bubbles)
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      
      const dist = Math.sqrt(x * x + z * z);
      if (dist > 0.05) { // don't deform center heavily
        const angle = Math.atan2(z, x);
        const deform = 1.0 + Math.sin(angle * 5) * 0.08 + Math.cos(angle * 3) * 0.04;
        pos.setX(i, x * deform);
        pos.setZ(i, z * deform);
      }
      
      // Bubbles height bump
      const bubble = Math.sin(x * 20) * Math.cos(z * 20) * 0.0035;
      pos.setY(i, y + bubble);
    }
    geom.computeVertexNormals();

    const textures = createNaanTextures();
    const mat = new THREE.MeshStandardMaterial({
      map: textures.map,
      bumpMap: textures.bump,
      bumpScale: 0.005,
      roughness: 0.85,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createBaguetteMesh(): THREE.Group {
    const group = new THREE.Group();

    // Height is length along baguette axis (0.65m), radius 0.032m
    const geom = new THREE.CylinderGeometry(0.03, 0.03, 0.65, 16, 12);
    
    // Taper tips & bend
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // lengthwise coordinate
      const z = pos.getZ(i);
      
      const distRatio = Math.abs(y) / 0.325; // 0 to 1
      
      let taper = 1.0;
      if (distRatio > 0.65) {
        // smooth tapering at tips
        taper = Math.cos(((distRatio - 0.65) / 0.35) * (Math.PI / 2.2));
      }
      
      // Add slight curved bend along length
      const bendX = Math.sin(((y + 0.325) / 0.65) * Math.PI) * 0.012;
      
      pos.setX(i, x * taper + bendX);
      pos.setZ(i, z * taper);
    }
    geom.computeVertexNormals();

    const textures = createBaguetteTextures();
    const mat = new THREE.MeshStandardMaterial({
      map: textures.map,
      bumpMap: textures.bump,
      bumpScale: 0.006,
      roughness: 0.9,
      metalness: 0.05
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // In CylinderGeometry, the height axis is Y.
    // We want the baguette's long axis to point forward (along Z).
    // So we rotate the mesh inside the group.
    mesh.rotation.x = Math.PI / 2;
    
    group.add(mesh);
    return group;
  }

  private createWindParticles() {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.windParticleCount * 3);
    const speeds = new Float32Array(this.windParticleCount);

    for (let i = 0; i < this.windParticleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;    // width X
      positions[i * 3 + 1] = Math.random() * 12;         // height Y
      positions[i * 3 + 2] = Math.random() * 200;        // depth Z
      speeds[i] = 10 + Math.random() * 15;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

    // Semi-transparent wind lines/points
    const mat = new THREE.PointsMaterial({
      color: '#e0f4ff',
      size: 0.12,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });

    this.windParticles = new THREE.Points(geom, mat);
    this.scene.add(this.windParticles);
  }

  private createCrumbExplosion(pos: THREE.Vector3, type: 'naan' | 'baguette') {
    const particleCount = type === 'naan' ? 40 : 60;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Start at impact position
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      // Random speed vector exploding outwards & upwards
      const theta = Math.random() * Math.PI * 2;
      const speedXZ = 1.0 + Math.random() * 3.5;
      const speedY = 1.5 + Math.random() * 4.0;

      velocities.push(new THREE.Vector3(
        Math.cos(theta) * speedXZ,
        speedY,
        Math.sin(theta) * speedXZ
      ));
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Crumb material (different colors based on bread type)
    const crumbColor = type === 'naan' ? '#e2c48e' : '#c68d4a';
    const mat = new THREE.PointsMaterial({
      color: crumbColor,
      size: type === 'naan' ? 0.08 : 0.06,
      transparent: true,
      opacity: 0.9
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.crumbParticles.push(points);

    // Animate particles down with gravity
    const startTime = performance.now();
    const gravity = 9.81;

    const animateParticles = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed > 1.2) {
        // Cleanup
        this.scene.remove(points);
        points.geometry.dispose();
        (points.material as THREE.Material).dispose();
        this.crumbParticles = this.crumbParticles.filter(p => p !== points);
        return;
      }

      const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const vel = velocities[i];
        
        // Update positions with gravity
        const dx = vel.x * elapsed;
        const dy = vel.y * elapsed - 0.5 * gravity * elapsed * elapsed;
        const dz = vel.z * elapsed;

        // Clip to ground
        const newY = Math.max(0, pos.y + dy);

        posAttr.setX(i, pos.x + dx);
        posAttr.setY(i, newY);
        posAttr.setZ(i, pos.z + dz);
      }
      posAttr.needsUpdate = true;
      requestAnimationFrame(animateParticles);
    };

    animateParticles();
  }

  // --- Public API for state management ---

  public setWeaponType(type: 'naan' | 'baguette') {
    this.currentType = type;
    this.projectileGroup.clear();

    if (type === 'naan') {
      this.projectileGroup.add(this.naanMesh);
    } else {
      this.projectileGroup.add(this.baguetteMesh);
    }

    // Reset trail
    this.clearTrail();
    this.resetCamera();
  }

  public setCameraMode(mode: 'follow' | 'side' | 'orbit') {
    this.cameraMode = mode;
  }

  public clearTrail() {
    const positionAttr = this.trailLine.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positionAttr.count; i++) {
      positionAttr.setXYZ(i, 0, 0, 0);
    }
    positionAttr.needsUpdate = true;
    this.trailLine.visible = false;
  }

  public updateTrail(trail: FlightState['trail']) {
    this.trailLine.visible = true;
    const positionAttr = this.trailLine.geometry.attributes.position as THREE.BufferAttribute;
    const maxPoints = positionAttr.count;

    // Fill points up to maxPoints
    for (let i = 0; i < maxPoints; i++) {
      if (i < trail.length) {
        const p = trail[i];
        positionAttr.setXYZ(i, p.x, p.y, p.z);
      } else if (trail.length > 0) {
        // Clamp remaining points to last active point
        const last = trail[trail.length - 1];
        positionAttr.setXYZ(i, last.x, last.y, last.z);
      }
    }
    positionAttr.needsUpdate = true;
  }

  public showPrediction(points: FlightState['trail']) {
    this.predictionLine.visible = true;
    const positionAttr = this.predictionLine.geometry.attributes.position as THREE.BufferAttribute;
    const maxPoints = positionAttr.count;

    for (let i = 0; i < maxPoints; i++) {
      if (i < points.length) {
        const p = points[i];
        positionAttr.setXYZ(i, p.x, p.y, p.z);
      } else if (points.length > 0) {
        // Clamp remaining points to last active point
        const last = points[points.length - 1];
        positionAttr.setXYZ(i, last.x, last.y, last.z);
      }
    }
    positionAttr.needsUpdate = true;
    this.predictionLine.computeLineDistances();
  }

  public hidePrediction() {
    this.predictionLine.visible = false;
  }

  public resetCamera() {
    this.cameraMode = 'follow';
    this.camera.position.set(0, 3, -6);
    this.camera.lookAt(new THREE.Vector3(0, 1.5, 5));
    // Reset projectile visuals
    this.projectileGroup.position.set(0, 1.5, 0);
    if (this.currentType === 'naan') {
      this.projectileGroup.rotation.set(0, 0, 0);
    } else {
      this.projectileGroup.rotation.set(0, 0, 0);
    }
  }

  public updateScene(
    state: FlightState,
    wind: WindState,
    dt: number
  ) {
    // 1. Update clouds movement
    this.clouds.forEach((cloud, idx) => {
      // Wind speed affects clouds
      cloud.position.z += (wind.z * 0.1 - 0.2) * dt * 5;
      cloud.position.x += wind.x * 0.1 * dt * 5;
      
      // Wrap clouds around
      if (cloud.position.z < -50) cloud.position.z = 450;
      if (cloud.position.z > 450) cloud.position.z = -50;
      if (cloud.position.x < -60) cloud.position.x = 60;
      if (cloud.position.x > 60) cloud.position.x = -60;
    });

    // 2. Update wind particles
    const windPosAttr = this.windParticles.geometry.attributes.position as THREE.BufferAttribute;
    const windSpeedAttr = this.windParticles.geometry.attributes.speed as THREE.BufferAttribute;
    const particleCount = windPosAttr.count;

    for (let i = 0; i < particleCount; i++) {
      let x = windPosAttr.getX(i);
      let y = windPosAttr.getY(i);
      let z = windPosAttr.getZ(i);
      const speed = windSpeedAttr.getX(i);

      // Move particle along wind direction
      z += (speed + wind.z) * dt;
      x += wind.x * dt;

      // Wrap around wind particles to stay around camera
      const centerZ = state.isActive ? state.position.z : this.camera.position.z;
      if (z > centerZ + 100) {
        z = centerZ - 50;
        x = (Math.random() - 0.5) * 30 + this.camera.position.x;
        y = Math.random() * 15;
      } else if (z < centerZ - 50) {
        z = centerZ + 100;
        x = (Math.random() - 0.5) * 30 + this.camera.position.x;
        y = Math.random() * 15;
      }

      windPosAttr.setXYZ(i, x, y, z);
    }
    windPosAttr.needsUpdate = true;

    // 3. Update projectile position and rotation
    this.projectileGroup.position.set(state.position.x, state.position.y, state.position.z);
    
    // Set rot based on physics state
    if (this.currentType === 'naan') {
      this.projectileGroup.rotation.set(-state.rotation.x, state.rotation.y, state.rotation.z);
    } else {
      // Baguette parent rotation
      this.projectileGroup.rotation.set(-state.rotation.x, state.rotation.y, state.rotation.z);
    }

    // Update shadow camera frustum position to follow projectile (optimizes shadow map quality)
    this.sunLight.position.set(
      state.position.x + 40,
      state.position.y + 60,
      state.position.z - 30
    );
    this.sunLight.target = this.projectileGroup;

    // 4. Trail update
    if (state.isActive) {
      this.updateTrail(state.trail);
    }

    // 5. Impact handling
    if (!state.isActive && state.isStuck && this.trailLine.visible) {
      // Just hit the ground!
      audioManager.playHit(this.currentType);
      this.createCrumbExplosion(
        new THREE.Vector3(state.position.x, state.position.y, state.position.z),
        this.currentType
      );
      // Disable trail updates so crumbs explosion doesn't loop
      this.trailLine.visible = false;
    }

    // 6. Camera logic
    const projPos = this.projectileGroup.position;
    
    if (state.isActive) {
      if (this.cameraMode === 'follow') {
        // Follow closely behind the bread, always aligned straight down the Z runway
        const followDist = this.currentType === 'naan' ? 4.5 : 3.5;
        const followHeight = this.currentType === 'naan' ? 1.4 : 1.0;
        
        // Position camera directly behind the projectile along the Z axis
        const targetCamX = projPos.x;
        const targetCamY = projPos.y + followHeight;
        const targetCamZ = projPos.z - followDist;

        // Smooth camera translation
        this.camera.position.x += (targetCamX - this.camera.position.x) * 0.12;
        this.camera.position.y += (targetCamY - this.camera.position.y) * 0.12;
        this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.12;

        // Look straight forward along the Z axis (pointing directly down the throwing track)
        const lookTarget = new THREE.Vector3(
          this.camera.position.x, // Keep line of sight parallel to Z axis
          projPos.y + 0.1,
          projPos.z + 5.0
        );
        this.camera.lookAt(lookTarget);
      } else if (this.cameraMode === 'side') {
        // Side view tracking
        this.camera.position.set(projPos.x - 7, projPos.y + 2, projPos.z);
        this.camera.lookAt(projPos);
      }
    } else if (state.isStuck) {
      // Landed state camera: stay directly behind and look straight down the Z runway
      const followDist = this.currentType === 'naan' ? 4.5 : 3.5;
      const followHeight = this.currentType === 'naan' ? 1.4 : 1.0;

      const targetCamX = projPos.x;
      const targetCamY = projPos.y + followHeight;
      const targetCamZ = projPos.z - followDist;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.08;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 0.08;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.08;
      
      const lookTarget = new THREE.Vector3(
        this.camera.position.x, // Keep line of sight parallel to Z axis
        projPos.y + 0.1,
        projPos.z + 5.0
      );
      this.camera.lookAt(lookTarget);
    } else {
      // Menu / Aiming phase: nice fixed preview camera, showing the bread hovering on the launchpad.
      this.camera.position.set(0, 2.3, -4.5);
      this.camera.lookAt(new THREE.Vector3(0, 1.6, 3));
    }

    // 7. Render
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  public dispose() {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.dispose();
    
    // Dispose materials and geometries
    this.naanMesh.geometry.dispose();
    (this.naanMesh.material as THREE.Material).dispose();
    
    this.baguetteMesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });

    this.groundPlane.geometry.dispose();
    (this.groundPlane.material as THREE.Material).dispose();

    this.clouds.forEach(cloud => {
      cloud.geometry.dispose();
      (cloud.material as THREE.Material).dispose();
    });

    this.signposts.forEach(sign => {
      sign.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
    });

    this.trailLine.geometry.dispose();
    (this.trailLine.material as THREE.Material).dispose();

    this.predictionLine.geometry.dispose();
    (this.predictionLine.material as THREE.Material).dispose();

    this.windParticles.geometry.dispose();
    (this.windParticles.material as THREE.Material).dispose();
  }
}
