import { ALL_CARD_COLORS, BoardBinder } from './binder';
import { NEPAL_TICKETS } from './nepalMapData';
import { CardColor, DestinationTicket, PlayerState, TurnPhase } from './types';

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function createEmptyHand(): Record<CardColor, number> {
  return {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
    orange: 0,
    purple: 0,
    white: 0,
    black: 0,
    locomotive: 0,
  };
}

export function buildTransportDeck(): CardColor[] {
  const deck: CardColor[] = [];
  for (const color of ALL_CARD_COLORS) {
    const count = color === 'locomotive' ? 14 : 12;
    for (let i = 0; i < count; i++) {
      deck.push(color);
    }
  }
  return shuffleArray(deck);
}

export class NepalGameEngine {
  public players: PlayerState[];
  public deck: CardColor[] = [];
  public discardPile: CardColor[] = [];
  public market: Array<CardColor | null> = [null, null, null, null, null];
  public ticketDeck: DestinationTicket[] = [];
  public routeOwners: Array<number | null>;
  public activePlayerIdx = 0;
  public phase: TurnPhase = 'choose-action';
  public binder: BoardBinder;

  public constructor(players: PlayerState[], binder: BoardBinder, routeCount = 56) {
    this.players = players;
    this.binder = binder;
    this.routeOwners = Array.from({ length: routeCount }, () => null);
    this.initDecksAndDeal();
  }

  public initDecksAndDeal(): void {
    this.deck = buildTransportDeck();
    this.discardPile = [];
    this.ticketDeck = shuffleArray(NEPAL_TICKETS.map((t) => ({ ...t, completed: false })));

    for (const player of this.players) {
      player.hand = createEmptyHand();
      for (let i = 0; i < 4; i++) {
        const card = this.drawSingleFromDeck();
        if (card) {
          player.hand[card] += 1;
        }
      }
      player.tickets = this.ticketDeck.splice(0, 2);
    }

    for (let slot = 0; slot < 5; slot++) {
      this.market[slot] = this.drawSingleFromDeck();
    }

    this.syncAllBindings('Draw 2 transport cards, claim a route, or draw destination tickets.');
  }

  public drawSingleFromDeck(): CardColor | null {
    if (this.deck.length === 0 && this.discardPile.length > 0) {
      this.deck = shuffleArray(this.discardPile);
      this.discardPile = [];
    }
    return this.deck.pop() ?? null;
  }

  public replenishMarketSlot(slotIdx: number): void {
    this.market[slotIdx] = this.drawSingleFromDeck();
    this.binder.syncMarket(this.market);
    this.updateDeckRemainingCount();
  }

  public updateDeckRemainingCount(): void {
    const deckCountEl = document.getElementById('deck-remaining-count');
    if (deckCountEl) {
      deckCountEl.textContent = `${this.deck.length} cards`;
    }
  }

  public logEvent(message: string): void {
    const ticker = document.getElementById('game-log-ticker');
    if (ticker) {
      ticker.textContent = message;
    }
  }

  public syncAllBindings(statusMessage: string): void {
    const humanPlayer = this.players[0];
    if (humanPlayer) {
      this.binder.syncHand(humanPlayer.hand);
    }
    this.binder.syncMarket(this.market);
    this.players.forEach((p, idx) => {
      this.binder.playerScores.transition(idx, p.score);
      this.binder.playerCarriages.transition(idx, p.carriages);
    });
    const active = this.players[this.activePlayerIdx];
    this.binder.turnBanner.transition({
      activePlayerId: this.activePlayerIdx,
      activePlayerName: active.name,
      activePlayerColor: active.colorHex,
      phase: this.phase,
      statusMessage,
    });
    this.updateDeckRemainingCount();
  }
}
