import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {scenarios} from './legacyScenarios';
import {moduleViewScenario} from './moduleView';
import {HierarchyPlay} from './HierarchyPlay';
import {createWorld,setInput,step,validate,intervene,validateBehavior} from './engine';
import {scopeItems,descendants,projectConnections,validateHierarchyView,moduleById,readBoundary} from './hierarchy';
import {HierarchyGraph} from './HierarchyGraph';
import {ModuleDetails} from './ModuleDetails';
import {hierarchySample,readHierarchySession,type HierarchySession} from './hierarchySession';

describe('unified system/module view',()=>{
 it.each(scenarios.map(s=>s.id))('%s groups exactly all INNER nodes and preserves execution',id=>{
  const raw=scenarios.find(s=>s.id===id)!,before=structuredClone(raw),s=moduleViewScenario(raw);
  expect(()=>validate(s)).not.toThrow();expect(raw).toEqual(before);
  expect(descendants(s,'Core').sort()).toEqual(raw.nodes.filter(n=>n.kind==='inner').map(n=>n.id).sort());
  expect(scopeItems(s,null).modules).toEqual(['Core']);
  const initial=renderToStaticMarkup(<HierarchyPlay s={s} onScenario={()=>{}}/>);for(const n of raw.nodes.filter(n=>n.kind==='inner'))expect(initial).not.toContain(n.id);
  expect(scopeItems(s,null).nodes.sort()).toEqual(raw.nodes.filter(n=>n.kind!=='inner').map(n=>n.id).sort());
  let a=setInput(raw,createWorld(raw),raw.inputs[0].id,raw.inputs[0].max),b=setInput(s,createWorld(s),raw.inputs[0].id,raw.inputs[0].max);
  for(let i=0;i<24;i++){a=step(raw,a,false);b=step(s,b,false);projectConnections(s,b,i%2?'Core':null);expect(b).toEqual(a);}
 });
 it('reveals child specs only when their parent is expanded, without the separate Output spec section',()=>{
  const s=moduleViewScenario(scenarios.find(s=>s.id==='hierarchy')!),w=createWorld(s);
  const props={s,w,selected:null,onScope:()=>{},onSelect:()=>{},onInput:()=>{}};
  const root=renderToStaticMarkup(<HierarchyPlay s={s} onScenario={()=>{}}/>);
  expect(root).toContain('data-module="Core"');expect(root).not.toContain('data-module="Transform"');
  expect(root).not.toContain(moduleById(s,'Shared').spec.expected);expect(root).not.toContain('output-requirements');
  const core=renderToStaticMarkup(<HierarchyGraph {...props} scope="Core"/>);
  expect(core).toContain('data-module="Transform"');expect(core).toContain('value = 2 × signal − external.');
  expect(core).not.toContain('data-module="Shared"');expect(core).not.toContain('data-node="N04"');
  const reference=renderToStaticMarkup(<HierarchyGraph {...props} scope="Reference"/>);
  expect(reference).toContain('data-module="Shared"');expect(reference).not.toContain('data-node="N03"');
 });
 it('renders explicit terminal boundary nodes and preserves fetch routes and observed frame timestamps',()=>{
  const s=moduleViewScenario(scenarios.find(s=>s.id==='hierarchy')!),w=createWorld(s),before=structuredClone(w);
  const html=renderToStaticMarkup(<HierarchyGraph s={s} w={w} scope="Transform" selected={null} onScope={()=>{}} onSelect={()=>{}} onInput={()=>{}}/>);
  expect(html).toContain('data-boundary="boundary-in:signal"');expect(html).toMatch(/data-boundary="boundary-out:value"[^>]*grid-column:4/);
  expect(html).toContain('data-node="N04"');expect(html).not.toContain('data-node="N05"');
  const links=projectConnections(s,w,'Transform');expect(links.find(l=>l.connectionId==='E03')).toMatchObject({from:{item:'boundary-in',port:'factor'},to:{item:'N04'},request:true});
  expect(readBoundary(s,w,moduleById(s,'Transform').ports.find(p=>p.id==='signal')!)).toMatchObject({value:w.frames.N04.inputs.E02,time:w.frames.N04.time});
  renderToStaticMarkup(<ModuleDetails s={s} w={w} id="Transform" onExpand={()=>{}}/>);expect(w).toEqual(before);
  expect(()=>validateHierarchyView(s,{scope:'Transform',selected:'boundary-in:factor'})).not.toThrow();
  expect(()=>validateHierarchyView(s,{scope:null,selected:'Transform'})).toThrow();
 });
 it('matches the documented Core and Timing response times against healthy consumed-input frames',()=>{
  const raw=structuredClone(scenarios.find(s=>s.id==='hierarchy')!);raw.faults=[];
  const s=moduleViewScenario(raw);let w=setInput(s,createWorld(s),'N01.level',8);
  const observations:{time:number;command:number;value:number;echo:number;ready:number;sample:number}[]=[];
  for(let i=0;i<15;i++){w=step(s,w,false);observations.push({time:w.time,command:w.frames.N02.inputs.E01,value:w.frames.N04.output,echo:w.frames.N09.output,ready:w.frames.N07.output,sample:w.frames.N06.inputs.E06});}
  expect(observations.find(p=>p.command===8)!.time).toBe(2);
  expect(observations.find(p=>p.echo===8)!.time).toBe(3);
  expect(observations.find(p=>p.ready===1)!.time).toBe(11);
  expect(observations.find(p=>p.sample===8)!.time).toBe(3);
  w=setInput(s,w,'N01.level',0);
  for(let i=0;i<4;i++)w=step(s,w,false);
  expect(w.time).toBe(19);expect(w.frames.N07.output).toBe(0);expect(w.frames.N02.inputs.E01).toBe(0);
 });
 it('restores new boundary selections and keeps the System contract as the acceptance criterion',()=>{
  const s=moduleViewScenario(scenarios.find(s=>s.id==='hierarchy')!),w=intervene(s,intervene(s,createWorld(s),'N04.scale',.5),'N07.thresholdScale',2);
  expect(moduleById(s,'System').spec.outputs?.map(row=>row.rules)).toEqual(s.outputRequirements.map(row=>row.rules));
  expect(validateBehavior(s,w).passed).toBe(true);
  const data:HierarchySession={version:14,sid:s.id,world:w,view:{scope:'Transform',selected:'boundary-in:factor'},detailsOpen:true,points:[hierarchySample(s,w)],experiments:[],notes:'',prediction:'',hint:0};
  expect(readHierarchySession(s,JSON.stringify(data))).toEqual(data);
 });
});
