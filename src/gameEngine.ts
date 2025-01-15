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
    this.checkMarketLocomotiveWipe();

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
    this.checkMarketLocomotiveWipe();
    this.binder.syncMarket(this.market);
    this.updateDeckRemainingCount();
  }

  public checkMarketLocomotiveWipe(): void {
    let safety = 0;
    while (safety < 5) {
      const locoCount = this.market.filter((c) => c === 'locomotive').length;
      if (locoCount < 3) break;
      safety += 1;
      for (const c of this.market) {
        if (c) this.discardPile.push(c);
      }
      for (let i = 0; i < 5; i++) {
        this.market[i] = this.drawSingleFromDeck();
      }
      this.logEvent('3+ Wild Locomotives in market — wiped and dealt 5 fresh transport cards!');
    }
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

  public drawBlindCard(): void {
    if (this.phase !== 'choose-action' && this.phase !== 'drawing-second-card') {
      return;
    }
    const player = this.players[this.activePlayerIdx];
    const drawn = this.drawSingleFromDeck();
    if (!drawn) {
      this.logEvent('Transport deck is empty!');
      return;
    }
    player.hand[drawn] += 1;
    if (this.phase === 'choose-action') {
      this.phase = 'drawing-second-card';
      this.logEvent(`${player.name} drew 1 blind card. Draw 1 more card (face-up Wild not allowed).`);
      this.syncAllBindings('Draw 1 more card from the blind deck or a non-wild market slot.');
    } else {
      this.logEvent(`${player.name} completed drawing 2 transport cards.`);
      this.advanceTurn();
    }
  }

  public drawMarketCard(slotIdx: number): void {
    if (this.phase !== 'choose-action' && this.phase !== 'drawing-second-card') {
      return;
    }
    const card = this.market[slotIdx];
    if (!card) return;

    if (this.phase === 'drawing-second-card' && card === 'locomotive') {
      this.logEvent('Cannot take a face-up Wild Locomotive as your second card!');
      return;
    }

    const player = this.players[this.activePlayerIdx];
    player.hand[card] += 1;
    this.replenishMarketSlot(slotIdx);

    if (card === 'locomotive') {
      this.logEvent(`${player.name} took a face-up ★ Wild Locomotive (counts as 2 draws).`);
      this.advanceTurn();
    } else if (this.phase === 'choose-action') {
      this.phase = 'drawing-second-card';
      this.logEvent(`${player.name} took a ${card.toUpperCase()} card. Draw 1 more card.`);
      this.syncAllBindings('Draw 1 more card (blind deck or non-wild market card).');
    } else {
      this.logEvent(`${player.name} took a ${card.toUpperCase()} card and finished their turn.`);
      this.advanceTurn();
    }
  }

  public advanceTurn(): void {
    this.phase = 'choose-action';
    this.activePlayerIdx = (this.activePlayerIdx + 1) % this.players.length;
    const nextPlayer = this.players[this.activePlayerIdx];
    this.syncAllBindings(`${nextPlayer.name}'s turn — Draw cards, claim a route, or draw tickets.`);
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
