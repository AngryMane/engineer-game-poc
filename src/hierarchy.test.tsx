import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {hierarchyScenario as original} from './hierarchyScenario';
import {createWorld,step,setInput,intervene,validateBehavior,validate,restartWithSettings,type Scenario,type World} from './engine';
import {validateHierarchyView,scopeItems,projectConnections,readBoundary,moduleById,visibleSeries} from './hierarchy';
import {HierarchyPlay} from './HierarchyPlay';
import {HierarchyGraph} from './HierarchyGraph';
import {ModuleDetails} from './ModuleDetails';
import {NodeDetails} from './NodeDetails';
import {hierarchySample,readHierarchySession,type HierarchySession} from './hierarchySession';
const run=(s:Scenario,w:World,count:number)=>{for(let i=0;i<count;i++)w=step(s,w,false);return w;};
const healthy=()=>({...structuredClone(original),faults:[]});

describe('logical module ownership and public boundaries',()=>{
 it('validates a nested tree while leaving the original execution graph unchanged',()=>{
  expect(()=>validate(original)).not.toThrow();
  expect(scopeItems(original,null).modules).toHaveLength(4);
  expect(scopeItems(original,'M4').modules).toEqual(['M41','M42']);
  expect(scopeItems(original,'M41').nodes).toEqual(['N03']);
  const flat=structuredClone(original);delete flat.hierarchy;
  let a=setInput(original,createWorld(original),'N01.level',8),b=setInput(flat,createWorld(flat),'N01.level',8);
  for(let i=0;i<40;i++){scopeItems(original,i%2?'M41':null);projectConnections(original,a,i%2?'M2':null);a=step(original,a,false);b=step(flat,b,false);expect(a).toEqual(b);}
 });
 it('rejects missing children, duplicate ownership, cycles, bad ports and undeclared crossings',()=>{
  const mutations=[(s:Scenario)=>s.hierarchy!.modules[0].children.push('missing'),(s:Scenario)=>s.hierarchy!.modules[0].nodes.push('N03'),(s:Scenario)=>moduleById(s,'M41').children.push('M4'),(s:Scenario)=>{moduleById(s,'M2').ports[0].binding={kind:'input',connectionId:'missing'};},(s:Scenario)=>{moduleById(s,'M4').ports=moduleById(s,'M4').ports.filter(p=>p.id!=='factor');},(s:Scenario)=>{moduleById(s,'M2').spec.relations[0].expression={ref:'N03.level'};},(s:Scenario)=>{s.hierarchy!.outputs=[];}];
  for(const mutation of mutations){const s=structuredClone(original);mutation(s);expect(()=>validate(s)).toThrow();}
 });
 it('projects cross-module dependencies to public interfaces without publishing node or edge IDs',()=>{
  const w=createWorld(original),links=projectConnections(original,w,null);
  expect(links.some(l=>l.from.item==='M4'&&l.to.item==='M2'&&l.request)).toBe(true);
  for(const l of links){expect(l.id).toMatch(/^link-/);expect(l.from.item).toMatch(/^M/);expect(l.to.item).toMatch(/^M/);}
  expect(projectConnections(original,w,'M41').every(l=>l.to.item==='boundary-out')).toBe(true);
 });
 it('rejects a selected node outside the displayed level',()=>{
  expect(()=>validateHierarchyView(original,{scope:null,selected:'N03'})).toThrow();
  expect(()=>validateHierarchyView(original,{scope:'M41',selected:'N03'})).not.toThrow();
  expect(()=>validateHierarchyView(original,{scope:'missing',selected:null})).toThrow();
 });
});

