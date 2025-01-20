import { NEPAL_CITIES, NEPAL_ROUTES, CITY_BY_ID, MAP_WIDTH, MAP_HEIGHT } from './nepalMapData';
import { NepalRegion, NepalRoute, PlayerState, CARD_COLOR_HEX, ROUTE_COLOR_HEX, ROUTE_POINTS_TABLE } from './types';
import { ALL_CARD_COLORS, BoardBinder } from './binder';
import { getConnectedComponent } from './graph';

const REGION_BADGE_COLOR: Record<NepalRegion, string> = {
  himalaya: '#3b6e8c',
  pahad: '#b85d38',
  terai: '#4d7c3f',
};

function renderRouteSegmentsMarkup(route: NepalRoute): string {
  const fromCity = CITY_BY_ID.get(route.from);
  const toCity = CITY_BY_ID.get(route.to);
  if (!fromCity || !toCity) return '';

  const dx = toCity.x - fromCity.x;
  const dy = toCity.y - fromCity.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;

  const offsetMag = route.doubleIndex === 0 ? -6.5 : route.doubleIndex === 1 ? 6.5 : 0;
  const ox = nx * offsetMag;
  const oy = ny * offsetMag;

  const padEnd = 15;
  const usableDist = Math.max(24, dist - padEnd * 2);
  const segStep = usableDist / route.length;
  const segW = Math.max(12, Math.min(34, segStep - 4));
  const segH = 8.5;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const baseFill = ROUTE_COLOR_HEX[route.color];
  const strokeColor = route.color === 'white' ? '#5c4b3b' : '#2b2118';

  const blocks: string[] = [];
  for (let i = 0; i < route.length; i++) {
    const t = padEnd + (i + 0.5) * segStep;
    const cx = fromCity.x + ux * t + ox;
    const cy = fromCity.y + uy * t + oy;
    blocks.push(`
      <g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
        <rect
          class="route-segment-box"
          x="${(-segW / 2).toFixed(1)}"
          y="${(-segH / 2).toFixed(1)}"
          width="${segW.toFixed(1)}"
          height="${segH}"
          rx="2.5"
          fill="${baseFill}"
          stroke="${strokeColor}"
          stroke-width="1.4"
          ${route.isMountainPass ? 'stroke-dasharray="3,2"' : ''}
        />
        ${
          route.isMountainPass
            ? `<polygon points="-3,2 0,-3 3,2" fill="#fbf8f3" opacity="0.85" />`
            : ''
        }
      </g>
    `);
  }

  const midX = (fromCity.x + toCity.x) / 2 + ox;
  const midY = (fromCity.y + toCity.y) / 2 + oy;

  return `
    <g
      id="route-${route.id}"
      class="route-group"
      data-route-id="${route.id}"
      data-color="${route.color}"
      data-mountain="${route.isMountainPass ? '1' : '0'}"
    >
      <line
        class="route-bed"
        x1="${(fromCity.x + ox).toFixed(1)}"
        y1="${(fromCity.y + oy).toFixed(1)}"
        x2="${(toCity.x + ox).toFixed(1)}"
        y2="${(toCity.y + oy).toFixed(1)}"
        stroke="rgba(43, 33, 24, 0.22)"
        stroke-width="10"
        stroke-linecap="round"
      />
      ${blocks.join('')}
      <g id="route-owner-token-${route.id}" class="route-owner-overlay" transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)})"></g>
    </g>
  `;
}

