import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {caseScenarios,faultCases,incidentScenario,playableScenarios} from './index';
import {sharedSystem} from './system';
import {createWorld,step,setInput,intervene,validate,validateBehavior,type Scenario,type World} from '../engine';
import {reportObservations} from '../faultReports';
import {descendants,moduleById,publicText,scopeItems} from '../hierarchy';
import {presentScenario} from '../semanticPresentation';
import {HierarchyPlay} from '../HierarchyPlay';

const T=60000;
const byId=(id:string)=>caseScenarios.find(s=>s.id===id)!;
const healthy=byId('case-00');
const edit=(s:Scenario,edits:Record<string,number>,w:World=createWorld(s))=>Object.entries(edits).reduce((world,[id,value])=>intervene(s,world,id,value,'repair'),w);
function run(s:Scenario,inputs:{time:number;id:string;value:number}[],steps:number){
 let w=createWorld(s);const issues:number[]=[];
 for(let t=0;t<steps;t++){for(const a of inputs.filter(a=>a.time===w.time))w=setInput(s,w,a.id,a.value);w=step(s,w,false);if(Object.keys(w.monitor.alerts).length)issues.push(w.time);}
 return {w,issues};
}

describe('shared system',()=>{
 it('every case uses the same graph, hierarchy, contracts and acceptance cases',()=>{
  expect(caseScenarios.map(s=>s.id)).toEqual(faultCases.map(c=>c.id));
  for(const s of caseScenarios){
   expect(()=>validate(s)).not.toThrow();
   expect(s.nodes).toEqual(sharedSystem.nodes);expect(s.connections).toEqual(sharedSystem.connections);
   expect(s.outputRequirements).toEqual(sharedSystem.outputRequirements);expect(s.behaviorCases).toEqual(sharedSystem.behaviorCases);
   expect(s.hierarchy!.modules).toEqual(sharedSystem.hierarchy!.modules);
   expect(s.faults.length).toBe(s.id==='case-00'?0:1);
  }
 });
 it('has no padding: every node reaches a system output and every module groups real content',()=>{
  const s=healthy,outputs=new Set(s.nodes.filter(n=>n.kind==='output').map(n=>n.id));
  const reaches=(id:string,seen=new Set<string>()):boolean=>outputs.has(id)||s.connections.filter(e=>e.from===id&&!seen.has(e.to)).some(e=>{seen.add(e.to);return reaches(e.to,seen);});
  for(const node of s.nodes)expect(reaches(node.id),node.id).toBe(true);
  for(const m of s.hierarchy!.modules){
   expect(m.nodes.length+m.children.length,m.id).toBeGreaterThan(0);
   if(m.children.length)expect(m.nodes.length+m.children.length,m.id).toBeGreaterThan(1);
  }
  expect(s.nodes.length).toBe(30);expect(s.outputRequirements.length).toBe(10);
  const depth=(id:string):number=>1+Math.max(0,...moduleById(s,id).children.map(depth));
  expect(depth('System')).toBe(3);
  expect(descendants(s,'System').sort()).toEqual(s.nodes.map(n=>n.id).sort());
 });
 it('the healthy system passes every public acceptance case',()=>{
  expect(validateBehavior(healthy,createWorld(healthy)).passed).toBe(true);
 },T);
});

