import type {Scenario,World,Edit} from './engine';
import type {HierarchyPoint} from './hierarchySession';
import {runToEnd,startPlayback,type Operation} from './experiment';
/** Save format v14 action shape. Kept to read old saves and as a thin wrapper over experiment.ts. */
export type ReplayAction={time:number;kind:'input';id:string;value:number}|{time:number;kind:'edit';id:string;value:number;purpose:Edit['purpose']}|{time:number;kind:'request';id:string};
export type Recipe={initial:World;actions:ReplayAction[];until:number};
export function toOperations(actions:ReplayAction[]):Operation[]{
 return actions.map(a=>a.kind==='input'?{atTick:a.time,kind:'setInput',target:a.id,value:a.value}:a.kind==='edit'?{atTick:a.time,kind:'intervene',target:a.id,value:a.value,purpose:a.purpose}:{atTick:a.time,kind:'request',target:a.id});
}
export function validateActions(s:Scenario,actions:ReplayAction[],start:number,until:number){
 if(!Array.isArray(actions)||!Number.isInteger(until)||until<start)throw Error('Invalid recipe duration');
 let previous=start;
 for(const a of actions){if(!a||!Number.isInteger(a.time)||a.time<previous||a.time>until)throw Error('Actions must be ordered within the run');previous=a.time;
  if(a.kind==='input'){const i=s.inputs.find(i=>i.id===a.id);if(!i||!Number.isFinite(a.value)||a.value<i.min||a.value>i.max||Math.abs((a.value-i.min)/i.step-Math.round((a.value-i.min)/i.step))>1e-7)throw Error('Invalid recipe input');}
  else if(a.kind==='edit'){const i=s.interventions.find(i=>i.id===a.id);if(!i||!Number.isFinite(a.value)||a.value<i.min||a.value>i.max||!['experiment','repair'].includes(a.purpose))throw Error('Invalid recipe edit');}
  else if(a.kind==='request'){if(!s.nodes.some(n=>n.id===a.id&&n.trigger.type==='request'))throw Error('Invalid recipe request');}
  else throw Error('Invalid recipe action');
 }
}
export function replayExperiment(s:Scenario,recipe:Recipe):{world:World;points:HierarchyPoint[]}{
 validateActions(s,recipe.actions,recipe.initial.time,recipe.until);
 const run=runToEnd(s,startPlayback(s,recipe.initial,toOperations(recipe.actions),recipe.until));
 if(run.status==='failed')throw Error(run.error);
 return {world:run.world,points:run.points};
}
