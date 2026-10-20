import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorld,step,setInput,intervene,validate,validateBehavior,type Scenario,type World} from './engine';
import {shipScenario,shipScenarios,designerRuns,SHIP_SCENARIO_ID,SHIP_CASES} from './spaceship';
import {ROUTE} from './spaceship/system';
import {terminated} from './engine';
import {runToEnd,startPlayback} from './experiment';
import {PAYLOAD,O2} from './spaceship/system';
import {formatValue,messageText,lastMessage} from './signals';
import {reportObservations} from './faultReports';
import {createExperiment,runExperiment,setupFor,startLive,liveApply,liveTick,type Operation} from './experiment';
import {readHierarchySession,hierarchySample,SHIP_SAVE_KEY,HIERARCHY_SAVE_KEY,saveKeyFor,type HierarchySession} from './hierarchySession';
import {HierarchyPlay} from './HierarchyPlay';
import {App} from './App';
import {caseScenarios} from './cases';
import {canEnter,channelKey,displaysIn,voicesIn} from './floorPlan';
import {ShipFloor,ShipDevicePanel} from './ShipFloor';

const T=120000;
const faulty=shipScenario(true),healthy=shipScenario(false),onlyA=shipScenario(['A']),onlyB=shipScenario(['B']),onlyC=shipScenario(['C']);
/** Direct repairs of all three faults. */
const FIX={'pdu.pumpEssential':1,'bay_air.fan':1.5,'cool_ctrl.maxFlow':30};
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