const repairs:Record<string,Record<string,number>[]>={
 'case-01':[{'N09.load':2}],'case-02':[{'N14.rate':1}],'case-03':[{'N11.scale':2}],'case-04':[{'N16.ceiling':30}],
 'case-05':[{'N07.interval':1}],'case-06':[{'N10.factor':1}],'case-07':[{'N19.retention':1},{'N20.useAck':1}],
};
const shortcuts:Record<string,Record<string,number>>={
 'case-01':{'N13.gain':1.5},'case-02':{'N15.gain':0},'case-03':{'N16.gain':.65,'N17.gain':.65},'case-04':{'N11.scale':1.5},
 'case-05':{'N13.gain':1.2},'case-06':{'N14.rate':2},'case-07':{'N19.state.value':6},
};
describe('fault cases',()=>{
 it.each(faultCases.filter(c=>c.fault).map(c=>c.id))('%s fails until repaired, accepts documented repairs and rejects shortcuts',id=>{
  const s=byId(id);
  expect(validateBehavior(s,createWorld(s)).passed).toBe(false);
  for(const repair of repairs[id])expect(validateBehavior(s,edit(s,repair)).passed,JSON.stringify(repair)).toBe(true);
  expect(validateBehavior(s,edit(s,shortcuts[id])).passed).toBe(false);
  for(const cause of s.solution.rootCauseIds)expect(s.faults[0].targetId).toBe(cause);
 },T);
 it('each case carries at least one report whose evidence differs from the healthy system',()=>{
  for(const s of caseScenarios){
   expect(s.reports!.length).toBeGreaterThan(0);
   const healthyCopy={...healthy,reports:s.reports};
   const differs=s.reports!.some(r=>{const faulty=reportObservations(s,r),normal=reportObservations(healthyCopy,r);return faulty.some((o,i)=>JSON.stringify(o.values)!==JSON.stringify(normal[i].values));});
   expect(differs,s.id).toBe(s.id!=='case-00');
   for(const r of s.reports!)for(const entry of r.entries)for(const id of entry.ids??[])expect(s.nodes.some(n=>n.id===id&&n.kind!=='inner')||s.inputs.some(i=>i.id===id),`${r.id} ${id}`).toBe(true);
  }
 },T);
 it('large supply exposes the ceiling fault while small supply stays correct',()=>{
  const s=byId('case-04');
  expect(run(s,[{time:0,id:'N01.level',value:6}],30).issues).toEqual([]);
  expect(run(s,[{time:0,id:'N01.level',value:14}],30).issues.length).toBeGreaterThan(0);
 });
 it('the sampling fault delays outputs by an amount that depends on when the input changes',()=>{
  const first=(time:number)=>{let w=createWorld(byId('case-05'));const s=byId('case-05');for(let t=0;t<20;t++){if(w.time===time)w=setInput(s,w,'N01.level',12);w=step(s,w,false);if(w.states.N21.value>20)return w.time-time;}return -1;};
  expect(first(1)).toBe(5);expect(first(3)).toBe(7);
  expect(validateBehavior(byId('case-05'),edit(byId('case-05'),{'N07.interval':1})).passed).toBe(true);
 },T);
 it('the retention fault only appears after capture is released while unused',()=>{
  const s=byId('case-07'),cap='N04.enabled',use='N05.enabled',req='N02.level';
  const result=(inputs:{time:number;id:string;value:number}[])=>run(s,inputs,24).w.states.N28.value;
  expect(result([{time:0,id:req,value:6},{time:0,id:cap,value:1},{time:6,id:cap,value:0},{time:10,id:use,value:1}])).toBe(0);
  expect(result([{time:0,id:req,value:6},{time:0,id:cap,value:1},{time:4,id:use,value:1},{time:8,id:cap,value:0}])).toBe(6);
  expect(result([{time:0,id:req,value:6},{time:0,id:cap,value:1},{time:6,id:cap,value:0},{time:6,id:use,value:1}])).toBe(6);
 });
 it('the usage factor fault disappears at zero request and grows with request',()=>{
  const s=byId('case-06'),gap=(request:number)=>{const a=run(s,[{time:0,id:'N02.level',value:request}],12).w,b=run(healthy,[{time:0,id:'N02.level',value:request}],12).w;return b.states.N22.value-a.states.N22.value;};
  expect(gap(0)).toBe(0);expect(gap(2)).toBeGreaterThan(0);expect(gap(4)).toBeGreaterThan(gap(2));
 });
});

