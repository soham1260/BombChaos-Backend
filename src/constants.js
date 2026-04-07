export const GRID_WIDTH = 15;
export const GRID_HEIGHT = 13;
export const TICK_RATE = 60; // Hz
export const TICK_MS = 1000 / TICK_RATE;

export const TILE = {
  EMPTY: 0,
  WALL: 1,       
  SOFT: 2,      
  BOMB: 3,
  FIRE: 4,
  POWERUP: 5,
};

export const POWERUP_TYPE = {
  BOMB_UP: 'BOMB_UP',
  FIRE_UP: 'FIRE_UP',
  SPEED_UP: 'SPEED_UP',
  REMOTE_BOMB: 'REMOTE_BOMB',
  BOMB_KICK: 'BOMB_KICK',
  PIERCING_FLAME: 'PIERCING_FLAME',
};

export const POWERUP_DROP_CHANCE = 0.35;

export const BOMB_FUSE_TICKS = 120;

export const FIRE_DURATION_TICKS = 36;

export const DEFAULT_PLAYER_STATS = {
  maxBombs: 1,
  bombRange: 2,
  speed: 5,
  hasRemoteBomb: false,
  hasBombKick: false,
  hasPiercingFlame: false,
};

export const SPAWN_POSITIONS = [
  { x: 1, y: 1 },
  { x: 13, y: 1 },
  { x: 1, y: 11 },
  { x: 13, y: 11 },
];

export const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'];
export const CHARACTERS = ['bomber1', 'bomber2', 'bomber3', 'bomber4'];

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS_TO_START = 2;

// Player move speed in pixels per second
export const TILE_SIZE = 48;
export const PIXELS_PER_SECOND = DEFAULT_PLAYER_STATS.speed * TILE_SIZE;

export const DIRECTIONS = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx: 1,  dy:  0 },
};
