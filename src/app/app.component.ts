import { Component, computed, signal } from '@angular/core';
import {
  applyMove, BOARDS, canStartAt, hasPeg, initialBoard, legalMoves, LEVELS, pegCount,
  searchSolution, type BoardState, type Difficulty, type Hole, type Move
} from './peg-engine';

type Status = 'choosing' | 'playing' | 'won' | 'stuck';
type BestByLevel = Partial<Record<Difficulty, number>>;

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly levels = LEVELS;
  readonly levelId = signal<Difficulty>('easy');
  readonly level = computed(() => LEVELS.find(level => level.id === this.levelId())!);
  readonly puzzle = computed(() => BOARDS[this.levelId()]);
  readonly holes = computed(() => this.puzzle().holes);
  readonly pegDiameter = computed(() => `${Math.min(11.2, 0.78 * 74 / (this.puzzle().rows - 1))}%`);
  readonly board = signal<BoardState>(initialBoard());
  readonly startHole = signal(0);
  readonly choosingStart = signal(false);
  readonly selected = signal<number | null>(null);
  readonly suggestion = signal<Move | null>(null);
  readonly history = signal<readonly BoardState[]>([]);
  readonly future = signal<readonly BoardState[]>([]);
  readonly hintsUsed = signal(0);
  readonly bestByLevel = signal<BestByLevel>(this.readBest());
  readonly bestResult = computed(() => this.bestByLevel()[this.levelId()] ?? null);
  readonly feedback = signal('Select a peg, then choose a highlighted empty hole.');

  readonly pegsLeft = computed(() => pegCount(this.board()));
  readonly moves = computed(() => this.history().length);
  readonly totalJumps = computed(() => this.puzzle().holes.length - 2);
  readonly options = computed(() => legalMoves(this.board(), this.puzzle()));
  readonly hintRemaining = computed(() => {
    const limit = this.level().hints;
    return limit === null ? null : Math.max(0, limit - this.hintsUsed());
  });
  readonly status = computed<Status>(() => {
    if (this.choosingStart()) return 'choosing';
    if (this.pegsLeft() === 1) return 'won';
    return this.options().length === 0 ? 'stuck' : 'playing';
  });
  readonly canHint = computed(() =>
    this.status() === 'playing' && (this.hintRemaining() === null || this.hintRemaining()! > 0)
  );
  readonly targets = computed(() => new Set(this.options()
    .filter(move => move.from === this.selected()).map(move => move.to)));
  readonly movable = computed(() => new Set(this.options().map(move => move.from)));

  selectLevel(id: Difficulty): void {
    if (id === this.levelId()) return;
    this.levelId.set(id);
    this.startHole.set(this.puzzle().recommendedOpening);
    this.restart();
    this.feedback.set(`${this.level().label}: ${this.puzzle().holes.length} holes. ${this.level().subtitle}.`);
  }

  hasPeg(id: number): boolean { return hasPeg(this.board(), id); }

  openingAllowed(id: number): boolean {
    return canStartAt(this.puzzle(), id);
  }

  holeLabel(hole: Hole): string {
    const location = `row ${hole.row + 1}, position ${hole.column + 1}`;
    if (this.choosingStart()) {
      return this.openingAllowed(hole.id)
        ? `Choose ${location} as starting vacancy`
        : `Unavailable starting hole at ${location}; this opening cannot be solved`;
    }
    if (this.targets().has(hole.id)) return `Jump into ${location}`;
    if (this.hasPeg(hole.id)) {
      return `Peg at ${location}${this.selected() === hole.id ? ', selected' : ''}`;
    }
    return `Empty hole at ${location}`;
  }

  onHoleClick(id: number): void {
    if (this.choosingStart()) {
      if (!this.openingAllowed(id)) {
        this.feedback.set('That starting hole cannot lead to one peg on Hard. Choose a glowing hole.');
        return;
      }
      this.startHole.set(id);
      this.restart();
      this.feedback.set('Opening selected. Make your first jump.');
      return;
    }
    if (this.status() !== 'playing') return;
    const selected = this.selected();
    if (selected === id) {
      this.clearSelection();
      return;
    }
    const move = selected === null ? undefined :
      this.options().find(m => m.from === selected && m.to === id);
    if (move) {
      this.play(move);
      return;
    }
    this.suggestion.set(null);
    if (this.hasPeg(id) && this.movable().has(id)) {
      this.selected.set(id);
      this.feedback.set('Now choose a highlighted empty hole.');
    } else if (this.hasPeg(id)) {
      this.selected.set(null);
      this.feedback.set('That peg cannot jump. Choose another.');
    } else {
      this.feedback.set('Select a peg first, then its landing hole.');
    }
  }

  undo(): void {
    const previous = this.history();
    if (previous.length === 0 || this.choosingStart()) return;
    this.future.update(items => [...items, this.board()]);
    this.board.set(previous[previous.length - 1]);
    this.history.set(previous.slice(0, -1));
    this.clearSelection();
    this.feedback.set('Jump undone. Choose a move or use Redo.');
  }

  redo(): void {
    const next = this.future();
    if (next.length === 0 || this.choosingStart()) return;
    this.history.update(items => [...items, this.board()]);
    this.board.set(next[next.length - 1]);
    this.future.set(next.slice(0, -1));
    this.clearSelection();
    this.feedback.set(this.status() === 'won'
      ? 'Perfect! One peg remains.'
      : this.status() === 'stuck' ? 'No jumps remain. Undo to try again.' : 'Jump restored.');
  }

  restart(): void {
    this.board.set(initialBoard(this.startHole(), this.puzzle()));
    this.history.set([]);
    this.future.set([]);
    this.hintsUsed.set(0);
    this.clearSelection();
    this.choosingStart.set(false);
    this.feedback.set('Fresh board. Select a peg to begin.');
  }

  newGame(): void {
    this.board.set(this.puzzle().fullBoard);
    this.history.set([]);
    this.future.set([]);
    this.hintsUsed.set(0);
    this.clearSelection();
    this.choosingStart.set(true);
    this.feedback.set(this.levelId() === 'hard'
      ? 'Choose a glowing hole as your vacancy; some Hard openings are impossible.'
      : 'Choose any peg to remove and create your starting empty hole.');
  }

  hint(): void {
    if (!this.canHint()) return;
    this.hintsUsed.update(count => count + 1);
    const result = searchSolution(this.board(), this.puzzle());
    this.suggestion.set(result.path?.[0] ?? this.options()[0] ?? null);
    this.selected.set(null);
    this.feedback.set(result.path !== null
      ? 'Blue marks the peg to move. Green marks a winning landing hole.'
      : result.complete
        ? 'This position has no one-peg solution. The marked jump is legal, but Undo may be better.'
        : 'Search limit reached. The marked jump is legal, but not guaranteed to win.');
  }

  private clearSelection(): void {
    this.selected.set(null);
    this.suggestion.set(null);
  }

  private play(move: Move): void {
    const current = this.board();
    const next = applyMove(current, move, this.puzzle());
    this.history.update(items => [...items, current]);
    this.future.set([]);
    this.board.set(next);
    this.clearSelection();
    if (pegCount(next) === 1) {
      this.feedback.set(`Perfect! ${this.level().label} solved with just one peg.`);
      this.saveBest(1);
    } else if (legalMoves(next, this.puzzle()).length === 0) {
      const left = pegCount(next);
      this.feedback.set(`No moves left with ${left} pegs. Undo to try another route.`);
      this.saveBest(left);
    } else {
      this.feedback.set('Good jump. Keep clearing the triangle.');
    }
  }

  private readBest(): BestByLevel {
    const values: BestByLevel = {};
    try {
      const stored = localStorage.getItem('triangle-peg-best-v2');
      const parsed: unknown = stored === null ? {} : JSON.parse(stored);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        for (const level of LEVELS) {
          const value = record[level.id];
          if (typeof value === 'number' && Number.isInteger(value) &&
              value >= 1 && value < (level.rows * (level.rows + 1)) / 2) {
            values[level.id] = value;
          }
        }
      }
      if (values.easy === undefined) {
        const previous = localStorage.getItem('triangle-peg-best-v1');
        const value = previous === null ? NaN : Number(previous);
        if (Number.isInteger(value) && value >= 1 && value <= 14) values.easy = value;
      }
    } catch {
      // Browser storage is optional.
    }
    return values;
  }

  private saveBest(pegs: number): void {
    const id = this.levelId();
    const existing = this.bestByLevel()[id];
    if (existing !== undefined && existing <= pegs) return;
    const next = { ...this.bestByLevel(), [id]: pegs };
    this.bestByLevel.set(next);
    try { localStorage.setItem('triangle-peg-best-v2', JSON.stringify(next)); }
    catch { /* Private mode or disabled storage. */ }
  }
}