describe('case presentation',()=>{
 const text=(value:string)=>publicText(presentScenario(byId('case-00'),'abstract'),value);
 it.each(caseScenarios.map(s=>s.id))('%s shows symptom and reports without exposing internal node ids',id=>{
  const s=byId(id),html=renderToStaticMarkup(<HierarchyPlay s={s} onScenario={()=>{}}/>);
  expect(html).toContain('障害案件');expect(html).toContain(text(s.symptom));for(const r of s.reports!)expect(html).toContain(r.title);
  expect(html).not.toMatch(/\bN(0[7-9]|1\d|20)\b/);
  expect(scopeItems(s,null).modules).toEqual(['Intake','Load','Reference','Preparation','Conversion','Setting']);
  const functional=presentScenario(s,'functional');
  expect(functional.hierarchy!.modules.find(m=>m.id==='Storage')!.label).toBe('Preparation buffer');
  expect(presentScenario(s,'abstract').hierarchy!.modules.find(m=>m.id==='Storage')!.label).toMatch(/^Module [A-Z]$/);
 });
 it('the selector shows the practice page and one page for all fault reports',()=>{
  const html=renderToStaticMarkup(<HierarchyPlay s={healthy} onScenario={()=>{}}/>);
  expect(playableScenarios.map(s=>s.id)).toEqual(['case-00','incident']);
  for(const s of playableScenarios)expect(html).toContain(s.title);
  for(const s of caseScenarios.slice(1))expect(html).not.toContain(s.title);
 });
});

describe('all fault reports on one page',()=>{
 const s=incidentScenario,directRepairs={'N09.load':2,'N14.rate':1,'N11.scale':2,'N16.ceiling':30,'N07.interval':1,'N10.factor':1,'N19.retention':1};
 it('uses the shared system with every case fault at once',()=>{
  expect(()=>validate(s)).not.toThrow();
  expect(s.nodes).toEqual(sharedSystem.nodes);expect(s.connections).toEqual(sharedSystem.connections);expect(s.outputRequirements).toEqual(sharedSystem.outputRequirements);expect(s.behaviorCases).toEqual(sharedSystem.behaviorCases);
  expect(s.faults.map(f=>f.targetId).sort()).toEqual(faultCases.filter(c=>c.fault).map(c=>c.fault!.targetId).sort());
  expect(s.reports!.length).toBe(7);
 });
 it('clears only when every fault is repaired, with the alternative repair accepted',()=>{
  expect(validateBehavior(s,createWorld(s)).passed).toBe(false);
  expect(validateBehavior(s,edit(s,directRepairs)).passed).toBe(true);
  const alternative:Record<string,number>={...directRepairs,'N20.useAck':1};delete alternative['N19.retention'];
  expect(validateBehavior(s,edit(s,alternative)).passed).toBe(true);
  for(const id of Object.keys(directRepairs)){const partial={...directRepairs};delete (partial as Record<string,number>)[id];expect(validateBehavior(s,edit(s,partial)).passed,id).toBe(false);}
 },T);
 it('every report shows evidence that differs from the healthy system and only public ids',()=>{
  const healthyCopy={...healthy,reports:s.reports};
  for(const r of s.reports!){
   const faulty=reportObservations(s,r),normal=reportObservations(healthyCopy,r);
   expect(faulty.some((o,i)=>JSON.stringify(o.values)!==JSON.stringify(normal[i].values)),r.id).toBe(true);
   for(const entry of r.entries)for(const id of entry.ids??[])expect(s.nodes.some(n=>n.id===id&&n.kind!=='inner')||s.inputs.some(i=>i.id===id),`${r.id} ${id}`).toBe(true);
   expect(r.hints!.length).toBeGreaterThan(0);
  }
 },T);
 it('shows all seven reports on one page without internal ids or step buttons',()=>{
  const html=renderToStaticMarkup(<HierarchyPlay s={s} onScenario={()=>{}}/>);
  for(const r of s.reports!)expect(html).toContain(publicText(presentScenario(s,'abstract'),r.title));
  expect(html).not.toMatch(/\bN(0[7-9]|1\d|20)\b/);
  expect(html).not.toMatch(/>\+\d+</);
  // Reports name outputs by their on-screen labels, never by undefined functional words.
  expect(html).not.toMatch(/余力|準備量|変換値|換算値|周期負荷|供給量|要求量|外部値/);
 });
});
