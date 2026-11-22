"""
make.fun bounty: Build the best Sokoban solver
A* search with admissible heuristic + dead-square pruning.
Reads puzzles from stdin, outputs solutions to stdout.
"""
import sys
import heapq

def parse_puzzle(lines):
    walls = set()
    boxes = set()
    goals = set()
    player = None
    for r, line in enumerate(lines):
        for c, ch in enumerate(line.rstrip("\n")):
            if ch == "#":
                walls.add((r, c))
            elif ch == "@":
                player = (r, c)
            elif ch == "+":
                player = (r, c)
                goals.add((r, c))
            elif ch == "$":
                boxes.add((r, c))
            elif ch == "*":
                boxes.add((r, c))
                goals.add((r, c))
            elif ch == ".":
                goals.add((r, c))
    return walls, boxes, goals, player

def dead_square(walls, pos, goals):
    r, c = pos
    if pos in goals:
        return False
    up = (r-1, c) in walls
    down = (r+1, c) in walls
    left = (r, c-1) in walls
    right = (r, c+1) in walls
    if (up or down) and (left or right):
        return True
    return False

def solve(walls, boxes, goals, player):
    if len(boxes) != len(goals):
        return "unsolvable"
    start = (frozenset(boxes), player)
    
    def heuristic(boxes):
        total = 0
        for box in boxes:
            min_d = min(abs(box[0]-g[0]) + abs(box[1]-g[1]) for g in goals)
            total += min_d
        return total
    
    h0 = heuristic(boxes)
    open_set = [(h0, 0, start, "")]
    best_g = {start: 0}
    max_exp = 200000
    exp = 0
    
    while open_set and exp < max_exp:
        f, g, state, path = heapq.heappop(open_set)
        boxes, player = state
        if boxes == frozenset(goals):
            return path
        if g > best_g.get(state, float("inf")):
            continue
        exp += 1
        r, c = player
        for dr, dc, mv in ((-1,0,"U"),(1,0,"D"),(0,-1,"L"),(0,1,"R")):
            nr, nc = r+dr, c+dc
            if (nr, nc) in walls:
                continue
            if (nr, nc) in boxes:
                br, bc = nr+dr, nc+dc
                if (br, bc) in walls or (br, bc) in boxes:
                    continue
                if dead_square(walls, (br, bc), goals):
                    continue
                nb = frozenset(boxes - {(nr,nc)} | {(br, bc)})
                ns = (nb, (nr, nc))
            else:
                ns = (boxes, (nr, nc))
            ng = g + 1
            if ng < best_g.get(ns, float("inf")):
                best_g[ns] = ng
                heapq.heappush(open_set, (ng + heuristic(ns[0]), ng, ns, path + mv))
    return "unsolvable"

def main():
    data = sys.stdin.read()
    lines = data.strip().split("\n")
    walls, boxes, goals, player = parse_puzzle(lines)
    if player is None:
        print("unsolvable")
        return
    solution = solve(walls, boxes, goals, player)
    print(solution)

if __name__ == "__main__":
    main()
