import { Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import {
  applyMove, BOARDS, canStartAt, hasPeg, initialBoard, legalMoves, LEVELS, pegCount,
  type BoardState, type Difficulty, type Hole, type Move
} from './peg-engine';
import {
  LIGHT_LEVELS, isLightOn, litCount, makeLightsPuzzle, pressLight
} from './lights-engine';
import {
  SLIDING_LEVELS, correctTileCount, isSolved, makeSlidingPuzzle, neighbors, slideTile
} from './sliding-engine';
import {
  F1_HIDE_CLOCK_AFTER_MS, F1_HOLD_MIN_MS, F1_LIGHT_INTERVAL_MS, F1_LIGHTS, F1_TEN_SECONDS_MS,
  F1_HOLD_MAX_MS, formatF1Difference, formatF1Time, reactionHoldDelay,
  scorePerfect10, scoreReaction, type F1Mode, type F1Stage
} from './f1-engine';

type GameId = 'peg' | 'lights' | 'sliding' | 'f1';
type PegStatus = 'choosing' | 'playing' | 'won' | 'stuck';
type BestByLevel = Partial<Record<Difficulty, number>>;
interface GameStats {
  first: number | string;
  firstLabel: string;
  moves: number;
  best: number | string | null;
  bestLabel: string;
  movesLabel?: string;
  progress: number;
  max: number;
}
interface Choice {
  id: Difficulty;
  label: string;
  details: string;
  subtitle: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  @ViewChild('newGameDialog') private newGameDialog?: ElementRef<HTMLDialogElement>;

  readonly game = signal<GameId | null>(null);
  readonly pendingLevel = signal<Difficulty>('easy');
  readonly pendingF1Mode = signal<F1Mode>('reaction');
  readonly choices = computed<Choice[]>(() => {
    switch (this.game()) {
      case 'lights': return LIGHT_LEVELS.map(level => ({
        id: level.id, label: level.label,
        details: `${level.size} × ${level.size} grid`, subtitle: level.subtitle
      }));
      case 'sliding': return SLIDING_LEVELS.map(level => ({
        id: level.id, label: level.label,
        details: `${level.size} × ${level.size} grid`, subtitle: level.subtitle
      }));
      default: return LEVELS.map(level => ({
        id: level.id, label: level.label,
        details: `${level.rows * (level.rows + 1) / 2} holes · ${level.rows} rows`,
        subtitle: level.subtitle
      }));
    }
  });

  // Original Triangle Peg game, kept independent of the other two games.
  readonly levelId = signal<Difficulty>('easy');
  readonly level = computed(() => LEVELS.find(level => level.id === this.levelId())!);
  readonly puzzle = computed(() => BOARDS[this.levelId()]);
  readonly holes = computed(() => this.puzzle().holes);
  readonly pegDiameter = computed(() => ({
    easy: '9.3%', medium: '7.8%', hard: '6.8%', extreme: '5.9%'
  })[this.levelId()]);
  readonly board = signal<BoardState>(initialBoard());
  readonly startHole = signal(0);
  readonly choosingStart = signal(false);
  readonly selected = signal<number | null>(null);
  readonly history = signal<readonly BoardState[]>([]);
  readonly future = signal<readonly BoardState[]>([]);
  readonly bestByLevel = signal<BestByLevel>(this.readPegBest());
  readonly bestResult = computed(() => this.bestByLevel()[this.levelId()] ?? null);
  readonly feedback = signal('Select a peg, then choose a highlighted empty hole.');
  readonly pegsLeft = computed(() => pegCount(this.board()));
  readonly moves = computed(() => this.history().length);
  readonly options = computed(() => legalMoves(this.board(), this.puzzle()));
  readonly status = computed<PegStatus>(() => {
    if (this.choosingStart()) return 'choosing';
    if (this.pegsLeft() === 1) return 'won';
    return this.options().length === 0 ? 'stuck' : 'playing';
  });
  readonly targets = computed(() => new Set(this.options()
    .filter(move => move.from === this.selected()).map(move => move.to)));
  readonly movable = computed(() => new Set(this.options().map(move => move.from)));

  // Lights Out: the board is a BigInt mask, with a separate undo/redo history.
  readonly lightsLevel = signal<Difficulty>('easy');
  readonly lightsSize = computed(() => LIGHT_LEVELS.find(level => level.id === this.lightsLevel())!.size);
  readonly lightsCells = computed(() => Array.from({ length: this.lightsSize() ** 2 }, (_, i) => i));
  readonly lightBoard = signal<bigint>(makeLightsPuzzle('easy', this.newSeed()).board);
  readonly lightHistory = signal<readonly bigint[]>([]);
  readonly lightFuture = signal<readonly bigint[]>([]);
  readonly lightFeedback = signal('Tap a light to toggle it and its neighbors. Turn them all off.');
  readonly litLeft = computed(() => litCount(this.lightBoard()));
  readonly lightsWon = computed(() => this.litLeft() === 0);
  readonly lightsBest = signal<BestByLevel>(this.readMoveBest('utgardnet-lights-best-v1'));

  // Sliding Puzzle: tiles are an immutable number array, with zero as the gap.
  readonly slidingLevel = signal<Difficulty>('easy');
  readonly slidingSize = computed(() => SLIDING_LEVELS.find(level => level.id === this.slidingLevel())!.size);
  readonly tilesBoard = signal<readonly number[]>(makeSlidingPuzzle('easy', this.newSeed()).tiles);
  readonly tilesHistory = signal<readonly (readonly number[])[]>([]);
  readonly tilesFuture = signal<readonly (readonly number[])[]>([]);
  readonly tilesFeedback = signal('Tap a tile beside the gap. Arrange the numbers in order.');
  readonly tilesWon = computed(() => isSolved(this.tilesBoard()));
  readonly tilesCorrect = computed(() => correctTileCount(this.tilesBoard()));
  readonly tilesBest = signal<BestByLevel>(this.readMoveBest('utgardnet-sliding-best-v1'));

  // F1 Start Lights: both modes use performance.now() for timing, and scores
  // are kept separately in localStorage.
  readonly f1Mode = signal<F1Mode>('reaction');
  readonly f1Stage = signal<F1Stage>('idle');
  readonly f1LightPositions: readonly number[] = [0, 1, 2, 3, 4];
  readonly f1Lit = signal(0);
  readonly f1Elapsed = signal(0);
  readonly f1Attempts = signal(0);
  readonly f1ResultMs = signal<number | null>(null);
  readonly f1DifferenceMs = signal<number | null>(null);
  readonly f1Feedback = signal('Start the test, then react when all five lights go out.');
  readonly f1BestReaction = signal<number | null>(this.readF1Best('utgardnet-f1-reaction-best-v1'));
  readonly f1BestPerfect = signal<number | null>(this.readF1Best('utgardnet-f1-perfect10-best-v1'));
  readonly f1Active = computed(() => ['countdown', 'go', 'running'].includes(this.f1Stage()));
  readonly f1ResultText = computed(() => {
    if (this.f1Stage() === 'false-start') return 'FALSE';
    if (this.f1Stage() !== 'result') return '—';
    return this.f1Mode() === 'reaction'
      ? formatF1Time(this.f1ResultMs() ?? 0)
      : formatF1Difference(this.f1DifferenceMs() ?? 0);
  });
  readonly f1DisplayClock = computed(() => {
    if (this.f1Mode() !== 'perfect10') return '';
    if (this.f1Stage() === 'running' && this.f1Elapsed() >= F1_HIDE_CLOCK_AFTER_MS) return '••.•••';
    return (this.f1Elapsed() / 1000).toFixed(3);
  });
  readonly f1ModeName = computed(() =>
    this.f1Mode() === 'reaction' ? 'Reaction Start' : '10 Seconds Perfect');
  private f1Timers: number[] = [];
  private f1Tick: number | null = null;
  private f1StartedAt = 0;
  private f1GoAt = 0;

  readonly currentLevel = computed(() => {
    switch (this.game()) {
      case 'lights': return this.lightsLevel();
      case 'sliding': return this.slidingLevel();
      default: return this.levelId();
    }
  });
  readonly currentStatus = computed(() => {
    switch (this.game()) {
      case 'peg':
        switch (this.status()) {
          case 'choosing': return 'CHOOSE A HOLE';
          case 'won': return 'SOLVED';
          case 'stuck': return 'NO MOVES LEFT';
          default: return 'IN PLAY';
        }
      case 'lights': return this.lightsWon() ? 'SOLVED' : 'IN PLAY';
      case 'sliding': return this.tilesWon() ? 'SOLVED' : 'IN PLAY';
      case 'f1':
        switch (this.f1Stage()) {
          case 'countdown': return 'WAIT FOR LIGHTS';
          case 'go': return 'GO!';
          case 'running': return 'COUNT TO TEN';
          case 'false-start': return 'FALSE START';
          case 'result': return 'FINISHED';
          default: return 'READY';
        }
      default: return '';
    }
  });
  readonly currentWon = computed(() =>
    this.game() === 'lights' ? this.lightsWon() :
    this.game() === 'sliding' ? this.tilesWon() :
    this.game() === 'f1' ? this.f1Stage() === 'result' : this.status() === 'won'
  );
  readonly currentFeedback = computed(() =>
    this.game() === 'lights' ? this.lightFeedback() :
    this.game() === 'sliding' ? this.tilesFeedback() :
    this.game() === 'f1' ? this.f1Feedback() : this.feedback()
  );
  readonly canUndo = computed(() => {
    switch (this.game()) {
      case 'peg': return !this.choosingStart() && this.history().length > 0;
      case 'lights': return this.lightHistory().length > 0;
      case 'sliding': return this.tilesHistory().length > 0;
      case 'f1': return false;
      default: return false;
    }
  });
  readonly canRedo = computed(() => {
    switch (this.game()) {
      case 'peg': return !this.choosingStart() && this.future().length > 0;
      case 'lights': return this.lightFuture().length > 0;
      case 'sliding': return this.tilesFuture().length > 0;
      case 'f1': return false;
      default: return false;
    }
  });
  readonly stats = computed<GameStats>(() => {
    switch (this.game()) {
      case 'f1': {
        const mode = this.f1Mode();
        const bestMs = mode === 'reaction' ? this.f1BestReaction() : this.f1BestPerfect();
        return {
          first: this.f1ResultText(),
          firstLabel: mode === 'reaction' ? 'REACTION TIME' : 'ERROR FROM 10.000s',
          moves: this.f1Attempts(), movesLabel: 'ATTEMPTS',
          best: bestMs === null ? null : formatF1Time(bestMs),
          bestLabel: mode === 'reaction' ? 'BEST REACTION' : 'CLOSEST TO 10s',
          progress: mode === 'reaction'
            ? this.f1Lit()
            : Math.min(F1_TEN_SECONDS_MS, this.f1Elapsed()),
          max: mode === 'reaction' ? F1_LIGHTS : F1_TEN_SECONDS_MS
        };
      }
      case 'lights': {
        const count = this.lightsSize() ** 2;
        return {
          first: this.litLeft(), firstLabel: 'LIGHTS ON',
          moves: this.lightHistory().length,
          best: this.lightsBest()[this.lightsLevel()] ?? null,
          bestLabel: 'BEST · ' + this.lightsLevel().toUpperCase(),
          progress: count - this.litLeft(), max: count
        };
      }
      case 'sliding': {
        const max = this.slidingSize() ** 2 - 1;
        return {
          first: this.tilesCorrect(), firstLabel: 'TILES PLACED',
          moves: this.tilesHistory().length,
          best: this.tilesBest()[this.slidingLevel()] ?? null,
          bestLabel: 'BEST · ' + this.slidingLevel().toUpperCase(),
          progress: this.tilesCorrect(), max
        };
      }
      default: {
        const max = this.puzzle().holes.length - 2;
        return {
          first: this.choosingStart() ? this.puzzle().holes.length - 1 : this.pegsLeft(),
          firstLabel: 'PEGS LEFT',
          moves: this.moves(), best: this.bestResult(),
          bestLabel: 'BEST · ' + this.levelId().toUpperCase(),
          progress: this.choosingStart() ? 0 : this.puzzle().holes.length - 1 - this.pegsLeft(),
          max
        };
      }
    }
  });

  goHome(): void {
    if (this.game() === 'f1' && this.f1Active()) this.resetF1();
    this.game.set(null);
  }
  openGame(id: GameId): void { this.game.set(id); }

  openNewGame(): void {
    if (this.game() === null || (this.game() === 'f1' && this.f1Active())) return;
    this.pendingLevel.set(this.currentLevel());
    this.pendingF1Mode.set(this.f1Mode());
    const dialog = this.newGameDialog?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }
  chooseDifficulty(level: Difficulty): void { this.pendingLevel.set(level); }
  chooseF1Mode(mode: F1Mode): void { this.pendingF1Mode.set(mode); }
  cancelNewGame(): void { this.newGameDialog?.nativeElement.close(); }
  dismissModalBackdrop(event: MouseEvent): void {
    if (event.target === this.newGameDialog?.nativeElement) this.cancelNewGame();
  }

  confirmNewGame(): void {
    this.newGameDialog?.nativeElement.close();
    switch (this.game()) {
      case 'f1':
        this.resetF1();
        this.f1Mode.set(this.pendingF1Mode());
        this.f1Attempts.set(0);
        this.f1Feedback.set(this.f1Mode() === 'reaction'
          ? 'Press Start. Wait for five red lights to go out, then tap!'
          : 'Press Start, count ten seconds, and tap Stop as accurately as possible.');
        break;
      case 'peg':
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
        break;
      case 'lights':
        this.lightsLevel.set(this.pendingLevel());
        this.lightBoard.set(makeLightsPuzzle(this.lightsLevel(), this.newSeed()).board);
        this.lightHistory.set([]);
        this.lightFuture.set([]);
        this.lightFeedback.set('Turn all lights off. Each tap flips neighboring lights too.');
        break;
      case 'sliding':
        this.slidingLevel.set(this.pendingLevel());
        this.tilesBoard.set(makeSlidingPuzzle(this.slidingLevel(), this.newSeed()).tiles);
        this.tilesHistory.set([]);
        this.tilesFuture.set([]);
        this.tilesFeedback.set('Slide the numbered tiles into order by tapping beside the gap.');
        break;
    }
  }

  undo(): void {
    switch (this.game()) {
      case 'peg': this.undoPeg(); break;
      case 'lights': {
        const history = this.lightHistory();
        if (!history.length) return;
        this.lightFuture.update(items => [...items, this.lightBoard()]);
        this.lightBoard.set(history[history.length - 1]);
        this.lightHistory.set(history.slice(0, -1));
        this.lightFeedback.set('Move undone.');
        break;
      }
      case 'sliding': {
        const history = this.tilesHistory();
        if (!history.length) return;
        this.tilesFuture.update(items => [...items, this.tilesBoard()]);
        this.tilesBoard.set(history[history.length - 1]);
        this.tilesHistory.set(history.slice(0, -1));
        this.tilesFeedback.set('Move undone.');
        break;
      }
    }
  }
  redo(): void {
    switch (this.game()) {
      case 'peg': this.redoPeg(); break;
      case 'lights': {
        const future = this.lightFuture();
        if (!future.length) return;
        this.lightHistory.update(items => [...items, this.lightBoard()]);
        this.lightBoard.set(future[future.length - 1]);
        this.lightFuture.set(future.slice(0, -1));
        this.lightFeedback.set(this.lightsWon() ? 'All lights out. Perfect!' : 'Move restored.');
        break;
      }
      case 'sliding': {
        const future = this.tilesFuture();
        if (!future.length) return;
        this.tilesHistory.update(items => [...items, this.tilesBoard()]);
        this.tilesBoard.set(future[future.length - 1]);
        this.tilesFuture.set(future.slice(0, -1));
        this.tilesFeedback.set(this.tilesWon() ? 'Puzzle solved!' : 'Move restored.');
        break;
      }
    }
  }


  private scheduleF1(callback: () => void, delay: number): void {
    this.f1Timers.push(window.setTimeout(callback, delay));
  }
  private clearF1Timers(): void {
    for (const timer of this.f1Timers) window.clearTimeout(timer);
    this.f1Timers = [];
    if (this.f1Tick !== null) {
      window.clearInterval(this.f1Tick);
      this.f1Tick = null;
    }
  }
  private resetF1(): void {
    this.clearF1Timers();
    this.f1Stage.set('idle');
    this.f1Lit.set(0);
    this.f1Elapsed.set(0);
    this.f1ResultMs.set(null);
    this.f1DifferenceMs.set(null);
    this.f1GoAt = 0;
  }
  ngOnDestroy(): void {
    this.clearF1Timers();
  }
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.hidden && this.game() === 'f1' && this.f1Active()) {
      this.resetF1();
      this.f1Feedback.set('Round cancelled because the tab was hidden. Start a new attempt.');
    }
  }
  private randomF1Hold(): number {
    const sample = new Uint32Array(1);
    // GitHub Pages is HTTPS; crypto provides an unpredictable hold length.
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(sample);
      return reactionHoldDelay(sample[0] / 0x100000000);
    }
    return reactionHoldDelay(Math.random());
  }
  startF1Round(): void {
    if (this.game() !== 'f1' || this.f1Active()) return;
    this.resetF1();
    this.f1Attempts.update(n => n + 1);
    this.f1StartedAt = performance.now();
    if (this.f1Mode() === 'reaction') {
      this.f1Stage.set('countdown');
      this.f1Feedback.set('Wait until all five red lights go OUT. Early taps are false starts.');
      for (let count = 1; count <= F1_LIGHTS; count++) {
        this.scheduleF1(() => {
          if (this.f1Stage() === 'countdown') this.f1Lit.set(count);
        }, count * F1_LIGHT_INTERVAL_MS);
      }
      this.scheduleF1(() => {
        if (this.f1Stage() !== 'countdown') return;
        this.f1GoAt = performance.now();
        this.f1Lit.set(0);
        this.f1Stage.set('go');
        this.f1Feedback.set('LIGHTS OUT! TAP NOW!');
      }, F1_LIGHTS * F1_LIGHT_INTERVAL_MS + this.randomF1Hold());
    } else {
      this.f1Stage.set('running');
      this.f1Feedback.set('Count to exactly 10 seconds. The clock disappears after 3 seconds.');
      this.f1Tick = window.setInterval(() => {
        if (this.f1Stage() === 'running') {
          this.f1Elapsed.set(performance.now() - this.f1StartedAt);
        }
      }, 40);
    }
  }
  f1Tap(event: PointerEvent): void {
    if (!event.isPrimary) return;
    this.recordF1Tap();
  }
  f1KeyboardTap(event: KeyboardEvent): void {
    if (event.repeat) return;
    event.preventDefault();
    this.recordF1Tap();
  }
  private recordF1Tap(): void {
    if (this.game() !== 'f1' || !this.f1Active()) return;
    const tappedAt = performance.now();
    if (this.f1Mode() === 'reaction') {
      if (this.f1Stage() === 'countdown') {
        this.clearF1Timers();
        this.f1Stage.set('false-start');
        this.f1Feedback.set('FALSE START! You tapped before the lights went out. Try again.');
        return;
      }
      if (this.f1Stage() !== 'go') return;
      const result = scoreReaction(tappedAt, this.f1GoAt);
      this.clearF1Timers();
      if (result.kind === 'false-start') {
        this.f1Stage.set('false-start');
        this.f1Feedback.set('False start. Try again.');
        return;
      }
      this.f1ResultMs.set(result.reactionMs);
      this.f1Stage.set('result');
      this.f1Feedback.set(`Reaction: ${formatF1Time(result.reactionMs)}. Try to beat your record!`);
      this.saveF1Best('reaction', result.reactionMs);
    } else if (this.f1Stage() === 'running') {
      const result = scorePerfect10(this.f1StartedAt, tappedAt);
      this.clearF1Timers();
      this.f1Elapsed.set(result.elapsedMs);
      this.f1DifferenceMs.set(result.differenceMs);
      this.f1ResultMs.set(result.absoluteErrorMs);
      this.f1Stage.set('result');
      this.f1Feedback.set(
        `Stopped at ${formatF1Time(result.elapsedMs)} — ${formatF1Difference(result.differenceMs)} from 10.000s.`
      );
      this.saveF1Best('perfect10', result.absoluteErrorMs);
    }
  }
  private readF1Best(key: string): number | null {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return null;
      const score = Number(stored);
      return Number.isFinite(score) && score >= 0 && score < 60000 ? score : null;
    } catch { return null; }
  }
  private saveF1Best(mode: F1Mode, score: number): void {
    const holder = mode === 'reaction' ? this.f1BestReaction : this.f1BestPerfect;
    if (holder() !== null && holder()! <= score) return;
    holder.set(score);
    const key = mode === 'reaction'
      ? 'utgardnet-f1-reaction-best-v1' : 'utgardnet-f1-perfect10-best-v1';
    try { localStorage.setItem(key, String(score)); } catch { /* Optional. */ }
  }

  lightIsOn(index: number): boolean { return isLightOn(this.lightBoard(), index); }
  tapLight(index: number): void {
    if (this.game() !== 'lights' || this.lightsWon()) return;
    const next = pressLight(this.lightBoard(), this.lightsSize(), index);
    this.lightHistory.update(items => [...items, this.lightBoard()]);
    this.lightFuture.set([]);
    this.lightBoard.set(next);
    if (next === 0n) {
      this.lightFeedback.set('All lights out! You solved the puzzle.');
      this.saveMoveBest('lights', this.lightsLevel(), this.lightHistory().length);
    } else {
      this.lightFeedback.set('Keep going. Every tap also flips neighboring lights.');
    }
  }
  canSlide(index: number): boolean {
    return neighbors(this.tilesBoard().indexOf(0), this.slidingSize()).includes(index);
  }
  tapTile(index: number): void {
    if (this.game() !== 'sliding' || this.tilesWon()) return;
    const next = slideTile(this.tilesBoard(), this.slidingSize(), index);
    if (next === null) return;
    this.tilesHistory.update(items => [...items, this.tilesBoard()]);
    this.tilesFuture.set([]);
    this.tilesBoard.set(next);
    if (isSolved(next)) {
      this.tilesFeedback.set('Every tile in place! Puzzle solved.');
      this.saveMoveBest('sliding', this.slidingLevel(), this.tilesHistory().length);
    } else {
      this.tilesFeedback.set('Slide tiles next to the empty square until every number is in order.');
    }
  }

  hasPeg(id: number): boolean { return hasPeg(this.board(), id); }
  openingAllowed(id: number): boolean { return canStartAt(this.puzzle(), id); }
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
      this.restartPeg();
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
      this.playPeg(move);
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
  private undoPeg(): void {
    const history = this.history();
    if (!history.length || this.choosingStart()) return;
    this.future.update(items => [...items, this.board()]);
    this.board.set(history[history.length - 1]);
    this.history.set(history.slice(0, -1));
    this.clearSelection();
    this.feedback.set('Jump undone. Choose a move or use Redo.');
  }
  private redoPeg(): void {
    const future = this.future();
    if (!future.length || this.choosingStart()) return;
    this.history.update(items => [...items, this.board()]);
    this.board.set(future[future.length - 1]);
    this.future.set(future.slice(0, -1));
    this.clearSelection();
    this.feedback.set(this.status() === 'won'
      ? 'Perfect! One peg remains.'
      : this.status() === 'stuck' ? 'No jumps remain. Undo to try again.' : 'Jump restored.');
  }
  private restartPeg(): void {
    this.board.set(initialBoard(this.startHole(), this.puzzle()));
    this.history.set([]);
    this.future.set([]);
    this.clearSelection();
    this.choosingStart.set(false);
  }
  private clearSelection(): void { this.selected.set(null); }
  private playPeg(move: Move): void {
    const current = this.board();
    const next = applyMove(current, move, this.puzzle());
    this.history.update(items => [...items, current]);
    this.future.set([]);
    this.board.set(next);
    this.clearSelection();
    if (pegCount(next) === 1) {
      this.feedback.set(`Perfect! ${this.level().label} solved with just one peg.`);
      this.savePegBest(1);
    } else if (legalMoves(next, this.puzzle()).length === 0) {
      const left = pegCount(next);
      this.feedback.set(`No moves left with ${left} pegs. Undo to try another route.`);
      this.savePegBest(left);
    } else {
      this.feedback.set('Good jump. Keep clearing the triangle.');
    }
  }
  private newSeed(): number {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }
  private readMoveBest(key: string): BestByLevel {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const value = parsed as Record<string, unknown>;
        const best: BestByLevel = {};
        for (const level of LEVELS) {
          const moves = value[level.id];
          if (typeof moves === 'number' && Number.isInteger(moves) && moves > 0 && moves <= 1000000) {
            best[level.id] = moves;
          }
        }
        return best;
      }
    } catch { /* Storage may be disabled. */ }
    return {};
  }
  private saveMoveBest(game: 'lights' | 'sliding', level: Difficulty, moves: number): void {
    const storageKey = game === 'lights' ? 'utgardnet-lights-best-v1' : 'utgardnet-sliding-best-v1';
    const holder = game === 'lights' ? this.lightsBest : this.tilesBest;
    const previous = holder()[level];
    if (previous !== undefined && previous <= moves) return;
    const best = { ...holder(), [level]: moves };
    holder.set(best);
    try { localStorage.setItem(storageKey, JSON.stringify(best)); } catch { /* Optional. */ }
  }
  private readPegBest(): BestByLevel {
    const best: BestByLevel = {};
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('triangle-peg-best-v2') || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const values = parsed as Record<string, unknown>;
        for (const level of LEVELS) {
          const score = values[level.id];
          if (typeof score === 'number' && Number.isInteger(score) &&
              score >= 1 && score < level.rows * (level.rows + 1) / 2) best[level.id] = score;
        }
      }
      if (best.easy === undefined) {
        const previous = localStorage.getItem('triangle-peg-best-v1');
        const value = previous === null ? NaN : Number(previous);
        if (Number.isInteger(value) && value >= 1 && value <= 14) best.easy = value;
      }
    } catch { /* Optional. */ }
    return best;
  }
  private savePegBest(pegs: number): void {
    const level = this.levelId();
    const previous = this.bestByLevel()[level];
    if (previous !== undefined && previous <= pegs) return;
    const best = { ...this.bestByLevel(), [level]: pegs };
    this.bestByLevel.set(best);
    try { localStorage.setItem('triangle-peg-best-v2', JSON.stringify(best)); } catch { /* Optional. */ }
  }
}
