<script lang="ts">
  import { RotateCw, Compass, ArrowUp, Zap } from 'lucide-svelte';
  import { audioManager } from './AudioManager';

  // Props using Svelte 5 runes
  let { onLaunch, onAiming, weaponType, wind } = $props<{
    onLaunch: (params: { angle: number; speed: number; spin: number; sideAngle: number }) => void;
    onAiming: (params: { angle: number; speed: number; spin: number; sideAngle: number } | null) => void;
    weaponType: 'naan' | 'baguette';
    wind: { x: number; y: number; z: number };
  }>();

  // State sliders
  let launchAngle = $state(15);
  let sideAngle = $state(0);
  let spinRps = $state(12);
  let launchSpeed = $state(32); // Default standard speed (32 m/s = 115 km/h)

  // Sync state values when weaponType changes
  let currentWeapon = $state("");
  $effect(() => {
    if (currentWeapon !== weaponType) {
      currentWeapon = weaponType;
      launchAngle = weaponType === 'naan' ? 15 : 42;
      spinRps = weaponType === 'naan' ? 12 : 0;
      sideAngle = 0;
      launchSpeed = 32; // Reset to default speed
    }
  });

  // Derived wind values
  let windAngle = $derived(Math.atan2(-wind.x, wind.z) * (180 / Math.PI));
  let windSpeedKmh = $derived(Math.round(Math.sqrt(wind.x * wind.x + wind.z * wind.z) * 3.6));

  // Sync aiming prediction line in ThreeJS scene whenever sliders change
  $effect(() => {
    onAiming({
      angle: launchAngle,
      speed: launchSpeed,
      spin: spinRps,
      sideAngle: sideAngle
    });

    // Cleanup when component unmounts
    return () => {
      onAiming(null);
    };
  });

  function triggerThrow() {
    audioManager.playClick();
    audioManager.playLaunch(weaponType === 'naan');
    
    onLaunch({
      angle: launchAngle,
      speed: launchSpeed,
      spin: spinRps,
      sideAngle: sideAngle
    });
  }

  // Play click on slider interaction
  function handleSliderChange() {
    audioManager.playClick();
  }
</script>

