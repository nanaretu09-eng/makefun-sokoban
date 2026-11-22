// make.fun bounty: Build the best Sokoban solver
// Room-based solver: detects hallway (row 8), solves each room independently.
// Each room has 3-4 boxes → state space small enough for move-based A*.
// Combines room solutions with hallway navigation.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const I = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const O = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

function parse(level: string) {
  const walls = new Set<number>();
  const boxes = new Set<number>();
  const goals = new Set<number>();
  let player = -1, maxR = 0, maxC = 0;
  const lines = level.split("\n");
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    maxR = Math.max(maxR, r); maxC = Math.max(maxC, line.length);
    for (let c = 0; c < line.length; c++) {
      const ch = line[c], k = r * 64 + c;
      if (ch === "#") walls.add(k);
      else if (ch === "@") player = k;
      else if (ch === "+") { player = k; goals.add(k); }
      else if (ch === "$") boxes.add(k);
      else if (ch === "*") { boxes.add(k); goals.add(k); }
      else if (ch === ".") goals.add(k);
    }
  }
  return { walls, boxes, goals, player, maxR, maxC, lines };
}

// Find hallway row (row with player, typically row 8)
function findHallway({ walls, player, lines }: { walls: Set<number>; player: number; lines: string[] }): number {
  if (player >= 0) return Math.floor(player / 64);
  // Fallback: row with fewest walls (the corridor)
  const maxR = lines.length - 1;
  let bestRow = 0, bestOpen = Infinity;
  for (let r = 0; r <= maxR; r++) {
    let open = 0;
    for (let c = 0; c < lines[r].length; c++) {
      if (!walls.has(r * 64 + c)) open++;
    }
    if (open < bestOpen) { bestOpen = open; bestRow = r; }
  }
  return bestRow;
}

// Find rooms by BFS from doors (each door leads to a room; rooms on same side of hallway merge)
function findRooms(walls: Set<number>, hallwayRow: number, maxR: number, maxC: number, lines: string[]): Map<number, Set<number>> {
  const rooms = new Map<number, Set<number>>(); // roomId -> squares
  const roomIdBySquare = new Map<number, number>();

  // Find doors (open squares adjacent to hallway)
  const doors: number[] = [];
  const maxC_line = Math.max(...lines.map(l => l.length));
  for (let c = 0; c <= maxC_line; c++) {
    const above = (hallwayRow - 1) * 64 + c;
    const below = (hallwayRow + 1) * 64 + c;
    if (hallwayRow > 0 && !walls.has(above)) doors.push(above);
    if (hallwayRow < maxR && !walls.has(below)) doors.push(below);
  }

  let roomId = 0;
  for (const door of doors) {
    if (roomIdBySquare.has(door)) continue; // already assigned to a room
    // BFS from this door, not crossing hallway
    const roomSquares = new Set<number>();
    const q = [door];
    roomIdBySquare.set(door, roomId);
    roomSquares.add(door);
    let head = 0;
    while (head < q.length) {
      const s = q[head++];
      const sr = Math.floor(s / 64), sc = s % 64;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = sr + dr, nc = sc + dc;
        const nk = nr * 64 + nc;
        if (nr < 0 || nr > maxR || nc < 0 || nc > maxC) continue;
        if (nr === hallwayRow) continue; // don't cross hallway
        if (walls.has(nk) || roomIdBySquare.has(nk)) continue;
        roomIdBySquare.set(nk, roomId);
        roomSquares.add(nk); q.push(nk);
      }
    }
    if (roomSquares.size > 0) {
      rooms.set(roomId++, roomSquares);
    }
  }
  return rooms;
}

// Assign boxes/goals to rooms
function assignToRooms(
  boxes: Set<number>,
  goals: Set<number>,
  rooms: Map<number, Set<number>>
): Map<number, { boxes: number[]; goals: number[] }> {
  const roomData = new Map<number, { boxes: number[]; goals: number[] }>();
  for (const [id, squares] of rooms) {
    const roomBoxes: number[] = [], roomGoals: number[] = [];
    for (const b of boxes) if (squares.has(b)) roomBoxes.push(b);
    for (const g of goals) if (squares.has(g)) roomGoals.push(g);
    if (roomBoxes.length > 0 || roomGoals.length > 0) {
      roomData.set(id, { boxes: roomBoxes, goals: roomGoals });
    }
  }
  return roomData;
}