export function renderNepalMapSvg(): string {
  const routesMarkup = NEPAL_ROUTES.map(renderRouteSegmentsMarkup).join('');

  const citiesMarkup = NEPAL_CITIES.map((city) => {
    const r = city.isHub ? 9 : 6.5;
    const regionColor = REGION_BADGE_COLOR[city.region];
    return `
      <g id="city-${city.id}" class="city-node" data-city="${city.id}" transform="translate(${city.x}, ${city.y})">
        <circle class="city-halo" r="${r + 4}" fill="${regionColor}" opacity="0.22" />
        <circle class="city-dot" r="${r}" fill="#fbf8f3" stroke="${regionColor}" stroke-width="3" />
        ${city.isHub ? `<circle r="3" fill="${regionColor}" />` : ''}
        <g class="city-label-group" transform="translate(0, ${-(r + 8)})">
          <rect x="${-(city.name.length * 3.6 + 8)}" y="-14" width="${city.name.length * 7.2 + 16}" height="18" rx="5" fill="rgba(43, 33, 24, 0.85)" />
          <text y="-2" text-anchor="middle" fill="#fbf8f3" font-size="11" font-weight="700">${city.name}</text>
        </g>
      </g>
    `;
  }).join('');

  return `
    <svg id="nepal-board-svg" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="nepal-terrain-grad" x1="0%" y1="0%" x2="15%" y2="100%">
          <stop offset="0%" stop-color="#e3ecf2" />
          <stop offset="42%" stop-color="#efe3d0" />
          <stop offset="85%" stop-color="#e2ebd5" />
          <stop offset="100%" stop-color="#d7e4c5" />
        </linearGradient>
        <filter id="board-drop-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#2b2118" flood-opacity="0.22" />
        </filter>
      </defs>

      <!-- Nepal National Border & Topographical Polygon -->
      <path
        id="nepal-border-shape"
        d="M 52,320 L 96,204 L 198,84 L 312,96 L 465,148 L 620,145 L 795,186 L 978,242 L 1185,356 L 1205,495 L 1072,612 L 882,618 L 735,585 L 520,536 L 268,512 L 128,456 L 44,378 Z"
        fill="url(#nepal-terrain-grad)"
        stroke="#8c6d53"
        stroke-width="4"
        filter="url(#board-drop-shadow)"
      />

      <!-- Himalayan Ridge Contour Line -->
      <path
        d="M 122,225 Q 310,165 550,205 T 980,295 L 1168,390"
        fill="none"
        stroke="#7a9eb5"
        stroke-width="2"
        stroke-dasharray="8,6"
        opacity="0.65"
      />

      <!-- Mahabharat / Churia Terai Boundary Line -->
      <path
        d="M 74,368 Q 340,445 640,455 T 1175,525"
        fill="none"
        stroke="#6a8d56"
        stroke-width="2"
        stroke-dasharray="6,6"
        opacity="0.65"
      />

      <!-- Regional Watermarks -->
      <text x="580" y="130" text-anchor="middle" fill="#52738a" font-size="13" font-weight="800" letter-spacing="4" opacity="0.65">
        GREAT HIMALAYAN TRAIL (HIMALAYA)
      </text>
      <text x="650" y="650" text-anchor="middle" fill="#4f6f3e" font-size="13" font-weight="800" letter-spacing="4" opacity="0.65">
        MAHENDRA EAST-WEST CORRIDOR (TERAI)
      </text>

      <!-- Route Tracks Layer -->
      <g id="routes-layer">
        ${routesMarkup}
      </g>

      <!-- Cities Layer -->
      <g id="cities-layer">
        ${citiesMarkup}
      </g>
    </svg>
  `;
}

