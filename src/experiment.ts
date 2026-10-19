import {setInput,intervene,requestNode,step,terminated,type Scenario,type World,type Edit} from './engine';
import {hierarchySample,type HierarchyPoint} from './hierarchySession';

/**
 * Experiment sequences and playback, kept outside React so they can be tested directly.
 *
 * Time rule: an operation with `atTick: t` is applied while the clock shows t, after tick t has
 * been processed and before tick t+1 is processed. This is exactly what happens when a player
 * edits a value while the screen shows `t`. Operations at the same tick are applied in
 * registration order (array order). Each operation goes through setInput / intervene /
 * requestNode, so the usual validation and the ban on editing external disturbances apply.
 */
export type Operation=
 |{atTick:number;kind:'setInput';target:string;value:number}
 |{atTick:number;kind:'intervene';target:string;value:number;purpose:Edit['purpose']}
 |{atTick:number;kind:'request';target:string};
/** An operation before it is stamped with the tick it was performed at. */
export type PendingOperation=Operation extends infer O?O extends Operation?Omit<O,'atTick'>:never:never;
/** Everything needed to rerun an experiment: the full start snapshot already holds the random state. */
export type ExperimentSetup={scenarioId:string;seeds:Record<string,number>;initial:World};
export type OutputSummary={nodeId:string;onsets:number[];recoveries:number[];failingAtEnd:boolean};
/** `terminatedAt`: the tick a terminal state (ship: explosion) ended the run before `until`. */
export type ExperimentOutcome={status:'completed'|'failed';terminatedAt?:number;terminalCause?:string;finalTime:number;points:HierarchyPoint[];logs:World['monitor']['logs'];outputs:OutputSummary[];error?:string;failedAt?:{index:number;atTick:number}};
export type Experiment={id:string;name:string;parentId?:string;origin:'recording'|'variant'|'migrated';prediction:string;memo:string;setup:ExperimentSetup;operations:Operation[];until:number;outcome:ExperimentOutcome};
export type Recording={start:World;operations:Operation[]};

const MAX_TICKS=2000;
export const seedsOf=(s:Scenario)=>Object.fromEntries(s.nodes.filter(n=>n.externalInput).map(n=>[n.id,n.externalInput!.seed]));
export function setupFor(s:Scenario,initial:World):ExperimentSetup{return {scenarioId:s.id,seeds:seedsOf(s),initial:structuredClone(initial)};}

/** Stable sort by tick: operations at the same tick keep their registration order. */
export function normalizeOperations(ops:Operation[]):Operation[]{return ops.map((op,i)=>({op,i})).sort((a,b)=>a.op.atTick-b.op.atTick||a.i-b.i).map(x=>structuredClone(x.op));}

const onStep=(value:number,min:number,step=1)=>Math.abs((value-min)/step-Math.round((value-min)/step))<1e-7;
/** Checks one operation against the scenario's editing rules. Throws a player-readable message. */
export function validateOperation(s:Scenario,op:Operation){
 if(!op||!Number.isInteger(op.atTick)||op.atTick<0)throw Error('操作の時刻は0以上の整数tickで指定してください');
 const node=s.nodes.find(n=>n.id===op.target.split('.')[0]);
 if(node?.externalInput)throw Error('外乱INPUTは編集禁止です');
 if(op.kind==='setInput'){const i=s.inputs.find(i=>i.id===op.target);if(!i)throw Error(`通常入力ではありません：${op.target}`);if(!Number.isFinite(op.value)||op.value<i.min||op.value>i.max||!onStep(op.value,i.min,i.step))throw Error(`${op.target} は ${i.min}〜${i.max}、刻み ${i.step} で指定してください`);return;}
 if(op.kind==='intervene'){const i=s.interventions.find(i=>i.id===op.target);if(!i)throw Error(`編集できる設定ではありません：${op.target}`);if(!Number.isFinite(op.value)||op.value<i.min||op.value>i.max||(i.step!==undefined&&!onStep(op.value,i.min,i.step)))throw Error(`${op.target} は ${i.min}〜${i.max} で指定してください`);if(!['experiment','repair'].includes(op.purpose))throw Error('編集の目的が不正です');return;}
 if(op.kind==='request'){if(!s.nodes.some(n=>n.id===op.target&&n.kind==='inner'&&n.trigger.type==='request'))throw Error(`問い合わせできるノードではありません：${op.target}`);return;}
 throw Error('未知の操作種別です');
}
/** A sequence must be ordered by tick and lie within [start, until]. */
export function validateSequence(s:Scenario,ops:Operation[],start:number,until:number){
 if(!Array.isArray(ops)||!Number.isInteger(until)||until<start)throw Error('終了tickは開始tick以降の整数で指定してください');
 if(until-start>MAX_TICKS)throw Error(`1回の実験は${MAX_TICKS}tickまでです`);
 let previous=start;
 ops.forEach((op,index)=>{
  try{validateOperation(s,op);}catch(e){throw Error(`操作${index+1}：${(e as Error).message}`);}
  if(op.atTick<previous||op.atTick>until)throw Error(`操作${index+1}：時刻は t=${start}〜${until} の範囲で、昇順に並べてください`);
  previous=op.atTick;
 });
}
/** Applies one operation through the engine API. Throws without changing `world` on failure. */
export function applyOperation(s:Scenario,world:World,op:Operation):World{
 validateOperation(s,op);
 if(op.kind==='setInput')return setInput(s,world,op.target,op.value);
 if(op.kind==='intervene')return intervene(s,world,op.target,op.value,op.purpose);
 return requestNode(s,world,op.target).world;
}