function findDoors(roomSquares: Set<number>, hallwayRow: number): { door: number; entrance: number }[] {
  const doors: { door: number; entrance: number }[] = [];
  for (const s of roomSquares) {
    const r = Math.floor(s / 64);
    if (r === hallwayRow - 1) {
      doors.push({ door: s, entrance: (hallwayRow) * 64 + (s % 64) });
    } else if (r === hallwayRow + 1) {
      doors.push({ door: s, entrance: (hallwayRow) * 64 + (s % 64) });
    }
  }
  return doors;
}

const D = [[-1,0],[1,0],[0,-1],[0,1]];
const MV = ["u","d","l","r"];

// Push-distance heuristic for a single room
function pushDistRoom(walls: Set<number>, goals: number[], maxR: number, maxC: number): Int32Array {
  const size = (maxR + 3) * 64 + (maxC + 3);
  const dist = new Int32Array(size).fill(-1);
  const q: number[] = [];
  for (const g of goals) { dist[g] = 0; q.push(g); }
  let head = 0;
  while (head < q.length) {
    const s = q[head++];
    const sr = Math.floor(s / 64), sc = s % 64, d = dist[s];
    for (let i = 0; i < 4; i++) {
      const dr = D[i][0], dc = D[i][1];
      const bk = (sr - dr) * 64 + (sc - dc);
      const pk = (sr - 2*dr) * 64 + (sc - 2*dc);
      if (bk < 0 || pk < 0) continue;
      if (walls.has(bk) || walls.has(pk)) continue;
      if (dist[bk] === -1) { dist[bk] = d + 1; q.push(bk); }
    }
  }
  return dist;
}

// Corner deadlocks for a room
function cornerDeadRoom(walls: Set<number>, goals: number[], maxR: number, maxC: number): Set<number> {
  const dead = new Set<number>();
  const goalSet = new Set(goals);
  for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) {
    const k = r * 64 + c;
    if (walls.has(k) || goalSet.has(k)) continue;
    const up = walls.has((r-1)*64+c), down = walls.has((r+1)*64+c);
    const left = walls.has(r*64+c-1), right = walls.has(r*64+c+1);
    if ((up || down) && (left || right)) dead.add(k);
  }
  return dead;
}

class MinHeap {
  a: Array<{ f: number; g: number; key: string }> = [];
  push(it: { f: number; g: number; key: string }) { this.a.push(it); let i = this.a.length-1; while (i>0){const p=(i-1)>>1; if (this.a[i].f < this.a[p].f || (this.a[i].f===this.a[p].f && this.a[i].g > this.a[p].g)){[this.a[i],this.a[p]]=[this.a[p],this.a[i]];i=p;}else break;} }
  pop(): { f: number; g: number; key: string } { const t=this.a[0]; const l=this.a.pop()!; if(this.a.length>0){this.a[0]=l;let i=0;for(;;){const L=2*i+1,R=2*i+2;let m=i;if(L<this.a.length&&(this.a[L].f<this.a[m].f||(this.a[L].f===this.a[m].f&&this.a[L].g>this.a[m].g)))m=L;if(R<this.a.length&&(this.a[R].f<this.a[m].f||(this.a[R].f===this.a[m].f&&this.a[R].g>this.a[m].g)))m=R;if(m===i)break;[this.a[i],this.a[m]]=[this.a[m],this.a[i]];i=m;}} return t; }
  get size() { return this.a.length; }
}

// BFS path in hallway (avoiding walls)
function hallwayPath(walls: Set<number>, hallwayRow: number, start: number, target: number): string {
  const startR = Math.floor(start / 64), startC = start % 64;
  const targetR = Math.floor(target / 64), targetC = target % 64;
  if (start === target) return "";
  
  const seen = new Set<number>([start]);
  const parent = new Map<number, number>();
  const q = [start];
  let head = 0;
  while (head < q.length) {
    const s = q[head++];
    if (s === target) break;
    const sr = Math.floor(s / 64), sc = s % 64;
    for (let i = 0; i < 4; i++) {
      const nr = sr + D[i][0], nc = sc + D[i][1];
      const nk = nr * 64 + nc;
      if (nr !== hallwayRow) continue; // only move in hallway
      if (walls.has(nk) || seen.has(nk)) continue;
      seen.add(nk); parent.set(nk, s); q.push(nk);
    }
  }
  if (!parent.has(target)) return ""; // no path
  let moves = "";
  let cur = target;
  while (cur !== start) {
    const p = parent.get(cur)!;
    const cr = Math.floor(cur / 64), cc = cur % 64;
    const pr = Math.floor(p / 64), pc = p % 64;
    if (cr === pr - 1) moves = "u" + moves;
    else if (cr === pr + 1) moves = "d" + moves;
    else if (cc === pc - 1) moves = "l" + moves;
    else if (cc === pc + 1) moves = "r" + moves;
    cur = p;
  }
  return moves;
}

