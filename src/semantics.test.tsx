import {describe,it,expect} from 'vitest';
import {semanticScenario as original} from './semanticScenario';
import {createWorld,step,setInput,intervene,validateBehavior,validate} from './engine';
describe('resource coordination scenario',()=>{
 it('validates and satisfies every output contract when healthy',()=>{const s={...original,faults:[]};expect(()=>validate(s)).not.toThrow();expect(validateBehavior(s,createWorld(s)),JSON.stringify(validateBehavior(s,createWorld(s)))).toMatchObject({passed:true});});
 it('accepts a shared repair and a two-branch compensating repair',()=>{const direct=intervene(original,createWorld(original),'N05.factor',1);expect(validateBehavior(original,direct),JSON.stringify(validateBehavior(original,direct))).toMatchObject({passed:true});let other=intervene(original,createWorld(original),'N07.correction',.5);expect(validateBehavior(original,other).passed).toBe(false);other=intervene(original,other,'N10.correction',.5);expect(validateBehavior(original,other)).toMatchObject({passed:true});});
 it('reveals different symptoms which disappear when demand is zero',()=>{
  for(const demand of [0,2,4]){let w=setInput(original,setInput(original,createWorld(original),'N02.level',demand),'N03.enabled',1);for(let i=0;i<5;i++)w=step(original,w,false);expect(Boolean(w.monitor.alerts.N08)).toBe(demand!==0);expect(Boolean(w.monitor.alerts.N11)).toBe(demand!==0);}
 });
});

import {renderToStaticMarkup} from 'react-dom/server';
import {presentScenario} from './semanticPresentation';
import {HierarchyPlay} from './HierarchyPlay';
import {HierarchyGraph} from './HierarchyGraph';
import {ModuleDetails} from './ModuleDetails';
import {scopeItems,projectConnections,readBoundary,moduleById} from './hierarchy';
import {hierarchySample,readHierarchySession,type HierarchySession} from './hierarchySession';

