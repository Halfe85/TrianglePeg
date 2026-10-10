import { Component, computed, signal } from '@angular/core';
import { applyMove, FULL_BOARD, hasPeg, HOLES, initialBoard, legalMoves,
  pegCount, solve, type Hole, type Move } from './peg-engine';

type Status='choosing'|'playing'|'won'|'stuck';

@Component({
  selector:'app-root',
  standalone:true,
  templateUrl:'./app.component.html',
  styleUrl:'./app.component.css'
})
export class AppComponent {
  readonly holes=HOLES;
  readonly board=signal(initialBoard());
  readonly startHole=signal(0);
  readonly choosingStart=signal(false);
  readonly selected=signal<number|null>(null);
  readonly suggestion=signal<Move|null>(null);
  readonly history=signal<readonly number[]>([]);
  readonly future=signal<readonly number[]>([]);
  readonly bestResult=signal<number|null>(this.readBest());
  readonly feedback=signal('Select a peg, then tap a highlighted empty hole to jump.');
  readonly pegsLeft=computed(()=>pegCount(this.board()));
  readonly moves=computed(()=>this.history().length);
  readonly options=computed(()=>legalMoves(this.board()));
  readonly status=computed<Status>(()=>{
    if(this.choosingStart()) return 'choosing';
    if(this.pegsLeft()===1) return 'won';
    return this.options().length===0 ? 'stuck' : 'playing';
  });
  readonly targets=computed(()=>new Set(this.options()
    .filter(m=>m.from===this.selected()).map(m=>m.to)));
  readonly movable=computed(()=>new Set(this.options().map(m=>m.from)));
  hasPeg(id:number):boolean { return hasPeg(this.board(),id); }
  holeLabel(hole:Hole):string {
    const where=`row ${hole.row+1}, position ${hole.column+1}`;
    if(this.choosingStart()) return `Choose ${where} as the empty starting hole`;
    if(this.targets().has(hole.id)) return `Jump into ${where}`;
    if(this.hasPeg(hole.id)) return `Peg at ${where}${this.selected()===hole.id?', selected':''}`;
    return `Empty hole at ${where}`;
  }
  onHoleClick(id:number):void {
    if(this.choosingStart()){
      this.startHole.set(id);
      this.restart();
      this.feedback.set('Starting hole selected. Make your first jump.');
      return;
    }
    if(this.status()!=='playing') return;
    const selected=this.selected();
    if(selected===id){
      this.selected.set(null);
      this.suggestion.set(null);
      return;
    }
    const move=selected===null?undefined:this.options().find(m=>m.from===selected && m.to===id);
    if(move){ this.play(move); return; }
    this.suggestion.set(null);
    if(this.hasPeg(id) && this.movable().has(id)){
      this.selected.set(id);
      this.feedback.set('Now choose one of the glowing empty holes.');
    }else if(this.hasPeg(id)){
      this.selected.set(null);
      this.feedback.set('That peg has no legal jump. Try another.');
    }else{
      this.feedback.set('Choose a peg first, then its highlighted landing hole.');
    }
  }
  undo():void {
    const previous=this.history();
    if(previous.length===0 || this.choosingStart()) return;
    this.future.update(steps=>[...steps,this.board()]);
    this.board.set(previous[previous.length-1]);
    this.history.set(previous.slice(0,-1));
    this.clearSelection();
    this.feedback.set('Jump undone. Make your next move, or use Redo.');
  }
  redo():void {
    const next=this.future();
    if(next.length===0 || this.choosingStart()) return;
    this.history.update(steps=>[...steps,this.board()]);
    this.board.set(next[next.length-1]);
    this.future.set(next.slice(0,-1));
    this.clearSelection();
    if(this.pegsLeft()===1){
      this.feedback.set('Perfect! You solved the triangle with one peg left.');
    }else if(this.options().length===0){
      this.feedback.set('No jumps remain. Undo to try another route.');
    }else{
      this.feedback.set('Jump restored. Continue playing.');
    }
  }
  private clearSelection():void {
    this.selected.set(null);
    this.suggestion.set(null);
  }
  restart():void {
    this.board.set(initialBoard(this.startHole()));
    this.history.set([]);
    this.future.set([]);
    this.selected.set(null);
    this.suggestion.set(null);
    this.choosingStart.set(false);
    this.feedback.set('Fresh board. Pick a peg to start.');
  }
  newGame():void {
    this.board.set(FULL_BOARD);
    this.history.set([]);
    this.future.set([]);
    this.selected.set(null);
    this.suggestion.set(null);
    this.choosingStart.set(true);
    this.feedback.set('Tap any hole to make it the empty starting space.');
  }
  hint():void {
    if(this.status()!=='playing') return;
    const path=solve(this.board());
    this.suggestion.set(path?.[0]??this.options()[0]??null);
    this.selected.set(null);
    this.feedback.set(path===null
      ? 'A one-peg solution is no longer possible. The marked jump is legal; Undo may help.'
      : 'Blue marks the peg to jump. Green marks its destination on a winning route.');
  }
  private play(move:Move):void {
    const current=this.board();
    const next=applyMove(current,move);
    this.history.update(items=>[...items,current]);
    this.future.set([]); // A new move invalidates the redo branch.
    this.board.set(next);
    this.selected.set(null);
    this.suggestion.set(null);
    if(pegCount(next)===1){
      this.feedback.set('Perfect! You solved the triangle with one peg left.');
      this.saveBest(1);
    }else if(legalMoves(next).length===0){
      const count=pegCount(next);
      this.feedback.set(`No jumps remain with ${count} pegs. Undo or restart to try again.`);
      this.saveBest(count);
    }else this.feedback.set('Nice jump! Keep removing pegs.');
  }
  private readBest():number|null {
    try {
      const raw=localStorage.getItem('triangle-peg-best-v1');
      if(raw===null) return null;
      const n=Number(raw);
      return Number.isInteger(n)&&n>=1&&n<=14?n:null;
    } catch { return null; }
  }
  private saveBest(pegs:number):void {
    const best=this.bestResult();
    if(best!==null&&best<=pegs) return;
    this.bestResult.set(pegs);
    try { localStorage.setItem('triangle-peg-best-v1',String(pegs)); }
    catch { /* Local storage is optional. */ }
  }
}