<div class="launch-container">
  <!-- Instruction Top Panel (Always Visible, Transparent/Blur) -->
  <div class="instructions-card" class:naan-border={weaponType === 'naan'} class:baguette-border={weaponType === 'baguette'}>
    {#if weaponType === 'naan'}
      <span class="hud-weapon-title">🫓 Naan Brot (Frisbee)</span>
      <p class="hud-weapon-desc">Gleitet auf der Luft. Hoher <strong>Drall (Spin)</strong> stabilisiert die Flugbahn und erzeugt Auftrieb. Flach werfen!</p>
    {:else}
      <span class="hud-weapon-title">🥖 Baguette (Speer)</span>
      <p class="hud-weapon-desc">Fliegt ballistisch und schneidet den Wind. Optimaler Winkel ca. <strong>38°–45°</strong>. Volle Kraft!</p>
    {/if}
  </div>

  <!-- Wind Indicator Compass (Top Right) -->
  <div class="wind-hud-card">
    <div class="wind-arrow-container" style="transform: rotate({windAngle}deg)">
      <ArrowUp class="icon wind-arrow-icon" />
    </div>
    <span class="wind-hud-speed">{windSpeedKmh} <span class="wind-hud-unit">km/h</span></span>
    <span class="wind-hud-label">
      {#if windSpeedKmh < 2}
        still
      {:else if Math.abs(wind.z) > Math.abs(wind.x)}
        {wind.z > 0 ? 'Rücken' : 'Gegen'}
      {:else}
        Seite
      {/if}
    </span>
  </div>

  <!-- Left: Vertical Angle Slider (Pitch) - Glass Visor -->
  <div class="vertical-slider-wrap angle-slider-wrap">
    <ArrowUp class="icon label-angle slider-icon-top" />
    <div class="vertical-slider-container">
      <input 
        type="range" 
        min="0" 
        max="75" 
        step="1"
        bind:value={launchAngle}
        oninput={handleSliderChange}
        class="custom-range range-angle"
      />
    </div>
    <span class="slider-value">{launchAngle}°</span>
  </div>

  <!-- Right: Vertical Speed Slider (Power) - Glass Visor -->
  <div class="vertical-slider-wrap speed-slider-wrap">
    <Zap class="icon label-speed slider-icon-top" />
    <div class="vertical-slider-container">
      <input 
        type="range" 
        min="5" 
        max="40" 
        step="1"
        bind:value={launchSpeed}
        oninput={handleSliderChange}
        class="custom-range range-speed"
      />
    </div>
    <span class="slider-value">{Math.round(launchSpeed * 3.6)} km/h</span>
  </div>

  <!-- Bottom Center: Horizontal Aiming & Spin Sliders - Glass Deck -->
  <div class="bottom-center-hud">
    <!-- Direction Slider -->
    <div class="horizontal-hud-item">
      <div class="hud-item-label-row">
        <span class="hud-item-label"><Compass class="icon label-dir" /> Richtung</span>
        <span class="hud-item-value">
          {#if sideAngle < 0}
            {Math.abs(sideAngle)}° Links ➔
          {:else if sideAngle > 0}
            {sideAngle}° Rechts ➔
          {:else}
            Geradeaus
          {/if}
        </span>
      </div>
      <input 
        type="range" 
        min="-25" 
        max="25" 
        step="1"
        bind:value={sideAngle}
        oninput={handleSliderChange}
        class="custom-range range-dir"
      />
    </div>

    <!-- Spin Slider (Only for Naan Brot) -->
    {#if weaponType === 'naan'}
      <div class="horizontal-hud-item">
        <div class="hud-item-label-row">
          <span class="hud-item-label"><RotateCw class="icon label-spin" /> Drall</span>
          <span class="hud-item-value">
            {#if spinRps < 0}
              {Math.abs(spinRps)} RPS Links ⟲
            {:else if spinRps > 0}
              {spinRps} RPS Rechts ⟳
            {:else}
              0 RPS (Kein)
            {/if}
          </span>
        </div>
        <input 
          type="range" 
          min="-25" 
          max="25" 
          step="1"
          bind:value={spinRps}
          oninput={handleSliderChange}
          class="custom-range range-spin"
        />
      </div>
    {/if}
  </div>

  <!-- Bottom Right: Floating circular Fire Button -->
  <button class="throw-trigger-btn" onclick={triggerThrow} aria-label="Abwerfen">
    🚀
  </button>
</div>

<style>
  .launch-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .launch-container,
  .launch-container * {
    box-sizing: border-box;
  }

  /* Permanent Transparent Top Card */
  .instructions-card {
    pointer-events: auto;
    position: absolute;
    top: 16px;
    left: 16px;
    right: 128px; /* leaves space for larger wind HUD card */
    background: rgba(15, 17, 23, 0.45);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 12px 16px;
    color: #f3f4f6;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .instructions-card.naan-border {
    border-left: 4px solid #ebce96;
    box-shadow: 0 8px 25px rgba(235, 206, 150, 0.05), 0 8px 25px rgba(0, 0, 0, 0.25);
  }

  .instructions-card.baguette-border {
    border-left: 4px solid #f69d3c;
    box-shadow: 0 8px 25px rgba(246, 157, 60, 0.05), 0 8px 25px rgba(0, 0, 0, 0.25);
  }

  .hud-weapon-title {
    font-size: 0.85rem;
    font-weight: 800;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-shadow: 0 1px 3px rgba(0,0,0,0.85);
  }

  .hud-weapon-desc {
    margin: 0;
    font-size: 0.72rem;
    line-height: 1.4;
    color: #d1d5db;
    text-shadow: 0 1px 2px rgba(0,0,0,0.85);
  }

  /* Floating Wind Compass Card (Top Right) - Enlarged for breathing room */
  .wind-hud-card {
    pointer-events: auto;
    position: absolute;
    top: 16px;
    right: 16px;
    width: 96px;
    height: 96px;
    background: rgba(15, 17, 23, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .wind-arrow-container {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  :global(.wind-arrow-icon) {
    width: 22px;
    height: 22px;
    color: #60a5fa;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.85));
  }

  .wind-hud-speed {
    font-size: 0.78rem;
    font-weight: 800;
    color: white;
    margin-top: 1px;
    text-shadow: 0 1px 3px rgba(0,0,0,0.9);
    white-space: nowrap;
  }

  .wind-hud-unit {
    font-size: 0.55rem;
    color: #9ca3af;
    font-weight: 500;
  }

  .wind-hud-label {
    font-size: 0.55rem;
    font-weight: 800;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-shadow: 0 1px 2px rgba(0,0,0,0.85);
    margin-top: 0;
  }

  /* Vertical Sliders Layout along left/right borders - Glass Visor Casings - WIDENED to 76px */
  .vertical-slider-wrap {
    pointer-events: auto;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 78px; /* Widened from 52px to prevent text overflows like "115 km/h" */
    height: 330px; /* Tall vertical size */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    z-index: 99;
    background: rgba(15, 17, 23, 0.35);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 26px;
    padding: 16px 0;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  }

  .angle-slider-wrap {
    left: 12px;
  }

  .speed-slider-wrap {
    right: 12px;
  }

  .vertical-slider-container {
    position: relative;
    width: 16px;
    height: 220px;
  }

  .vertical-slider-container input {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 220px;
    height: 12px;
    transform: translate(-50%, -50%) rotate(-90deg);
    -webkit-appearance: none;
    appearance: none;
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 99px;
    outline: none;
    cursor: pointer;
    margin: 0;
    box-shadow: inset 0 1px 4px rgba(0,0,0,0.6);
  }

  :global(.slider-icon-top) {
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.9));
  }

  .slider-value {
    font-size: 0.8rem;
    font-weight: 800;
    color: white;
    text-align: center;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.95);
    white-space: nowrap;
    width: 100%;
    padding: 0 4px;
  }

  /* Bottom-Center HUD - Glass Deck Casing - WIDENED to 340px to prevent text wraps */
  .bottom-center-hud {
    pointer-events: auto;
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 340px; /* Widened from 300px to prevent wraps */
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    z-index: 98;
    background: rgba(15, 17, 23, 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 16px 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }

  .horizontal-hud-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hud-item-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
    font-size: 0.75rem;
    text-shadow: 0 1.5px 3px rgba(0,0,0,0.95);
  }

  .hud-item-label {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #e5e7eb;
    font-weight: 700;
  }

  .hud-item-label-row :global(.icon) {
    width: 15px;
    height: 15px;
    filter: drop-shadow(0 1.5px 2px rgba(0,0,0,0.9));
  }

  .hud-item-value {
    color: white;
    font-weight: 800;
  }

  /* Custom range sliders styling - Thicker, tactile */
  .custom-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 10px; /* Thicker tracks */
    border-radius: 99px;
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.18);
    outline: none;
    margin: 4px 0;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
  }

  /* Webkit Thumb - Enlarged */
  .custom-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 26px; /* Fat slider knobs */
    height: 26px;
    border-radius: 50%;
    background: currentColor;
    cursor: pointer;
    border: 3px solid #ffffff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.6);
    transition: transform 0.1s ease;
  }

  .custom-range::-webkit-slider-thumb:hover {
    transform: scale(1.12);
  }

  .custom-range::-webkit-slider-thumb:active {
    transform: scale(0.9);
  }

  /* Firefox Thumb - Enlarged */
  .custom-range::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: currentColor;
    cursor: pointer;
    border: 3px solid #ffffff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.6);
  }

  /* Color themes for inputs */
  .range-angle { color: #3b82f6; }
  .range-dir { color: #10b981; }
  .range-spin { color: #a78bfa; }
  .range-speed { color: #f59e0b; }

  :global(.label-angle) { color: #3b82f6; }
  :global(.label-dir) { color: #10b981; }
  :global(.label-spin) { color: #a78bfa; }
  :global(.label-speed) { color: #f59e0b; }

  /* Bottom Right: Big round Fire button - Premium Glowing Trigger */
  .throw-trigger-btn {
    pointer-events: auto;
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 66px;
    height: 66px;
    background: linear-gradient(135deg, #ff7f50 0%, #ff4500 100%);
    color: white;
    border: none;
    border-radius: 50%;
    font-size: 1.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 0 15px rgba(255, 69, 0, 0.4), 0 4px 18px rgba(255, 69, 0, 0.4), 0 2px 6px rgba(0,0,0,0.4);
    transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    z-index: 99;
  }

  .throw-trigger-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 0 25px rgba(255, 69, 0, 0.7), 0 6px 22px rgba(255, 69, 0, 0.5);
  }

  .throw-trigger-btn:active {
    transform: scale(0.92);
  }

  @keyframes slideDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* Responsive layout adjustments for small phones */
  @media (max-width: 480px) {
    .vertical-slider-wrap {
      width: 70px; /* Widened slightly on mobile too */
      height: 250px;
      padding: 12px 0;
      border-radius: 20px;
    }
    .vertical-slider-container {
      height: 150px;
    }
    .vertical-slider-container input {
      width: 150px;
    }
    .bottom-center-hud {
      max-width: 240px; /* Widened slightly on mobile */
      bottom: 12px;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 16px;
    }
    .throw-trigger-btn {
      width: 58px;
      height: 58px;
      font-size: 1.5rem;
      bottom: 12px;
      right: 12px;
    }
    .instructions-card {
      right: 114px; /* gives enough space for wind badge */
      padding: 8px 12px;
      border-radius: 12px;
    }
    .wind-hud-card {
      width: 82px;
      height: 82px;
      top: 16px;
      right: 16px;
    }
    :global(.wind-arrow-icon) {
      width: 18px;
      height: 18px;
    }
    .wind-hud-speed {
      font-size: 0.72rem;
    }
  }
</style>
