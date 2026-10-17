import {validateActions,type Recipe,type ReplayAction} from './experimentReplay';
import type {DisplayMode} from './semanticModel';
import {readGraphLayout,type GraphLayout} from './graphLayout';
import type {Scenario,World} from './engine';
import {boundaryKey,readBoundary,validateHierarchyView,type HierarchyView} from './hierarchy';
export type HierarchyPoint={time:number;values:Record<string,number>};
export type HierarchyExperiment={name:string;points:HierarchyPoint[];notes:string;prediction:string;recipe?:Recipe;logs?:World['monitor']['logs']};
export type HierarchySession={version:14;runStart?:World;runActions?:ReplayAction[];displayMode?:DisplayMode;layout?:GraphLayout;sid:string;world:World;view:HierarchyView;detailsOpen:boolean;points:HierarchyPoint[];notes:string;prediction:string;experiments:HierarchyExperiment[];hint:number};
export const HIERARCHY_SAVE_KEY='causal-hierarchy-session-v14';
export function hierarchySample(s:Scenario,w:World):HierarchyPoint {
 return {time:w.time,values:Object.fromEntries([...s.hierarchy!.modules.flatMap(m=>m.ports.filter(p=>p.observable).map(p=>[boundaryKey(m.id,p.id),readBoundary(s,w,p).value])),...s.observations.map(o=>[o.id,w.states[o.target][o.key]])])};
}
export function readHierarchySession(s:Scenario,raw:string):HierarchySession {
 const d=JSON.parse(raw) as HierarchySession;
 if(!d||d.version!==14||d.sid!==s.id||!d.world||!Number.isInteger(d.world.time)||d.world.time<0||!d.view||typeof d.detailsOpen!=='boolean'||d.detailsOpen&&!d.view.selected||!Array.isArray(d.points)||!Array.isArray(d.experiments)||typeof d.notes!=='string'||typeof d.prediction!=='string'||!Number.isInteger(d.hint)||d.hint<0||d.hint>s.hints.length)throw Error('不正な保存データ');
 if(d.displayMode!==undefined&&!['abstract','functional'].includes(d.displayMode))throw Error('Invalid display mode');
 validateHierarchyView(s,d.view);
 if(d.layout!==undefined)d.layout=readGraphLayout(s,d.layout);
 validateSnapshot(s,d.world);
 if(d.runStart){validateSnapshot(s,d.runStart);validateActions(s,d.runActions??[],d.runStart.time,d.world.time);}
 for(const ex of d.experiments)if(ex.recipe){validateSnapshot(s,ex.recipe.initial);validateActions(s,ex.recipe.actions,ex.recipe.initial.time,ex.recipe.until);}
 for(const point of [...d.points,...d.experiments.flatMap(e=>e.points??[])])if(!Number.isInteger(point.time)||!point.values||Object.values(point.values).some(v=>!Number.isFinite(v)))throw Error('不正な計測履歴');
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
 for(const e of s.connections)if(![0,1].includes(w.parameters?.[e.id]?.enabled)||!Number.isFinite(w.signals[e.id])||!Number.isFinite(w.frames[e.to].inputs[e.id])||!Number.isFinite(w.states?.[e.id]?.value))throw Error('不正な接続状態');
 for(const event of w.pending)if(!s.nodes.some(n=>n.id===event.target)||!Number.isInteger(event.due)||event.due<=w.time||!Number.isFinite(event.value)||event.reason==='input'&&!s.connections.some(e=>e.id===event.connectionId&&e.from===event.source&&e.to===event.target))throw Error('不正な配送待ち');
}
