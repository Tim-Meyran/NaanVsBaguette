<script lang="ts">
  import { Volume2, VolumeX, RotateCcw, Compass, ArrowUp, Zap } from 'lucide-svelte';
  import { type FlightState } from './Physics';

  // Props using Svelte 5 runes
  let { state, weaponType, onReset, isMuted, onToggleMute } = $props<{
    state: FlightState;
    weaponType: 'naan' | 'baguette';
    onReset: () => void;
    isMuted: boolean;
    onToggleMute: () => void;
  }>();

  // Speed in km/h
  let currentSpeedKmh = $derived(
    Math.round(
      Math.sqrt(
        state.velocity.x * state.velocity.x +
        state.velocity.y * state.velocity.y +
        state.velocity.z * state.velocity.z
      ) * 3.6
    )
  );

  // Height and Distance in meters
  let currentHeight = $derived(Math.max(0, state.position.y).toFixed(1));
  let currentDistance = $derived(Math.max(0, state.position.z).toFixed(1));

  // Dynamic commentary based on current physics parameters
  let commentary = $derived.by(() => {
    const speed = currentSpeedKmh;
    const heightVal = parseFloat(currentHeight);
    const time = state.time;

    if (state.isStuck || !state.isActive) {
      return weaponType === 'naan' 
        ? 'Der Fladen ist weich gelandet! 🫓' 
        : 'Volltreffer! Das Baguette steckt im Boden! 🥖';
    }

    if (time < 0.3) {
      return 'Katapult-Start! Voller Schub! 🚀';
    }

    if (weaponType === 'naan') {
      const rotZDeg = Math.abs(state.rotation.z * 180 / Math.PI);
      if (rotZDeg > 45) {
        return 'Wobbelnde Scheibe! Sie verliert Stabilität! ⚠️';
      }
      if (state.velocity.y > 1.0) {
        return 'Tandoori-Auftrieb! Es steigt! 📈';
      }
      if (state.velocity.y < -1.0 && heightVal > 1.5) {
        return 'Gleitflug... Segelt elegant dahin. 🍃';
      }
      if (heightVal <= 1.5) {
        return 'Dicht über dem Boden! Gleich gibt es Brotkrümel... 🌾';
      }
      return 'Naan-Express im Gleitmodus! 🫓💨';
    } else {
      // Baguette comments
      if (state.velocity.y < -2.0) {
        return 'Sturzflug! Gravitation gewinnt! ☄️';
      }
      if (speed > 80) {
        return 'Hyperschall-Baguette! Knusprige Schallmauer! 🔥';
      }
      if (state.velocity.y > 0) {
        return 'Steigt steil nach oben! 🥖';
      }
      return 'Perfekte Speerform, schneidet die Luft! 🎯';
    }
  });
</script>

<div class="stats-container">
  <div class="hud-top-section">
    <!-- Top Bar: Settings / Mute & Reset -->
    <div class="hud-top-bar">
      <button class="hud-btn" onclick={onReset} aria-label="Zurücksetzen">
        <RotateCcw class="icon" /> Reset
      </button>

      <div class="weapon-indicator">
        {#if weaponType === 'naan'}
          <span class="dot naan-dot"></span> NAAN FLUG
        {:else}
          <span class="dot baguette-dot"></span> BAGUETTE FLUG
        {/if}
      </div>

      <button class="hud-btn" onclick={onToggleMute} aria-label="Stummschalten">
        {#if isMuted}
          <VolumeX class="icon mute-icon" /> Stumm
        {:else}
          <Volume2 class="icon" /> Sound
        {/if}
      </button>
    </div>

    <!-- Realtime HUD Dashboards -->
    <div class="hud-dashboard">
      <div class="hud-card">
        <div class="hud-card-label"><Compass class="icon icon-dist" /> DISTANZ</div>
        <div class="hud-card-value">{currentDistance} <span class="unit">m</span></div>
      </div>

      <div class="hud-card">
        <div class="hud-card-label"><Zap class="icon icon-speed" /> TEMPO</div>
        <div class="hud-card-value">{currentSpeedKmh} <span class="unit">km/h</span></div>
      </div>

      <div class="hud-card">
        <div class="hud-card-label"><ArrowUp class="icon icon-height" /> HÖHE</div>
        <div class="hud-card-value">{currentHeight} <span class="unit">m</span></div>
      </div>
    </div>
  </div>

  <!-- Commentary Box at bottom -->
  <div class="commentary-box">
    <div class="commentary-content">
      <span class="pulse-indicator"></span>
      <p>{commentary}</p>
    </div>
  </div>
</div>

<style>
  .stats-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .hud-top-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .hud-top-bar {
    pointer-events: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    animation: fadeIn 0.3s ease;
  }

  .hud-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(22, 23, 29, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: white;
    padding: 8px 14px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .hud-btn:hover {
    background: rgba(40, 42, 54, 0.85);
    transform: translateY(-1px);
  }

  .hud-btn:active {
    transform: translateY(1px);
  }

  .hud-btn :global(.icon) {
    width: 15px;
    height: 15px;
  }

  :global(.mute-icon) {
    color: #ef4444;
  }

  .weapon-indicator {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 6px 12px;
    border-radius: 99px;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .naan-dot {
    background-color: #ebce96;
    box-shadow: 0 0 8px #ebce96;
  }

  .baguette-dot {
    background-color: #f69d3c;
    box-shadow: 0 0 8px #f69d3c;
  }

  /* HUD Cards display */
  .hud-dashboard {
    display: flex;
    justify-content: center;
    gap: 12px;
    width: 100%;
    margin-top: 16px;
    animation: slideDown 0.3s ease;
  }

  .hud-card {
    background: rgba(22, 23, 29, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 8px 16px;
    min-width: 90px;
    text-align: center;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }

  .hud-card-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    color: #9ca3af;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }

  .hud-card-label :global(.icon) {
    width: 11px;
    height: 11px;
  }

  :global(.icon-dist) { color: #10b981; }
  :global(.icon-speed) { color: #f59e0b; }
  :global(.icon-height) { color: #3b82f6; }

  .hud-card-value {
    font-size: 1.3rem;
    font-weight: 800;
    color: white;
  }

  .unit {
    font-size: 0.7rem;
    color: #9ca3af;
    font-weight: 500;
  }

  /* Bottom Commentary Box */
  .commentary-box {
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    margin-bottom: 12px;
    animation: slideUp 0.3s ease;
  }

  .commentary-content {
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 99px;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  .pulse-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #22c55e;
    animation: indicatorPulse 1.2s infinite ease-in-out;
    flex-shrink: 0;
  }

  .commentary-content p {
    margin: 0;
    color: #f3f4f6;
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
  }

  @keyframes indicatorPulse {
    0% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.3);
      opacity: 1;
      box-shadow: 0 0 6px #22c55e;
    }
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideDown {
    from { transform: translateY(-15px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(15px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @media (max-width: 480px) {
    .hud-dashboard {
      gap: 6px;
    }
    .hud-card {
      padding: 6px 10px;
      min-width: 75px;
      flex-grow: 1;
    }
    .hud-card-value {
      font-size: 1.1rem;
    }
    .commentary-content {
      padding: 8px 16px;
    }
    .commentary-content p {
      font-size: 0.8rem;
    }
  }
</style>
