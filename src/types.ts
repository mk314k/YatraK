export type NepalRegion = 'terai' | 'pahad' | 'himalaya';

export type RouteColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'purple'
  | 'white'
  | 'black'
  | 'gray';

export type CardColor = Exclude<RouteColor, 'gray'> | 'locomotive';

export interface NepalCity {
  id: string;
  name: string;
  nepaliName: string;
  region: NepalRegion;
  elevationMeters: number;
  x: number;
  y: number;
  isHub?: boolean;
}

export interface NepalRoute {
  id: number;
  from: string;
  to: string;
  length: 1 | 2 | 3 | 4 | 5 | 6;
  color: RouteColor;
  isMountainPass?: boolean;
  doubleIndex?: 0 | 1;
}

export interface DestinationTicket {
  id: number;
  from: string;
  to: string;
  points: number;
  corridorName: string;
  completed?: boolean;
}

export type BotPersonality = 'human' | 'sherpa' | 'express' | 'blocker';

export interface PlayerState {
  id: number;
  name: string;
  colorHex: string;
  personality: BotPersonality;
  score: number;
  carriages: number;
  hand: Record<CardColor, number>;
  tickets: DestinationTicket[];
}

export type TurnPhase =
  | 'setup-tickets'
  | 'choose-action'
  | 'drawing-second-card'
  | 'selecting-tickets'
  | 'game-over';

export const ROUTE_POINTS_TABLE: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
};

export const CARD_COLOR_HEX: Record<CardColor, string> = {
  red: '#c83e31',
  blue: '#2a6f97',
  green: '#3a7d44',
  yellow: '#d99b26',
  orange: '#d96b27',
  purple: '#7b4b94',
  white: '#f4efe6',
  black: '#2f2d2e',
  locomotive: '#b85d38',
};

export const ROUTE_COLOR_HEX: Record<RouteColor, string> = {
  red: '#c83e31',
  blue: '#2a6f97',
  green: '#3a7d44',
  yellow: '#d99b26',
  orange: '#d96b27',
  purple: '#7b4b94',
  white: '#f4efe6',
  black: '#2f2d2e',
  gray: '#9e9284',
};