export function renderGameWorkspaceMarkup(players: PlayerState[]): string {
  const playerCardsHtml = players
    .map(
      (p, idx) => `
      <div class="player-summary-card${idx === 0 ? ' active-turn' : ''}" data-player-idx="${idx}">
        <div class="player-card-header">
          <span class="player-dot" style="background:${p.colorHex}"></span>
          <strong class="player-name">${p.name}</strong>
          <span class="player-role-tag">${p.personality === 'human' ? 'You' : p.personality}</span>
        </div>
        <div class="player-card-stats">
          <span id="player-score-${idx}" class="player-score-pill">${p.score} pts</span>
          <span id="player-carriages-${idx}" class="player-carriage-pill">🚌 ${p.carriages}</span>
        </div>
      </div>
    `
    )
    .join('');

  const marketSlotsHtml = Array.from({ length: 5 }, (_, idx) => `
    <button type="button" id="market-slot-${idx}" class="market-card-slot" data-slot="${idx}">
      Card ${idx + 1}
    </button>
  `).join('');

  const handChipsHtml = ALL_CARD_COLORS.map((color) => {
    const bg =
      color === 'locomotive'
        ? 'linear-gradient(135deg, #c83e31 0%, #d99b26 35%, #3a7d44 70%, #2a6f97 100%)'
        : CARD_COLOR_HEX[color];
    const textCol = color === 'white' || color === 'yellow' ? '#2b2118' : '#fffdf9';
    const label = color === 'locomotive' ? '★ Wild' : color;
    return `
      <div class="hand-card-chip" data-color="${color}">
        <span class="hand-card-swatch" style="background:${bg};color:${textCol}">${label}</span>
        <span id="hand-count-${color}" class="hand-card-count">0</span>
      </div>
    `;
  }).join('');

  return `
    <div class="game-shell">
      <header class="top-bar">
        <div class="brand-group">
          <h1 id="app-title">Ticket to Ride: Nepal</h1>
          <span class="subtitle-pill">Himalayan Railway &amp; Highway Edition</span>
        </div>
        <div class="turn-banner">
          <span id="turn-player-badge" class="turn-player-badge">Player 1</span>
          <span id="turn-status-text" class="turn-status-text">Draw 2 transport cards, claim a route, or draw destination tickets.</span>
        </div>
        <div class="top-actions">
          <button type="button" id="btn-rules" class="top-btn">Rules &amp; Scoring</button>
          <button type="button" id="btn-new-game" class="top-btn primary">New Game</button>
        </div>
      </header>

      <div class="workspace-grid">
        <aside class="left-panel">
          <section class="panel-section">
            <h2 class="section-heading">Expedition Teams</h2>
            <div id="player-cards-row" class="player-cards-list">
              ${playerCardsHtml}
            </div>
          </section>
          <section class="panel-section tickets-section">
            <div class="section-header-row">
              <h2 class="section-heading">Your Destination Tickets</h2>
              <button type="button" id="btn-draw-tickets" class="mini-btn">+ Draw Tickets</button>
            </div>
            <div id="player-tickets-list" class="tickets-list"></div>
          </section>
        </aside>

        <main class="board-stage">
          <div id="map-viewport" class="map-viewport">
            ${renderNepalMapSvg()}
            <div class="map-zoom-controls">
              <button type="button" id="btn-zoom-in" class="zoom-btn" title="Zoom In">+</button>
              <button type="button" id="btn-zoom-reset" class="zoom-btn" title="Reset View">100%</button>
              <button type="button" id="btn-zoom-out" class="zoom-btn" title="Zoom Out">−</button>
            </div>
            <div id="board-tooltip" class="board-tooltip hidden"></div>
          </div>
        </main>

        <aside class="right-panel">
          <section class="panel-section">
            <h2 class="section-heading">Transport Market</h2>
            <button type="button" id="btn-draw-blind" class="blind-deck-btn">
              <span>Draw Blind Deck</span>
              <small id="deck-remaining-count">110 cards</small>
            </button>
            <div class="market-slots-stack">
              ${marketSlotsHtml}
            </div>
          </section>
        </aside>
      </div>

      <footer class="bottom-hand-bar">
        <div class="hand-bar-label">Your Transport Hand</div>
        <div class="hand-chips-row">
          ${handChipsHtml}
        </div>
        <div id="game-log-ticker" class="game-log-ticker">
          Welcome to Nepal! Connect Terai highways, Pahad hills, and Himalayan mountain passes.
        </div>
      </footer>

      <div id="modal-overlay" class="modal-overlay hidden"></div>
    </div>
  `;
}

