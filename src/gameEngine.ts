import { ALL_CARD_COLORS, BoardBinder } from './binder';
import { computeLongestTrailForPlayer, findShortestUnclaimedRoutesForTicket, updateTicketsCompletionForPlayer } from './graph';
import { CITY_BY_ID, NEPAL_ROUTES, NEPAL_TICKETS } from './nepalMapData';
import { CardColor, DestinationTicket, NepalRoute, PlayerState, ROUTE_POINTS_TABLE, TurnPhase } from './types';

const STORAGE_KEY = 'yatrak.save.v1';

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
  public pendingTickets: DestinationTicket[] = [];
  public minTicketsToKeep = 1;
  public routeOwners: Array<number | null>;
  public activePlayerIdx = 0;
  public phase: TurnPhase = 'choose-action';
  public finalTurnsRemaining: number | null = null;
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

  public startTicketDraft(isInitialSetup = false): boolean {
    if (!isInitialSetup && this.phase !== 'choose-action') {
      return false;
    }
    if (this.ticketDeck.length === 0) {
      this.logEvent('No more Destination Tickets remaining in the deck!');
      return false;
    }
    this.pendingTickets = this.ticketDeck.splice(0, 3);
    this.minTicketsToKeep = isInitialSetup ? Math.min(2, this.pendingTickets.length) : 1;
    this.phase = isInitialSetup ? 'setup-tickets' : 'selecting-tickets';
    this.syncAllBindings(`Select at least ${this.minTicketsToKeep} Destination Ticket(s) to keep.`);
    this.renderTicketDraftModal();
    return true;
  }

  public confirmTicketDraft(selectedTicketIds: number[]): boolean {
    if (selectedTicketIds.length < this.minTicketsToKeep) {
      return false;
    }
    const player = this.players[this.activePlayerIdx];
    const kept: DestinationTicket[] = [];
    const returned: DestinationTicket[] = [];

    for (const t of this.pendingTickets) {
      if (selectedTicketIds.includes(t.id)) {
        kept.push(t);
      } else {
        returned.push(t);
      }
    }

    player.tickets.push(...kept);
    this.ticketDeck.push(...returned);
    const wasSetup = this.phase === 'setup-tickets';
    this.pendingTickets = [];

    const modal = document.getElementById('modal-overlay');
    modal?.classList.add('hidden');
    this.renderPlayerTicketsList();

    if (wasSetup) {
      this.phase = 'choose-action';
      this.logEvent(`${player.name} kept ${kept.length} initial Destination Tickets. Game begins!`);
      this.syncAllBindings('Draw 2 transport cards, claim a route, or draw destination tickets.');
    } else {
      this.logEvent(`${player.name} drafted ${kept.length} new Destination Ticket(s).`);
      this.advanceTurn();
    }
    return true;
  }

  public renderPlayerTicketsList(): void {
    const listEl = document.getElementById('player-tickets-list');
    const human = this.players[0];
    if (!listEl || !human) return;

    listEl.innerHTML = human.tickets
      .map((t) => {
        const fromName = CITY_BY_ID.get(t.from)?.name ?? t.from;
        const toName = CITY_BY_ID.get(t.to)?.name ?? t.to;
        return `
          <div class="ticket-card${t.completed ? ' completed' : ''}" data-from="${t.from}" data-to="${t.to}">
            <div class="ticket-route-line">
              <span>${fromName} → ${toName}</span>
              <span>${t.completed ? '✓ ' : ''}+${t.points}</span>
            </div>
            <div class="ticket-corridor">${t.corridorName}</div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.ticket-card').forEach((card) => {
      card.addEventListener('mouseenter', () => {
        const fromId = card.getAttribute('data-from') ?? '';
        const toId = card.getAttribute('data-to') ?? '';
        document.getElementById(`city-${fromId}`)?.classList.add('city-ticket-focus');
        document.getElementById(`city-${toId}`)?.classList.add('city-ticket-focus');
      });
      card.addEventListener('mouseleave', () => {
        document.querySelectorAll('.city-ticket-focus').forEach((el) => {
          el.classList.remove('city-ticket-focus');
        });
      });
    });
  }

  public renderTicketDraftModal(): void {
    const modal = document.getElementById('modal-overlay');
    if (!modal || this.pendingTickets.length === 0) return;

    const selected = new Set<number>(this.pendingTickets.map((t) => t.id));

    const drawModalContent = () => {
      const canConfirm = selected.size >= this.minTicketsToKeep;
      const cardsHtml = this.pendingTickets
        .map((t) => {
          const isChecked = selected.has(t.id);
          const fromName = CITY_BY_ID.get(t.from)?.name ?? t.from;
          const toName = CITY_BY_ID.get(t.to)?.name ?? t.to;
          return `
            <label class="draft-ticket-option${isChecked ? ' selected' : ''}" data-ticket-id="${t.id}">
              <input type="checkbox" ${isChecked ? 'checked' : ''} data-ticket-check="${t.id}" />
              <div class="draft-ticket-info">
                <strong>${fromName} ↔ ${toName} (+${t.points} pts)</strong>
                <small>${t.corridorName}</small>
              </div>
            </label>
          `;
        })
        .join('');

      modal.innerHTML = `
        <div class="modal-card">
          <h3>Draft Destination Tickets</h3>
          <p class="modal-subtitle">Choose at least <strong>${this.minTicketsToKeep}</strong> ticket(s) to keep. Completed tickets add points; uncompleted tickets deduct points at game end.</p>
          <div class="draft-tickets-stack">${cardsHtml}</div>
          <div class="modal-actions">
            <button type="button" id="btn-confirm-tickets" class="top-btn primary" ${canConfirm ? '' : 'disabled'}>
              Keep ${selected.size} Ticket(s)
            </button>
          </div>
        </div>
      `;

      modal.querySelectorAll('[data-ticket-check]').forEach((input) => {
        input.addEventListener('change', (e) => {
          const id = Number((e.currentTarget as HTMLElement).getAttribute('data-ticket-check'));
          if (selected.has(id)) {
            selected.delete(id);
          } else {
            selected.add(id);
          }
          drawModalContent();
        });
      });

      const confirmBtn = document.getElementById('btn-confirm-tickets');
      confirmBtn?.addEventListener('click', () => {
        this.confirmTicketDraft(Array.from(selected));
      });
    };

    drawModalContent();
    modal.classList.remove('hidden');
  }

  public logEvent(message: string): void {
    const ticker = document.getElementById('game-log-ticker');
    if (ticker) {
      ticker.textContent = message;
    }
  }

  public spawnFloatingRoutePopup(routeId: number, label: string, colorHex: string): void {
    const tokenEl = document.getElementById(`route-owner-token-${routeId}`);
    const viewport = document.getElementById('map-viewport');
    if (!tokenEl || !viewport) return;
    const tokenRect = tokenEl.getBoundingClientRect();
    const viewRect = viewport.getBoundingClientRect();

    const popup = document.createElement('div');
    popup.className = 'floating-score-popup';
    popup.textContent = label;
    popup.style.backgroundColor = colorHex;
    popup.style.left = `${tokenRect.left - viewRect.left}px`;
    popup.style.top = `${tokenRect.top - viewRect.top - 10}px`;
    viewport.appendChild(popup);
    window.setTimeout(() => {
      popup.remove();
    }, 1100);
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
    const justPlayed = this.players[this.activePlayerIdx];
    if (this.finalTurnsRemaining === null && justPlayed.carriages <= 2) {
      this.finalTurnsRemaining = this.players.length;
      this.logEvent(`🔔 ${justPlayed.name} has ${justPlayed.carriages} carriages left! Final round triggered.`);
    }

    if (this.finalTurnsRemaining !== null) {
      this.finalTurnsRemaining -= 1;
      if (this.finalTurnsRemaining <= 0) {
        this.finishGameAndScore();
        return;
      }
    }

    this.phase = 'choose-action';
    this.activePlayerIdx = (this.activePlayerIdx + 1) % this.players.length;
    const nextPlayer = this.players[this.activePlayerIdx];
    this.syncAllBindings(`${nextPlayer.name}'s turn — Draw cards, claim a route, or draw tickets.`);

    if (nextPlayer.personality !== 'human') {
      window.setTimeout(() => {
        this.executeBotTurn();
      }, 650);
    }
  }

  public finishGameAndScore(): void {
    this.phase = 'game-over';

    const trails = this.players.map((p) => computeLongestTrailForPlayer(p.id, this.routeOwners));
    const maxTrailLen = Math.max(0, ...trails.map((t) => t.length));

    const summaryRows: string[] = [];
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      updateTicketsCompletionForPlayer(p.tickets, p.id, this.routeOwners);
      const routeScore = p.score;
      let ticketBonus = 0;
      for (const t of p.tickets) {
        ticketBonus += t.completed ? t.points : -t.points;
      }
      const hasLongest = maxTrailLen > 0 && trails[i].length === maxTrailLen;
      const longestBonus = hasLongest ? 10 : 0;
      if (hasLongest) {
        trails[i].routeIds.forEach((rid) => this.binder.setRouteHighlight(rid, true));
      }
      p.score = routeScore + ticketBonus + longestBonus;

      summaryRows.push(`
        <tr>
          <td><span class="player-dot" style="display:inline-block;background:${p.colorHex};margin-right:6px"></span><strong>${p.name}</strong></td>
          <td>${routeScore}</td>
          <td>${ticketBonus >= 0 ? `+${ticketBonus}` : ticketBonus}</td>
          <td>${trails[i].length} segs ${hasLongest ? '(+10 🏆)' : ''}</td>
          <td><strong>${p.score} pts</strong></td>
        </tr>
      `);
    }

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    this.syncAllBindings(`🏆 Expedition Complete! Winner: ${winner.name} (${winner.score} pts)`);

    const modal = document.getElementById('modal-overlay');
    if (modal) {
      modal.innerHTML = `
        <div class="modal-card modal-wide">
          <h3>🏆 Expedition Complete — Final Standings</h3>
          <p class="modal-subtitle">Winner: <strong>${winner.name}</strong> with <strong>${winner.score} points</strong>! Longest continuous trail highlighted in gold on the map.</p>
          <table class="standings-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Routes</th>
                <th>Tickets</th>
                <th>Longest Trail</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${summaryRows.join('')}
            </tbody>
          </table>
          <div class="modal-actions">
            <button type="button" id="btn-close-standings" class="top-btn primary">Inspect Map</button>
          </div>
        </div>
      `;
      modal.classList.remove('hidden');
      document.getElementById('btn-close-standings')?.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }
  }

  public executeBotTurn(): void {
    if (this.phase === 'game-over') return;
    const bot = this.players[this.activePlayerIdx];
    if (!bot || bot.personality === 'human') return;

    const plannedRouteIds = new Set<number>();
    for (const ticket of bot.tickets) {
      if (!ticket.completed) {
        const steps = findShortestUnclaimedRoutesForTicket(
          ticket.from,
          ticket.to,
          bot.id,
          this.routeOwners,
          this.players.length
        );
        steps.forEach((rid) => plannedRouteIds.add(rid));
      }
    }

    const claimableRoutes = NEPAL_ROUTES.filter((r) => this.canClaimRoute(this.activePlayerIdx, r.id));

    if (claimableRoutes.length > 0) {
      const scored = claimableRoutes.map((r) => {
        let priority = r.length * 3;
        if (plannedRouteIds.has(r.id)) priority += 25;
        if (bot.personality === 'sherpa' && r.isMountainPass) priority += 12;
        if (bot.personality === 'express' && r.length >= 3) priority += 10;
        if (bot.personality === 'blocker') {
          const fromHub = CITY_BY_ID.get(r.from)?.isHub;
          const toHub = CITY_BY_ID.get(r.to)?.isHub;
          if (fromHub && toHub) priority += 14;
        }
        return { route: r, priority };
      });
      scored.sort((a, b) => b.priority - a.priority);
      const chosen = scored[0].route;
      if (scored[0].priority >= 12 || bot.carriages <= 10) {
        this.tryClaimRoute(chosen.id);
        return;
      }
    }

    const neededColors = new Set<CardColor>();
    plannedRouteIds.forEach((rid) => {
      const r = NEPAL_ROUTES[rid];
      if (r && r.color !== 'gray') {
        neededColors.add(r.color);
      }
    });

    const locoSlot = this.market.findIndex((c) => c === 'locomotive');
    if (locoSlot !== -1 && (bot.personality === 'sherpa' || neededColors.size === 0)) {
      this.drawMarketCard(locoSlot);
      return;
    }

    const matchingSlot = this.market.findIndex((c) => c !== null && c !== 'locomotive' && neededColors.has(c));
    if (matchingSlot !== -1) {
      this.drawMarketCard(matchingSlot);
    } else {
      this.drawBlindCard();
    }

    if (this.phase === 'drawing-second-card' && this.activePlayerIdx === bot.id) {
      const secondSlot = this.market.findIndex((c) => c !== null && c !== 'locomotive' && neededColors.has(c));
      if (secondSlot !== -1) {
        this.drawMarketCard(secondSlot);
      } else {
        this.drawBlindCard();
      }
    }
  }

  public findPayableColorForRoute(
    player: PlayerState,
    route: NepalRoute
  ): { colorUsed: Exclude<CardColor, 'locomotive'>; colorCount: number; wildCount: number } | null {
    const needed = route.length;
    if (player.carriages < needed) return null;

    const wilds = player.hand.locomotive ?? 0;
    const baseColors: Array<Exclude<CardColor, 'locomotive'>> = [
      'red',
      'blue',
      'green',
      'yellow',
      'orange',
      'purple',
      'white',
      'black',
    ];

    if (route.color !== 'gray') {
      const targetColor = route.color;
      const haveColor = player.hand[targetColor] ?? 0;
      if (haveColor + wilds < needed) return null;
      const useColor = Math.min(needed, haveColor);
      const useWild = needed - useColor;
      return { colorUsed: targetColor, colorCount: useColor, wildCount: useWild };
    }

    let bestChoice: { colorUsed: Exclude<CardColor, 'locomotive'>; colorCount: number; wildCount: number } | null = null;
    for (const col of baseColors) {
      const haveColor = player.hand[col] ?? 0;
      if (haveColor + wilds >= needed) {
        const useColor = Math.min(needed, haveColor);
        const useWild = needed - useColor;
        if (!bestChoice || useWild < bestChoice.wildCount) {
          bestChoice = { colorUsed: col, colorCount: useColor, wildCount: useWild };
        }
      }
    }
    return bestChoice;
  }

  public canClaimRoute(playerIdx: number, routeId: number): boolean {
    if (this.phase !== 'choose-action') return false;
    const route = NEPAL_ROUTES[routeId];
    if (!route || this.routeOwners[routeId] !== null) return false;

    const sibling = NEPAL_ROUTES.find(
      (r) =>
        r.id !== route.id &&
        ((r.from === route.from && r.to === route.to) || (r.from === route.to && r.to === route.from))
    );
    if (sibling && this.routeOwners[sibling.id] === playerIdx) {
      return false;
    }
    if (sibling && this.players.length <= 3 && this.routeOwners[sibling.id] !== null) {
      return false;
    }

    const player = this.players[playerIdx];
    return this.findPayableColorForRoute(player, route) !== null;
  }

  public tryClaimRoute(routeId: number): boolean {
    if (!this.canClaimRoute(this.activePlayerIdx, routeId)) {
      this.logEvent('Cannot claim this route yet — check required cards, carriages, or double-route rules.');
      return false;
    }
    const route = NEPAL_ROUTES[routeId];
    const player = this.players[this.activePlayerIdx];
    const payment = this.findPayableColorForRoute(player, route);
    if (!payment) return false;

    const fromName = CITY_BY_ID.get(route.from)?.name ?? route.from;
    const toName = CITY_BY_ID.get(route.to)?.name ?? route.to;

    let extraPassTax = 0;
    if (route.isMountainPass) {
      const weatherCard = this.drawSingleFromDeck();
      if (weatherCard) {
        this.discardPile.push(weatherCard);
        if (weatherCard === 'locomotive' || weatherCard === payment.colorUsed) {
          const remainingSame = (player.hand[payment.colorUsed] ?? 0) - payment.colorCount;
          const remainingWild = (player.hand.locomotive ?? 0) - payment.wildCount;
          if (remainingSame <= 0 && remainingWild <= 0) {
            this.logEvent(
              `🏔️ Mountain Pass weather check drew ${weatherCard.toUpperCase()} on ${fromName} ↔ ${toName}! Needed 1 extra card — expedition turned back.`
            );
            this.advanceTurn();
            return false;
          }
          extraPassTax = 1;
        }
      }
    }

    player.hand[payment.colorUsed] -= payment.colorCount;
    player.hand.locomotive -= payment.wildCount;
    for (let i = 0; i < payment.colorCount; i++) this.discardPile.push(payment.colorUsed);
    for (let i = 0; i < payment.wildCount; i++) this.discardPile.push('locomotive');

    if (extraPassTax > 0) {
      if (player.hand[payment.colorUsed] > 0) {
        player.hand[payment.colorUsed] -= 1;
        this.discardPile.push(payment.colorUsed);
      } else {
        player.hand.locomotive -= 1;
        this.discardPile.push('locomotive');
      }
    }

    player.carriages -= route.length;
    const basePoints = ROUTE_POINTS_TABLE[route.length] ?? 1;
    const passBonus = route.isMountainPass ? 2 : 0;
    const gainedPoints = basePoints + passBonus;
    player.score += gainedPoints;

    this.routeOwners[routeId] = player.id;
    this.binder.claimRoute(routeId, player.id, player.colorHex, player.name);
    updateTicketsCompletionForPlayer(player.tickets, player.id, this.routeOwners);
    this.spawnFloatingRoutePopup(routeId, `+${gainedPoints} pts`, player.colorHex);

    const passNote = route.isMountainPass
      ? ` (includes +2 Himalayan Pass bonus${extraPassTax ? ', +1 weather card paid' : ''})`
      : '';
    this.logEvent(`${player.name} claimed ${fromName} ↔ ${toName} (+${gainedPoints} pts)${passNote}!`);

    this.advanceTurn();
    return true;
  }

  public syncAllBindings(statusMessage: string): void {
    const humanPlayer = this.players[0];
    if (humanPlayer) {
      this.binder.syncHand(humanPlayer.hand);
      this.renderPlayerTicketsList();
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
    this.saveToStorage();
  }

  public saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        players: this.players,
        deck: this.deck,
        discardPile: this.discardPile,
        market: this.market,
        ticketDeck: this.ticketDeck,
        routeOwners: this.routeOwners,
        activePlayerIdx: this.activePlayerIdx,
        phase: this.phase === 'selecting-tickets' || this.phase === 'setup-tickets' ? 'choose-action' : this.phase,
        finalTurnsRemaining: this.finalTurnsRemaining,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }

  public restoreFromStorage(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.players) || parsed.players.length !== this.players.length) {
        return false;
      }
      this.players = parsed.players;
      this.deck = Array.isArray(parsed.deck) ? parsed.deck : this.deck;
      this.discardPile = Array.isArray(parsed.discardPile) ? parsed.discardPile : [];
      this.market = Array.isArray(parsed.market) ? parsed.market : this.market;
      this.ticketDeck = Array.isArray(parsed.ticketDeck) ? parsed.ticketDeck : this.ticketDeck;
      this.routeOwners = Array.isArray(parsed.routeOwners) ? parsed.routeOwners : this.routeOwners;
      this.activePlayerIdx = typeof parsed.activePlayerIdx === 'number' ? parsed.activePlayerIdx : 0;
      this.phase = parsed.phase ?? 'choose-action';
      this.finalTurnsRemaining = parsed.finalTurnsRemaining ?? null;

      this.routeOwners.forEach((ownerId, routeId) => {
        if (ownerId !== null && this.players[ownerId]) {
          const p = this.players[ownerId];
          this.binder.claimRoute(routeId, p.id, p.colorHex, p.name);
        }
      });

      const active = this.players[this.activePlayerIdx];
      this.syncAllBindings(`Resumed expedition — ${active.name}'s turn.`);
      return true;
    } catch {
      return false;
    }
  }

  public static clearSavedGame(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