// General BFS path avoiding walls and static obstacles (boxes at goals)
function findPath(walls: Set<number>, obstacles: Set<number>, start: number, target: number): string {
  if (start === target) return "";
  const seen = new Set<number>([start]);
  const parent = new Map<number, number>();
  const q = [start];
  let head = 0;
  while (head < q.length) {
    const s = q[head++];
    if (s === target) break;
    const sr = Math.floor(s / 64), sc = s % 64;
    for (let i = 0; i < 4; i++) {
      const nr = sr + D[i][0], nc = sc + D[i][1];
      const nk = nr * 64 + nc;
      if (walls.has(nk) || obstacles.has(nk) || seen.has(nk)) continue;
      seen.add(nk); parent.set(nk, s); q.push(nk);
    }
  }
  if (!parent.has(target)) return "";
  let moves = "";
  let cur = target;
  while (cur !== start) {
    const p = parent.get(cur)!;
    const cr = Math.floor(cur / 64), cc = cur % 64;
    const pr = Math.floor(p / 64), pc = p % 64;
    if (cr === pr - 1) moves = "u" + moves;
    else if (cr === pr + 1) moves = "d" + moves;
    else if (cc === pc - 1) moves = "l" + moves;
    else if (cc === pc + 1) moves = "r" + moves;
    cur = p;
  }
  return moves;
}

function walkPath(start: number, target: number, parent: Map<number, number>): string {
  if (start === target) return "";
  let cur = target;
  let moves = "";
  while (cur !== start) {
    const p = parent.get(cur);
    if (p === undefined) return "";
    const cr = Math.floor(cur / 64), cc = cur % 64;
    const pr = Math.floor(p / 64), pc = p % 64;
    if (cr === pr - 1) moves = "u" + moves;
    else if (cr === pr + 1) moves = "d" + moves;
    else if (cc === pc - 1) moves = "l" + moves;
    else if (cc === pc + 1) moves = "r" + moves;
    else return "";
    cur = p;
  }
  return moves;
}

// Solve a single room with move-based A*
function solveRoom(
  walls: Set<number>,
  roomSquares: Set<number>,
  roomBoxes: number[],
  roomGoals: number[],
  playerStart: number,
  hallwayRow: number,
  timeBudgetMs: number,
  expBudget: number
): { moves: string; finalPlayer: number } {
  if (roomBoxes.length === 0) return { moves: "", finalPlayer: playerStart };

  const dist = pushDistRoom(walls, roomGoals, 63, 63); // max grid
  const dead = cornerDeadRoom(walls, roomGoals, 63, 63);
  const goalArr = [...roomGoals].sort((a,b)=>a-b);
  const h = (boxes: number[]) => { let t = 0; for (const b of boxes) { const d = dist[b]; if (d < 0) return 1e9; t += d; } return t; };
  const isGoal = (boxes: number[]) => boxes.length === goalArr.length && boxes.every((v,i)=>v===goalArr[i]);

  const startBoxes = [...roomBoxes].sort((a,b)=>a-b);
  if (h(startBoxes) >= 1e9) return { moves: "", finalPlayer: playerStart };

  const startKey = playerStart + "|" + startBoxes.join(",");
  const heap = new MinHeap();
  heap.push({ f: h(startBoxes), g: 0, key: startKey });
  const bestG = new Map<string, number>();
  bestG.set(startKey, 0);
  const prev = new Map<string, { prevKey: string; move: string }>();

  const TIME_START = Date.now();
  let exp = 0, goalKey = "";

  while (heap.size > 0 && exp < expBudget && Date.now() - TIME_START < timeBudgetMs) {
    const { f, g, key } = heap.pop();
    if (g > (bestG.get(key) ?? Infinity)) continue;
    const [playerStr, ...boxStrs] = key.split("|");
    const player = parseInt(playerStr);
    const boxes = boxStrs[0] ? boxStrs[0].split(",").map(Number) : [];
    if (isGoal(boxes)) { goalKey = key; break; }
    exp++;

    const boxSet = new Set(boxes);
    const pr = Math.floor(player / 64), pc = player % 64;

    for (let i = 0; i < 4; i++) {
      const dr = D[i][0], dc = D[i][1];
      const nr = pr + dr, nc = pc + dc;
      const nk = nr * 64 + nc;
      if (walls.has(nk) || !roomSquares.has(nk)) continue;

      let nplayer = nk;
      let nboxes = boxes;
      if (boxSet.has(nk)) {
        const br = nr + dr, bc = nc + dc;
        const bk = br * 64 + bc;
        if (walls.has(bk) || boxSet.has(bk) || !roomSquares.has(bk)) continue;
        if (dead.has(bk)) continue;
        if (dist[bk] < 0) continue;
        nboxes = boxes.slice();
        const bi = nboxes.indexOf(nk);
        nboxes[bi] = bk; nboxes.sort((a,b)=>a-b);
      }

      const nkey = nplayer + "|" + nboxes.join(",");
      const ng = g + 1;
      if (ng >= (bestG.get(nkey) ?? Infinity)) continue;
      bestG.set(nkey, ng);
      const hv = h(nboxes); if (hv >= 1e9) continue;
      prev.set(nkey, { prevKey: key, move: MV[i] });
      heap.push({ f: ng + hv, g: ng, key: nkey });
    }
  }

  if (!goalKey) return { moves: "", finalPlayer: playerStart };

  const moves: string[] = [];
  let cur = goalKey;
  while (prev.has(cur)) {
    moves.push(prev.get(cur)!.move);
    cur = prev.get(cur)!.prevKey;
  }
  moves.reverse();
  // Final player position
  const [playerStr] = goalKey.split("|");
  return { moves: moves.join(""), finalPlayer: parseInt(playerStr) };
}

