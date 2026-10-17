import {setInput,intervene,requestNode,step,type Scenario,type World,type Edit} from './engine';
import {hierarchySample,type HierarchyPoint} from './hierarchySession';
export type ReplayAction={time:number;kind:'input';id:string;value:number}|{time:number;kind:'edit';id:string;value:number;purpose:Edit['purpose']}|{time:number;kind:'request';id:string};
export type Recipe={initial:World;actions:ReplayAction[];until:number};
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
 let world=structuredClone(recipe.initial);const points=[hierarchySample(s,world)];let index=0;
 while(true){while(index<recipe.actions.length&&recipe.actions[index].time===world.time){const a=recipe.actions[index++];world=a.kind==='input'?setInput(s,world,a.id,a.value):a.kind==='edit'?intervene(s,world,a.id,a.value,a.purpose):requestNode(s,world,a.id).world;points.push(hierarchySample(s,world));}if(world.time===recipe.until)break;world=step(s,world);points.push(hierarchySample(s,world));}
 return {world,points};
}
