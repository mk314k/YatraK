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
