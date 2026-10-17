import {describe,it,expect} from 'vitest';
import {scenarios} from './scenarios';
import {createWorld,step,setInput,intervene,restartWithSettings,validateBehavior,validate,type World,type Scenario} from './engine';
import {checkOutputs,expressionLabel} from './contracts';
const added=scenarios.slice(3).filter(s=>!s.hierarchy);
function run(s:Scenario,w:World,count:number){for(let i=0;i<count;i++)w=step(s,w,false);return w;}
describe('additional investigations',()=>{
 it('adds three selectable problems with twenty nodes and five terminal outputs each',()=>{
  expect(added.map(s=>s.id)).toEqual(['shared','ceiling','sampling']);
  for(const s of added){expect(()=>validate(s)).not.toThrow();expect(s.nodes).toHaveLength(20);expect(s.outputRequirements).toHaveLength(5);expect(s.nodes.filter(n=>n.kind==='output')).toHaveLength(5);}
 });
 it.each(added.map(s=>s.id))('%s healthy configuration satisfies all published input and timing cases',id=>{
  const s={...added.find(s=>s.id===id)!,faults:[]};const result=validateBehavior(s,createWorld(s));expect(result,JSON.stringify(result)).toMatchObject({passed:true});
 });
 it.each(added.map(s=>s.id))('%s fault is detected and a durable repair passes all cases',id=>{
  const s=added.find(s=>s.id===id)!;let w=run(s,createWorld(s),12);
  expect(validateBehavior(s,w).passed).toBe(false);
  const f=s.faults[0],normal=s.nodes.find(n=>n.id===f.targetId)!.parameters[f.parameter!];
  w=intervene(s,w,`${f.targetId}.${f.parameter}`,normal);
  expect(validateBehavior(s,w)).toMatchObject({passed:true});
  let live=restartWithSettings(s,w);for(let i=0;i<80;i++)live=step(s,live);
  expect(live.verification.cleared).toBe(true);
 });
 it('shared data affects several outputs while independent outputs remain correct',()=>{
  const s=added[0],w=run(s,createWorld(s),12);
  expect(Object.keys(w.monitor.alerts).sort()).toEqual(['N16','N17','N18']);
  expect(w.trace.some(t=>t.trigger==='fetch'&&t.requester==='N05'&&t.nodeId==='N02'&&t.value===3)).toBe(true);
  expect(w.trace.some(t=>t.trigger==='fetch'&&t.requester==='N05'&&t.nodeId==='N07'&&t.value===3)).toBe(true);
  expect(w.states.N19.value).toBe(23);expect(w.states.N20.value).toBe(9);
 });
 it('clipping fault disappears for small input and returns for large input',()=>{
  const s=added[1];let w=setInput(s,createWorld(s),'N01.level',3);w=run(s,w,12);
  expect(checkOutputs(s,w).issues).toEqual([]);
  expect(validateBehavior(s,w).passed).toBe(false);
  w=setInput(s,w,'N01.level',12);w=run(s,w,12);
  expect(Object.keys(w.monitor.alerts).sort()).toEqual(['N16','N17','N18']);
 });
 it('sampling fault violates deadlines then recovers without passing case validation',()=>{
  const s=added[2];let w=setInput(s,createWorld(s),'N01.level',14);
  w=run(s,w,4);expect(w.monitor.alerts.N18[0]).toMatchObject({expected:'18',actual:2});
  w=run(s,w,12);expect(w.monitor.alerts).toEqual({});
  expect(w.monitor.logs.filter(l=>l.nodeId==='N18').map(l=>[l.time,l.type])).toEqual([[4,'onset'],[6,'recovery']]);
  expect(validateBehavior(s,w).passed).toBe(false);
 });
 it('rejects a constant-output shortcut for every new problem',()=>{
  for(const original of added){const s=structuredClone(original);s.faults=[];s.nodes.find(n=>n.id==='N11')!.update.value=s.nodes.find(n=>n.id==='N11')!.initialState.value;expect(validateBehavior(s,createWorld(s)).passed).toBe(false);}
 });
 it('preserves queries, timers and frames during snapshot replay',()=>{
  for(const s of added){const w=run(s,setInput(s,createWorld(s),'N01.level',14),3);expect(run(s,w,12)).toEqual(run(s,JSON.parse(JSON.stringify(w)),12));}
 });
 it('publishes the same threshold and conditional semantics as node processing',()=>{
  const s=added[2],rule=s.outputRequirements.find(r=>r.nodeId==='N18')!.rules[0];
  expect(rule.kind==='equals'&&expressionLabel(rule.expected)).toContain('≥ 10');
  for(const count of [1,3]){const broken=structuredClone(s),r=broken.outputRequirements[0].rules[0];if(r.kind==='equals')r.expected={op:'threshold',args:Array(count).fill(1)};expect(()=>validate(broken)).toThrow('出力式');}
 });
});
