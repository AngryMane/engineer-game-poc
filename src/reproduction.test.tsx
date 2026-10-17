import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {reproductionScenario as s} from './reproductionScenario';
import {createWorld,setInput,step,intervene,validateBehavior,restartWithSettings,type World} from './engine';
import {replayExperiment,type ReplayAction,type Recipe} from './experimentReplay';
import {hierarchySample,readHierarchySession,type HierarchySessionV14} from './hierarchySession';
import {runToEnd,startPlayback} from './experiment';
import {presentScenario} from './semanticPresentation';
import {HierarchyPlay} from './HierarchyPlay';
import {scopeItems,projectConnections} from './hierarchy';
const action=(time:number,id:string,value:number):ReplayAction=>({kind:'input',time,id,value});
const capture='N02.enabled',use='N03.enabled';
const actions=[action(0,capture,1),action(6,capture,0),action(10,use,1)];
const recipe=(initial=createWorld(s),events=actions,until=22):Recipe=>({initial,actions:events,until});
const normal={...s,faults:[]};
describe('causal reproduction discovery',()=>{
 it('has a correct independent normal contract, including changed levels and stop/restart',()=>{expect(validateBehavior(normal,createWorld(normal))).toMatchObject({passed:true});});
 it('separates latent loss from later output onset, deterministically',()=>{
  let faulty=createWorld(s),healthy=createWorld(normal);let latent:number|undefined,onset:number|undefined;
  for(let t=0;t<22;t++){for(const a of actions.filter(a=>a.time===t)){faulty=setInput(s,faulty,a.id,(a as {value:number}).value);healthy=setInput(normal,healthy,a.id,(a as {value:number}).value);}faulty=step(s,faulty);healthy=step(normal,healthy);if(latent===undefined&&faulty.states.N05.value!==healthy.states.N05.value){latent=faulty.time;expect(faulty.monitor.alerts).toEqual({});}if(onset===undefined&&faulty.monitor.alerts.N08)onset=faulty.time;}
  expect(latent).toBe(8);expect(onset).toBe(13);expect(faulty.states.N07.value).toBe(10);expect(faulty.states.N08.value).toBe(0);
  const a=replayExperiment(s,recipe()),b=replayExperiment(s,recipe());expect(a).toEqual(b);expect(a.world).toEqual(faulty);
 });
 it('does not fail from waiting, either input alone, reverse order, or simultaneous release/use',()=>{
  const controls=[[],[action(0,use,1)],[action(0,capture,1),action(6,capture,0)],[action(0,use,1),action(5,capture,1),action(11,capture,0)],[action(0,capture,1),action(10,use,1)],[action(0,capture,1),action(6,capture,0),action(6,use,1)]];
  for(const events of controls)expect(replayExperiment(s,recipe(createWorld(s),events,40)).world.monitor.logs.filter(l=>l.type==='onset'),JSON.stringify(events)).toEqual([]);
  for(const gap of [1,3,9]){const run=replayExperiment(s,recipe(createWorld(s),[action(0,capture,1),action(6,capture,0),action(6+gap,use,1)],32));expect(run.world.monitor.logs.some(l=>l.type==='onset')).toBe(true);}
 });
 it('accepts direct and alternative repairs without a reproduction gate, rejects prefill and output freezing',()=>{
  for(const [id,value] of [['N05.retention',1],['N06.useAck',1]] as const){const fixed=intervene(s,createWorld(s),id,value);expect(validateBehavior(s,fixed)).toMatchObject({passed:true});expect(replayExperiment(s,recipe(fixed)).world.monitor.logs.filter(l=>l.type==='onset')).toEqual([]);expect(replayExperiment(s,recipe(fixed,[],32)).world.verification.cleared).toBe(true);}
  for(const [id,value]of [['N05.state.value',10],['N06.gain',0]] as const)expect(validateBehavior(s,intervene(s,createWorld(s),id,value)).passed).toBe(false);
 });
 it('stores full snapshots and actions, restores mid-run, and replays after restart exactly',()=>{
  const initial=restartWithSettings(s,intervene(s,createWorld(s),'N06.useAck',1));const original=replayExperiment(s,recipe(initial));
  // A v14 save is migrated to v15; its experiment and recording still replay to the same world.
  const data:HierarchySessionV14={version:14,sid:s.id,world:original.world,runStart:initial,runActions:actions,view:{scope:'Holding',selected:null},detailsOpen:false,points:original.points,notes:'normal',prediction:'same',experiments:[{name:'run',notes:'both outcomes retained',prediction:'',points:original.points,recipe:recipe(initial),logs:original.world.monitor.logs}],hint:0};
  const loaded=readHierarchySession(s,JSON.stringify(data));expect(loaded.version).toBe(15);const ex=loaded.experiments[0];expect(ex).toMatchObject({name:'run',memo:'both outcomes retained',origin:'migrated',until:22});
  expect(runToEnd(s,startPlayback(s,ex.setup.initial,ex.operations,ex.until)).world).toEqual(original.world);expect(ex.outcome.points).toEqual(original.points);
  expect(runToEnd(s,startPlayback(s,loaded.recording.start,loaded.recording.operations,loaded.world.time)).world).toEqual(original.world);
  expect(readHierarchySession(s,JSON.stringify(loaded))).toEqual(loaded);
  const partial=replayExperiment(s,recipe(createWorld(s),actions.slice(0,2),9));const resumed=replayExperiment(s,{initial:JSON.parse(JSON.stringify(partial.world)),actions:actions.slice(2),until:22});expect(resumed.world).toEqual(replayExperiment(s,recipe()).world);
 });
 it('replays interventions at the original tick, including edits after a symptom',()=>{const rec=recipe();rec.actions=[...actions,{kind:'edit',time:15,id:'N06.useAck',value:1,purpose:'experiment'}];const run=replayExperiment(s,rec);expect(run.world.edits.at(-1)?.time).toBe(15);expect(run.world.monitor.logs.map(l=>[l.type,l.time])).toEqual([['onset',13],['recovery',17]]);expect(replayExperiment(s,JSON.parse(JSON.stringify(rec)))).toEqual(run);});
 it('rejects reordered, invalid and out-of-range copied recipes',()=>{for(const events of [[action(3,capture,1),action(1,use,1)],[action(0,'missing',1)],[action(0,capture,2)],[action(99,use,1)]])expect(()=>replayExperiment(s,recipe(createWorld(s),events))).toThrow();});
 it('keeps modes/hierarchy observational and initial evidence incomplete',()=>{
  const a=presentScenario(s,'abstract'),b=presentScenario(s,'functional');const initial=createWorld(s),before=structuredClone(initial);for(const scope of [null,'Core','Control','Holding','Consumption']){scopeItems(a,scope);projectConnections(b,initial,scope);}expect(initial).toEqual(before);expect(replayExperiment(a,recipe())).toEqual(replayExperiment(b,recipe()));expect(validateBehavior(a,initial)).toEqual(validateBehavior(b,initial));
  const html=renderToStaticMarkup(<HierarchyPlay s={s} onScenario={()=>{}}/>);expect(html).toContain('Partial records');expect(html).not.toContain('t=6');expect(html).not.toContain('N05');expect(html).not.toContain('Retention /');expect(html).toContain('Input events');expect(hierarchySample(a,initial)).toEqual(hierarchySample(b,initial));
 });
});

import {semanticScenario} from './semanticScenario';
it('replays external random timing, values, queued deliveries and request operations from the exact seed state',()=>{
 const sc=structuredClone(semanticScenario);sc.nodes.find(n=>n.externalInput)!.externalInput!.seed=12345;
 const initial=createWorld(sc),events:ReplayAction[]=[{kind:'request',time:3,id:'N05'},action(5,'N03.enabled',1),{kind:'edit',time:8,id:'N05.factor',value:1,purpose:'repair'}];
 const recorded={initial,actions:events,until:20},run=replayExperiment(sc,recorded),loaded=JSON.parse(JSON.stringify(recorded));expect(replayExperiment(sc,loaded)).toEqual(run);expect(run.world.trace.some(t=>t.nodeId==='N05'&&t.time===3)).toBe(true);expect(run.world.random.N04).not.toEqual(initial.random.N04);
 const altered=structuredClone(loaded);altered.initial.random.N04.value=54321;expect(replayExperiment(sc,altered).world.states.N15.value).not.toBe(run.world.states.N15.value);
});
