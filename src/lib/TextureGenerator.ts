import { CanvasTexture, RepeatWrapping } from 'three';

// Procedurally generate textures for our bread models and environment

export function createNaanTextures(): { map: CanvasTexture; bump: CanvasTexture } {
  // Create color map canvas
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Create bump map canvas
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  // 1. Fill base color (warm tan naan dough)
  ctx.fillStyle = '#ebce96';
  ctx.fillRect(0, 0, 512, 512);

  // Fill base bump (neutral middle gray)
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // 2. Add organic noise/shading
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 20 + Math.random() * 40;

    // Darker bake areas
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(196, 143, 67, 0.4)');
    grad.addColorStop(1, 'rgba(196, 143, 67, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Bump bubbles (puffy areas, light gray in bump map)
    const bGrad = bCtx.createRadialGradient(x, y, 0, x, y, r);
    bGrad.addColorStop(0, 'rgba(170, 170, 170, 0.3)');
    bGrad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  // 3. Add distinctive tandoor char spots (charred bubbles)
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 15;

    // Charred spots (very dark brown/black centers)
    const spotGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    spotGrad.addColorStop(0, 'rgba(54, 27, 8, 0.95)');
    spotGrad.addColorStop(0.5, 'rgba(84, 45, 17, 0.7)');
    spotGrad.addColorStop(1, 'rgba(84, 45, 17, 0)');
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Charred spots are depressed/cratered (dark in bump map)
    const bSpotGrad = bCtx.createRadialGradient(x, y, 0, x, y, r);
    bSpotGrad.addColorStop(0, 'rgba(30, 30, 30, 0.8)');
    bSpotGrad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    bCtx.fillStyle = bSpotGrad;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  // 4. Add flour dust
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    bCtx.fillStyle = 'rgba(150, 150, 150, 0.2)';
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  const mapTexture = new CanvasTexture(canvas);
  const bumpTexture = new CanvasTexture(bumpCanvas);

  return { map: mapTexture, bump: bumpTexture };
}

export function createBaguetteTextures(): { map: CanvasTexture; bump: CanvasTexture } {
  // Create color map canvas (represented horizontally, U goes along length, V goes around circumference)
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Create bump map canvas
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 1024;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;

  // 1. Golden crust background
  ctx.fillStyle = '#b06517';
  ctx.fillRect(0, 0, 1024, 256);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 1024, 256);

  // 2. Add crust highlights/shading
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 256;
    const rx = 50 + Math.random() * 100;
    const ry = 20 + Math.random() * 40;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, rx);
    grad.addColorStop(0, 'rgba(214, 142, 60, 0.45)');
    grad.addColorStop(1, 'rgba(176, 101, 23, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Draw diagonal cuts (Grigne)
  // We'll place 6 diagonal cuts along the length of the baguette
  const cutWidth = 40;
  const numCuts = 7;
  const spacing = 1024 / (numCuts + 1);

  for (let i = 1; i <= numCuts; i++) {
    const centerX = i * spacing;
    
    ctx.save();
    bCtx.save();
    
    // Position of cut (slanted)
    ctx.translate(centerX, 128);
    ctx.rotate(-Math.PI / 6); // 30 degrees tilt

    bCtx.translate(centerX, 128);
    bCtx.rotate(-Math.PI / 6);

    // Inner crumb color (fluffy white/cream)
    const cutGrad = ctx.createLinearGradient(-cutWidth, -80, cutWidth, 80);
    cutGrad.addColorStop(0, '#fbf3db');
    cutGrad.addColorStop(0.5, '#fffefe');
    cutGrad.addColorStop(1, '#fbf3db');

    ctx.fillStyle = cutGrad;
    
    // Draw the main ellipse cut
    ctx.beginPath();
    ctx.ellipse(0, 0, cutWidth, 75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker crust lip around the cut
    ctx.strokeStyle = '#6e3903';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, cutWidth + 2, 77, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bump map: Cuts are deep valleys (dark gray), crust lip is raised (light gray)
    // Draw the valley
    const bCutGrad = bCtx.createRadialGradient(0, 0, 0, 0, 0, 75);
    bCutGrad.addColorStop(0, '#202020'); // deep valley
    bCutGrad.addColorStop(0.8, '#505050');
    bCutGrad.addColorStop(1, '#808080'); // back to crust level
    bCtx.fillStyle = bCutGrad;
    bCtx.beginPath();
    bCtx.ellipse(0, 0, cutWidth, 75, 0, 0, Math.PI * 2);
    bCtx.fill();

    // Draw the raised crust lip in bump map
    bCtx.strokeStyle = '#cccccc'; // raised
    bCtx.lineWidth = 5;
    bCtx.beginPath();
    bCtx.ellipse(0, 0, cutWidth + 3, 78, 0, 0, Math.PI * 2);
    bCtx.stroke();

    ctx.restore();
    bCtx.restore();
  }

  // 4. White flour dusting on top
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 256;
    const r = 2 + Math.random() * 4;

    // Dust only close to center (top of baguette)
    const distFromCenter = Math.abs(y - 128);
    if (distFromCenter < 100) {
      const opacity = (1.0 - distFromCenter / 100) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      bCtx.fillStyle = `rgba(180, 180, 180, ${opacity * 0.3})`;
      bCtx.beginPath();
      bCtx.arc(x, y, r, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  const mapTexture = new CanvasTexture(canvas);
  const bumpTexture = new CanvasTexture(bumpCanvas);

  return { map: mapTexture, bump: bumpTexture };
}

export function createGrassTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Fill grassy green
  ctx.fillStyle = '#659c35';
  ctx.fillRect(0, 0, 256, 256);

  // Procedural noise to represent blades of grass
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const length = 2 + Math.random() * 6;
    const angle = (Math.random() - 0.5) * 0.2;
    
    // Choose varying shades of green
    const colorVal = Math.floor(100 + Math.random() * 60);
    ctx.strokeStyle = `rgb(${Math.floor(colorVal * 0.6)}, ${colorVal}, ${Math.floor(colorVal * 0.3)})`;
    ctx.lineWidth = 1.0;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(angle) * length, y - Math.cos(angle) * length);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, 1); // Can adjust repeat tiling in material definition
  return texture;
}
