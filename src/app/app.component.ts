import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import {
  applyMove, BOARDS, canStartAt, hasPeg, initialBoard, legalMoves, LEVELS, pegCount,
  type BoardState, type Difficulty, type Hole, type Move
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
  @ViewChild('newGameDialog') private newGameDialog?: ElementRef<HTMLDialogElement>;
  readonly levels = LEVELS;
  readonly levelId = signal<Difficulty>('easy');
  readonly pendingLevel = signal<Difficulty>('easy');
  readonly level = computed(() => LEVELS.find(level => level.id === this.levelId())!);
  readonly puzzle = computed(() => BOARDS[this.levelId()]);
  readonly holes = computed(() => this.puzzle().holes);
  // Smaller pegs maintain clear spacing on denser grids.
  readonly pegDiameter = computed(() => ({
    easy: '9.3%', medium: '7.8%', hard: '6.8%', extreme: '5.9%'
  })[this.levelId()]);
  readonly board = signal<BoardState>(initialBoard());
  readonly startHole = signal(0);
  readonly choosingStart = signal(false);
  readonly selected = signal<number | null>(null);
  readonly history = signal<readonly BoardState[]>([]);
  readonly future = signal<readonly BoardState[]>([]);
  readonly bestByLevel = signal<BestByLevel>(this.readBest());
  readonly bestResult = computed(() => this.bestByLevel()[this.levelId()] ?? null);
  readonly feedback = signal('Select a peg, then choose a highlighted empty hole.');

  readonly pegsLeft = computed(() => pegCount(this.board()));
  readonly moves = computed(() => this.history().length);
  readonly totalJumps = computed(() => this.puzzle().holes.length - 2);
  readonly options = computed(() => legalMoves(this.board(), this.puzzle()));
  readonly status = computed<Status>(() => {
    if (this.choosingStart()) return 'choosing';
    if (this.pegsLeft() === 1) return 'won';
    return this.options().length === 0 ? 'stuck' : 'playing';
  });
  readonly targets = computed(() => new Set(this.options()
    .filter(move => move.from === this.selected()).map(move => move.to)));
  readonly movable = computed(() => new Set(this.options().map(move => move.from)));

  openNewGame(): void {
    this.pendingLevel.set(this.levelId());
    const dialog = this.newGameDialog?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  chooseDifficulty(id: Difficulty): void {
    this.pendingLevel.set(id);
  }

  cancelNewGame(): void {
    this.newGameDialog?.nativeElement.close();
  }

  confirmNewGame(): void {
    this.newGameDialog?.nativeElement.close();
    this.levelId.set(this.pendingLevel());
    this.startHole.set(this.puzzle().recommendedOpening);
    this.board.set(this.puzzle().fullBoard);
    this.history.set([]);
    this.future.set([]);
    this.clearSelection();
    this.choosingStart.set(true);
    this.feedback.set(this.levelId() === 'hard'
      ? 'Choose a highlighted starting hole. Some Hard openings cannot be solved.'
      : 'Choose any peg to remove for your starting empty hole.');
  }

  dismissModalBackdrop(event: MouseEvent): void {
    if (event.target === this.newGameDialog?.nativeElement) this.cancelNewGame();
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
    this.clearSelection();
    this.choosingStart.set(false);
    this.feedback.set('Fresh board. Select a peg to begin.');
  }

  private clearSelection(): void {
    this.selected.set(null);
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
