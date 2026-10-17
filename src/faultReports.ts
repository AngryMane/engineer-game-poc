import {createWorld,setInput,step,type Scenario} from './engine';
import type {BehaviorCase} from './contracts';

/** A run that a report was observed in. The input history is hidden from the player. */
export type ReportRun={label:string;seed?:number;inputs:BehaviorCase['inputs']};
/** One observation in a report: either recorded values, or ids sampled from the named run. */
export type ReportEntry={run:string;time:number;ids?:string[];values?:Record<string,number>;note:string};
/** Evidence handed to the player. Reports describe symptoms; they never name the cause. */
export type FaultReport={id:string;title:string;from:string;summary:string;runs?:ReportRun[];entries:ReportEntry[];missing?:string};
export type ReportObservation={run:string;time:number;values:Record<string,number>;note:string};

/** Resolve report entries. Sampled values come from replaying the run on the faulty system. */
export function reportObservations(s:Scenario,report:FaultReport):ReportObservation[]{
 const sampled=new Map<string,Map<number,Record<string,number>>>();
 for(const run of report.runs??[]){
  const times=new Set(report.entries.filter(e=>e.run===run.label&&e.ids).map(e=>e.time));if(!times.size)continue;
  const sc=run.seed===undefined?s:{...s,nodes:s.nodes.map(n=>n.externalInput?{...n,externalInput:{...n.externalInput,seed:run.seed!}}:n)};
  let w=createWorld(sc);const values=new Map<number,Record<string,number>>();const end=Math.max(...times);
  for(let t=0;t<=end;t++){
   if(times.has(w.time))values.set(w.time,{...Object.fromEntries(s.nodes.map(n=>[n.id,w.states[n.id].value])),...Object.fromEntries(s.inputs.map(i=>[i.id,w.parameters[i.nodeId][i.parameter]]))});
   if(t===end)break;
   for(const action of run.inputs.filter(a=>a.time===w.time))w=setInput(sc,w,action.id,action.value);
   w=step(sc,w,false);
  }
  sampled.set(run.label,values);
 }
 return report.entries.map(entry=>{
  if(entry.values)return {run:entry.run,time:entry.time,values:entry.values,note:entry.note};
  const all=sampled.get(entry.run)?.get(entry.time);if(!all)throw Error(`Report ${report.id}: run ${entry.run} has no sample at t=${entry.time}`);
  return {run:entry.run,time:entry.time,values:Object.fromEntries(entry.ids!.map(id=>[id,Number(all[id].toFixed(4))])),note:entry.note};
 });
}
