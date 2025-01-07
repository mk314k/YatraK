import { NEPAL_CITIES, NEPAL_ROUTES, CITY_BY_ID, MAP_WIDTH, MAP_HEIGHT } from './nepalMapData';
import { NepalRegion, NepalRoute, ROUTE_COLOR_HEX } from './types';

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