describe('fault A: cooling falls short while the pump reports normal',()=>{
 it('the reproduction sequence first caps the pump grant, then the temperature fails much later, then the payload limits itself',()=>{
  let capped:number|undefined;
  const w=run(onlyA,designerRuns.reproduce,80,{},w=>{if(capped===undefined&&w.states.pump.request>w.states.pdu.pumpGrant+0.5)capped=w.time;});
  const temp=w.monitor.logs.find(l=>l.nodeId==='mon_temp')!.time,limit=w.monitor.logs.find(l=>l.nodeId==='rep_payload')!.time;
  expect(capped).toBeDefined();expect(temp-capped!).toBeGreaterThanOrEqual(10);expect(limit).toBeGreaterThan(temp);
  expect(w.states.pdu.pumpGrant).toBeCloseTo(1.5);expect(w.states.pump.request).toBeCloseTo(3.75);
  // The pump status never changes: it reports that it is running on command.
  expect(w.monitor.logs.some(l=>l.nodeId==='rep_pump')).toBe(false);
 });
 it('is deterministic: the same sequence gives the same internal and final symptoms',()=>{
  const a=run(onlyA,designerRuns.reproduce,120),b=run(onlyA,designerRuns.reproduce,120);
  expect(onsets(a)).toEqual(onsets(b));expect(a.states).toEqual(b.states);expect(a.messages).toEqual(b.messages);
 });
 it('the control sequence changes one condition (the boost is later) and shows no anomaly',()=>{
  const w=run(onlyA,designerRuns.control,200);expect(onsets(w)).toEqual([]);
  expect(designerRuns.control.filter((x,i)=>JSON.stringify(x)!==JSON.stringify(designerRuns.reproduce[i])).map(x=>x.id)).toEqual([O2]);
 });
 it('boost first fails at every gap; the window after the experiment starts is short',()=>{
  for(const gap of [0,10,40])expect(onsets(run(onlyA,[{time:4,id:O2,value:1},{time:4+gap,id:PAYLOAD,value:2}],200)).length,`gap ${gap}`).toBeGreaterThan(0);
  for(const gap of [0,4])expect(onsets(run(onlyA,[{time:8,id:PAYLOAD,value:2},{time:8+gap,id:O2,value:1}],200)).length,`gap ${gap}`).toBeGreaterThan(0);
  for(const gap of [10,30])expect(onsets(run(onlyA,[{time:8,id:PAYLOAD,value:2},{time:8+gap,id:O2,value:1}],200)),`gap ${gap}`).toEqual([]);
 },T);
 it('message history supports the hypothesis: the bad day gets more O₂ and a smaller pump grant than the good day',()=>{
  const bad=run(onlyA,designerRuns.reproduce,60),good=run(onlyA,designerRuns.control,60);
  expect(lastMessage(bad,'c_o2_rate')!.value).toBeCloseTo(2);expect(lastMessage(good,'c_o2_rate')!.value).toBeLessThan(1.5);
  expect(lastMessage(bad,'c_pump_grant')!.value).toBeLessThan(lastMessage(good,'c_pump_grant')!.value);
 });
 it('a faster temperature sensor does not fix it, so the stale report is not the main cause',()=>{
  expect(onsets(run(onlyA,designerRuns.reproduce,80,{'rack_sensor.interval':1})).length).toBeGreaterThan(0);
 });
 it('fails public cases before repair',()=>{expect(validateBehavior(faulty,createWorld(faulty)).passed).toBe(false);},T);
 it.each([
  ['direct: pump back to an essential load',{'pdu.pumpEssential':1}],
  ['alternative: lower O₂ boost power',{'o2gen.boostPower':3}],
  ['alternative: higher minimum flow reserves pump power first',{'cool_ctrl.minFlow':20}],
 ])('accepts %s',(_,patch)=>{const p:Record<string,number>={...FIX,...patch};if(!('pdu.pumpEssential' in patch))delete p['pdu.pumpEssential'];expect(check(faulty,p)).toMatchObject({passed:true});},T);
 it.each([
  ['allocating above the bus rating',{'pdu.capacity':7}],
  ['raising the thermal trip',{'payload.trip':50}],
  ['offsetting the temperature sensor',{'rack_sensor.offset':-5}],
  ['a faster sensor only',{'rack_sensor.interval':1}],
  ['a higher controller gain',{'cool_ctrl.gain':10}],
 ])('rejects %s',(_,patch)=>{const p:Record<string,number>={...FIX,...patch};delete p['pdu.pumpEssential'];expect(check(faulty,p).passed).toBe(false);},T);
 it('a manual repair made in play is used by verification and clears the case',()=>{
  let w=createWorld(faulty);for(const [id,v] of Object.entries(FIX))w=intervene(faulty,w,id,v,'repair');
  for(let i=0;i<40&&!w.verification.cleared;i++)w=step(faulty,w);
  expect(w.edits[0]).toMatchObject({purpose:'repair',target:'pdu'});expect(w.verification.cleared).toBe(true);
 },T);
 it('reports contain observed facts only, sampled from the hidden runs, and each crew member reports from their own room',()=>{
  for(const sc of shipScenarios){
   for(const report of sc.reports!){const obs=reportObservations(sc,report);expect(obs.length).toBe(report.entries.length);
    const role=report.from.match(/（(.+)）/)![1],room=sc.floor!.compartments.find(c=>c.role===role)!.id;
    for(const e of report.entries)for(const id of e.ids!){const node=sc.inputs.find(i=>i.id===id)?.nodeId??id;if(node===sc.floor!.alarm)continue;expect(sc.floor!.displays[node]??sc.floor!.devices.find(d=>d.nodeId===node)!.compartment,`${sc.id} ${report.id} ${id}`).toBe(room);}}
   const text=JSON.stringify(sc.reports)+sc.symptom+sc.briefing.firstAction;
   for(const spoiler of ['一般負荷','pumpEssential','負荷区分','先着','排出量','最大流量'])expect(text,sc.id).not.toContain(spoiler);
  }
  const [c3,c5,c8,last]=shipScenarios,obs=(sc:Scenario,i:number)=>reportObservations(sc,sc.reports![i]);
  expect(obs(c3,0)[2].values).toMatchObject({rep_payload:3,rep_fire:1});expect(obs(c3,1)[1].values.mon_temp).toBeGreaterThan(40);expect(obs(c3,1)[1].values.rep_flow).toBe(12);
  expect(obs(c5,0)[1].values.rep_tank).toBe(100);expect(obs(c5,1)[1].values.rep_fire).toBe(1);
  expect(obs(c8,1)[1].values.rep_flow).toBe(16);expect(obs(c8,1)[2].values.rep_fire).toBe(1);
  expect(obs(last,0)[1].values.rep_flow).toBe(12);expect(obs(last,0)[2].values.rep_fire).toBe(1);expect(obs(last,1)[0].values['ops_o2.mode']).toBe(1);
  expect(obs(last,2)[1].values.rep_flow).toBe(16);expect(obs(last,2)[2].values.rep_fire).toBe(1);
 },T);
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
  const data:HierarchySession={version:16,sid:faulty.id,world,recording:{start:createWorld(faulty),operations:ops},view:{scope:null,selected:null},detailsOpen:false,points:[hierarchySample(faulty,world)],notes:'',prediction:'',experiments:[],hint:0};
  expect(readHierarchySession(faulty,JSON.stringify(data))).toEqual(data);
  // Saves made while measurement points and diagnosis existed still load; that part is dropped.
  expect(readHierarchySession(faulty,JSON.stringify({...data,investigation:{probes:[{connectionId:'c_pump_grant',since:12}],diagnosed:['pdu'],extraDiagnoses:0}}))).toEqual(data);
  expect(()=>readHierarchySession(faulty,JSON.stringify({...data,version:15}))).toThrow();
  const broken=structuredClone(data);broken.world.messages!.c_flow[0].signal='power.pumpGrant';expect(()=>readHierarchySession(faulty,JSON.stringify(broken))).toThrow();
 });
 it('the main screen is the ship, with run controls only and a message log tab',()=>{
  const html=renderToStaticMarkup(<App/>);
  expect(html).toContain('宇宙船 / 1. カナリア3号の爆発');expect(SHIP_SCENARIO_ID).toBe('ship-canary-03');expect(html).toContain('本日の爆発：0 隻');expect(html).toContain('>Messages<');
  expect(html).not.toMatch(/>\+\d+</);expect(html).toContain('>Run<');
  // The game starts in the science lab: only its screens are shown.
  expect(html).toContain('科学ラボの表示');expect(html).toContain('記録済みデータ量');expect(html).not.toContain('冷却ポンプ状態</h3>');
  // No mode switch and no designer sequences on the play screen.
  expect(html).not.toContain('Display mode');expect(html).not.toContain('pumpEssential');
  expect(renderToStaticMarkup(<HierarchyPlay s={caseScenarios[0]} onScenario={()=>{}}/>)).not.toContain('>Messages<');
 });
});

