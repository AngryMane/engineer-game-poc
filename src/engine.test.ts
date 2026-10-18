import {describe,it,expect} from 'vitest';
import {createWorld,step,observe,intervene,setInput,requestNode,validate,validateBehavior,restartWithSettings,type Scenario,type World,type Expr} from './engine';
import {scenarios} from './legacyScenarios';
const active=(s:Scenario,w=createWorld(s))=>s.inputs.some(i=>i.id==='N01.enabled')?setInput(s,w,'N01.enabled',1):w;
const simulate=(s:Scenario,count:number,w=active(s))=>{const frames=[w];for(let i=0;i<count;i++){w=step(s,w);frames.push(w);}return frames;};
const final=(frames:World[])=>frames.at(-1)!;
const run=(s:Scenario,count:number,w=active(s))=>final(simulate(s,count,w));
const edit=(s:Scenario,w:World,target:string,parameter:string,value:number,purpose:'experiment'|'repair'='experiment')=>s.inputs.some(i=>i.id===`${target}.${parameter}`)?setInput(s,active(s,w),`${target}.${parameter}`,value):intervene(s,active(s,w),`${target}.${parameter}`,value,purpose);
const repaired=(s:Scenario)=>{let w=run(s,36);if(!s.faults.length)return setInput(s,w,'N01.level',16);for(const f of s.faults.filter(f=>f.parameter)){const node=s.nodes.find(n=>n.id===f.targetId),edge=s.connections.find(e=>e.id===f.targetId);w=edit(s,w,f.targetId,f.parameter!,node?.parameters[f.parameter!]??(edge as unknown as Record<string,number>)[f.parameter!],'repair');}return w;};
describe('deterministic synchronous engine',()=>{
 it('transports node output unchanged, with processing only in the source node',()=>{
  const s=scenarios[2];let w=active(s);
  expect(w.parameters.E04).toEqual({enabled:1});
  expect(w.parameters.N05.gain).toBe(.2);
  for(let tick=0;tick<40;tick++){
   const delivered=w.pending.filter(event=>event.connectionId==='E04'&&event.due===w.time+1);
   w=step(s,w,false);
   for(const event of w.pending.filter(event=>event.connectionId==='E04'&&event.due===w.time+1))expect(event.value).toBe(w.frames.N05.output);
   if(delivered.length)expect(w.frames.N06.inputs.E04).toBe(delivered.at(-1)!.value);
  }
  expect(()=>intervene(s,w,'E04.gain',1)).toThrow();
  expect(()=>intervene(s,w,'E04.delaySteps',2)).toThrow();
 });
 it('rejects connection faults and processing-related connection editors',()=>{
  for(const field of ['gain','delaySteps','state','key']){
   const s=structuredClone(scenarios[0]);Object.assign(s.connections[0],{[field]:1});expect(()=>validate(s)).toThrow();
  }
  const s=structuredClone(scenarios[0]);s.faults=[{id:'edge-fault',targetId:'E01',key:'value',mode:'gain_change',startStep:0,severity:.2}];expect(()=>validate(s)).toThrow();
  for(const scenario of scenarios)expect(scenario.interventions.filter(i=>scenario.connections.some(e=>e.id===i.target)).every(i=>i.parameter==='enabled')).toBe(true);
 });
 it('replays identical operations, edits and measurements',()=>{const s=structuredClone(scenarios[1]);s.observations[0].noise=.3;const replay=()=>simulate(s,90,edit(s,createWorld(s),'N05','period',8)).map(w=>observe(s,w,s.observations[0].id));expect(replay()).toEqual(replay());});
 it('is independent of node and edge registration order, including real feedback',()=>{const a=scenarios[2],b={...a,nodes:[...a.nodes].reverse(),connections:[...a.connections].reverse()};expect(run(a,100).states).toEqual(run(b,100).states);expect(run(a,100).states.N05.value).toBeCloseTo(.16);});
 it('changes output transitions for legacy node faults after a single declared input (sequence-dependent faults tested separately)',()=>{for(const s of scenarios.slice(1).filter(s=>s.id!=='reproduction')){const healthy={...s,faults:[]},input=s.inputs[0],value=input.defaultValue===input.max?input.min:input.max;const operation=(sc:Scenario)=>setInput(sc,createWorld(sc),input.id,value);const outputs=s.nodes.filter(n=>n.kind==='output').map(n=>n.id);const trace=(sc:Scenario)=>{let w=operation(sc);const values=[outputs.map(id=>w.states[id].value)];for(let t=0;t<72;t++){w=step(sc,w,false);values.push(outputs.map(id=>w.states[id].value));}return values;};expect(trace(s)).not.toEqual(trace(healthy));}});
 it('retains latency after a direct edit and rejects invalid values',()=>{const s=scenarios[0],w=edit(s,createWorld(s),'N01','level',16);expect(w.states.N03.value).toBe(4);expect(run(s,3,w).states.N03.value).toBe(8);expect(()=>edit(s,w,'N01','gain',99)).toThrow();expect(()=>edit(s,w,'N01','gain',.123)).toThrow();expect(()=>edit(s,w,'missing','gain',1)).toThrow();});
 it('applies sampling, permissions, offsets and deterministic noise',()=>{const s=structuredClone(scenarios[0]),w=createWorld(s),o=s.observations[0];o.available=false;expect(observe(s,w,o.id)).toBeNull();o.available=true;o.offset=18;expect(observe(s,w,o.id)).toBe(26);o.permission='afterStep';o.unlockStep=2;expect(observe(s,w,o.id)).toBeNull();o.permission='public';o.period=2;expect(observe(s,step(s,w),o.id)).toBeNull();o.noise=1;expect(observe(s,w,o.id)).toBe(observe(s,w,o.id));expect(observe(s,w,o.id)).not.toBe(26);});
 it('rejects invalid references, expressions and delay definitions',()=>{let s=structuredClone(scenarios[0]);s.connections[0].to='missing';expect(()=>validate(s)).toThrow();s=structuredClone(scenarios[0]);s.nodes[0].update.value={ref:'param.missing'};expect(()=>validate(s)).toThrow();s=structuredClone(scenarios[0]);s.nodes[0].update.value={op:'eval',args:[]} as unknown as Expr;expect(()=>validate(s)).toThrow();s=structuredClone(scenarios[0]);Object.assign(s.connections[0],{delaySteps:2});expect(()=>validate(s)).toThrow();s=structuredClone(scenarios[0]);s.nodes[1].id='N01';expect(()=>validate(s)).toThrow();});
 it('rejects invalid behavior cases and incomplete output contracts',()=>{for(const mutate of [(s:Scenario)=>{s.solution.stableSteps=0;},(s:Scenario)=>{s.outputRequirements=[];},(s:Scenario)=>{s.outputRequirements[0].nodeId='missing';},(s:Scenario)=>{s.behaviorCases=[];},(s:Scenario)=>{s.interventions=[];s.inputs=[];}]){const s=structuredClone(scenarios[0]);mutate(s);expect(()=>validate(s)).toThrow();}});
 it('safely reports divergence',()=>{const s=structuredClone(scenarios[0]);s.nodes[1].update.value=1e10;const w=setInput(s,createWorld(s),'N01.level',16);expect(()=>run(s,3,w)).toThrow('安定範囲');});
 it('supports node runtime fault modes and rejects additional edge processing',()=>{for(const mode of ['stuck','drift','gain_change','leak','delay','intermittent'] as const){const s=structuredClone(scenarios[0]);s.faults=[{id:'f',targetId:'N02',key:'value',mode,startStep:1,severity:2,condition:1}];expect(()=>simulate(s,12)).not.toThrow();}const s=structuredClone(scenarios[0]);Object.assign(s.connections[0],{gain:.2});expect(()=>validate(s)).toThrow();});
 it('applies the time/condition-dependent parameter fault once and permits a durable repair',()=>{const s=scenarios[1];expect(createWorld(s).parameters.N06.load).toBe(2);const faulty=run(s,3);expect(faulty.parameters.N06.load).toBe(8);expect(faulty.appliedFaults).toContain('F01');const fixed=edit(s,faulty,'N06','load',2);expect(run(s,100,fixed).parameters.N06.load).toBe(2);});
});
describe('automatic repair validation',()=>{
 it('accepts healthy behavior without requiring any particular edit',()=>{expect(run(scenarios[0],12).verification.cleared).toBe(true);for(const s of scenarios.slice(1))expect(run(s,150).verification.cleared).toBe(false);});
 it('clears repaired behavior after a stable window and all public cases',()=>{for(const s of scenarios){const w=repaired(s),next=run(s,120,w);expect(next.verification.cleared).toBe(true);expect(next.monitor.lastValidation?.passed).toBe(true);}},30000);
 it('accepts equivalent upstream compensation that satisfies all timing and output requirements',()=>{const s=scenarios[2];let w=run(s,40);w=edit(s,w,'N05','level',5);expect(validateBehavior(s,w).passed).toBe(true);expect(run(s,100,w).verification.cleared).toBe(true);expect(w.parameters.N05.gain).toBe(.2);});
 it('does not clear with supply compensation or disabled activity',()=>{const s=scenarios[1];let w=edit(s,run(s,36),'N01','capacity',16);expect(run(s,120,w).verification.cleared).toBe(false);w=edit(s,run(s,36),'N05','enabled',0);expect(run(s,120,w).states.N04.value).toBeGreaterThanOrEqual(9.5);expect(run(s,120,w).verification.cleared).toBe(false);});
 it('rejects residual bypass edits even after the true cause is repaired, then clears when restored',()=>{for(const s of scenarios.slice(1)){let w=repaired(s);const target=s.interventions.some(i=>i.target==='N02'&&i.parameter==='gain')?'N02':s.nodes.find(n=>n.kind==='inner'&&'gain' in n.parameters)!.id;w=edit(s,w,target,'gain',1.05);expect(run(s,120,w).verification.cleared).toBe(false);w=edit(s,w,target,'gain',1);expect(run(s,120,w).verification.cleared).toBe(true);}},30000);
 it('rejects protected changes even if required output checks all pass',()=>{const s=scenarios[2];const w=edit(s,repaired(s),'N09','level',0.1);const after=run(s,120,w);expect(after.states.N04.value).toBe(4);expect(after.verification.cleared).toBe(false);});
 it('resets the stable window on edits and revokes clearance on a new output violation',()=>{const s=scenarios[0];let w=run(s,8);expect(w.verification.cleared).toBe(true);w=edit(s,w,'N02','gain',1.05);expect(w.verification.stable).toBe(0);w=setInput(s,w,'N01.level',16);expect(run(s,3,w).verification.cleared).toBe(false);expect(run(s,3,w).monitor.alerts.N03).toBeDefined();});
 it('records purpose without using purpose as an answer or exposing intermediate grading',()=>{const s=scenarios[1];const a=edit(s,run(s,3),'N06','load',2,'experiment'),b=edit(s,run(s,3),'N06','load',2,'repair');expect(a.edits[0].purpose).toBe('experiment');expect(b.edits[0].purpose).toBe('repair');expect(run(s,60,a).verification.cleared).toBe(true);expect(run(s,60,b).verification.cleared).toBe(true);});
 it('supports full reset, restart preserving edits, and deterministic snapshot replay',()=>{const s=scenarios[2],fixed=repaired(s);const restarted=restartWithSettings(s,fixed);expect(restarted.time).toBe(0);expect(restarted.states.N06.value).toBe(0);expect(restarted.parameters.N05.gain).toBe(1);expect(restarted.verification.cleared).toBe(false);expect(run(s,72,restarted).verification.cleared).toBe(true);const restored=JSON.parse(JSON.stringify(fixed)) as World;expect(run(s,80,restored)).toEqual(run(s,80,fixed));expect(createWorld(s).parameters.N05.gain).toBe(.2);});
});
describe('output-connected investigations and reported behavior',()=>{
 it('contains only measurable nodes with a path to an output',()=>{scenarios.slice(1).forEach(s=>{const reachable=new Set(s.nodes.filter(n=>n.kind==='output').map(n=>n.id));let changed=true;while(changed){changed=false;for(const e of s.connections)if(reachable.has(e.to)&&!reachable.has(e.from)){reachable.add(e.from);changed=true;}}expect(reachable.size).toBe(s.nodes.length);expect(s.visibleNodeIds).toHaveLength(s.nodes.length);for(const n of s.nodes){expect(s.connections.some(e=>e.from===n.id||e.to===n.id)).toBe(true);expect(s.observations.some(o=>o.target===n.id)).toBe(true);}expect(()=>validate(s)).not.toThrow();});});
 it('periodic: briefing matches normal and faulty output ranges',()=>{const s=scenarios[1];const normal=simulate({...s,faults:[]},72).map(w=>w.states.N04.value),faulty=simulate(s,72).map(w=>w.states.N04.value);expect([Math.min(...normal),Math.max(...normal)]).toEqual([7.5,10]);expect([Math.min(...faulty),Math.max(...faulty)]).toEqual([1.5,10]);expect(Math.max(...simulate(s,72).map(w=>w.states.N08.value))).toBe(8);});
 it('periodic: two real activity cycles share resources and can be isolated experimentally',()=>{const s=scenarios[1];let w=edit(s,createWorld(s),'N05','enabled',0);expect(Math.min(...simulate(s,72,w).slice(20).map(w=>w.states.N04.value))).toBe(9.5);w=edit(s,w,'N09','enabled',0);expect(Math.min(...simulate(s,72,w).slice(20).map(w=>w.states.N04.value))).toBe(10);expect(s.visibleConnectionIds).toContain('E07');expect(s.nodes.find(n=>n.id==='N04')?.description).not.toContain('N06');});
 it('periodic: adjusting a cycle changes output timing',()=>{const s=scenarios[1],a=simulate(s,90),b=simulate(s,90,edit(s,createWorld(s),'N09','period',24));expect(a.map(w=>w.states.N04.value)).not.toEqual(b.map(w=>w.states.N04.value));});
 it('delayed: normal/faulty switch times match briefing, repeat after reset, and repair restores onset',()=>{const s=scenarios[2],normal=simulate({...s,faults:[]},72),faulty=simulate(s,72);expect(normal.find(w=>w.states.N04.value===4)?.time).toBe(11);expect(faulty.find(w=>w.states.N04.value===4)?.time).toBe(33);expect(faulty[12].states.N04.value).toBe(10);expect(faulty).toEqual(simulate(s,72));expect(simulate(s,72,restartWithSettings(s,repaired(s))).find(w=>w.states.N04.value===4)?.time).toBe(11);});
 it('delayed: changing the drain changes actual accumulation and onset',()=>{const s=scenarios[2];const off=simulate(s,72,edit(s,createWorld(s),'N09','level',0));expect(off.find(w=>w.states.N04.value===4)?.time).toBeLessThan(33);});
 it('removes unrelated branches and their controls, observations and repair checks',()=>{for(const s of scenarios.slice(1)){const targets=new Set([...s.nodes,...s.connections].map(x=>x.id));for(const o of s.observations)expect(targets.has(o.target)).toBe(true);for(const i of s.interventions)expect(targets.has(i.target)).toBe(true);for(const r of s.outputRequirements)expect(targets.has(r.nodeId)).toBe(true);}expect(scenarios[1].nodes).toHaveLength(18);expect(scenarios[2].nodes).toHaveLength(13);});
 it('delayed: stopping inflow prevents onset and does not erase existing memory instantly',()=>{const s=scenarios[2];expect(run(s,72,edit(s,createWorld(s),'E04','enabled',0)).states.N04.value).toBe(10);const late=edit(s,run(s,50),'E04','enabled',0);expect(run(s,5,late).states.N04.value).toBe(4);});
});
describe('primitive composition',()=>{
 it('evaluates every supported primitive',()=>{const expressions:Expr[]=[{op:'sum',args:[2,3]},{op:'multiply',args:[2,3]},{op:'clamp',args:[10,0,4]},{op:'threshold',args:[5,4]},{op:'delay',args:[{ref:'input.signal'}]},{op:'integrator',args:[{ref:'state.value'},2]},{op:'filter',args:[0,10,.2]},{op:'switch',args:[1,7,9]},{op:'pulse',args:[4,2,8,0]}];const expected=[5,6,4,1,8,6,2,7,8];expressions.forEach((expr,i)=>{const s=structuredClone(scenarios[0]);s.nodes[1].update.value=expr;s.nodes[1].trigger={type:'timer',periodParameter:'interval'};s.nodes[1].parameters.interval=1;expect(step(s,createWorld(s)).states.N02.value).toBe(expected[i]);});});
 it('rejects unknown observation keys and malformed expressions',()=>{const s=structuredClone(scenarios[0]);s.observations[0].key='missing';expect(()=>validate(s)).toThrow();const b=structuredClone(scenarios[0]);b.nodes[0].update.value={op:'filter',args:[1]};expect(()=>validate(b)).toThrow();});
});

