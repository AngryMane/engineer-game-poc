import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorld,step,setInput,intervene,validate,validateBehavior,type Scenario,type World} from './engine';
import {shipScenario,designerRuns,SHIP_SCENARIO_ID} from './spaceship';
import {PAYLOAD,O2} from './spaceship/system';
import {formatValue,messageText,lastMessage} from './signals';
import {reportObservations} from './faultReports';
import {createExperiment,runExperiment,setupFor,startLive,liveApply,liveTick,type Operation} from './experiment';
import {readHierarchySession,hierarchySample,SHIP_SAVE_KEY,HIERARCHY_SAVE_KEY,saveKeyFor,type HierarchySession} from './hierarchySession';
import {HierarchyPlay} from './HierarchyPlay';
import {App} from './App';
import {caseScenarios} from './cases';

const T=120000;
const faulty=shipScenario(true),healthy=shipScenario(false);
type Input={time:number;id:string;value:number};
function run(s:Scenario,inputs:Input[],ticks:number,patch:Record<string,number>={},onTick?:(w:World)=>void){
 let w=createWorld(s);for(const [key,value]of Object.entries(patch)){const [node,parameter]=key.split('.');w.parameters[node][parameter]=value;}
 for(let t=0;t<ticks;t++){for(const i of inputs.filter(i=>i.time===w.time))w=setInput(s,w,i.id,i.value);w=step(s,w,false);onTick?.(w);}
 return w;
}
const onsets=(w:World)=>w.monitor.logs.filter(l=>l.type==='onset').map(l=>`${l.nodeId}@${l.time}`);
function check(s:Scenario,patch:Record<string,number>){const w=createWorld(s);for(const [key,value]of Object.entries(patch)){const [node,parameter]=key.split('.');w.parameters[node][parameter]=value;}return validateBehavior(s,w);}

describe('meaning-bearing signals',()=>{
 it('the same number reads as different quantities with their units',()=>{
  expect(formatValue(faulty,'thermal.rackTemperature',20)).toBe('20 °C');
  expect(formatValue(faulty,'power.pumpGrant',20)).toBe('20 kW');
  expect(formatValue(faulty,'thermal.coolantFlow',20)).toBe('20 L/min');
  expect(formatValue(faulty,'payload.status',3)).toBe('制限運転（熱保護）');
 });
 it('detects a connection that carries a different kind of information than the receiver expects',()=>{
  const s=structuredClone(faulty);s.connections.push({...s.connections.find(e=>e.id==='c_report_ctrl')!,id:'c_wrong',to:'pdu',input:'pumpRequest'});
  expect(()=>validate(s)).toThrow(/機器ラック温度（°C）≠ ポンプ電力要求（kW）/);
 });
 it('detects a unit that disagrees with the signal dictionary, and unknown signals',()=>{
  const s=structuredClone(faulty);s.connections.find(e=>e.id==='c_flow')!.unit='kW';expect(()=>validate(s)).toThrow(/単位/);
  const t=structuredClone(faulty);t.connections[0].signal='thermal.unknown';expect(()=>validate(t)).toThrow(/未定義の信号/);
  const u=structuredClone(faulty);delete u.connections[0].signal;expect(()=>validate(u)).toThrow(/信号がありません/);
 });
 it('scenarios without a dictionary stay untyped and cannot reference signals',()=>{
  const legacy=structuredClone(caseScenarios[0]);expect(createWorld(legacy).messages).toBeUndefined();
  legacy.connections[0].signal='thermal.rackTemperature';expect(()=>validate(legacy)).toThrow();
 });
 it('a sensor report keeps measurement, send, delivery and adoption times apart',()=>{
  const w=run(healthy,[],13);
  const report=lastMessage(w,'c_report_ctrl')!;
  expect(report).toMatchObject({measuredAt:11,emittedAt:12,deliveredAt:13});
  // The controller keeps using the last report it received until the next one arrives four ticks later.
  const later=run(healthy,[],16);
  expect(lastMessage(later,'c_report_ctrl')!.deliveredAt).toBe(13);
  expect(later.frames.cool_ctrl.adopted!.c_report_ctrl).toMatchObject({adoptedAt:16,emittedAt:12,measuredAt:11,deliveredAt:13});
  expect(messageText(healthy,report)).toBe(`t=13 受信 · ラック温度センサー → 冷却制御：機器ラック温度の計測報告 ${formatValue(healthy,'thermal.rackTemperatureReport',report.value)}（計測 t=11） · 送信 t=12`);
 });
 it('commands keep their original send time while they are the latest value',()=>{
  const w=run(healthy,[{time:2,id:PAYLOAD,value:2}],20);
  expect(w.frames.payload.adopted!.c_mode_payload).toMatchObject({emittedAt:3,deliveredAt:4,adoptedAt:20});
 });
});

