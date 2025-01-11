import './style.css';
import { renderGameWorkspaceMarkup, attachBoardViewportInteractions } from './boardView';
import { BoardBinder } from './binder';
import { PlayerState } from './types';

const initialPlayers: PlayerState[] = [
  {
    id: 0,
    name: 'Explorer (You)',
    colorHex: '#b85d38',
    personality: 'human',
    score: 0,
    carriages: 40,
    hand: { red: 1, blue: 1, green: 1, yellow: 0, orange: 1, purple: 0, white: 0, black: 0, locomotive: 1 },
    tickets: [],
  },
  {
    id: 1,
    name: 'Sherpa Tenzing',
    colorHex: '#2a6f97',
    personality: 'sherpa',
    score: 0,
    carriages: 40,
    hand: { red: 0, blue: 0, green: 0, yellow: 0, orange: 0, purple: 0, white: 0, black: 0, locomotive: 0 },
    tickets: [],
  },
  {
    id: 2,
    name: 'Terai Express',
    colorHex: '#3a7d44',
    personality: 'express',
    score: 0,
    carriages: 40,
    hand: { red: 0, blue: 0, green: 0, yellow: 0, orange: 0, purple: 0, white: 0, black: 0, locomotive: 0 },
    tickets: [],
  },
];

const appRoot = document.getElementById('app');
if (appRoot) {
  appRoot.innerHTML = renderGameWorkspaceMarkup(initialPlayers);
  const binder = new BoardBinder(initialPlayers.length);
  binder.syncHand(initialPlayers[0].hand);
  binder.syncMarket(['red', 'blue', 'locomotive', 'green', 'orange']);
  attachBoardViewportInteractions(binder);
}