describe('presentation-only semantic model',()=>{
 it('keeps both modes and arbitrary renamed meaning identical through edits, external variation and acceptance',()=>{
  const renamed=structuredClone(original);for(const m of Object.values(renamed.hierarchy!.semantics!.modules)){m.name='Different name';m.purpose='Different role';m.assumptions=['Different wording'];m.constraints=['Different wording'];for(const [id,p] of Object.entries(m.ports)){p.name=`Renamed_${id}`;p.role='Different interpretation';}}
  const views=[presentScenario(original,'abstract'),presentScenario(original,'functional'),presentScenario(renamed,'functional')];
  const worlds=views.map(s=>setInput(s,createWorld(s),'N03.enabled',1));
  for(let t=0;t<22;t++){
   for(let i=0;i<views.length;i++){if(t===6)worlds[i]=setInput(views[i],worlds[i],'N02.level',4);if(t===11)worlds[i]=intervene(views[i],worlds[i],'N05.factor',1);worlds[i]=step(views[i],worlds[i],false);}
   expect(worlds[1]).toEqual(worlds[0]);expect(worlds[2]).toEqual(worlds[0]);
  }
  expect(views[0].nodes.map(n=>n.update)).toEqual(views[1].nodes.map(n=>n.update));expect(views[0].outputRequirements).toBe(views[1].outputRequirements);
  expect(validateBehavior(views[0],worlds[0])).toEqual(validateBehavior(views[1],worlds[1]));expect(validateBehavior(views[1],worlds[1]).passed).toBe(true);
  for(const scope of [null,'Core','Balance','Storage','Accounting','Calibration']){expect(scopeItems(views[0],scope)).toEqual(scopeItems(views[1],scope));const links=(s:typeof original)=>projectConnections(s,worlds[0],scope).map(({from,to,...rest})=>({...rest,from:{item:from.item,port:from.port},to:{item:to.item,port:to.port}}));expect(links(views[0])).toEqual(links(views[1]));}
 });
 it('shows purpose, port roles and constraints only in functional view without exposing hidden children or repair values',()=>{
  const a=presentScenario(original,'abstract'),b=presentScenario(original,'functional'),w=createWorld(original);
  const props={w,scope:'Core',selected:null,onScope:()=>{},onSelect:()=>{},onInput:()=>{}};
  const abstract=renderToStaticMarkup(<HierarchyGraph {...props} s={a}/>),functional=renderToStaticMarkup(<HierarchyGraph {...props} s={b}/>);
  expect(abstract).toContain('Module C');expect(abstract).not.toContain('Headroom monitor');expect(functional).toContain('Headroom monitor');
  const details=renderToStaticMarkup(<ModuleDetails s={b} w={w} id="Storage" onExpand={()=>{}}/>);
  expect(details).toContain('余剰がなければ進まない');expect(details).toContain('UsageScale');expect(details).not.toContain('N05');expect(details).not.toContain('factor = 1');
  const initial=renderToStaticMarkup(<HierarchyPlay s={original} onScenario={()=>{}}/>);expect(initial).toContain('A · Abstract');expect(initial).not.toContain('Headroom monitor');expect(initial).not.toContain('N05');
  for(const m of b.hierarchy!.modules)for(const port of m.ports){expect(port.description).not.toBe('');expect(readBoundary(b,w,port)).toEqual(readBoundary(a,w,moduleById(a,m.id).ports.find(p=>p.id===port.id)!));}
 });
 it('separates steady headroom loss from preparation delay while readiness itself follows actual charge',()=>{
  const times=[];for(const s of [original,{...original,faults:[]}]){let w=setInput(s,createWorld(s),'N03.enabled',1);let first=0;for(let i=0;i<20;i++){w=step(s,w,false);if(!first&&w.states.N13.value===1)first=w.time;expect(w.monitor.alerts.N13).toBeUndefined();}times.push(first);}
  expect(times).toEqual([8,7]);
 });
 it('keeps healthy local module equations consistent with consumed frame histories under changing inputs',()=>{
  const s={...original,faults:[]};let w=setInput(s,createWorld(s),'N03.enabled',1);
  for(let t=0;t<22;t++){
   if(t===4)w=setInput(s,w,'N02.level',3);if(t===8)w=setInput(s,w,'N01.level',6);if(t===12)w=setInput(s,w,'N03.enabled',0);if(t===15)w=setInput(s,w,'N03.enabled',1);
   const before=structuredClone(w);w=step(s,w,false);
   const a=w.frames.N07.inputs,b=w.frames.N10.inputs;
   expect(w.frames.N07.output).toBeCloseTo(Math.max(0,a.E04-before.frames.N06.inputs.E01*before.frames.N06.inputs.E02-a.E05));
   expect(w.frames.N10.output).toBeCloseTo(b.E12?Math.min(24,before.frames.N10.output+Math.max(0,b.E10-before.frames.N09.inputs.E07*before.frames.N09.inputs.E08-b.E11)):0);
   expect(w.frames.N12.output).toBe(Number(before.frames.N10.output>=24));
  }
 });
 it('does not leak functional input-slot names or debrief text into abstract presentation',()=>{
  const a=presentScenario(original,'abstract'),b=presentScenario(original,'functional');
  const links=projectConnections(a,createWorld(a),'Balance');expect(links.every(link=>!['usage','supply','external','request','factor'].includes(link.to.label))).toBe(true);
  expect(a.connections).toBe(b.connections);expect(a.solution.stableSteps).toBe(b.solution.stableSteps);expect(a.solution.explanation).not.toContain('余剰');
 });
 it('persists the display mode alongside world, selected scope, layouts and notes in v14',()=>{
  const s=presentScenario(original,'functional'),world=createWorld(s);const data:HierarchySession={version:15,sid:s.id,displayMode:'functional',world,recording:{start:world,operations:[]},view:{scope:'Storage',selected:'Storage'},layout:{Storage:{N10:{x:20,y:30}}},detailsOpen:true,points:[hierarchySample(s,world)],experiments:[],notes:'hypothesis',prediction:'test request=0',hint:1};
  expect(readHierarchySession(s,JSON.stringify(data))).toEqual(data);delete data.displayMode;expect(readHierarchySession(s,JSON.stringify(data)).displayMode).toBeUndefined();
  expect(()=>readHierarchySession(s,JSON.stringify({...data,displayMode:'theme'}))).toThrow();
 });
 it('rejects output freezes, a one-branch fix and a prefilled-state shortcut',()=>{
  const frozen=structuredClone(original);frozen.faults=[];frozen.nodes.find(n=>n.id==='N07')!.update.value=8;expect(validateBehavior(frozen,createWorld(frozen)).passed).toBe(false);
  let w=intervene(original,createWorld(original),'N10.state.value',24);expect(validateBehavior(original,w).passed).toBe(false);w=intervene(original,w,'N05.factor',1);expect(validateBehavior(original,w).passed).toBe(true);
 });
});
