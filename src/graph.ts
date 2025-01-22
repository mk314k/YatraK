import { NEPAL_ROUTES } from './nepalMapData';
import { DestinationTicket } from './types';

export function buildPlayerAdjacency(
  playerId: number,
  routeOwners: Array<number | null>
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();

  for (let i = 0; i < NEPAL_ROUTES.length; i++) {
    if (routeOwners[i] !== playerId) continue;
    const r = NEPAL_ROUTES[i];
    if (!adj.has(r.from)) adj.set(r.from, new Set());
    if (!adj.has(r.to)) adj.set(r.to, new Set());
    adj.get(r.from)!.add(r.to);
    adj.get(r.to)!.add(r.from);
  }
  return adj;
}

export function getConnectedComponent(
  startCity: string,
  playerId: number,
  routeOwners: Array<number | null>
): Set<string> {
  const adj = buildPlayerAdjacency(playerId, routeOwners);
  const visited = new Set<string>([startCity]);
  const queue: string[] = [startCity];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const neighbors = adj.get(cur);
    if (!neighbors) continue;
    for (const nxt of neighbors) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return visited;
}

export function areCitiesConnectedForPlayer(
  fromCity: string,
  toCity: string,
  playerId: number,
  routeOwners: Array<number | null>
): boolean {
  if (fromCity === toCity) return true;
  const reachable = getConnectedComponent(fromCity, playerId, routeOwners);
  return reachable.has(toCity);
}

export function updateTicketsCompletionForPlayer(
  tickets: DestinationTicket[],
  playerId: number,
  routeOwners: Array<number | null>
): void {
  for (const ticket of tickets) {
    ticket.completed = areCitiesConnectedForPlayer(ticket.from, ticket.to, playerId, routeOwners);
  }
}

export interface LongestTrailResult {
  length: number;
  routeIds: number[];
}

export function computeLongestTrailForPlayer(
  playerId: number,
  routeOwners: Array<number | null>
): LongestTrailResult {
  interface EdgeRef {
    routeId: number;
    to: string;
    weight: number;
  }

  const adj = new Map<string, EdgeRef[]>();
  const cities = new Set<string>();

  for (let i = 0; i < NEPAL_ROUTES.length; i++) {
    if (routeOwners[i] !== playerId) continue;
    const r = NEPAL_ROUTES[i];
    cities.add(r.from);
    cities.add(r.to);
    if (!adj.has(r.from)) adj.set(r.from, []);
    if (!adj.has(r.to)) adj.set(r.to, []);
    adj.get(r.from)!.push({ routeId: r.id, to: r.to, weight: r.length });
    adj.get(r.to)!.push({ routeId: r.id, to: r.from, weight: r.length });
  }

  let bestLength = 0;
  let bestRouteIds: number[] = [];
  const usedEdges = new Set<number>();
  const currentTrail: number[] = [];

  const dfs = (city: string, currentLen: number) => {
    if (currentLen > bestLength) {
      bestLength = currentLen;
      bestRouteIds = [...currentTrail];
    }
    const edges = adj.get(city);
    if (!edges) return;
    for (const edge of edges) {
      if (usedEdges.has(edge.routeId)) continue;
      usedEdges.add(edge.routeId);
      currentTrail.push(edge.routeId);
      dfs(edge.to, currentLen + edge.weight);
      currentTrail.pop();
      usedEdges.delete(edge.routeId);
    }
  };

  for (const startCity of cities) {
    dfs(startCity, 0);
  }

  return { length: bestLength, routeIds: bestRouteIds };
}

export function findShortestUnclaimedRoutesForTicket(
  fromCity: string,
  toCity: string,
  playerId: number,
  routeOwners: Array<number | null>,
  totalPlayers: number
): number[] {
  interface StepEdge {
    to: string;
    routeId: number;
    cost: number;
  }

  const adj = new Map<string, StepEdge[]>();
  for (let i = 0; i < NEPAL_ROUTES.length; i++) {
    const r = NEPAL_ROUTES[i];
    const owner = routeOwners[i];

    if (owner !== null && owner !== playerId) {
      continue;
    }

    if (owner === null) {
      const sibling = NEPAL_ROUTES.find(
        (other) =>
          other.id !== r.id &&
          ((other.from === r.from && other.to === r.to) || (other.from === r.to && other.to === r.from))
      );
      if (sibling) {
        if (routeOwners[sibling.id] === playerId) continue;
        if (totalPlayers <= 3 && routeOwners[sibling.id] !== null) continue;
      }
    }

    const stepCost = owner === playerId ? 0 : r.length;
    if (!adj.has(r.from)) adj.set(r.from, []);
    if (!adj.has(r.to)) adj.set(r.to, []);
    adj.get(r.from)!.push({ to: r.to, routeId: r.id, cost: stepCost });
    adj.get(r.to)!.push({ to: r.from, routeId: r.id, cost: stepCost });
  }

  const dist = new Map<string, number>([[fromCity, 0]]);
  const prevEdge = new Map<string, { prevCity: string; routeId: number }>();
  const visited = new Set<string>();

  while (visited.size <= NEPAL_ROUTES.length) {
    let closestCity: string | null = null;
    let bestD = Infinity;
    for (const [city, d] of dist.entries()) {
      if (!visited.has(city) && d < bestD) {
        bestD = d;
        closestCity = city;
      }
    }
    if (!closestCity || closestCity === toCity) break;
    visited.add(closestCity);

    const neighbors = adj.get(closestCity) ?? [];
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue;
      const cand = bestD + edge.cost;
      if (cand < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, cand);
        prevEdge.set(edge.to, { prevCity: closestCity, routeId: edge.routeId });
      }
    }
  }

  if (!dist.has(toCity)) return [];

  const neededRoutes: number[] = [];
  let cur = toCity;
  while (cur !== fromCity) {
    const step = prevEdge.get(cur);
    if (!step) break;
    if (routeOwners[step.routeId] === null) {
      neededRoutes.push(step.routeId);
    }
    cur = step.prevCity;
  }
  return neededRoutes;
}