describe('ship floor plan: what the player sees first',()=>{
 const floorHtml=(w=createWorld(faulty),room='lab')=>renderToStaticMarkup(<ShipFloor s={faulty} w={w} room={room} selected={null} onMove={()=>{}} onSelect={()=>{}} onInput={()=>{}}/>);
 const panel=(id:string,w=createWorld(faulty))=>renderToStaticMarkup(<ShipDevicePanel s={faulty} w={w} id={id} purpose="experiment" setPurpose={()=>{}} onEdit={()=>{}}/>);
 it('shows compartments, equipment and the crew console, but no wiring and no internal values',()=>{
  const html=floorHtml();
  for(const label of ['科学ラボ','生命維持室','電力管理室','熱管理室','機器ベイ','生命維持機械室','電源室','熱制御区画','配電盤','冷却ポンプ','O₂生成装置','科学ラボの表示'])expect(html).toContain(label);
  // Consoles are operated where they sit, only by someone in that room.
  expect(html).toMatch(/aria-label="ペイロード運転指令"[^>]*>.*>実験運転<\/button>/);expect(html).toContain('aria-pressed="true"');
  expect(html).toMatch(/aria-label="O₂生成モード指令"[^>]*><button disabled=""/);expect(html).not.toMatch(/aria-label="ペイロード運転指令"[^>]*><button disabled/);
  expect(html.slice(0,html.indexOf('船内配置図'))).not.toContain('type="number"');
  const thermal=floorHtml(createWorld(faulty),'thermal_room'),screen=(h:string)=>h.slice(0,h.indexOf('運用契約'));
  expect(screen(thermal)).toContain('冷却ポンプ状態');expect(screen(thermal)).toContain('冷却液流量');expect(screen(thermal)).not.toContain('記録済みデータ量');
  expect(screen(floorHtml(createWorld(faulty),'bay'))).toContain('この部屋に表示はありません');
  expect(html).not.toContain('<path');expect(html).not.toContain('給電許可');expect(html).not.toContain('pumpEssential');
  const main=renderToStaticMarkup(<App/>);expect(main).toContain('船内配置図');expect(main).not.toContain('hierarchy-graph');
  // Measurement points and diagnosis are gone.
  for(const word of ['計測点','計測チャンネル','診断'])expect(main+html+panel('pdu'),word).not.toContain(word);
 });
 it('every output has a screen in one crew room, inner devices sit in maintenance areas, consoles in crew rooms',()=>{
  const a=structuredClone(faulty);delete a.floor!.displays.rep_tank;expect(()=>validate(a)).toThrow(/表示する部屋がない出力/);
  const b=structuredClone(faulty);b.floor!.displays.rep_tank='life';expect(()=>validate(b)).toThrow(/表示する部屋がない出力/);
  const c=structuredClone(faulty);c.floor!.devices.find(d=>d.nodeId==='pdu')!.compartment='power_room';expect(()=>validate(c)).toThrow(/区画が不正/);
  const d=structuredClone(faulty);d.floor!.devices.find(d=>d.nodeId==='ops_o2')!.compartment='life';expect(()=>validate(d)).toThrow(/区画が不正/);
  // Every crew role has its own console or screens; the mechanic can enter every room but outside.
  for(const room of faulty.floor!.compartments.filter(c=>c.access==='crew'))expect(displaysIn(faulty,room.id).filter(id=>id!==faulty.floor!.alarm).length,room.id).toBeGreaterThan(0);
  // The fire alarm is heard everywhere, maintenance areas included.
  for(const room of faulty.floor!.compartments.filter(c=>c.access!=='outside'))expect(displaysIn(faulty,room.id)).toContain('rep_fire');
  expect(faulty.floor!.compartments.filter(c=>canEnter(faulty,c.id)).map(c=>c.id)).not.toContain('outside');
 });
 it('every computing device is placed, and the plan is validated with the scenario',()=>{
  const s=structuredClone(faulty);s.floor!.devices=s.floor!.devices.filter(d=>d.nodeId!=='pdu');expect(()=>validate(s)).toThrow(/配置されていない設備/);
  const t=structuredClone(faulty);t.floor!.devices.find(d=>d.nodeId==='pdu')!.properties!.nope='x';expect(()=>validate(t)).toThrow(/プロパティ名/);
 });
 it('a device panel separates inputs, outputs and properties, all visible without any extra step',()=>{
  const w=run(faulty,designerRuns.reproduce,30),html=panel('pdu',w);
  const at=(text:string)=>html.indexOf(text);
  expect(at('入力（この設備が受け取る値）')).toBeGreaterThan(0);expect(at('出力（この設備が送る値）')).toBeGreaterThan(at('入力（この設備が受け取る値）'));expect(at('プロパティ（この設備の設定と内部状態）')).toBeGreaterThan(at('出力（この設備が送る値）'));
  const inputs=html.slice(at('入力（'),at('出力（')),outputs=html.slice(at('出力（'),at('プロパティ（')),props=html.slice(at('プロパティ（'),at('受け渡しの履歴'));
  for(const label of ['ポンプ電力要求','O₂生成装置電力要求'])expect(inputs).toContain(label);
  for(const label of ['ポンプ給電許可','O₂生成装置給電許可','主バス負荷'])expect(outputs).toContain(label);
  expect(outputs).toContain('1.5');expect(outputs).toContain('冷却ポンプ');
  expect(props).toContain('冷却ポンプの負荷区分（1=重要負荷、0=一般負荷）');expect(props).toContain('割り当て容量（kW）');expect(props).toContain('計算周期（tick）');expect(props).toContain('変更できません');
  expect(props).not.toContain('ポンプ給電許可');
 });
 it('internal state that is not sent anywhere is listed as a property, and command consoles show the crew command as their input',()=>{
  const payload=panel('payload');expect(payload.slice(payload.indexOf('プロパティ（'))).toContain('熱保護で制限運転中');
  const console=panel('ops_payload');expect(console.slice(console.indexOf('入力（'),console.indexOf('出力（'))).toContain('クルーの操作');expect(console).toContain('プロパティはありません');
  expect(panel('space_env')).toContain('船外環境（操作できない）');
 });
 it('timeline samples keep every connection, so a device\'s inputs and outputs can be charted, also for replays',()=>{
  const w=run(faulty,designerRuns.reproduce,30);expect(hierarchySample(faulty,w).values[channelKey('c_pump_grant')]).toBeCloseTo(1.5);
 });
});

