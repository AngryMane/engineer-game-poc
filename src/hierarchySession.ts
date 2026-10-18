import {validateActions,toOperations,type Recipe,type ReplayAction} from './experimentReplay';
import {runExperiment,setupFor,validateSequence,type Experiment,type Recording} from './experiment';
import type {DisplayMode} from './semanticModel';
import {readGraphLayout,type GraphLayout} from './graphLayout';
import type {Scenario,World} from './engine';
import {boundaryKey,readBoundary,validateHierarchyView,type HierarchyView} from './hierarchy';
export type HierarchyPoint={time:number;values:Record<string,number>};
/** v14 experiment. Read only, for migration. */
export type HierarchyExperimentV14={name:string;points:HierarchyPoint[];notes:string;prediction:string;recipe?:Recipe;logs?:World['monitor']['logs']};
export type HierarchySessionV14={version:14;runStart?:World;runActions?:ReplayAction[];displayMode?:DisplayMode;layout?:GraphLayout;sid:string;world:World;view:HierarchyView;detailsOpen:boolean;points:HierarchyPoint[];notes:string;prediction:string;experiments:HierarchyExperimentV14[];hint:number};
/**
 * v15: the run recording uses typed operations stamped with `atTick`, and each experiment
 * carries its own start snapshot, sequence, prediction, memo and computed outcome.
 */
