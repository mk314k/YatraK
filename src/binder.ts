import { MultiStateVar, StateVarList, StyleVarList } from 'statebinderk';
import { NEPAL_ROUTES } from './nepalMapData';
import { CardColor, CARD_COLOR_HEX, TurnPhase } from './types';

export const ALL_CARD_COLORS: CardColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'white',
  'black',
  'locomotive',
];

export interface RouteOwnershipBinding {
  ownerId: number | null;
  ownerColor: string;
  ownerName: string;
  highlighted?: boolean;
}

export interface TurnBannerBinding {
  activePlayerId: number;
  activePlayerName: string;
  activePlayerColor: string;
  phase: TurnPhase;
  statusMessage: string;
}

export class BoardBinder {
  public readonly routeOwners: StateVarList<RouteOwnershipBinding>;
  public readonly routeGlowStyles: StyleVarList<string>;
  public readonly playerScores: StateVarList<number>;
  public readonly playerCarriages: StateVarList<number>;
  public readonly handCardCounts: StateVarList<number>;
  public readonly marketSlots: StateVarList<CardColor | null>;
  public readonly turnBanner: MultiStateVar<TurnBannerBinding>;

  public constructor(playerCount = 4) {
    const initialOwners = NEPAL_ROUTES.map((r) => ({
      id: `route-${r.id}`,
      state: {
        ownerId: null,
        ownerColor: '',
        ownerName: '',
        highlighted: false,
      } as RouteOwnershipBinding,
    }));

    this.routeOwners = new StateVarList<RouteOwnershipBinding>(
      initialOwners,
      (element, state) => {
        const routeId = element.getAttribute('data-route-id');
        const tokenGroup = routeId
          ? document.getElementById(`route-owner-token-${routeId}`)
          : null;

        if (state.ownerId !== null) {
          element.classList.add('route-claimed');
          const boxes = element.querySelectorAll('.route-segment-box');
          boxes.forEach((box) => {
            box.setAttribute('fill', state.ownerColor);
            box.setAttribute('stroke', '#fffdf9');
            box.setAttribute('stroke-width', '2');
          });
          if (tokenGroup) {
            tokenGroup.innerHTML = `
              <circle r="9" fill="${state.ownerColor}" stroke="#fffdf9" stroke-width="2" />
              <text y="3.5" text-anchor="middle" fill="#fffdf9" font-size="9" font-weight="800">
                ${state.ownerName.slice(0, 1).toUpperCase()}
              </text>
            `;
          }
        } else {
          element.classList.remove('route-claimed');
          if (tokenGroup) {
            tokenGroup.innerHTML = '';
          }
        }

        if (state.highlighted) {
          element.classList.add('route-longest-highlight');
        } else {
          element.classList.remove('route-longest-highlight');
        }
      }
    );

    const initialGlows = NEPAL_ROUTES.map((r) => ({
      id: `route-${r.id}`,
      state: 'none',
    }));

    this.routeGlowStyles = new StyleVarList<string>(
      initialGlows,
      'filter'
    );

    const scoreInit = Array.from({ length: playerCount }, (_, idx) => ({
      id: `player-score-${idx}`,
      state: 0,
    }));
    this.playerScores = new StateVarList<number>(
      scoreInit,
      (el, score) => {
        el.textContent = `${score} pts`;
      }
    );

    const carriageInit = Array.from({ length: playerCount }, (_, idx) => ({
      id: `player-carriages-${idx}`,
      state: 40,
    }));
    this.playerCarriages = new StateVarList<number>(
      carriageInit,
      (el, count) => {
        el.textContent = `🚌 ${count}`;
      }
    );

    const handInit = ALL_CARD_COLORS.map((color) => ({
      id: `hand-count-${color}`,
      state: 0,
    }));
    this.handCardCounts = new StateVarList<number>(
      handInit,
      (el, count) => {
        el.textContent = String(count);
        const chip = el.closest('.hand-card-chip');
        if (chip) {
          if (count > 0) {
            chip.classList.remove('empty-card');
          } else {
            chip.classList.add('empty-card');
          }
        }
      }
    );

    const marketInit = Array.from({ length: 5 }, (_, slotIdx) => ({
      id: `market-slot-${slotIdx}`,
      state: null as CardColor | null,
    }));
    this.marketSlots = new StateVarList<CardColor | null>(
      marketInit,
      (el, cardColor) => {
        if (!cardColor) {
          el.textContent = 'Empty';
          el.style.background = '#e5dac7';
          el.style.color = '#756759';
          return;
        }
        const hex = CARD_COLOR_HEX[cardColor];
        el.style.background =
          cardColor === 'locomotive'
            ? 'linear-gradient(135deg, #c83e31 0%, #d99b26 35%, #3a7d44 70%, #2a6f97 100%)'
            : hex;
        el.style.color = cardColor === 'white' || cardColor === 'yellow' ? '#2b2118' : '#fffdf9';
        el.textContent = cardColor === 'locomotive' ? '★ Wild Yak / Bus' : cardColor.toUpperCase();
      }
    );

    this.turnBanner = new MultiStateVar<TurnBannerBinding>({
      activePlayerId: 0,
      activePlayerName: 'Player 1',
      activePlayerColor: '#b85d38',
      phase: 'choose-action',
      statusMessage: 'Draw 2 transport cards, claim a route, or draw destination tickets.',
    });

    this.turnBanner.addBinding('turn-player-badge', (el, st) => {
      el.textContent = st.activePlayerName;
      el.style.backgroundColor = st.activePlayerColor;
    });

    this.turnBanner.addBinding('turn-status-text', (el, st) => {
      el.textContent = st.statusMessage;
    });

    this.turnBanner.addBinding('player-cards-row', (el, st) => {
      const cards = el.querySelectorAll('.player-summary-card');
      cards.forEach((card, idx) => {
        if (idx === st.activePlayerId) {
          card.classList.add('active-turn');
        } else {
          card.classList.remove('active-turn');
        }
      });
    });
  }

  public claimRoute(routeId: number, ownerId: number, ownerColor: string, ownerName: string): void {
    this.routeOwners.transition(routeId, {
      ownerId,
      ownerColor,
      ownerName,
      highlighted: false,
    });
  }

  public setRouteHighlight(routeId: number, highlighted: boolean): void {
    const current = this.routeOwners.current(routeId);
    if (current) {
      this.routeOwners.transition(routeId, {
        ...current,
        highlighted,
      });
      this.routeGlowStyles.transition(
        routeId,
        highlighted ? 'drop-shadow(0 0 6px #d99b26)' : 'none'
      );
    }
  }

  public syncHand(hand: Record<CardColor, number>): void {
    const counts = ALL_CARD_COLORS.map((c) => hand[c] ?? 0);
    this.handCardCounts.listTransition(counts);
  }

  public syncMarket(cards: Array<CardColor | null>): void {
    const padded = Array.from({ length: 5 }, (_, i) => cards[i] ?? null);
    this.marketSlots.listTransition(padded);
  }
}