describe('same-class ships: three faults, three ways to explode',()=>{
 const at=(time:number,id:string,value:number)=>({time,id,value});
 const voyage=(s:Scenario,inputs:Input[],ticks=250)=>{let w=createWorld(s);for(let t=0;t<ticks&&!terminated(s,w);t++){for(const i of inputs.filter(i=>i.time===w.time))w=setInput(s,w,i.id,i.value);w=step(s,w,false);}return w;};
 const outcome=(w:World)=>w.states.hazard.exploded?`${w.states.hazard.cause===1?'heat':'spark'}@${w.time}`:'port';
 it('a healthy ship never catches fire, on any route and in any order',()=>{
  for(const inputs of Object.values(designerRuns))expect(outcome(voyage(healthy,inputs)),JSON.stringify(inputs)).toBe('port');
  for(const route of [0,1,2])expect(outcome(voyage(healthy,[at(0,ROUTE,route),at(2,O2,1),at(70,PAYLOAD,2)])),`route ${route}`).toBe('port');
 },T);
 it('each fault explodes only under its own conditions, and in its own way',()=>{
  expect(outcome(voyage(onlyA,designerRuns.reproduce))).toMatch(/^heat@/);expect(outcome(voyage(onlyA,designerRuns.control))).toBe('port');expect(outcome(voyage(onlyA,designerRuns.hotRoute))).toBe('port');
  expect(outcome(voyage(onlyB,designerRuns.ventSpark))).toMatch(/^spark@/);for(const day of ['reproduce','control','boostFirst','hotRoute'] as const)expect(outcome(voyage(onlyB,designerRuns[day])),day).toBe('port');
  expect(outcome(voyage(onlyC,designerRuns.hotRoute))).toMatch(/^heat@/);for(const day of ['reproduce','control','ventSpark'] as const)expect(outcome(voyage(onlyC,designerRuns[day])),day).toBe('port');
 },T);
 it('with all three faults, every reported day explodes first by its own cause',()=>{
  expect(outcome(voyage(faulty,designerRuns.reproduce))).toMatch(/^heat@5\d$/);
  const b=voyage(faulty,designerRuns.ventSpark);expect(outcome(b)).toMatch(/^spark@6\d$/);expect(b.states.bay_air.value).toBeGreaterThanOrEqual(30);
  expect(outcome(voyage(faulty,designerRuns.hotRoute))).toMatch(/^heat@/);expect(outcome(voyage(faulty,designerRuns.control))).toBe('port');
 },T);
 it('repairing one fault can still leave the same voyage exploding, later and for another reason',()=>{
  const s=structuredClone(faulty);s.faults=s.faults.filter(f=>f.targetId!=='bay_air');
  expect(outcome(voyage(s,designerRuns.ventSpark))).toMatch(/^heat@/);
 },T);
 it('each fault alone fails the public cases; all direct repairs pass; leaving one out fails',()=>{
  for(const s of [onlyA,onlyB,onlyC])expect(validateBehavior(s,createWorld(s)).passed,s.id).toBe(false);
  expect(check(faulty,FIX)).toMatchObject({passed:true});
  for(const key of Object.keys(FIX)){const p:Record<string,number>={...FIX};delete p[key];expect(check(faulty,p).passed,key).toBe(false);}
 },T);
 it('an exploded voyage stops there, and its outcome names the cause',()=>{
  const ops:Operation[]=designerRuns.reproduce.map(i=>({atTick:i.time,kind:'setInput',target:i.id,value:i.value}));
  const pb=runToEnd(faulty,startPlayback(faulty,createWorld(faulty),ops,200));
  expect(pb.status).toBe('completed');expect(pb.terminatedAt).toBeLessThan(60);expect(pb.world.time).toBe(pb.terminatedAt);
  expect(runExperiment(faulty,setupFor(faulty,createWorld(faulty)),ops,200)).toMatchObject({terminatedAt:pb.terminatedAt,terminalCause:'機器ベイの熱暴走'});
  let live=startLive(faulty,pb.world);live=liveTick(faulty,live);expect(live.world.time).toBe(pb.world.time);expect(live.notice?.stop).toBe(true);
 },T);
 it('crew voices follow what each room can see',()=>{
  const w=voyage(faulty,designerRuns.reproduce,46);
  expect(voicesIn(faulty,w,'thermal_room').join()).toContain('40 °C');expect(voicesIn(faulty,w,'lab').join()).not.toContain('40 °C');
 },T);
});