describe('healthy ship',()=>{
 it('passes every public case: orders, gaps, stop and restart, long runs and disturbance seeds',()=>{expect(validateBehavior(healthy,createWorld(healthy))).toMatchObject({passed:true});},T);
 it('keeps the published normal relations: steady flow, bus within rating, pump reports running',()=>{
  const w=run(healthy,[{time:2,id:PAYLOAD,value:2},{time:40,id:O2,value:1}],160);
  expect(w.monitor.logs).toEqual([]);
  expect(w.states.rack.value).toBeGreaterThan(31);expect(w.states.rack.value).toBeLessThan(37);
  expect(w.states.pdu.value).toBeLessThanOrEqual(5.5+1e-9);expect(w.states.rep_pump.value).toBe(1);
 });
});

describe('fault case: cooling falls short while the pump reports normal',()=>{
 it('the reproduction sequence first caps the pump grant, then the temperature fails much later, then the payload limits itself',()=>{
  let capped:number|undefined;
  const w=run(faulty,designerRuns.reproduce,80,{},w=>{if(capped===undefined&&w.states.pump.request>w.states.pdu.pumpGrant+0.5)capped=w.time;});
  const temp=w.monitor.logs.find(l=>l.nodeId==='mon_temp')!.time,limit=w.monitor.logs.find(l=>l.nodeId==='rep_payload')!.time;
  expect(capped).toBeDefined();expect(temp-capped!).toBeGreaterThanOrEqual(15);expect(limit).toBeGreaterThan(temp);
  expect(w.states.pdu.pumpGrant).toBeCloseTo(1.5);expect(w.states.pump.request).toBeCloseTo(3.75);
  // The pump status never changes: it reports that it is running on command.
  expect(w.monitor.logs.some(l=>l.nodeId==='rep_pump')).toBe(false);
 });
 it('is deterministic: the same sequence gives the same internal and final symptoms',()=>{
  const a=run(faulty,designerRuns.reproduce,120),b=run(faulty,designerRuns.reproduce,120);
  expect(onsets(a)).toEqual(onsets(b));expect(a.states).toEqual(b.states);expect(a.messages).toEqual(b.messages);
 });
 it('the control sequence changes one condition (the boost is later) and shows no anomaly',()=>{
  const w=run(faulty,designerRuns.control,200);expect(onsets(w)).toEqual([]);
  expect(designerRuns.control.filter((x,i)=>JSON.stringify(x)!==JSON.stringify(designerRuns.reproduce[i])).map(x=>x.id)).toEqual([O2]);
 });
 it('boost first fails at every gap; the window after the experiment starts is short',()=>{
  for(const gap of [0,10,40])expect(onsets(run(faulty,[{time:4,id:O2,value:1},{time:4+gap,id:PAYLOAD,value:2}],200)).length,`gap ${gap}`).toBeGreaterThan(0);
  for(const gap of [0,4])expect(onsets(run(faulty,[{time:8,id:PAYLOAD,value:2},{time:8+gap,id:O2,value:1}],200)).length,`gap ${gap}`).toBeGreaterThan(0);
  for(const gap of [10,30])expect(onsets(run(faulty,[{time:8,id:PAYLOAD,value:2},{time:8+gap,id:O2,value:1}],200)),`gap ${gap}`).toEqual([]);
 });
 it('message history supports the hypothesis: the bad day gets more O₂ and a smaller pump grant than the good day',()=>{
  const bad=run(faulty,designerRuns.reproduce,60),good=run(faulty,designerRuns.control,60);
  expect(lastMessage(bad,'c_o2_rate')!.value).toBeCloseTo(2);expect(lastMessage(good,'c_o2_rate')!.value).toBeLessThan(1.5);
  expect(lastMessage(bad,'c_pump_grant')!.value).toBeLessThan(lastMessage(good,'c_pump_grant')!.value);
 });
 it('a faster temperature sensor does not fix it, so the stale report is not the main cause',()=>{
  expect(onsets(run(faulty,designerRuns.reproduce,80,{'rack_sensor.interval':1})).length).toBeGreaterThan(0);
 });
 it('fails public cases before repair',()=>{expect(validateBehavior(faulty,createWorld(faulty)).passed).toBe(false);},T);
 it.each([
  ['direct: pump back to an essential load',{'pdu.pumpEssential':1}],
  ['alternative: lower O₂ boost power',{'o2gen.boostPower':3}],
  ['alternative: higher minimum flow reserves pump power first',{'cool_ctrl.minFlow':20}],
 ])('accepts %s',(_,patch)=>{expect(check(faulty,patch)).toMatchObject({passed:true});},T);
 it.each([
  ['allocating above the bus rating',{'pdu.capacity':7}],
  ['raising the thermal trip',{'payload.trip':50}],
  ['offsetting the temperature sensor',{'rack_sensor.offset':-5}],
  ['a faster sensor only',{'rack_sensor.interval':1}],
  ['a higher controller gain',{'cool_ctrl.gain':10}],
 ])('rejects %s',(_,patch)=>{expect(check(faulty,patch).passed).toBe(false);},T);
 it('a manual repair made in play is used by verification and clears the case',()=>{
  let w=intervene(faulty,createWorld(faulty),'pdu.pumpEssential',1,'repair');
  for(let i=0;i<40&&!w.verification.cleared;i++)w=step(faulty,w);
  expect(w.edits[0]).toMatchObject({purpose:'repair',target:'pdu'});expect(w.verification.cleared).toBe(true);
 },T);
 it('reports contain observed facts only, sampled from the hidden runs',()=>{
  for(const report of faulty.reports!){const obs=reportObservations(faulty,report);expect(obs.length).toBe(report.entries.length);}
  const r1=reportObservations(faulty,faulty.reports![0]);expect(r1[1].values.mon_temp).toBeGreaterThan(40);expect(r1[2].values.rep_payload).toBe(3);
  const text=JSON.stringify(faulty.reports)+faulty.symptom+faulty.briefing.firstAction;
  for(const spoiler of ['一般負荷','pumpEssential','負荷区分','先着'])expect(text).not.toContain(spoiler);
 });
});

