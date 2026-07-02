<script lang="ts">
  import { RotateCcw, Award, ArrowLeftRight, ChevronRight } from 'lucide-svelte';
  import { type FlightState } from './Physics';

  // Props using Svelte 5 runes
  let { state, weaponType, highscores, onReplay, onChangeWeapon } = $props<{
    state: FlightState;
    weaponType: 'naan' | 'baguette';
    highscores: { naan: number; baguette: number };
    onReplay: () => void;
    onChangeWeapon: () => void;
  }>();

  let finalDistance = $derived(parseFloat(state.distance.toFixed(1)));
  let peakHeight = $derived(parseFloat(state.maxHeight.toFixed(1)));
  let topSpeed = $derived(Math.round(state.maxSpeed * 3.6));

  let naanDisplayBest = $derived(
    weaponType === 'naan' 
      ? Math.max(finalDistance, highscores.naan) 
      : highscores.naan
  );
  let baguetteDisplayBest = $derived(
    weaponType === 'baguette' 
      ? Math.max(finalDistance, highscores.baguette) 
      : highscores.baguette
  );

  // Determine if this throw is a new personal best
  let isNewRecord = $derived(
    weaponType === 'naan' 
      ? finalDistance > highscores.naan 
      : finalDistance > highscores.baguette
  );

  // Funny milestone quote in German
  let milestoneQuote = $derived.by(() => {
    const dist = finalDistance;
    if (dist < 15) {
      return 'Das Brot landete direkt vor dir im Gras. Hast du hungrige Tauben angelockt? 🐦🍞';
    } else if (dist < 35) {
      return 'Ein solider Wurf! Genug Reichweite, um das Brot über den Gartenzaun zu befördern. 🏡';
    } else if (dist < 60) {
      return 'Starke Leistung! Du hast das Naan/Baguette bis zur nächsten Picknickdecke geschleudert! 🧺🍷';
    } else if (dist < 100) {
      return 'Superwurf! Der Dorfbäcker schaut ehrfürchtig zu. Tandoori-Power pur! 🥖🔥';
    } else if (dist < 160) {
      return 'Absoluter Rekord! Eine interkontinentale Kohlenhydrat-Lieferung! Die NASA klaut deine Aerodynamik! 🚀💫';
    } else {
      return 'Unerhört! Das Brot hat die Schallmauer durchbrochen und kreist nun in der Umlaufbahn! 🛰️🪐';
    }
  });
</script>

