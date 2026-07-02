<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Play } from 'lucide-svelte';
  
  import { 
    type FlightState, 
    type WindState, 
    createInitialState, 
    updateFlightStep,
    getPredictedTrajectory
  } from './lib/Physics';
  
  import { SimulationScene } from './lib/SimulationScene';
  import { audioManager } from './lib/AudioManager';
  
  // Custom Svelte Overlays
  import LaunchOverlay from './lib/LaunchOverlay.svelte';
  import StatsOverlay from './lib/StatsOverlay.svelte';
  import ResultsOverlay from './lib/ResultsOverlay.svelte';

  // Game Phases: 'menu' | 'aim' | 'flight' | 'results'
  let phase = $state<'menu' | 'aim' | 'flight' | 'results'>('menu');
  let weaponType = $state<'naan' | 'baguette'>('naan');
  
  // Highscores state (retained in LocalStorage)
  let highscores = $state({ naan: 0, baguette: 0 });
  
  // Dynamic wind speed (randomized for each attempt)
  let wind = $state<WindState>({ x: 0, y: 0, z: 0 });
  
  // Real-time flight tracking
  let flightState = $state<FlightState | null>(null);
  
  // Mute configurations
  let isMuted = $state(false);

  // Difficulty configurations (easy = no wind, medium = low wind, hard = high wind)
  let difficulty = $state<'easy' | 'medium' | 'hard'>('medium');

  // Milestone toasts tracking
  let crossedMilestone = $state<{ dist: number, text: string } | null>(null);
  let notifiedMilestones = new Set<number>();

  // HTML Element bindings for WebGL
  let containerEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let simScene = $state<SimulationScene | null>(null);
  
  // Render and simulation loop control
  let animationFrameId = 0;
  let lastTime = 0;
  let idleSpinAngle = 0;

  // Aiming parameters passed from LaunchOverlay
  let aimingParams = $state<{ angle: number; speed: number; spin: number; sideAngle: number } | null>(null);

  // Sync aiming prediction line in ThreeJS scene
  $effect(() => {
    console.log("Trajectory effect. simScene ready:", !!simScene, "aimingParams:", aimingParams);
    if (simScene) {
      if (aimingParams) {
        const traj = getPredictedTrajectory(
          aimingParams.angle,
          aimingParams.speed,
          1.75, // launch height matching preview
          aimingParams.spin,
          aimingParams.sideAngle,
          weaponType,
          wind
        );
        console.log("Calculated predicted trajectory points:", traj.length);
        simScene.showPrediction(traj);
      } else {
        console.log("Hiding prediction line");
        simScene.hidePrediction();
      }
    }
  });

  onMount(() => {
    // 1. Load highscores from local storage
    const savedScores = localStorage.getItem('naan_vs_baguette_scores');
    if (savedScores) {
      try {
        highscores = JSON.parse(savedScores);
      } catch (e) {
        console.error('Failed to parse highscores', e);
      }
    }

    // 2. Load mute preferences
    const savedMute = localStorage.getItem('naan_vs_baguette_muted');
    if (savedMute) {
      isMuted = savedMute === 'true';
      audioManager.setMute(isMuted);
    }

    // 3. Initialize Three.js scene
    if (containerEl && canvasEl) {
      simScene = new SimulationScene(containerEl, canvasEl);
      simScene.setWeaponType(weaponType);
    }

    // 4. Start Render/Logic Tick Loop
    lastTime = performance.now();
    tickLoop(lastTime);
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (simScene) {
      simScene.dispose();
    }
  });

  // --- Main Tick Loop ---
  function tickLoop(currentTime: number) {
    animationFrameId = requestAnimationFrame(tickLoop);

    let dt = (currentTime - lastTime) / 1000;
    // Cap dt to prevent massive jumps when switching tabs
    if (dt > 0.1) dt = 0.1;
    lastTime = currentTime;

    if (!simScene) return;

    if (phase === 'flight' && flightState && flightState.isActive) {
      // Run physical updates
      flightState = updateFlightStep(flightState, dt, weaponType, wind);
      
      // Check in-flight milestones
      const currentZ = flightState.position.z;
      const milestones = [
        { dist: 10, text: '🥖 Lehrlings-Wurf' },
        { dist: 25, text: '🧀 Picknick-Zone' },
        { dist: 50, text: '🇮🇳 Tandoor-Thermik' },
        { dist: 75, text: '🇫🇷 Paris grüßt!' },
        { dist: 100, text: '🚀 Interkontinental' },
        { dist: 150, text: '🌌 Stratosphäre' },
        { dist: 200, text: '🌙 Zum Mond!' }
      ];
      for (const m of milestones) {
        if (currentZ >= m.dist && !notifiedMilestones.has(m.dist)) {
          notifiedMilestones.add(m.dist);
          crossedMilestone = m;
          
          // Play a small celebratory sound
          audioManager.playSuccess();
          
          // Clear toast after 2.5 seconds
          setTimeout(() => {
            if (crossedMilestone === m) {
              crossedMilestone = null;
            }
          }, 2500);
          break;
        }
      }

      // Update Three.js scene models, cameras, shadows
      simScene.updateScene(flightState, wind, dt);
      
      // Update flight audio (speed whoosh pitching)
      const speed = Math.sqrt(
        flightState.velocity.x ** 2 +
        flightState.velocity.y ** 2 +
        flightState.velocity.z ** 2
      );
      audioManager.updateFlightLoop(speed, flightState.maxSpeed);

      // Check if flight just terminated (hit ground)
      if (!flightState.isActive) {
        handleFlightEnd();
      }
    } else {
      // Idle loop (Menu, Aim, and Results phases)
      // Determine spin to use for visual rotation
      let spinVal = 0.5; // default slow rotation in menu/results
      if (phase === 'aim' && aimingParams) {
        spinVal = aimingParams.spin;
      }

      // Accumulate angle based on selected spin RPS
      const spinSpeedRad = -spinVal * 2 * Math.PI * 0.5; // match wagon-wheel visual multiplier and invert for clockwise
      idleSpinAngle += spinSpeedRad * dt;

      const idleState: FlightState = flightState || {
        position: { x: 0, y: 1.75, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: idleSpinAngle, z: 0 },
        spin: spinVal * 2 * Math.PI,
        isActive: false,
        isStuck: false,
        distance: 0,
        maxHeight: 1.75,
        maxSpeed: 0,
        time: currentTime * 0.001,
        trail: []
      };

      // Add a slight hover effect to the weapon on the launch platform in Menu/Aim phases
      if (phase === 'menu' || phase === 'aim') {
        idleState.position.y = 1.75 + Math.sin(currentTime * 0.003) * 0.05;
        
        if (phase === 'aim' && aimingParams) {
          // Align preview bread orientation in real-time with sliders!
          idleState.rotation.x = aimingParams.angle * Math.PI / 180;
          idleState.rotation.y = (-aimingParams.sideAngle * Math.PI / 180) + idleSpinAngle;
          idleState.rotation.z = 0;
        } else {
          // Menu preview simple rotation
          if (weaponType === 'naan') {
            idleState.rotation.x = 0;
            idleState.rotation.z = 0;
            idleState.rotation.y = idleSpinAngle;
          } else {
            idleState.rotation.x = 0.1;
            idleState.rotation.z = idleSpinAngle * 0.5;
            idleState.rotation.y = 0.5;
          }
        }
      }

      simScene.updateScene(idleState, wind, dt);
    }
  }

  // --- Game State Handlers ---

  function selectWeapon(type: 'naan' | 'baguette') {
    weaponType = type;
    audioManager.playClick();
    if (simScene) {
      simScene.setWeaponType(type);
    }
  }

  function startAimingPhase() {
    audioManager.playClick();
    
    // Reset flight states so previous landing coordinates do not leak into preview
    flightState = null;
    aimingParams = null;
    
    // Generate randomized wind vector based on difficulty
    if (difficulty === 'easy') {
      wind = { x: 0, y: 0, z: 0 };
    } else if (difficulty === 'medium') {
      wind = {
        x: (Math.random() - 0.5) * 3, // -1.5 to +1.5 m/s side drift (~5.4 km/h)
        y: 0,
        z: (Math.random() - 0.5) * 8  // -4 to +4 m/s headwind/tailwind (~14.4 km/h)
      };
    } else { // hard
      wind = {
        x: (Math.random() - 0.5) * 8, // -4 to +4 m/s side drift (~14.4 km/h)
        y: 0,
        z: (Math.random() - 0.5) * 20 // -10 to +10 m/s headwind/tailwind (~36 km/h)
      };
    }

    phase = 'aim';
    if (simScene) {
      simScene.resetCamera();
      simScene.clearTrail();
      simScene.hidePrediction();
    }
  }

  function handleLaunch(params: { angle: number; speed: number; spin: number; sideAngle: number }) {
    notifiedMilestones.clear();
    crossedMilestone = null;

    // Generate initial state from overlay parameters
    flightState = createInitialState(
      params.angle,
      params.speed,
      1.75, // launch height matching preview
      params.spin,
      params.sideAngle
    );

    phase = 'flight';
    audioManager.startFlightLoop(weaponType);
  }

  function handleFlightEnd() {
    if (!flightState) return;

    audioManager.stopFlightLoop();

    const distance = parseFloat(flightState.distance.toFixed(1));
    const previousBest = weaponType === 'naan' ? highscores.naan : highscores.baguette;

    // Check if new personal record achieved
    if (distance > previousBest) {
      if (weaponType === 'naan') {
        highscores.naan = distance;
      } else {
        highscores.baguette = distance;
      }
      
      // Save updated records
      localStorage.setItem('naan_vs_baguette_scores', JSON.stringify(highscores));
      
      // Play celebratory fanfare
      setTimeout(() => {
        audioManager.playSuccess();
      }, 700);
    }

    phase = 'results';
  }

  function resetToAim() {
    startAimingPhase();
  }

  function returnToMenu() {
    audioManager.playClick();
    flightState = null;
    aimingParams = null;
    phase = 'menu';
    if (simScene) {
      simScene.resetCamera();
      simScene.clearTrail();
      simScene.hidePrediction();
    }
  }

  function toggleMute() {
    isMuted = audioManager.toggleMute();
    localStorage.setItem('naan_vs_baguette_muted', isMuted.toString());
  }