export function attachBoardViewportInteractions(
  binder: BoardBinder,
  getRouteOwners?: () => Array<number | null>
): void {
  const svg = document.getElementById('nepal-board-svg') as SVGSVGElement | null;
  const tooltip = document.getElementById('board-tooltip');
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  const zoomResetBtn = document.getElementById('btn-zoom-reset');

  let zoom = 1;
  const applyZoom = () => {
    if (svg) {
      svg.style.transform = `scale(${zoom})`;
    }
    if (zoomResetBtn) {
      zoomResetBtn.textContent = `${Math.round(zoom * 100)}%`;
    }
  };

  zoomInBtn?.addEventListener('click', () => {
    zoom = Math.min(1.6, Number((zoom + 0.15).toFixed(2)));
    applyZoom();
  });

  zoomOutBtn?.addEventListener('click', () => {
    zoom = Math.max(0.75, Number((zoom - 0.15).toFixed(2)));
    applyZoom();
  });

  zoomResetBtn?.addEventListener('click', () => {
    zoom = 1;
    applyZoom();
  });

  const showTooltip = (html: string, clientX: number, clientY: number) => {
    if (!tooltip) return;
    const viewport = document.getElementById('map-viewport');
    const rect = viewport?.getBoundingClientRect();
    const relX = rect ? clientX - rect.left + 14 : clientX;
    const relY = rect ? clientY - rect.top - 12 : clientY;
    tooltip.innerHTML = html;
    tooltip.style.left = `${relX}px`;
    tooltip.style.top = `${relY}px`;
    tooltip.classList.remove('hidden');
  };

  const hideTooltip = () => {
    tooltip?.classList.add('hidden');
  };

  document.querySelectorAll('.city-node').forEach((node) => {
    node.addEventListener('mousemove', (e) => {
      const ev = e as MouseEvent;
      const cityId = node.getAttribute('data-city') ?? '';
      const city = CITY_BY_ID.get(cityId);
      if (!city) return;
      showTooltip(
        `<strong>${city.name} (${city.nepaliName})</strong><br/>Region: ${city.region.toUpperCase()} • ${city.elevationMeters}m`,
        ev.clientX,
        ev.clientY
      );
      if (getRouteOwners) {
        const connected = getConnectedComponent(cityId, 0, getRouteOwners());
        if (connected.size > 1) {
          connected.forEach((cid) => {
            document.getElementById(`city-${cid}`)?.classList.add('city-network-connected');
          });
        }
      }
    });
    node.addEventListener('mouseleave', () => {
      hideTooltip();
      document.querySelectorAll('.city-network-connected').forEach((el) => {
        el.classList.remove('city-network-connected');
      });
    });
  });

  document.querySelectorAll('.route-group').forEach((group) => {
    group.addEventListener('mousemove', (e) => {
      const ev = e as MouseEvent;
      const routeId = Number(group.getAttribute('data-route-id') ?? '-1');
      const route = NEPAL_ROUTES[routeId];
      if (!route) return;
      const fromName = CITY_BY_ID.get(route.from)?.name ?? route.from;
      const toName = CITY_BY_ID.get(route.to)?.name ?? route.to;
      const pts = ROUTE_POINTS_TABLE[route.length] ?? 1;
      const owner = binder.routeOwners.current(routeId);
      const passBadge = route.isMountainPass ? ' • 🏔️ Mountain Pass (+2 bonus pts)' : '';
      const ownerLine = owner?.ownerId !== null
        ? `<br/>Claimed by: <strong>${owner.ownerName}</strong>`
        : `<br/>Color: <strong>${route.color.toUpperCase()}</strong> • Length: ${route.length} (${pts} pts)${passBadge}`;
      showTooltip(
        `<strong>${fromName} ↔ ${toName}</strong>${ownerLine}`,
        ev.clientX,
        ev.clientY
      );
    });
    group.addEventListener('mouseleave', hideTooltip);
  });
}