<div class="results-backdrop">
  <div class="results-card">
    
    <!-- Congratulations Header -->
    <div class="header">
      {#if isNewRecord}
        <div class="record-badge">
          <Award class="icon gold" /> NEUER BESTWERT!
        </div>
      {/if}
      
      <h2>Flug Beendet!</h2>
      <p class="weapon-label">
        {weaponType === 'naan' ? '🫓 Naan-Frisbee' : '🥖 Baguette-Speer'}
      </p>
    </div>

    <!-- Main Score Billboard -->
    <div class="score-billboard">
      <span class="score-val">{finalDistance}</span>
      <span class="score-unit">Meter</span>
    </div>

    <!-- Highscore Compare bar -->
    <div class="highscore-compare-box">
      <h3 class="compare-title">🏆 PERSÖNLICHE BESTWERTE</h3>
      
      <!-- Naan Bestwert Row -->
      <div class="score-progress-row">
        <div class="score-progress-header">
          <span class="score-progress-label">🫓 Naan-Frisbee Bestweite</span>
          <span class="score-progress-val">{naanDisplayBest.toFixed(1)} m</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill naan-bar-fill" style="width: {Math.min(100, (naanDisplayBest / 200) * 100)}%"></div>
        </div>
      </div>

      <!-- Baguette Bestwert Row -->
      <div class="score-progress-row">
        <div class="score-progress-header">
          <span class="score-progress-label">🥖 Baguette-Speer Bestweite</span>
          <span class="score-progress-val">{baguetteDisplayBest.toFixed(1)} m</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill baguette-bar-fill" style="width: {Math.min(100, (baguetteDisplayBest / 200) * 100)}%"></div>
        </div>
      </div>
    </div>

    <!-- Flight stats list -->
    <div class="stats-list">
      <div class="stat-row">
        <span class="stat-label">Maximale Höhe:</span>
        <span class="stat-value">{peakHeight} m</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Spitzengeschwindigkeit:</span>
        <span class="stat-value">{topSpeed} km/h</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Flugzeit:</span>
        <span class="stat-value">{state.time.toFixed(2)} s</span>
      </div>
    </div>

    <!-- Humorous milestone explanation -->
    <div class="quote-box">
      <p>{milestoneQuote}</p>
    </div>

    <!-- Buttons -->
    <div class="actions">
      <button class="btn btn-primary" onclick={onReplay}>
        <RotateCcw class="icon" /> Nochmal werfen
      </button>
      
      <button class="btn btn-secondary" onclick={onChangeWeapon}>
        <ArrowLeftRight class="icon" /> Gebäck wechseln
      </button>
    </div>
    
  </div>
</div>

<style>
  .results-backdrop {
    pointer-events: auto;
    position: absolute;
    inset: 0;
    background: rgba(10, 10, 15, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    z-index: 10000;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .results-card {
    background: rgba(22, 24, 30, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px;
    padding: 28px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 127, 80, 0.15);
    color: #f3f4f6;
    text-align: center;
    animation: zoomIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .header {
    margin-bottom: 16px;
    position: relative;
  }

  .record-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
    color: #1e1b4b;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 99px;
    box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);
    margin-bottom: 8px;
    animation: bounce 1.0s infinite ease-in-out alternate;
  }

  .record-badge :global(.icon) {
    width: 14px;
    height: 14px;
  }

  .header h2 {
    margin: 4px 0 0;
    font-size: 1.8rem;
    color: white;
    font-weight: 800;
  }

  .weapon-label {
    margin: 4px 0 0;
    font-size: 0.9rem;
    color: #9ca3af;
    font-weight: 600;
  }

  /* Score Billboard */
  .score-billboard {
    margin: 16px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .score-val {
    font-size: 4.8rem;
    font-weight: 900;
    line-height: 1;
    background: linear-gradient(to bottom, #ffffff 30%, #a1a1aa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
  }

  .score-unit {
    font-size: 1.1rem;
    color: #ff7f50;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.15em;
    margin-top: 4px;
  }

  /* Highscore bar comparison */
  .highscore-compare-box {
    background: rgba(15, 17, 23, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 20px;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
  }

  .compare-title {
    font-size: 0.72rem;
    font-weight: 800;
    color: #9ca3af;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
  }

  .score-progress-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .score-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
  }

  .score-progress-label {
    color: #d1d5db;
    font-weight: 500;
  }

  .score-progress-val {
    color: #ffffff;
    font-weight: 800;
  }

  .progress-bar-track {
    background: #111827;
    height: 8px;
    border-radius: 99px;
    width: 100%;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .naan-bar-fill {
    background: linear-gradient(90deg, #ebce96 0%, #d97706 100%);
    box-shadow: 0 0 8px rgba(235, 206, 150, 0.3);
  }

  .baguette-bar-fill {
    background: linear-gradient(90deg, #f69d3c 0%, #b06517 100%);
    box-shadow: 0 0 8px rgba(246, 157, 60, 0.3);
  }

  /* Stats list */
  .stats-list {
    margin: 16px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 6px;
    font-size: 0.85rem;
  }

  .stat-label {
    color: #9ca3af;
  }

  .stat-value {
    color: white;
    font-weight: 700;
  }

  /* Quote Box */
  .quote-box {
    background: rgba(255, 127, 80, 0.08);
    border: 1px dashed rgba(255, 127, 80, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 24px;
    text-align: center;
  }

  .quote-box p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.4;
    color: #ffd8c8;
    font-style: italic;
  }

  /* Actions */
  .actions {
    display: flex;
    gap: 12px;
  }

  .btn {
    flex: 1 1 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    border: none;
  }

  .btn-primary {
    background: linear-gradient(135deg, #ff7f50 0%, #ff4500 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(255, 69, 0, 0.3);
  }

  .btn-primary:hover {
    background: linear-gradient(135deg, #ff9166 0%, #ff5714 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 69, 0, 0.4);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-2px);
  }

  .btn-secondary:active {
    transform: translateY(0);
  }

  .btn :global(.icon) {
    width: 16px;
    height: 16px;
  }

  @keyframes zoomIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes bounce {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-4px);
    }
  }

  @media (max-width: 440px) {
    .results-card {
      padding: 20px 16px;
    }
    .score-val {
      font-size: 3.8rem;
    }
    .actions {
      flex-direction: column;
      gap: 8px;
    }
    .btn {
      width: 100%;
    }
  }
</style>