</script>

<main id="app">
  <!-- ThreeJS Viewport -->
  <div class="viewport-container" bind:this={containerEl}>
    <canvas class="webgl-canvas" bind:this={canvasEl}></canvas>
  </div>

  <!-- Svelte Overlays -->
  <div class="ui-overlay-container">
    
    <!-- 1. Menu Screen Overlay -->
    {#if phase === 'menu'}
      <div class="menu-screen">
        <div class="game-title-container">
          <h1 class="game-logo">
            <span class="logo-naan">Naan</span>
            <span class="logo-vs">vs.</span>
            <span class="logo-baguette">Baguette</span>
          </h1>
          <p class="game-subtitle">Das ultimative Backwaren-Flugduell</p>
        </div>

        <!-- Highscore Billboard -->
        <div class="highscore-banner">
          <span>🫓 Naan Rekord: <strong>{highscores.naan}m</strong></span>
          <span>🥖 Baguette Rekord: <strong>{highscores.baguette}m</strong></span>
        </div>

        <!-- Weapon selector -->
        <div class="weapon-selection">
          <!-- Naan Frisbee card -->
          <div 
            class="weapon-card naan" 
            class:selected={weaponType === 'naan'}
            onclick={() => selectWeapon('naan')}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && selectWeapon('naan')}
          >
            <div class="weapon-emoji">🫓</div>
            <h2 class="weapon-name">Naan Brot</h2>
            <p class="weapon-desc">Als Frisbee geworfen. Erzeugt aerodynamischen Auftrieb durch Drehung. Segelt flach!</p>
          </div>

          <!-- Baguette spear card -->
          <div 
            class="weapon-card baguette" 
            class:selected={weaponType === 'baguette'}
            onclick={() => selectWeapon('baguette')}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && selectWeapon('baguette')}
          >
            <div class="weapon-emoji">🥖</div>
            <h2 class="weapon-name">Baguette</h2>
            <p class="weapon-desc">Als Wurfspeer eingesetzt. Aerodynamisch, schwer, ballistisch. Holt mächtig Schwung!</p>
          </div>
        </div>

        <!-- Difficulty selector -->
        <div class="difficulty-section">
          <span class="difficulty-label">Wind-Schwierigkeit:</span>
          <div class="difficulty-options">
            <button 
              class="diff-btn easy" 
              class:active={difficulty === 'easy'} 
              onclick={() => { audioManager.playClick(); difficulty = 'easy'; }}
            >
              🟢 Leicht
            </button>
            <button 
              class="diff-btn medium" 
              class:active={difficulty === 'medium'} 
              onclick={() => { audioManager.playClick(); difficulty = 'medium'; }}
            >
              🟡 Mittel
            </button>
            <button 
              class="diff-btn hard" 
              class:active={difficulty === 'hard'} 
              onclick={() => { audioManager.playClick(); difficulty = 'hard'; }}
            >
              🔴 Schwer
            </button>
          </div>
        </div>
 
        <!-- Play Trigger -->
        <button class="play-btn" onclick={startAimingPhase}>
          <Play class="icon" fill="white" /> Bereitmachen!
        </button>

        <footer class="credits-footer">
          Entwickelt mit Svelte 5 & Three.js • Mobile-First Physik-Spiel
        </footer>
      </div>
    {/if}

    <!-- 2. Aiming & Launch Overlay -->
    {#if phase === 'aim'}
      <LaunchOverlay 
        {weaponType} 
        {wind} 
        onLaunch={handleLaunch} 
        onAiming={(params) => aimingParams = params}
      />
    {/if}

    <!-- 3. In-flight Live Dashboard HUD -->
    {#if phase === 'flight' && flightState}
      <StatsOverlay 
        state={flightState} 
        {weaponType}
        {isMuted}
        onReset={returnToMenu}
        onToggleMute={toggleMute}
      />
    {/if}

    <!-- Milestone toast notification -->
    {#if phase === 'flight' && crossedMilestone}
      <div class="milestone-toast">
        <div class="toast-glow"></div>
        <span class="toast-star">⭐</span>
        <span class="toast-text">{crossedMilestone.text} erreicht! ({crossedMilestone.dist}m)</span>
        <span class="toast-star">⭐</span>
      </div>
    {/if}

    <!-- 4. Flight Results Modal -->
    {#if phase === 'results' && flightState}
      <ResultsOverlay 
        state={flightState} 
        {weaponType} 
        {highscores}
        onReplay={resetToAim}
        onChangeWeapon={returnToMenu}
      />
    {/if}

  </div>
</main>