describe('equivalent A/B compensation acceptance',()=>{
 it('accepts compensating node gain across all public input tests and rejects overcompensation',()=>{
  const s=scenarios[1];
  let w=edit(s,run(s,3),'N06','gain',.25);expect(validateBehavior(s,w).passed).toBe(true);expect(run(s,100,w).verification.cleared).toBe(true);
  w=edit(s,w,'N06','load',2);expect(validateBehavior(s,w).passed).toBe(false);expect(run(s,30,w).verification.cleared).toBe(false);
 });
});
describe('manual input and node-role boundary',()=>{
 it('declares input, output, inner and keeps ordinary input separate from repair parameters',()=>{for(const s of scenarios){expect(s.nodes.some(n=>n.kind==='input')).toBe(true);expect(s.nodes.some(n=>n.kind==='output')).toBe(true);expect(s.nodes.some(n=>n.kind==='inner')).toBe(true);for(const i of s.inputs){expect(s.nodes.find(n=>n.id===i.nodeId)?.kind).toBe('input');expect(s.interventions.some(e=>e.target===i.nodeId&&e.parameter===i.parameter)).toBe(false);}}});
 it('permits only declared manual inputs and records no repair edit',()=>{const s=scenarios[0],initial=createWorld(s),w=setInput(s,initial,'N01.level',16);expect(w.edits).toEqual([]);expect(w.inputEvents).toEqual([{id:'N01.level',time:0,before:8,value:16}]);expect(w.states.N03.value).toBe(4);expect(run(s,3,w).states.N03.value).toBe(8);expect(()=>setInput(s,w,'N02.gain',2)).toThrow();expect(()=>intervene(s,w,'N01.level',16)).toThrow();expect(()=>setInput(s,w,'N01.level',21)).toThrow();expect(()=>setInput(s,w,'N01.level',.123)).toThrow();});
 it('remains idle without start input and measures latency from the actual operation',()=>{const s=scenarios[2];let w=createWorld(s);for(let t=0;t<50;t++){w=step(s,w);expect(w.states.N04.value).toBe(10);expect(w.states.N06.value).toBe(0);}const startTime=w.time;w=setInput(s,w,'N01.enabled',1);const first=simulate(s,40,w).find(frame=>frame.states.N04.value===4)!;expect(first.time-startTime).toBe(33);const healthy={...s,faults:[]};let h=createWorld(healthy);for(let t=0;t<50;t++)h=step(healthy,h);h=setInput(healthy,h,'N01.enabled',1);expect(simulate(healthy,40,h).find(frame=>frame.states.N04.value===4)!.time-startTime).toBe(11);});
 it('accepts a pure input change when the public behavior remains correct',()=>{const s=scenarios[0],w=setInput(s,createWorld(s),'N01.level',16);expect(run(s,12,w).verification.cleared).toBe(true);expect(w.edits).toHaveLength(0);});
 it('restarts the stability window after input changes and preserves input history in snapshots',()=>{const s=scenarios[0];let w=setInput(s,createWorld(s),'N01.level',16);w=run(s,7,w);expect(w.verification.stable).toBeGreaterThan(0);w=setInput(s,w,'N01.level',12);expect(w.verification.stable).toBe(0);const restored=JSON.parse(JSON.stringify(w)) as World;expect(run(s,10,restored)).toEqual(run(s,10,w));const restarted=restartWithSettings(s,w);expect(restarted.inputEvents[0]).toEqual({id:'N01.level',time:0,before:8,value:12});});
 it('rejects invalid roles, input targets, overlapping editors and unobservable outputs',()=>{for(const mutate of [(s:Scenario)=>{s.nodes[0].kind='unknown' as import('./engine').NodeKind;},(s:Scenario)=>{s.inputs[0].nodeId='N02';},(s:Scenario)=>{s.inputs[0].parameter='missing';},(s:Scenario)=>{s.interventions.push({id:'overlap',label:'overlap',target:'N01',parameter:'level',min:0,max:20,step:1,defaultValue:8,description:''});},(s:Scenario)=>{s.observations=s.observations.filter(o=>o.target!=='N03');}]){const s=structuredClone(scenarios[0]);mutate(s);expect(()=>validate(s)).toThrow();}});
});