describe('one fault per case, on one shared ship',()=>{
 const strip=(sc:Scenario)=>({nodes:sc.nodes,connections:sc.connections,floor:sc.floor,inputs:sc.inputs,interventions:sc.interventions,outputRequirements:sc.outputRequirements,behaviorCases:sc.behaviorCases,signals:sc.signals,hierarchy:sc.hierarchy});
 it('four cases in order: three single faults, then one ship with two',()=>{
  expect(shipScenarios.map(sc=>sc.id)).toEqual(['ship-canary-03','ship-canary-05','ship-canary-08','ship-canary-final']);
  expect(SHIP_CASES.map(c=>c.faults.join(''))).toEqual(['A','B','C','AC']);
  for(const sc of shipScenarios){expect(strip(sc)).toEqual(strip(healthy));expect(sc.reports!.map(r=>r.id)).toEqual(sc.reports!.map((_,i)=>`R${i+1}`));}
 });
 it('each case fails before repair and passes with its own direct repair only',()=>{
  const direct:Record<string,Record<string,number>>={A:{'pdu.pumpEssential':1},B:{'bay_air.fan':1.5},C:{'cool_ctrl.maxFlow':30}};
  for(const c of SHIP_CASES){const sc=shipScenarios.find(s=>s.id===c.id)!;
   expect(check(sc,{}).passed,c.id).toBe(false);
   expect(check(sc,Object.assign({},...c.faults.map(f=>direct[f]))),c.id).toMatchObject({passed:true});
   if(c.faults.length>1)for(const f of c.faults)expect(check(sc,direct[f]).passed,`${c.id} only ${f}`).toBe(false);}
 },T*3);
 it('alternative repairs are accepted per case, and bypasses are not',()=>{
  const [c3,,c8]=shipScenarios;
  for(const patch of [{'o2gen.boostPower':3.5},{'cool_ctrl.minFlow':20}] as Record<string,number>[])expect(check(c3,patch),JSON.stringify(patch)).toMatchObject({passed:true});
  expect(check(c8,{'cool_ctrl.maxFlow':24})).toMatchObject({passed:true});
  for(const patch of [{'cool_ctrl.minFlow':20},{'payload.trip':50}] as Record<string,number>[])expect(check(c8,patch).passed,JSON.stringify(patch)).toBe(false);
 },T*2);
 it('a healthy ship survives any crew operation: random command sequences never break the contract or explode',()=>{
  let seed=12345;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let k=0;k<25;k++){
   let w=createWorld(healthy);const ops:Input[]=[];
   for(let t=0;t<250;t++){
    if(rnd()<0.06){const i=healthy.inputs[Math.floor(rnd()*healthy.inputs.length)],value=i.min+Math.floor(rnd()*((i.max-i.min)/i.step+1))*i.step;ops.push({time:t,id:i.id,value});w=setInput(healthy,w,i.id,value);}
    w=step(healthy,w,false);
   }
   expect(w.monitor.logs,JSON.stringify(ops)).toEqual([]);expect(w.states.hazard.exploded,JSON.stringify(ops)).toBe(0);
  }
 },T*3);
});