export type HierarchySession={version:15|16;sid:string;world:World;recording:Recording;displayMode?:DisplayMode;layout?:GraphLayout;view:HierarchyView;detailsOpen:boolean;points:HierarchyPoint[];notes:string;prediction:string;experiments:Experiment[];hint:number;reportHints?:Record<string,number>;speed?:number};
export const HIERARCHY_SAVE_KEY='causal-hierarchy-session-v15';
/** v16: scenarios with a signal dictionary (the ship). Worlds carry message logs; never mixed with v15. */
export const SHIP_SAVE_KEY='causal-ship-session-v16';
export const saveKeyFor=(s:Scenario)=>s.signals?SHIP_SAVE_KEY:HIERARCHY_SAVE_KEY;
export const saveVersionFor=(s:Scenario):15|16=>s.signals?16:15;
/** Old key. It is read for migration and never written or removed. */
export const HIERARCHY_SAVE_KEY_V14='causal-hierarchy-session-v14';
export function hierarchySample(s:Scenario,w:World):HierarchyPoint {
 return {time:w.time,values:Object.fromEntries([...s.hierarchy!.modules.flatMap(m=>m.ports.filter(p=>p.observable).map(p=>[boundaryKey(m.id,p.id),readBoundary(s,w,p).value])),...s.observations.map(o=>[o.id,w.states[o.target][o.key]])])};
}
/** Converts a v14 save. Experiments are rerun from their recorded start, so outcomes are exact. */
export function migrateV14(s:Scenario,d:HierarchySessionV14):HierarchySession{
 const runStart=d.runStart??structuredClone(d.world);
 const experiments=d.experiments.filter(ex=>ex.recipe).map((ex,i):Experiment=>{const r=ex.recipe!,setup=setupFor(s,r.initial),operations=toOperations(r.actions);return {id:`exp-${i+1}`,name:ex.name,origin:'migrated',prediction:ex.prediction,memo:ex.notes,setup,operations,until:r.until,outcome:runExperiment(s,setup,operations,r.until)};});
 return {version:15,sid:d.sid,world:d.world,recording:{start:runStart,operations:toOperations(d.runActions??[])},displayMode:d.displayMode,layout:d.layout,view:d.view,detailsOpen:d.detailsOpen,points:d.points,notes:d.notes,prediction:d.prediction,experiments,hint:d.hint};
}
export function readHierarchySession(s:Scenario,raw:string):HierarchySession {
 let d=JSON.parse(raw) as HierarchySession|HierarchySessionV14;
 if(!d||d.sid!==s.id||!(s.signals?[16]:[14,15]).includes(d.version))throw Error('不正な保存データ');
 if(d.version===14){
  const old=d;if(!Array.isArray(old.experiments))throw Error('不正な保存データ');
  if(old.runStart){validateSnapshot(s,old.runStart);validateActions(s,old.runActions??[],old.runStart.time,old.world.time);}
  for(const ex of old.experiments)if(ex.recipe){validateSnapshot(s,ex.recipe.initial);validateActions(s,ex.recipe.actions,ex.recipe.initial.time,ex.recipe.until);}
  validateSnapshot(s,old.world);
  d=migrateV14(s,old);
 }
 if(!d.world||!Number.isInteger(d.world.time)||d.world.time<0||!d.view||typeof d.detailsOpen!=='boolean'||d.detailsOpen&&!d.view.selected||!Array.isArray(d.points)||!Array.isArray(d.experiments)||typeof d.notes!=='string'||typeof d.prediction!=='string'||!Number.isInteger(d.hint)||d.hint<0||d.hint>s.hints.length)throw Error('不正な保存データ');
 if(d.displayMode!==undefined&&!['abstract','functional'].includes(d.displayMode))throw Error('Invalid display mode');
 if(d.reportHints!==undefined&&(typeof d.reportHints!=='object'||Object.entries(d.reportHints).some(([id,n])=>!s.reports?.some(r=>r.id===id)||!Number.isInteger(n)||n<0||n>(s.reports!.find(r=>r.id===id)!.hints?.length??0))))throw Error('不正なヒント状態');
 validateHierarchyView(s,d.view);
 if(d.layout!==undefined)d.layout=readGraphLayout(s,d.layout);
 validateSnapshot(s,d.world);
 if(!d.recording)throw Error('不正な記録');validateSnapshot(s,d.recording.start);validateSequence(s,d.recording.operations,d.recording.start.time,d.world.time);
 const ids=new Set<string>();
 for(const ex of d.experiments){
  if(!ex||typeof ex.id!=='string'||ids.has(ex.id)||typeof ex.name!=='string'||typeof ex.prediction!=='string'||typeof ex.memo!=='string'||!ex.setup||ex.setup.scenarioId!==s.id||!ex.outcome||!Array.isArray(ex.outcome.points))throw Error('不正な実験');
  ids.add(ex.id);validateSnapshot(s,ex.setup.initial);validateSequence(s,ex.operations,ex.setup.initial.time,ex.until);
 }
 for(const ex of d.experiments)if(ex.parentId!==undefined&&!ids.has(ex.parentId))throw Error('不正な実験の親');
 for(const point of [...d.points,...d.experiments.flatMap(e=>e.outcome.points)])if(!Number.isInteger(point.time)||!point.values||Object.values(point.values).some(v=>!Number.isFinite(v)))throw Error('不正な計測履歴');
 return d;
}
export function validateSnapshot(s:Scenario,w:World){
 if(!w||!Number.isInteger(w.time)||w.time<0)throw Error("Invalid initial snapshot");
 if(!w.monitor||!Array.isArray(w.monitor.history)||!Array.isArray(w.monitor.logs)||!w.monitor.alerts||!Array.isArray(w.pending)||!Array.isArray(w.trace)||!Array.isArray(w.edits)||!Array.isArray(w.inputEvents)||!Array.isArray(w.appliedFaults)||!w.signals||!w.verification)throw Error('不正なゲーム状態');
 for(const n of s.nodes){
  for(const key of Object.keys(n.initialState))if(!Number.isFinite(w.states?.[n.id]?.[key]))throw Error('不正な状態値');
  for(const key of Object.keys(n.parameters))if(!Number.isFinite(w.parameters?.[n.id]?.[key]))throw Error('不正な設定');
  const f=w.frames?.[n.id];if(!f||!Number.isFinite(f.output)||!f.inputs||!w.activity?.[n.id]||!Number.isInteger(w.versions?.[n.id]))throw Error('不正な計算履歴');
  if(n.trigger.type==='timer'||n.trigger.type==='random')if(!Number.isInteger(w.nextDue?.[n.id])||w.nextDue[n.id]<=w.time)throw Error('不正な発火時刻');
  if(n.externalInput){const random=w.random?.[n.id];if(!random||![random.value,random.timing].every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff)||Object.entries(n.parameters).some(([key,value])=>w.parameters[n.id][key]!==value))throw Error('不正な外部入力');}
 }
 if(s.signals){if(!w.messages||typeof w.messages!=='object')throw Error('不正なメッセージ履歴');for(const [id,log]of Object.entries(w.messages)){const e=s.connections.find(e=>e.id===id);if(!e||!Array.isArray(log)||log.some(m=>!m||m.connectionId!==id||m.signal!==e.signal||!Number.isFinite(m.value)||![m.seq,m.emittedAt,m.deliveredAt].every(Number.isInteger)||m.deliveredAt>w.time))throw Error('不正なメッセージ履歴');}}
 for(const e of s.connections)if(![0,1].includes(w.parameters?.[e.id]?.enabled)||!Number.isFinite(w.signals[e.id])||!Number.isFinite(w.frames[e.to].inputs[e.id])||!Number.isFinite(w.states?.[e.id]?.value))throw Error('不正な接続状態');
 for(const event of w.pending)if(!s.nodes.some(n=>n.id===event.target)||!Number.isInteger(event.due)||event.due<=w.time||!Number.isFinite(event.value)||event.reason==='input'&&!s.connections.some(e=>e.id===event.connectionId&&e.from===event.source&&e.to===event.target))throw Error('不正な配送待ち');
}
