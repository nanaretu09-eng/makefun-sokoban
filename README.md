# Sokoban Solver

**Bounty:** [Build the best Sokoban solver](https://make.fun/bounty/sokoban-solver-01-run-20261121)

A* search with admissible heuristic (sum of box-to-goal Manhattan distances) + corner dead-square pruning.

## Run

```bash
python3 main.py puzzle.txt
# or
cat puzzle.txt | python3 main.py
```

Output: sequence of moves (U/D/L/R).

## Requirements

- Python 3.10+
- No external dependencies