describe('terminal output boundary',()=>{
 it('places every output in the last column and forbids outgoing connections',()=>{for(const s of scenarios){const outputs=s.nodes.filter(n=>n.kind==='output'),others=s.nodes.filter(n=>n.kind!=='output');expect(new Set(outputs.map(n=>n.x)).size).toBe(1);for(const output of outputs){expect(output.x).toBeGreaterThan(Math.max(...others.map(n=>n.x)));expect(s.connections.some(e=>e.from===output.id)).toBe(false);expect(s.connections.some(e=>e.to===output.id)).toBe(true);}}});
 it('rejects a scenario that feeds an output back into the internal graph',()=>{const s=structuredClone(scenarios[0]);s.connections[0].from='N03';expect(()=>validate(s)).toThrow('outputノードは終端');});
 it('keeps monitoring paths upstream of output nodes',()=>{scenarios.forEach(s=>s.connections.forEach(e=>expect(s.nodes.find(n=>n.id===e.from)?.kind).not.toBe('output')));});
});

describe('specified trigger contracts',()=>{
 const tick=(s:Scenario,w:World,count:number)=>run(s,count,w);
 function timerInput(interval=2){const s=structuredClone(scenarios[0]);s.nodes[0].trigger={type:'timer',periodParameter:'interval'};s.nodes[0].parameters.interval=interval;s.inputs.push({id:'N01.interval',nodeId:'N01',parameter:'interval',label:'period',description:'',min:1,max:20,step:1,defaultValue:interval});return s;}
 function shared(){
  const s=structuredClone(scenarios[0]);
  const provider=structuredClone(s.nodes[1]);provider.id='N04';provider.trigger={type:'request'};provider.parameters={level:2};provider.initialState={value:2};provider.update={value:{ref:'param.level'}};
  const consumer=structuredClone(s.nodes[1]);consumer.id='N05';consumer.update={value:{op:'multiply',args:[{ref:'input.signal'},{ref:'input.factor'}]}};
  s.nodes[1].update=structuredClone(consumer.update);s.nodes.push(provider,consumer);
  const base=s.connections[0];s.connections.push({...base,id:'E03',from:'N04',to:'N02',input:'factor',kind:'request'},{...base,id:'E04',to:'N05'},{...base,id:'E05',from:'N04',to:'N05',input:'factor',kind:'request'});
  s.interventions.push({id:'N04.level',label:'data',target:'N04',parameter:'level',min:0,max:20,step:1,defaultValue:2,description:''});
  return s;
 }
 it('manual input defaults are held but not emitted until an actual property update',()=>{const s=scenarios[0];let w=createWorld(s);expect(w.parameters.N01.level).toBe(8);w=tick(s,w,10);expect(w.activity.N01.count).toBe(0);expect(w.activity.N02.count).toBe(0);expect(setInput(s,w,'N01.level',8)).toEqual(w);w=setInput(s,w,'N01.level',16);w=tick(s,w,20);expect(w.activity.N01.count).toBe(1);expect(w.activity.N02.count).toBe(1);expect(w.states.N03.value).toBe(8);});
 it('queues every manual update once, capturing each value without coalescing',()=>{const s=scenarios[0];let w=setInput(s,createWorld(s),'N01.level',12);w=setInput(s,w,'N01.level',16);w=tick(s,w,3);expect(w.activity.N01.count).toBe(2);expect(w.activity.N02.count).toBe(2);expect(w.trace.filter(t=>t.nodeId==='N01'&&t.trigger==='manual').map(t=>t.value)).toEqual([12,16]);expect(w.trace.filter(t=>t.nodeId==='N03').map(t=>t.value)).toEqual([6,8]);});
 it('timer input emits the property repeatedly at its independent interval',()=>{const s=timerInput(3);let w=createWorld(s);w=tick(s,w,2);expect(w.activity.N01.count).toBe(0);w=step(s,w);expect(w.activity.N01.count).toBe(1);w=tick(s,w,6);expect(w.activity.N01.count).toBe(3);expect(w.trace.filter(t=>t.nodeId==='N01').map(t=>t.time)).toEqual([3,6,9]);});
 it('editing a timer input value does not emit immediately or change the period',()=>{const s=timerInput(4);let w=setInput(s,createWorld(s),'N01.level',16);expect(w.pending).toHaveLength(0);w=tick(s,w,3);expect(w.activity.N01.count).toBe(0);w=step(s,w);expect(w.trace.find(t=>t.nodeId==='N01')?.value).toBe(16);expect(w.parameters.N01.interval).toBe(4);});
 it('editing the interval reanchors the timer without emitting the interval as data',()=>{const s=timerInput(4);let w=tick(s,createWorld(s),2);w=setInput(s,w,'N01.interval',3);w=tick(s,w,2);expect(w.activity.N01.count).toBe(0);w=step(s,w);expect(w.time).toBe(5);expect(w.activity.N01.count).toBe(1);expect(w.states.N01.value).toBe(8);});
 it('input-trigger processors fire again for identical received values',()=>{const s=timerInput(2);const w=tick(s,createWorld(s),7);expect(w.activity.N02.count).toBe(3);expect(w.trace.filter(t=>t.nodeId==='N02').map(t=>t.value)).toEqual([4,4,4]);});
 it('does not join inputs: every arrival independently fires the processor',()=>{const s=structuredClone(scenarios[0]);s.connections.push({...s.connections[0],id:'E03',input:'other'});s.nodes[1].update.value={op:'sum',args:[{ref:'input.signal'},{ref:'input.other'}]};const w=tick(s,setInput(s,createWorld(s),'N01.level',16),2);expect(w.activity.N02.count).toBe(2);expect(w.trace.filter(t=>t.nodeId==='N02').map(t=>t.value)).toEqual([24,32]);});
 it('timer processors run without arrivals and update their retained state',()=>{const s=structuredClone(scenarios[0]);s.nodes[1].trigger={type:'timer',periodParameter:'interval'};s.nodes[1].parameters.interval=2;s.nodes[1].update.value={op:'integrator',args:[{ref:'state.value'},1]};let w=tick(s,createWorld(s),5);expect(w.activity.N02.count).toBe(2);expect(w.states.N02.value).toBe(6);w=tick(s,w,1);expect(w.states.N02.value).toBe(7);});
 it('request-trigger providers remain idle until someone asks',()=>{const s=shared();let w=tick(s,createWorld(s),5);expect(w.activity.N04.count).toBe(0);const queried=requestNode(s,w,'N04');expect(queried.value).toBe(2);expect(queried.world.activity.N04.count).toBe(1);expect(queried.world.pending).toHaveLength(0);expect(w.activity.N04.count).toBe(0);});
 it('two consumers fetch shared properties on their own processing start',()=>{const s=shared();let w=setInput(s,createWorld(s),'N01.level',10);w=tick(s,w,2);expect(w.activity.N04.count).toBe(2);expect(w.trace.filter(t=>t.trigger==='fetch').map(t=>[t.nodeId,t.requester,t.value])).toEqual([['N02','N04',2],['N05','N04',2]]);expect(w.states.N02.value).toBe(20);expect(w.states.N05.value).toBe(20);});
 it('data changes affect the next fetch and do not retroactively change a prior result',()=>{const s=shared();let w=tick(s,setInput(s,createWorld(s),'N01.level',10),2);const oldFetch=w.trace.find(t=>t.nodeId==='N02'&&t.trigger==='fetch')!;w=intervene(s,w,'N04.level',3);expect(w.states.N02.value).toBe(20);expect(w.pending.some(e=>e.source==='N04')).toBe(false);w=tick(s,setInput(s,w,'N01.level',12),2);const lastFetch=w.trace.filter(t=>t.nodeId==='N02'&&t.trigger==='fetch').at(-1)!;expect(lastFetch.value).toBe(3);expect(lastFetch.version).toBeGreaterThan(oldFetch.version!);expect(w.states.N02.value).toBe(36);expect(oldFetch.value).toBe(2);});
 it('manual local-state editing updates state rather than a parameter, and next trigger can update it again',()=>{const s=structuredClone(scenarios[0]);s.nodes[1].update.value={op:'sum',args:[{ref:'state.value'},{ref:'input.signal'}]};let w=intervene(s,createWorld(s),'N02.state.value',20);expect(w.states.N02.value).toBe(20);expect(w.parameters.N02.value).toBeUndefined();expect(w.edits[0].storage).toBe('state');w=tick(s,setInput(s,w,'N01.level',10),2);expect(w.states.N02.value).toBe(30);});
 it('the output only retains the received value and never activates further nodes',()=>{const s=scenarios[0],w=tick(s,setInput(s,createWorld(s),'N01.level',16),8);expect(w.activity.N03.count).toBe(1);expect(w.states.N03.value).toBe(8);expect(w.pending.some(e=>e.source==='N03')).toBe(false);});
 it('ordinary cyclic event connections progress across ticks rather than recurse',()=>{const s=structuredClone(scenarios[0]);s.connections.push({...s.connections[0],id:'E03',from:'N02',to:'N02',input:'feedback'});const w=tick(s,setInput(s,createWorld(s),'N01.level',16),40);expect(w.time).toBe(40);expect(w.activity.N02.count).toBeGreaterThan(20);});
 it('request cycles and invalid trigger-role combinations are rejected',()=>{const s=shared();s.connections.push({...s.connections[0],id:'E06',from:'N04',to:'N04',kind:'request'});expect(()=>validate(s)).toThrow('問い合わせの循環');const b=structuredClone(scenarios[0]);b.nodes[0].trigger={type:'request'};expect(()=>validate(b)).toThrow('トリガー');});
 it('pending event queues, timers and fetch history survive deterministic snapshot replay',()=>{const s=scenarios[1],w=tick(s,createWorld(s),15),saved=JSON.parse(JSON.stringify(w)) as World;expect(tick(s,w,30)).toEqual(tick(s,saved,30));});
 it('a failed activation is atomic and leaves the supplied world unchanged',()=>{const s=structuredClone(scenarios[0]);s.nodes[1].update.value=1e10;const before=step(s,setInput(s,createWorld(s),'N01.level',16));const saved=structuredClone(before);expect(()=>step(s,before)).toThrow('安定範囲');expect(before).toEqual(saved);});
});