/* ---------- playback ---------- */

export type Playback={world:World;points:HierarchyPoint[];operations:Operation[];until:number;next:number;status:'pending'|'completed'|'failed';terminatedAt?:number;error?:string;failedAt?:{index:number;atTick:number}};
export function startPlayback(s:Scenario,initial:World,operations:Operation[],until:number):Playback{
 const world=structuredClone(initial),base={world,points:[hierarchySample(s,world)],operations:structuredClone(operations),until,next:0};
 try{validateSequence(s,operations,world.time,until);}catch(e){return {...base,status:'failed',error:(e as Error).message};}
 return settle(s,{...base,status:'pending'});
}
/** Applies every operation due at the current tick. All-or-nothing: a failure keeps the world from before this tick's operations. */
function applyDue(s:Scenario,pb:Playback):Playback{
 let world=pb.world,next=pb.next;const points:HierarchyPoint[]=[];
 while(next<pb.operations.length&&pb.operations[next].atTick===world.time){
  const op=pb.operations[next];
  try{world=applyOperation(s,world,op);}catch(e){return {...pb,status:'failed',error:`操作${next+1}（t=${op.atTick}）：${(e as Error).message}`,failedAt:{index:next,atTick:op.atTick}};}
  points.push(hierarchySample(s,world));next++;
 }
 return points.length?{...pb,world,next,points:[...pb.points,...points]}:pb;
}
/** When the clock reaches `until`, apply that tick's operations and finish. */
function settle(s:Scenario,pb:Playback):Playback{
 if(pb.status!=='pending'||pb.world.time<pb.until)return pb;
 const done=applyDue(s,pb);return done.status==='pending'?{...done,status:'completed'}:done;
}
/** Advances playback by up to `ticks` simulation ticks. Display speed never changes the result. */
export function advancePlayback(s:Scenario,pb:Playback,ticks=1):Playback{
 let p=pb;
 for(let n=0;n<ticks&&p.status==='pending';n++){
  p=applyDue(s,p);if(p.status!=='pending')break;
  let world:World;
  try{world=step(s,p.world);}catch(e){p={...p,status:'failed',error:`t=${p.world.time}→${p.world.time+1}：${(e as Error).message}`};break;}
  p={...p,world,points:[...p.points,hierarchySample(s,world)]};
  // A terminal state (ship: the explosion) ends the run at once; nothing after it is recorded.
  if(terminated(s,world)){p={...p,status:'completed',terminatedAt:world.time};break;}
  p=settle(s,p);
 }
 return p;
}
/** What ended a run, in the scenario's words (ship: 熱暴走 or 火花). */
export function terminalCause(s:Scenario,w:World){const t=s.terminal;if(!t?.causeKey||!t.causes)return undefined;return t.causes[w.states[t.nodeId][t.causeKey]];}
export const runToEnd=(s:Scenario,pb:Playback)=>advancePlayback(s,pb,Number.POSITIVE_INFINITY);
export const nextOperation=(pb:Playback):Operation|undefined=>pb.operations[pb.next];

