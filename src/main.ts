import './style.css';
import { renderNepalMapSvg } from './boardView';

const appRoot = document.getElementById('app');
if (appRoot) {
  appRoot.innerHTML = `
    <div class="game-shell">
      <header class="top-bar">
        <div class="brand-group">
          <h1 id="app-title">Ticket to Ride: Nepal</h1>
          <span class="subtitle-pill">Himalayan Railway &amp; Highway Edition</span>
        </div>
      </header>
      <main class="board-stage">
        ${renderNepalMapSvg()}
      </main>
    </div>
  `;
}
