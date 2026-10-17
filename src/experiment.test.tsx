import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorld,step,setInput,intervene,restartWithSettings,type World} from './engine';
import {caseScenarios,incidentScenario,playableScenarios} from './cases';
import {scenarios as legacyScenarios} from './legacyScenarios';
import {HierarchyPlay} from './HierarchyPlay';
import {FlatApp} from './App';
import {advancePlayback,createExperiment,liveApply,liveTick,runExperiment,runToEnd,setupFor,startLive,startPlayback,validateSequence,variantOf,type Operation} from './experiment';
import {readHierarchySession,type HierarchySession} from './hierarchySession';
import {tickInterval} from './useTicker';

const s=incidentScenario,practice=caseScenarios[0];
const T=60000;
const run=(world:World,ticks:number)=>{let w=world;for(let i=0;i<ticks;i++)w=step(s,w);return w;};
const input=(atTick:number,target:string,value:number):Operation=>({atTick,kind:'setInput',target,value});
const sequence:Operation[]=[input(0,'N01.level',12),input(2,'N03.enabled',1),input(5,'N02.level',6),input(5,'N04.enabled',1),input(9,'N04.enabled',0),{atTick:12,kind:'intervene',target:'N14.rate',value:1,purpose:'experiment'},input(14,'N05.enabled',1)];
const experiment=(ops=sequence,until=30,id='exp-1')=>createExperiment(s,{id,name:id,origin:'recording',initial:createWorld(s),operations:ops,until});

describe('time controls: no step buttons',()=>{
 it.each(playableScenarios.map(sc=>sc.id))('%s shows Run/Pause/Reset/Restart and no fixed-tick buttons',id=>{
  const html=renderToStaticMarkup(<HierarchyPlay s={playableScenarios.find(sc=>sc.id===id)!} onScenario={()=>{}}/>);
  expect(html).not.toMatch(/>\+\d+</);expect(html).toContain('>Run<');expect(html).toContain('>Reset<');expect(html).toContain('>Restart<');expect(html).toContain('表示速度');
 });
 it('the legacy flat screen has no fixed-tick buttons either',()=>{
  for(const sc of legacyScenarios.filter(x=>!x.hierarchy))expect(renderToStaticMarkup(<FlatApp initialScenario={sc.id}/>),sc.id).not.toMatch(/>\+\d+</);
 });
});

describe('live run',()=>{
 it('Run, Pause, Run reaches the same world as stepping the engine directly',()=>{
  let live=startLive(s,createWorld(s));
  for(let i=0;i<5;i++)live=liveTick(s,live);
  // Paused: inspecting, note taking and editing experiments do not touch the world.
  const paused=structuredClone(live);
  for(let i=0;i<7;i++)live=liveTick(s,live);
  expect(paused.world.time).toBe(5);expect(live.world).toEqual(run(createWorld(s),12));
  expect(live.points.map(p=>p.time)).toEqual([...Array(13).keys()]);
 },T);
 it('records operations at the tick shown on screen and replays them exactly, however late the click came in real time',()=>{
  let live=startLive(s,createWorld(s));
  const clicks:[number,Operation['kind'],string,number][]=[[3,'setInput','N01.level',14],[3,'setInput','N02.level',0],[8,'intervene','N16.ceiling',30]];
  for(let t=0;t<=15;t++){for(const [at,kind,target,value] of clicks.filter(c=>c[0]===t))live=liveApply(s,live,kind==='setInput'?{kind,target,value}:{kind:'intervene',target,value,purpose:'experiment'});if(t<15)live=liveTick(s,live);}
  expect(live.recording.operations.map(o=>o.atTick)).toEqual([3,3,8]);
  const replayed=runToEnd(s,startPlayback(s,live.recording.start,live.recording.operations,live.world.time));
  expect(replayed.status).toBe('completed');expect(replayed.world).toEqual(live.world);expect(replayed.points).toEqual(live.points);
 },T);
 it('a rejected operation leaves the world unchanged and is not recorded',()=>{
  const live=startLive(s,createWorld(s));
  for(const op of [{kind:'setInput',target:'N06.value',value:1},{kind:'setInput',target:'N01.level',value:99},{kind:'intervene',target:'N06.seed',value:1,purpose:'repair'}] as const){
   const next=liveApply(s,live,op);expect(next.world).toBe(live.world);expect(next.recording.operations).toEqual([]);expect(next.notice?.stop).toBe(false);
  }
 });
});

