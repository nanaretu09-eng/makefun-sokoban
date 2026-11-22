# Sokoban Solver

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/nanaretu09-eng/makefun-sokoban/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/nanaretu09-eng/makefun-sokoban/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)


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