describe('atomic computation display frames',()=>{
 it('holds both ports until the timer consumes delivered input, then commits them together',()=>{
  const s=structuredClone(scenarios[0]);s.nodes[1].trigger={type:'timer',periodParameter:'interval'};s.nodes[1].parameters.interval=4;
  const initial=createWorld(s),pending=run(s,2,setInput(s,initial,'N01.level',16));
  expect(pending.signals.E01).toBe(16);
  expect(pending.frames.N02).toEqual({time:null,inputs:{E01:8},output:4});
  const completed=run(s,2,pending);
  expect(completed.frames.N02).toEqual({time:4,inputs:{E01:16},output:8});
  expect(pending.frames.N02).toEqual(initial.frames.N02);
  const edited=intervene(s,completed,'N02.state.value',20);
  expect(edited.states.N02.value).toBe(20);expect(edited.frames.N02).toEqual(completed.frames.N02);
  const restored=JSON.parse(JSON.stringify(completed)) as World;
  expect(run(s,8,restored).frames).toEqual(run(s,8,completed).frames);
 });
 it('preserves the prior pair when a calculation fails',()=>{
  const s=structuredClone(scenarios[0]);s.nodes[1].update.value={op:'multiply',args:[1e308,1e308]};
  const before=run(s,1,setInput(s,createWorld(s),'N01.level',16)),frames=structuredClone(before.frames);
  expect(()=>step(s,before)).toThrow();expect(before.frames).toEqual(frames);
 });
});