describe('ship play screen, experiments and saves',()=>{
 const ops:Operation[]=designerRuns.reproduce.map(i=>({atTick:i.time,kind:'setInput',target:i.id,value:i.value}));
 it('an experiment replays exactly the live run, and a one-condition variant does not fail',()=>{
  let live=startLive(faulty,createWorld(faulty));
  for(let t=0;t<70;t++){for(const op of ops.filter(o=>o.atTick===live.world.time))live=liveApply(faulty,live,{kind:'setInput',target:op.target,value:(op as {value:number}).value});live=liveTick(faulty,live);}
  const ex=createExperiment(faulty,{id:'exp-1',name:'R1',origin:'recording',initial:live.recording.start,operations:live.recording.operations,until:70});
  expect(ex.outcome.logs).toEqual(live.world.monitor.logs);
  const control=runExperiment(faulty,setupFor(faulty,createWorld(faulty)),[ops[0],{...ops[1],atTick:30}],70);
  expect(control.logs).toEqual([]);
 },T);
 it('saves under a new key and schema; old abstract saves are not converted',()=>{
  expect(saveKeyFor(faulty)).toBe(SHIP_SAVE_KEY);expect(saveKeyFor(caseScenarios[0])).toBe(HIERARCHY_SAVE_KEY);
  const world=run(faulty,designerRuns.reproduce,30);
  const data:HierarchySession={version:16,sid:SHIP_SCENARIO_ID,world,recording:{start:createWorld(faulty),operations:ops},view:{scope:null,selected:null},detailsOpen:false,points:[hierarchySample(faulty,world)],notes:'',prediction:'',experiments:[],hint:0};
  expect(readHierarchySession(faulty,JSON.stringify(data))).toEqual(data);
  expect(()=>readHierarchySession(faulty,JSON.stringify({...data,version:15}))).toThrow();
  const broken=structuredClone(data);broken.world.messages!.c_flow[0].signal='power.pumpGrant';expect(()=>readHierarchySession(faulty,JSON.stringify(broken))).toThrow();
 });
 it('the main screen is the ship, with run controls only and a message log tab',()=>{
  const html=renderToStaticMarkup(<App/>);
  expect(html).toContain('宇宙船 / 冷却が足りないのに、ポンプは正常を報告する');expect(html).toContain('>Messages<');
  expect(html).not.toMatch(/>\+\d+</);expect(html).toContain('>Run<');
  expect(html).toContain('30 °C');expect(html).toContain('運転中');
  // No mode switch and no designer sequences on the play screen.
  expect(html).not.toContain('Display mode');expect(html).not.toContain('pumpEssential');
  expect(renderToStaticMarkup(<HierarchyPlay s={caseScenarios[0]} onScenario={()=>{}}/>)).not.toContain('>Messages<');
 });
});
