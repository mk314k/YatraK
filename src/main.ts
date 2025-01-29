import './style.css';
import {
  renderGameWorkspaceMarkup,
  attachBoardViewportInteractions,
  openRulesModal,
  openNewGameSetupModal,
} from './boardView';
import { BoardBinder } from './binder';
import { NepalGameEngine, createEmptyHand } from './gameEngine';
import { PlayerState } from './types';

const defaultPlayers: PlayerState[] = [
  {
    id: 0,
    name: 'Explorer (You)',
    colorHex: '#c83e31',
    personality: 'human',
    score: 0,
    carriages: 40,
    hand: createEmptyHand(),
    tickets: [],
  },
  {
    id: 1,
    name: 'Sherpa Tenzing',
    colorHex: '#2a6f97',
    personality: 'sherpa',
    score: 0,
    carriages: 40,
    hand: createEmptyHand(),
    tickets: [],
  },
  {
    id: 2,
    name: 'Terai Express',
    colorHex: '#3a7d44',
    personality: 'express',
    score: 0,
    carriages: 40,
    hand: createEmptyHand(),
    tickets: [],
  },
];

function mountGameSession(players: PlayerState[], isFreshGame = false): void {
  const appRoot = document.getElementById('app');
  if (!appRoot) return;

  if (isFreshGame) {
    NepalGameEngine.clearSavedGame();
  }

  appRoot.innerHTML = renderGameWorkspaceMarkup(players);
  const binder = new BoardBinder(players.length);
  const engine = new NepalGameEngine(players, binder);
  if (!isFreshGame) {
    engine.restoreFromStorage();
  }

  attachBoardViewportInteractions(binder, () => engine.routeOwners);

  document.getElementById('btn-draw-blind')?.addEventListener('click', () => {
    if (engine.activePlayerIdx === 0) {
      engine.drawBlindCard();
    }
  });

  document.querySelectorAll('.market-card-slot').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (engine.activePlayerIdx === 0) {
        const slotIdx = Number(btn.getAttribute('data-slot') ?? '0');
        engine.drawMarketCard(slotIdx);
      }
    });
  });

  document.querySelectorAll('.route-group').forEach((group) => {
    group.addEventListener('click', () => {
      if (engine.activePlayerIdx === 0) {
        const routeId = Number(group.getAttribute('data-route-id') ?? '-1');
        if (routeId >= 0) {
          engine.tryClaimRoute(routeId);
        }
      }
    });
  });

  document.getElementById('btn-draw-tickets')?.addEventListener('click', () => {
    if (engine.activePlayerIdx === 0) {
      engine.startTicketDraft(false);
    }
  });

  document.getElementById('btn-rules')?.addEventListener('click', () => {
    openRulesModal();
  });

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    openNewGameSetupModal((configuredPlayers) => {
      mountGameSession(configuredPlayers, true);
    });
  });
}

mountGameSession(defaultPlayers);