describe('published output requirements',()=>{
 it('documents every output exactly once and retains only terminal output nodes',()=>{
  for(const s of scenarios){const outputs=s.nodes.filter(n=>n.kind==='output').map(n=>n.id).sort();expect(s.outputRequirements.map(r=>r.nodeId).sort()).toEqual(outputs);for(const id of outputs)expect(s.connections.some(e=>e.from===id)).toBe(false);}
 });
 it('periodic: healthy activity outputs keep specified phase and width despite the fault',()=>{
  const s=scenarios[1],normal=simulate({...s,faults:[]},180),faulty=simulate(s,180);
  for(const w of faulty){if(w.time>=2)expect(w.states.N13.value).toBe((w.time-1)%12<3?1:0);if(w.time>=5)expect(w.states.N14.value).toBe((w.time-4)%18<4?.5:0);}
  for(const id of ['N13','N14'])expect(faulty.map(w=>w.states[id].value)).toEqual(normal.map(w=>w.states[id].value));
  for(const w of normal.slice(4))expect(w.states.N08.value).toBe(2*normal[w.time-2].states.N13.value);
  expect(faulty.some(w=>w.states.N08.value===8)).toBe(true);
 });
 it('periodic: normal residual output obeys its contract across supply inputs',()=>{
  const s={...scenarios[1],faults:[]};
  for(const capacity of [0,1,4,10,20]){const frames=simulate(s,120,setInput(s,createWorld(s),'N01.capacity',capacity));for(const w of frames.slice(6)){expect(w.states.N04.value).toBeGreaterThanOrEqual(Math.max(0,capacity-2.5));expect(w.states.N04.value).toBeLessThanOrEqual(capacity);}}
 });
 it('delayed: acknowledgement and constant drain stay healthy with shifted start times and stop',()=>{
  for(const faulty of [false,true]){const s={...scenarios[2],faults:faulty?scenarios[2].faults:[]};for(const wait of [0,17,50]){
   let w=run(s,wait,createWorld(s));expect(w.states.N04.value).toBe(10);expect(w.states.N13.value).toBe(0);
   const frames=simulate(s,48,setInput(s,w,'N01.enabled',1));
   for(const f of frames){expect(f.states.N14.value).toBe(-.05);expect(f.states.N13.value).toBe(f.time-wait>=2?1:0);}
   expect(frames.find(f=>f.states.N04.value===4)?.time).toBe(wait+(faulty?33:11));
   w=setInput(s,final(frames),'N01.enabled',0);const stopped=simulate(s,4,w);expect(stopped[1].states.N13.value).toBe(1);expect(stopped[2].states.N13.value).toBe(0);expect(stopped[4].states.N04.value).toBe(10);
  }}
 });
});