describe('scoped presentation and observation semantics',()=>{
 it('initially hides internal names, formulas and causes across the entire rendered screen',()=>{
  const html=renderToStaticMarkup(<HierarchyPlay s={original} onScenario={()=>{}}/>);
  for(const n of original.nodes)expect(html).not.toContain(n.id);
  for(const e of original.connections)expect(html).not.toContain(e.id);
  expect(html).toContain('Input');expect(html).toContain('Transform');expect(html).toContain('Reference');
  expect(html).not.toContain(original.solution.explanation);expect(html).not.toContain('モジュール異常');expect(html).not.toContain('state.value');
  expect(html).not.toContain('output-requirements" open');expect(html).not.toContain('task-guide');
 });
 it('shows children first, then only directly owned nodes and public crossing labels',()=>{
  const props={s:original,w:createWorld(original),selected:null,onScope:()=>{},onSelect:()=>{},onInput:()=>{}};
  const parent=renderToStaticMarkup(<HierarchyGraph {...props} scope="M4"/>);expect(parent).toContain('Shared factor');expect(parent).not.toContain('N03');
  const leaf=renderToStaticMarkup(<HierarchyGraph {...props} scope="M41"/>);expect(leaf).toContain('N03');expect(leaf).not.toContain('N04');expect(leaf).not.toContain('N07');
  const refs=Object.fromEntries(original.nodes.filter(n=>n.id!=='N03').map(n=>[n.id,'外部の利用側']));
  const detail=renderToStaticMarkup(<NodeDetails s={original} w={run(original,createWorld(original),4)} selected="N03" referenceNames={refs} onRequest={()=>{}}/>);
  expect(detail).not.toContain('N04');expect(detail).not.toContain('N07');
 });
 it('uses boundary names for hidden senders and keeps output nodes in the last visual column',()=>{
  const w=run(original,createWorld(original),5);
  const detail=renderToStaticMarkup(<NodeDetails s={original} w={w} selected="N04" referenceNames={{N02:'boundary.signal',N03:'boundary.factor',N12:'boundary.external'}} onRequest={()=>{}}/>);
  for(const hidden of ['N02','N03','N12'])expect(detail).not.toContain(hidden);
  expect(detail).toContain('fetch(boundary.factor)');
  const graph=renderToStaticMarkup(<HierarchyGraph s={original} w={w} scope="M3" selected={null} onScope={()=>{}} onSelect={()=>{}} onInput={()=>{}}/>);
  expect(graph).toMatch(/data-node="N08"[^>]*grid-column:4/);
  expect(graph).toMatch(/data-node="N06"[^>]*grid-column:2/);
  expect(graph).toMatch(/data-node="N07"[^>]*grid-column:3/);
 });
 it('does not compute or query while reading module specifications and boundaries',()=>{
  const w=run(original,createWorld(original),6),before=structuredClone(w),module=moduleById(original,'M2');
  renderToStaticMarkup(<ModuleDetails s={original} w={w} id="M2" onExpand={()=>{}}/>);
  const p=module.ports.find(p=>p.id==='signal')!,sample=readBoundary(original,w,p);
  expect(sample).toEqual({value:w.frames.N04.inputs.E02,time:w.frames.N04.time,method:'計算時の入力'});
  expect(w).toEqual(before);
  expect(module.ports.find(p=>p.id==='factor')!.observable).toBe(false);
 });
 it('records hidden history continuously but limits available series to the current scope',()=>{
  const w=run(original,createWorld(original),12),point=hierarchySample(original,w);
  expect(point.values['o-N03']).toBe(4);
  expect(visibleSeries(original,null).every(item=>!item.id.startsWith('o-'))).toBe(true);
  expect(visibleSeries(original,'M41').some(item=>item.id==='o-N03')).toBe(true);
 });
});

describe('hierarchical investigation functional behavior',()=>{
 it('passes all public cases when healthy or directly repaired',()=>{
  const s=healthy();expect(validateBehavior(s,createWorld(s))).toMatchObject({passed:true});
  const w=intervene(original,createWorld(original),'N03.level',2);expect(validateBehavior(original,w)).toMatchObject({passed:true});
 });
 it('connects amplitude-dependent numerical errors to amplitude-independent delay',()=>{
  for(const level of [4,8]){
   const s=original;let w=setInput(s,createWorld(s),'N01.level',level);w=run(s,w,12);
   expect(w.monitor.alerts.N05[0].actual-Number(w.monitor.alerts.N05[0].expected)).toBeCloseTo(2*level);
   expect(w.monitor.alerts.N08[0]).toMatchObject({expected:'1',actual:0});
   expect(w.monitor.alerts.N10).toBeUndefined();expect(w.monitor.alerts.N11).toBeUndefined();
   w=run(s,w,8);expect(w.time).toBe(20);expect(w.states.N08.value).toBe(1);
  }
 });
 it('accepts a two-module alternative repair even though the shared module still violates its own spec',()=>{
  let w=createWorld(original);w=intervene(original,w,'N04.scale',.5);w=intervene(original,w,'N07.thresholdScale',2);
  expect(w.parameters.N03.level).toBe(4);expect(validateBehavior(original,w)).toMatchObject({passed:true});
  let live=restartWithSettings(original,w);for(let i=0;i<80;i++)live=step(original,live);expect(live.verification.cleared).toBe(true);
 });
 it('rejects fixing only one symptom or freezing an output',()=>{
  const numeric=intervene(original,createWorld(original),'N04.scale',.5);expect(validateBehavior(original,numeric).passed).toBe(false);
  const timing=intervene(original,createWorld(original),'N07.thresholdScale',2);expect(validateBehavior(original,timing).passed).toBe(false);
  const s=healthy();s.nodes.find(n=>n.id==='N04')!.update.value=16;expect(validateBehavior(s,createWorld(s)).passed).toBe(false);
 });
});

describe('hierarchy save and replay',()=>{
 function session():HierarchySession{const world=run(original,setInput(original,createWorld(original),'N01.level',8),7);return {version:15,sid:original.id,world,recording:{start:world,operations:[]},view:{scope:'M41',selected:'N03'},detailsOpen:true,points:[hierarchySample(original,world)],experiments:[],notes:'比較',prediction:'共通の条件',hint:1};}
 it('restores navigation, game state, external RNG, history and future behavior',()=>{
  const data=session(),restored=readHierarchySession(original,JSON.stringify(data));expect(restored).toEqual(data);expect(run(original,restored.world,30)).toEqual(run(original,data.world,30));
 });
 it('rejects hidden selections, invalid versions and missing state/frame/RNG entries',()=>{
  const mutations=[(d:HierarchySession)=>{d.view={scope:null,selected:'N03'};},(d:HierarchySession)=>{d.version=12 as 15;},(d:HierarchySession)=>{delete d.world.frames.N04;},(d:HierarchySession)=>{delete d.world.random.N12;},(d:HierarchySession)=>{d.world.parameters.N04.scale=NaN;}];
  for(const mutate of mutations){const data=session();mutate(data);expect(()=>readHierarchySession(original,JSON.stringify(data))).toThrow();}
 });
});
