// make.fun bounty: Build the best Sokoban solver
// Move-based A* with push-distance heuristic + corner deadlock pruning.
// State = (player, boxes). Heuristic = sum of push-distances.
// Expansion limit: 800k per level. Time budget ~22s.
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
  return { walls, boxes, goals, player, maxR, maxC };
}

const D = [[-1,0],[1,0],[0,-1],[0,1]];
const MV = ["u","d","l","r"];

function pushDist(walls: Set<number>, goals: Set<number>, maxR: number, maxC: number): Int32Array {
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

function cornerDead(walls: Set<number>, goals: Set<number>, maxR: number, maxC: number): Set<number> {
  const dead = new Set<number>();
  for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) {
    const k = r * 64 + c;
    if (walls.has(k) || goals.has(k)) continue;
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

function solve(level: string): string {
  const { walls, boxes: sb, goals, player: sp, maxR, maxC } = parse(level);
  if (sp < 0) return "";
  const dist = pushDist(walls, goals, maxR, maxC);
  const dead = cornerDead(walls, goals, maxR, maxC);
  const goalArr = [...goals].sort((a,b)=>a-b);
  const h = (boxes: number[]) => { let t = 0; for (const b of boxes) { const d = dist[b]; if (d < 0) return 1e9; t += d; } return t; };
  const isGoal = (boxes: number[]) => boxes.length === goalArr.length && boxes.every((v,i)=>v===goalArr[i]);

  const startBoxes = [...sb].sort((a,b)=>a-b);
  if (h(startBoxes) >= 1e9) return "";
  const startKey = sp + "|" + startBoxes.join(",");
  const heap = new MinHeap();
  heap.push({ f: h(startBoxes), g: 0, key: startKey });
  const bestG = new Map<string, number>();
  bestG.set(startKey, 0);
  const prev = new Map<string, { prevKey: string; move: string }>();

  const MAX_EXP = 800000;
  const TIME_START = Date.now();
  const TIME_LIMIT = 21000;
  let exp = 0, goalKey = "";

  while (heap.size > 0 && exp < MAX_EXP && Date.now() - TIME_START < TIME_LIMIT) {
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
      if (walls.has(nk)) continue;

      let nplayer = nk;
      let nboxes = boxes;
      if (boxSet.has(nk)) {
        const br = nr + dr, bc = nc + dc;
        const bk = br * 64 + bc;
        if (walls.has(bk) || boxSet.has(bk)) continue;
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

  if (!goalKey) return "";

  const moves: string[] = [];
  let cur = goalKey;
  while (prev.has(cur)) {
    moves.push(prev.get(cur)!.move);
    cur = prev.get(cur)!.prevKey;
  }
  moves.reverse();
  return moves.join("");
}

for (const id of readdirSync(I).sort()) {
  let level = "";
  try { level = readFileSync(join(I, id, "level.txt"), "utf8"); } catch { continue; }
  const moves = solve(level);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, "solution.txt"), moves + "\n");
}