describe('experiment sequences',()=>{
 it('replays the same setup, sequence and disturbance seed identically, also after a JSON round trip',()=>{
  const a=experiment(),b=experiment(),c=runExperiment(s,JSON.parse(JSON.stringify(a.setup)),JSON.parse(JSON.stringify(a.operations)),a.until);
  expect(a.outcome.status).toBe('completed');expect(a.outcome).toEqual(b.outcome);expect(c).toEqual(a.outcome);
  expect(a.setup.seeds).toEqual({N06:20261017});expect(a.setup.scenarioId).toBe('incident');
 },T);
 it('applies same-tick operations in registration order, before the tick advances',()=>{
  const twice=(values:number[])=>runToEnd(s,startPlayback(s,createWorld(s),values.map(v=>input(4,'N01.level',v)),6)).world;
  const up=twice([4,12]),down=twice([12,4]);
  expect(up.parameters.N01.level).toBe(12);expect(down.parameters.N01.level).toBe(4);
  expect(up.inputEvents.map(e=>[e.time,e.value])).toEqual([[4,4],[4,12]]);
  // Applied at t=4 (before tick 5): the manual input node emits at t=5 in both orders.
  expect(up.trace.filter(r=>r.nodeId==='N01'&&r.trigger==='manual').map(r=>[r.time,r.value])).toEqual([[5,4],[5,12]]);
  let manual=createWorld(s);manual=run(manual,4);manual=setInput(s,manual,'N01.level',4);manual=setInput(s,manual,'N01.level',12);manual=run(manual,2);
  expect(up).toEqual(manual);
 },T);
 it('handles repeated value changes, on/off toggling and parameter interventions in order',()=>{
  const ops:Operation[]=[input(1,'N01.level',10),input(2,'N01.level',11),input(3,'N01.level',12),input(2,'N03.enabled',1),input(6,'N03.enabled',0),input(8,'N03.enabled',1),{atTick:8,kind:'intervene',target:'N14.rate',value:1,purpose:'repair'},{atTick:8,kind:'intervene',target:'N14.rate',value:.5,purpose:'experiment'}];
  const sorted=createExperiment(s,{id:'x',name:'x',origin:'recording',initial:createWorld(s),operations:ops,until:20});
  expect(sorted.operations.map(o=>o.atTick)).toEqual([1,2,2,3,6,8,8,8]);
  expect(sorted.operations.slice(1,3).map(o=>o.target)).toEqual(['N01.level','N03.enabled']);
  const end=runToEnd(s,startPlayback(s,createWorld(s),sorted.operations,20)).world;
  expect(end.parameters.N14.rate).toBe(.5);expect(end.edits.map(e=>[e.time,e.value,e.purpose])).toEqual([[8,1,'repair'],[8,.5,'experiment']]);
  let manual=createWorld(s);for(let t=0;t<20;t++){for(const op of sorted.operations.filter(o=>o.atTick===t))manual=op.kind==='setInput'?setInput(s,manual,op.target,op.value):intervene(s,manual,op.target,(op as {value:number}).value,(op as {purpose:'repair'|'experiment'}).purpose);manual=step(s,manual);}
  expect(end).toEqual(manual);
 },T);
 it('a variant with one shifted operation reruns from the parent start and leaves the parent untouched',()=>{
  const ops=[input(0,'N04.enabled',1),input(0,'N02.level',6),input(6,'N04.enabled',0),input(10,'N05.enabled',1)];
  const parent=createExperiment(s,{id:'exp-1',name:'base',origin:'recording',initial:createWorld(s),operations:ops,until:24});const before=structuredClone(parent);
  const shifted=structuredClone(parent.operations);shifted[2].atTick=12;
  const variant=variantOf(s,parent,'exp-2','late release',shifted,24);
  expect(parent).toEqual(before);expect(variant.parentId).toBe('exp-1');expect(variant.setup.initial).toEqual(parent.setup.initial);
  expect(variant.operations.map(o=>o.atTick)).toEqual([0,0,10,12]);
  const used=(ex:typeof parent)=>runToEnd(s,startPlayback(s,ex.setup.initial,ex.operations,ex.until)).world.states.N28.value;
  expect(used(parent)).toBe(0);expect(used(variant)).toBe(6);
 },T);
 it('rejects edits to external disturbances, out-of-range values and unordered sequences without touching the world',()=>{
  const initial=createWorld(s);
  for(const ops of [[input(0,'N06.value',1)],[{atTick:0,kind:'intervene',target:'N06.seed',value:1,purpose:'experiment'}],[input(0,'N01.level',17)],[input(4,'N01.level',3),input(2,'N01.level',4)],[input(31,'N01.level',3)],[{atTick:1,kind:'request',target:'N22'}]] as Operation[][]){
   expect(()=>validateSequence(s,ops,0,30),JSON.stringify(ops)).toThrow();
   const pb=startPlayback(s,initial,ops,30);expect(pb.status).toBe('failed');expect(pb.world).toEqual(initial);expect(advancePlayback(s,pb,5)).toBe(pb);
  }
  expect(()=>experiment([input(0,'N06.value',1)])).toThrow(/外乱|通常入力/);
 });
 it('display speed does not change the result: 1 tick per call, 8 ticks per call and run-to-end agree',()=>{
  const start=startPlayback(s,createWorld(s),sequence,30);let slow=start,fast=start;
  while(slow.status==='pending')slow=advancePlayback(s,slow,1);
  while(fast.status==='pending')fast=advancePlayback(s,fast,8);
  expect(slow).toEqual(fast);expect(slow).toEqual(runToEnd(s,start));expect(slow.world.time).toBe(30);
  expect(tickInterval(4)).toBeLessThan(tickInterval(1));
 },T);
 it('reports the next scheduled operation and completes at the end tick',()=>{
  let pb=startPlayback(s,createWorld(s),[input(3,'N01.level',12)],5);
  expect(pb.operations[pb.next].atTick).toBe(3);
  pb=advancePlayback(s,pb,4);expect(pb.world.time).toBe(4);expect(pb.next).toBe(1);expect(pb.status).toBe('pending');
  pb=advancePlayback(s,pb,1);expect(pb.status).toBe('completed');expect(pb.world.time).toBe(5);
  expect(advancePlayback(s,pb,3)).toBe(pb);
 });
 it('summarizes onset, recovery and failing outputs for comparison',()=>{
  const ex=experiment([],40),repaired=experiment([{atTick:20,kind:'intervene',target:'N09.load',value:2,purpose:'repair'}],40,'exp-2');
  expect(ex.outcome.outputs.find(o=>o.nodeId==='N22')!.onsets.length).toBeGreaterThan(0);
  expect(ex.outcome.outputs.find(o=>o.nodeId==='N25')!.failingAtEnd||ex.outcome.outputs.find(o=>o.nodeId==='N25')!.onsets.length>0).toBe(true);
  expect(repaired.outcome.outputs.find(o=>o.nodeId==='N29')!.failingAtEnd).toBe(false);
  expect(repaired.outcome.logs.every(l=>l.time>=0)).toBe(true);
 },T);
});

