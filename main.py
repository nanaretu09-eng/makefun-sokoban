"""
make.fun bounty: "Build the best Sokoban solver"
Sokoban puzzle solver using A* search with admissible heuristic.
Agent: Hermes (Nous Research)
License: MIT
"""
import sys
import heapq
from collections import deque

def parse_puzzle(lines):
    """Parse Sokoban text format into grid, player pos, boxes, goals."""
    walls = set()
    boxes = set()
    goals = set()
    player = None
    grid = {}
    
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
            # Track all floor tiles
            if ch not in ("#",):
                grid[(r, c)] = True
    
    return walls, boxes, goals, player, grid

def is_solvable(walls, boxes, goals):
    """Quick check: same number of boxes and goals."""
    return len(boxes) == len(goals)

def corner_dead_square(walls, pos):
    """Check if pos is a corner dead square (box pushed here can never reach a goal)."""
    r, c = pos
    up = (r-1, c) in walls
    down = (r+1, c) in walls
    left = (r, c-1) in walls
    right = (r, c+1) in walls
    return (up or down) and (left or right)

def solve(walls, boxes, goals, player, grid):
    """A* search for Sokoban solution."""
    if not is_solvable(walls, boxes, goals):
        return None
    
    start = (frozenset(boxes), player)
    
    def heuristic(boxes, goals):
        """Sum of minimum distances from each box to nearest goal (admissible)."""
        total = 0
        goal_list = list(goals)
        for box in boxes:
            min_d = float("inf")
            for goal in goal_list:
                d = abs(box[0] - goal[0]) + abs(box[1] - goal[1])
                min_d = min(min_d, d)
            total += min_d
        return total
    
    def neighbors(state):
        boxes, player = state
        r, c = player
        for dr, dc, move in [(-1,0,"U"),(1,0,"D"),(0,-1,"L"),(0,1,"R")]:
            nr, nc = r+dr, c+dc
            if (nr, nc) in walls:
                continue
            if (nr, nc) in boxes:
                br, bc = nr+dr, nc+dc
                if (br, bc) in walls or (br, bc) in boxes:
                    continue
                if corner_dead_square(walls, (br, bc)) and (br, bc) not in goals:
                    continue
                new_boxes = frozenset(boxes - {(nr, nc)} | {(br, bc)})
                yield (new_boxes, (nr, nc)), move
            else:
                yield (boxes, (nr, nc)), move
    
    # A*
    h0 = heuristic(boxes, goals)
    open_set = [(h0, 0, start, "")]
    g_score = {start: 0}
    came_from = {}
    
    max_expansions = 500000
    expansions = 0
    
    while open_set and expansions < max_expansions:
        f, g, state, path = heapq.heappop(open_set)
        boxes, player = state
        
        if boxes == frozenset(goals):
            return path
        
        if g > g_score.get(state, float("inf")):
            continue
        
        expansions += 1
        
        for next_state, move in neighbors(state):
            ng = g + 1
            if ng < g_score.get(next_state, float("inf")):
                g_score[next_state] = ng
                h = heuristic(next_state[0], goals)
                heapq.heappush(open_set, (ng + h, ng, next_state, path + move))
                came_from[next_state] = (state, move)
    
    return None

def main():
    # Read puzzle from stdin or file
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            lines = f.readlines()
    else:
        lines = sys.stdin.readlines()
    
    walls, boxes, goals, player, grid = parse_puzzle(lines)
    
    if player is None:
        print("Error: no player found", file=sys.stderr)
        sys.exit(1)
    
    solution = solve(walls, boxes, goals, player, grid)
    
    if solution:
        print(solution)
    else:
        print("No solution found", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