export function summarizeOutputs(s:Scenario,world:World,logs=world.monitor.logs):OutputSummary[]{
 return s.outputRequirements.map(r=>({nodeId:r.nodeId,onsets:logs.filter(l=>l.nodeId===r.nodeId&&l.type==='onset').map(l=>l.time),recoveries:logs.filter(l=>l.nodeId===r.nodeId&&l.type==='recovery').map(l=>l.time),failingAtEnd:r.nodeId in world.monitor.alerts}));
}
export function outcomeOf(s:Scenario,pb:Playback,start:number):ExperimentOutcome{
 const logs=pb.world.monitor.logs.filter(l=>l.time>=start);
 return {status:pb.status==='failed'?'failed':'completed',...(pb.terminatedAt!==undefined?{terminatedAt:pb.terminatedAt,...(terminalCause(s,pb.world)?{terminalCause:terminalCause(s,pb.world)}:{})}:{}),finalTime:pb.world.time,points:pb.points,logs:structuredClone(logs),outputs:summarizeOutputs(s,pb.world,logs),...(pb.error?{error:pb.error}:{}),...(pb.failedAt?{failedAt:pb.failedAt}:{})};
}
/** Reruns an experiment from its own start snapshot. The current session is never touched. */
export function runExperiment(s:Scenario,setup:ExperimentSetup,operations:Operation[],until:number):ExperimentOutcome{
 return outcomeOf(s,runToEnd(s,startPlayback(s,setup.initial,operations,until)),setup.initial.time);
}
export function createExperiment(s:Scenario,fields:{id:string;name:string;prediction?:string;memo?:string;parentId?:string;origin:Experiment['origin'];initial:World;operations:Operation[];until:number}):Experiment{
 const setup=setupFor(s,fields.initial),operations=normalizeOperations(fields.operations);
 validateSequence(s,operations,setup.initial.time,fields.until);
 return {id:fields.id,name:fields.name,...(fields.parentId?{parentId:fields.parentId}:{}),origin:fields.origin,prediction:fields.prediction??'',memo:fields.memo??'',setup,operations,until:fields.until,outcome:runExperiment(s,setup,operations,fields.until)};
}
/** A variant always reruns from the parent's start snapshot; the parent is never modified. */
export function variantOf(s:Scenario,parent:Experiment,id:string,name:string,operations:Operation[],until:number):Experiment{
 return createExperiment(s,{id,name,parentId:parent.id,origin:'variant',prediction:'',memo:'',initial:parent.setup.initial,operations,until});
}

/* ---------- live session ---------- */

/** The player's own run. Operations are stamped with the tick shown on screen when they were made. */
export type LiveRun={world:World;points:HierarchyPoint[];recording:Recording;notice?:{text:string;stop:boolean}};
export function startLive(s:Scenario,world:World):LiveRun{return {world,points:[hierarchySample(s,world)],recording:{start:structuredClone(world),operations:[]}};}
/** One tick of Run. A failing tick leaves the world as it was and asks the UI to pause. */
export function liveTick(s:Scenario,live:LiveRun):LiveRun{
 if(terminated(s,live.world))return {...live,notice:{text:'この船はもう爆発しています。Reset か Restart で新しい船を出してください。',stop:true}};
 try{const world=step(s,live.world);const next={...live,world,points:[...live.points,hierarchySample(s,world)]};return terminated(s,world)?{...next,notice:{text:`t=${world.time} 船が爆発しました。全員が脱出ポッドで避難しました。`,stop:true}}:next;}
 catch(e){return {...live,notice:{text:String((e as Error).message??e),stop:true}};}
}
export function liveApply(s:Scenario,live:LiveRun,pending:PendingOperation):LiveRun{
 if(terminated(s,live.world))return {...live,notice:{text:'この船はもう爆発しています。Reset か Restart で新しい船を出してください。',stop:false}};
 const op={...pending,atTick:live.world.time} as Operation;
 try{const world=applyOperation(s,live.world,op);if(world===live.world)return live;return {...live,world,points:[...live.points,hierarchySample(s,world)],recording:{...live.recording,operations:[...live.recording.operations,op]}};}
 catch(e){return {...live,notice:{text:(e as Error).message,stop:false}};}
}
/** Starts a fresh recording at the current tick without touching the world. */
export function restartRecording(live:LiveRun):LiveRun{return {...live,recording:{start:structuredClone(live.world),operations:[]}};}
export const operationLabel=(op:Operation,text:(id:string)=>string=id=>id)=>op.kind==='request'?`t=${op.atTick} 問い合わせ ${text(op.target)}`:`t=${op.atTick} ${op.kind==='setInput'?'入力':op.purpose==='repair'?'修復':'実験編集'} ${text(op.target)} = ${op.value}`;