describe('reset, restart and save/load',()=>{
 it('a recording that starts at Restart replays from the restarted world',()=>{
  let live=startLive(s,createWorld(s));live=liveApply(s,live,{kind:'intervene',target:'N09.load',value:2,purpose:'repair'});live=liveApply(s,live,{kind:'setInput',target:'N01.level',value:12});
  for(let i=0;i<6;i++)live=liveTick(s,live);
  live=startLive(s,restartWithSettings(s,live.world));expect(live.world.time).toBe(0);expect(live.world.parameters.N09.load).toBe(2);
  live=liveApply(s,live,{kind:'setInput',target:'N02.level',value:5});for(let i=0;i<10;i++)live=liveTick(s,live);
  expect(runToEnd(s,startPlayback(s,live.recording.start,live.recording.operations,live.world.time)).world).toEqual(live.world);
 },T);
 it('v15 saves keep the recording, experiments, variants and notes, and replay identically after loading',()=>{
  let live=startLive(s,createWorld(s));for(const op of sequence.filter(o=>o.atTick===0))live=liveApply(s,live,op as never);for(let i=0;i<8;i++)live=liveTick(s,live);
  const base=experiment(),variant=variantOf(s,base,'exp-2','v',[...base.operations.slice(1)],30);
  const data:HierarchySession={version:15,sid:s.id,world:live.world,recording:live.recording,view:{scope:null,selected:null},detailsOpen:false,points:live.points,notes:'n',prediction:'p',experiments:[{...base,prediction:'N22 drops',memo:'it did'},variant],hint:0,reportHints:{R01:2},speed:4};
  const loaded=readHierarchySession(s,JSON.stringify(data));expect(loaded).toEqual(data);
  expect(runExperiment(s,loaded.experiments[1].setup,loaded.experiments[1].operations,30)).toEqual(variant.outcome);
  for(const broken of [{...data,experiments:[{...variant,parentId:'missing'}]},{...data,reportHints:{R99:1}},{...data,experiments:[{...base,operations:[input(0,'N06.value',1)]}]},{...data,recording:{...data.recording,operations:[input(99,'N01.level',1)]}}])expect(()=>readHierarchySession(s,JSON.stringify(broken))).toThrow();
  expect(()=>readHierarchySession(practice,JSON.stringify(data))).toThrow();
  expect(setupFor(s,live.world).initial).not.toBe(live.world);
 },T);
});