function solveLevel(level: string): string {
  const { walls, boxes, goals, player, maxR, maxC, lines } = parse(level);
  if (player < 0) return "";

  // Find hallway
  const hallwayRow = findHallway({ walls, player, lines });
  // Find rooms
  const rooms = findRooms(walls, hallwayRow, maxR, maxC, lines);
  // Assign boxes/goals to rooms
  const roomData = assignToRooms(boxes, goals, rooms);

  // Per-instance budget
  const totalRooms = roomData.size;
  const timePerRoom = Math.min(55000 / Math.max(1, totalRooms), 20000);
  const expPerRoom = Math.min(500000 / Math.max(1, totalRooms), 200000);

  let fullMoves = "";
  let currentPlayer = player;

  // Sort rooms by row (top to bottom) for deterministic order
  const sortedRooms = [...roomData.entries()].sort((a,b)=>a[0]-b[0]);

  for (const [roomId, { boxes: roomBoxes, goals: roomGoals }] of sortedRooms) {
    if (roomBoxes.length === 0) continue;

    const roomSquares = rooms.get(roomId)!;
    // Find door for this room (entry from hallway)
    const doorInfos = findDoors(roomSquares, hallwayRow);
    // Navigate from current player position to room entrance (hallway square) using BFS
    if (doorInfos.length > 0) {
      const targetEntrance = doorInfos[0].entrance;
      const path = hallwayPath(walls, hallwayRow, currentPlayer, targetEntrance);
      fullMoves += path;
      currentPlayer = targetEntrance;
    }

    // Solve room (includes entrance square in roomSquares)
    const entrance = doorInfos.length > 0 ? doorInfos[0].entrance : currentPlayer;
    const extendedRoomSquares = new Set(roomSquares);
    if (doorInfos.length > 0) extendedRoomSquares.add(doorInfos[0].entrance);
    const { moves: roomMoves, finalPlayer } = solveRoom(
      walls, extendedRoomSquares, roomBoxes, roomGoals,
      entrance, hallwayRow, timePerRoom, expPerRoom
    );
    fullMoves += roomMoves;
    currentPlayer = finalPlayer;

    // Return to hallway after room
    if (doorInfos.length > 0) {
      const targetEntrance = doorInfos[0].entrance;
      const finalBoxes = new Set(roomGoals); // boxes at goals
      const path = findPath(walls, finalBoxes, currentPlayer, targetEntrance);
      fullMoves += path;
      currentPlayer = targetEntrance;
    }
  }

  return fullMoves;
}

for (const id of readdirSync(I).sort()) {
  let level = "";
  try { level = readFileSync(join(I, id, "level.txt"), "utf8"); } catch { continue; }
  const moves = solveLevel(level);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, "solution.txt"), moves + "\n");
}