describe('read-only external disturbance inputs',()=>{
 function external(timer=false,fixed=false){const s=structuredClone(scenarios[1]),n=s.nodes.find(n=>n.id==='N15')!;n.externalInput={seed:12345,value:fixed?{type:'fixed',value:0.2}:{type:'uniform',min:0,max:0.4}};if(timer){n.trigger={type:'timer',periodParameter:'interval'};n.parameters.interval=4;}return s;}
 it('emits repeatable bounded values at repeatable bounded random intervals',()=>{
  const s=external(),frames=simulate(s,160),records=final(frames).trace.filter(t=>t.nodeId==='N15');
  // Trace is bounded globally, so use activation changes to retain every emission.
  const events=frames.filter((w,i)=>i>0&&w.activity.N15.count!==frames[i-1].activity.N15.count);
  expect(events.length).toBeGreaterThan(15);let previous=0;
  for(const w of events){expect(w.time-previous).toBeGreaterThanOrEqual(3);expect(w.time-previous).toBeLessThanOrEqual(7);expect(w.states.N15.value).toBeGreaterThanOrEqual(0);expect(w.states.N15.value).toBeLessThan(0.4);previous=w.time;}
  expect(new Set(events.map(w=>w.states.N15.value)).size).toBe(events.length);expect(records.length).toBeGreaterThan(0);
  expect(simulate(s,160)).toEqual(frames);
  const other=external();other.nodes.find(n=>n.id==='N15')!.externalInput!.seed=54321;expect(simulate(other,160).map(w=>w.frames.N15)).not.toEqual(frames.map(w=>w.frames.N15));
 });
 it('supports periodic timing independently of uniform or fixed values',()=>{
  for(const fixed of [false,true]){const s=external(true,fixed),frames=simulate(s,24);for(const w of frames){expect(w.activity.N15.count).toBe(Math.floor(w.time/4));if(fixed&&w.time>=4)expect(w.states.N15.value).toBe(0.2);}}
  const fixed=external(false,true);expect(simulate(fixed,30).filter(w=>w.activity.N15.count>0).every(w=>w.states.N15.value===0.2)).toBe(true);
 });
 it('preserves random streams and pending emissions across save/replay and restart',()=>{
  const s=external(),w=run(s,37),copy=JSON.parse(JSON.stringify(w)) as World;
  expect(run(s,80,copy)).toEqual(run(s,80,w));
  const restart=restartWithSettings(s,w);expect(simulate(s,80,restart).map(w=>w.frames.N15)).toEqual(simulate(s,80).map(w=>w.frames.N15));
  expect(run({...s,nodes:[...s.nodes].reverse(),connections:[...s.connections].reverse()},80).frames).toEqual(run(s,80).frames);
 });
 it('rejects player edits even when a forged control definition targets the external input',()=>{
  const s=external(true),w=createWorld(s),n=s.nodes.find(n=>n.id==='N15')!;
  expect(s.inputs.some(i=>i.nodeId===n.id)).toBe(false);expect(s.interventions.some(i=>i.target===n.id)).toBe(false);
  s.inputs.push({id:'N15.interval',nodeId:'N15',parameter:'interval',label:'forged',description:'',min:1,max:20,step:1,defaultValue:4});
  s.interventions.push({id:'N15.interval',target:'N15',parameter:'interval',label:'forged',description:'',min:1,max:20,defaultValue:4});
  expect(()=>setInput(s,w,'N15.interval',5)).toThrow('編集禁止');expect(()=>intervene(s,w,'N15.interval',5)).toThrow('編集禁止');expect(()=>validate(s)).toThrow();
  expect(w.parameters.N15.interval).toBe(4);expect(w.inputEvents).toEqual([]);
 });
 it('rejects malformed seeds, distributions and random intervals',()=>{
  for(const mutate of [(n:import('./engine').Node)=>{n.externalInput!.seed=-1;},(n:import('./engine').Node)=>{n.externalInput!.value={type:'uniform',min:2,max:1};},(n:import('./engine').Node)=>{n.trigger.minInterval=0;},(n:import('./engine').Node)=>{n.trigger.maxInterval=513;}]){const s=external();mutate(s.nodes.find(n=>n.id==='N15')!);expect(()=>createWorld(s)).toThrow();}
 });
 it('actually affects an output while a repaired system tolerates the entire disturbance range',()=>{
  const s=scenarios[1],normal={...s,faults:[]},frames=simulate(normal,180);
  expect(new Set(frames.map(w=>w.states.N18.value)).size).toBeGreaterThan(10);
  for(const w of frames.slice(8)){expect(w.states.N17.value).toBeGreaterThanOrEqual(7.1);expect(w.states.N17.value).toBeLessThanOrEqual(10);}
  expect(frames.some(w=>w.states.N17.value<w.states.N04.value)).toBe(true);
  expect(Math.min(...simulate(s,72).map(w=>w.states.N17.value))).toBeLessThan(7.1);
  const edited=edit(s,run(s,36),'N06','load',2);expect(run(s,100,edited).verification.cleared).toBe(true);
 });
});

describe('disturbance transaction safety',()=>{
 it('does not consume random state if a later calculation in the same step fails',()=>{
  const s=structuredClone(scenarios[1]),source=s.nodes.find(n=>n.id==='N15')!,consumer=s.nodes.find(n=>n.id==='N16')!;
  source.trigger={type:'timer',periodParameter:'interval'};source.parameters.interval=4;
  consumer.trigger={type:'timer',periodParameter:'interval'};consumer.parameters.interval=4;consumer.update.value={op:'multiply',args:[1e308,1e308]};
  const before=run(s,3),random=structuredClone(before.random),frame=structuredClone(before.frames.N15);
  expect(()=>step(s,before)).toThrow();expect(before.random).toEqual(random);expect(before.frames.N15).toEqual(frame);
 });
});
