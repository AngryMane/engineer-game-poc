import {updateMonitor,checkOutputs,validateContracts,type ContractRule,type BehaviorCase,type Monitor} from './contracts';
export type Expr = number | { ref: string } | { op: 'sum'|'multiply'|'clamp'|'threshold'|'delay'|'integrator'|'filter'|'switch'|'pulse'; args: Expr[] };
export type NodeKind = 'input'|'output'|'inner';
export type ManualInput = {id:string;nodeId:string;parameter:string;label:string;description:string;min:number;max:number;step:number;defaultValue:number};
export type InputEvent = {time:number;id:string;before:number;value:number};
export type Trigger = {type:'manual'|'timer'|'request'|'input'|'random';periodParameter?:string;minInterval?:number;maxInterval?:number};
export type ExternalInput = {seed:number;value:{type:'uniform';min:number;max:number}|{type:'fixed';value:number}};
export type Node = { externalInput?:ExternalInput;trigger:Trigger;inputParameter?:string;kind:NodeKind;id:string; label:string; description:string; ports:{id:string;direction:'in'|'out'}[]; initialState:Record<string,number>; parameters:Record<string,number>; update:Record<string,Expr>; x:number;y:number };
export type Connection = {id:string;from:string;to:string;input:string;enabled:boolean;kind:string;unit:string};
export type Fault = {id:string;targetId:string;key:string;mode:'stuck'|'drift'|'gain_change'|'leak'|'delay'|'intermittent';startStep:number;severity:number;parameter?:string;condition?:Expr};
export type Observation = {id:string;label:string;target:string;key:string;period:number;noise:number;offset:number;available:boolean;permission:'public'|'afterStep';unlockStep:number;cost:number};
export type Intervention = {id:string;label:string;target:string;parameter:string;min:number;max:number;defaultValue:number;description:string;step?:number;storage?:'parameter'|'state'};
export type Edit = {time:number;target:string;parameter:string;before:number;value:number;storage?:'parameter'|'state';purpose:'experiment'|'repair'};
export type OutputRequirement = {nodeId:string;role:string;condition:string;expected:string;rules:ContractRule[]};
export type Scenario = {behaviorCases:BehaviorCase[];outputRequirements:OutputRequirement[];id:string;title:string;description:string;symptom:string;briefing:{conditions:string;expected:string;expectedFlow:string[];difference:string;firstAction:string};inputs:ManualInput[];nodes:Node[];connections:Connection[];faults:Fault[];observations:Observation[];interventions:Intervention[];visibleNodeIds:string[];visibleConnectionIds:string[];hints:string[];solution:{rootCauseIds:string[];stableSteps:number;causalPath:string[];explanation:string;observations:string;misleading:string}};
export type ScheduledEvent = {due:number;seq:number;target:string;source:string;connectionId?:string;value:number;reason:'manual'|'input'};
export type TriggerRecord = {time:number;nodeId:string;trigger:string;value:number;requester?:string;version?:number};
export type Activity = {count:number;lastAt:number|null;lastTrigger:string};
export type ComputationFrame = {time:number|null;inputs:Record<string,number>;output:number};
export type World = {monitor:Monitor;random:Record<string,{value:number;timing:number}>;frames:Record<string,ComputationFrame>;time:number;states:Record<string,Record<string,number>>;parameters:Record<string,Record<string,number>>;past:Record<string,Record<string,number>>[];appliedFaults:string[];inputEvents:InputEvent[];edits:Edit[];verification:{elapsed:number;stable:number;cleared:boolean};pending:ScheduledEvent[];sequence:number;signals:Record<string,number>;nextDue:Record<string,number>;versions:Record<string,number>;activity:Record<string,Activity>;trace:TriggerRecord[]};
const ops = new Set(['sum','multiply','clamp','threshold','delay','integrator','filter','switch','pulse']);
export function validate(s:Scenario){
 const ids=s.nodes.map(n=>n.id), all=[...ids,...s.connections.map(e=>e.id)];
 if(new Set(all).size!==all.length)throw Error('重複したID');
 if(!s.nodes.some(n=>n.kind==='input')||!s.nodes.some(n=>n.kind==='output')||s.nodes.some(n=>!['input','output','inner'].includes(n.kind)))throw Error('不正なノード種別');
 if(new Set(s.inputs.map(i=>i.id)).size!==s.inputs.length)throw Error('重複した入力ID');
 for(const i of s.inputs){const node=s.nodes.find(n=>n.id===i.nodeId);if(!node||node.kind!=='input'||node.externalInput||!(i.parameter in node.parameters)||i.min>i.max||!Number.isFinite(i.step)||i.step<=0||!Number.isFinite(i.min)||!Number.isFinite(i.max)||i.defaultValue!==node.parameters[i.parameter]||i.defaultValue<i.min||i.defaultValue>i.max)throw Error('不正な手動入力');if(s.interventions.some(e=>e.target===i.nodeId&&e.parameter===i.parameter))throw Error('通常入力と修復編集の重複');}
 if(s.nodes.some(n=>n.kind==='input'&&!n.externalInput&&!s.inputs.some(i=>i.nodeId===n.id)))throw Error('操作できない入力ノード');
 if(s.nodes.some(n=>n.kind==='output'&&!s.observations.some(o=>o.target===n.id&&o.available&&o.permission==='public')))throw Error('観測できない出力ノード');
 for(const node of s.nodes){const x=node.externalInput;if(!x)continue;const v=x.value;
  if(node.kind!=='input'||!Number.isInteger(x.seed)||x.seed<0||x.seed>0xffffffff||!v||!['uniform','fixed'].includes(v.type)||(v.type==='uniform'?(!Number.isFinite(v.min)||!Number.isFinite(v.max)||v.min>v.max||Math.max(Math.abs(v.min),Math.abs(v.max))>1e9):(!Number.isFinite(v.value)||Math.abs(v.value)>1e9)))throw Error('不正な外乱定義');
  if(s.interventions.some(i=>i.target===node.id)||s.inputs.some(i=>i.nodeId===node.id))throw Error('外乱INPUTは編集禁止です');
 }
 for(const node of s.nodes)if(node.trigger.type==='random'&&(!node.externalInput||!Number.isInteger(node.trigger.minInterval)||!Number.isInteger(node.trigger.maxInterval)||node.trigger.minInterval!<1||node.trigger.maxInterval!<node.trigger.minInterval!||node.trigger.maxInterval!>512))throw Error('不正なランダム発火間隔');
 const check=(e:Expr)=>{if(typeof e==='number'){if(!Number.isFinite(e))throw Error('不正な数値');return;}if('ref'in e){if(!/^(state|param|input)\.[\w]+$/.test(e.ref)&&e.ref!=='time')throw Error('不正な参照');return;}if(!ops.has(e.op)||!Array.isArray(e.args))throw Error('未知のプリミティブ');const arity:Record<string,number>={clamp:3,threshold:2,delay:1,integrator:2,filter:3,switch:3,pulse:4};if((arity[e.op]!==undefined&&e.args.length!==arity[e.op])||e.args.length===0)throw Error('プリミティブの引数数が不正');e.args.forEach(check);};
 s.nodes.forEach(n=>{if(!n.trigger||!(n.kind==='input'?(n.externalInput?['timer','random']:['manual','timer']):n.kind==='inner'?['request','input','timer']:['input']).includes(n.trigger.type))throw Error('不正なトリガー');if(n.trigger.type==='timer'&&(!n.trigger.periodParameter||!Number.isInteger(n.parameters[n.trigger.periodParameter])||n.parameters[n.trigger.periodParameter]<1))throw Error('タイマー周期は正の整数プロパティです');if(n.kind==='input'&&!n.externalInput&&(!n.inputParameter||!(n.inputParameter in n.parameters)))throw Error('入力値プロパティがありません');if(Object.values({...n.initialState,...n.parameters}).some(v=>!Number.isFinite(v)))throw Error('不正なノード数値');if(Object.keys(n.update).some(k=>!(k in n.initialState)))throw Error('未定義の状態');Object.values(n.update).forEach(check);for(const e of Object.values(n.update)){const walk=(v:Expr)=>{if(typeof v==='number')return;if('ref'in v){const [kind,key]=v.ref.split('.');if(kind==='state'&&!(key in n.initialState)||kind==='param'&&!(key in n.parameters)||kind==='input'&&!s.connections.some(c=>c.to===n.id&&c.input===key))throw Error('不正な参照先');}else v.args.forEach(walk);};walk(e);}});
 if(s.connections.some(e=>s.nodes.find(n=>n.id===e.to)?.kind==='input'))throw Error('inputノードへの接続は禁止です');
 if(s.connections.some(e=>e.kind==='request'&&s.nodes.find(n=>n.id===e.from)?.trigger.type!=='request'))throw Error('問い合わせ先はrequest triggerのinnerです');
 const visiting=new Set<string>(),visited=new Set<string>();const visit=(id:string)=>{if(visiting.has(id))throw Error('問い合わせの循環を検出しました');if(visited.has(id))return;visiting.add(id);s.connections.filter(e=>e.kind==='request'&&e.to===id).forEach(e=>visit(e.from));visiting.delete(id);visited.add(id);};s.nodes.forEach(n=>visit(n.id));
 if(s.connections.some(e=>s.nodes.find(n=>n.id===e.from)?.kind==='output'))throw Error('outputノードは終端である必要があります');
 s.connections.forEach(e=>{if(!ids.includes(e.from)||!ids.includes(e.to)||typeof e.enabled!=='boolean'||['gain','delaySteps','state','key'].some(key=>key in e))throw Error('不正な接続');});
 s.observations.forEach(o=>{const node=s.nodes.find(n=>n.id===o.target),edge=s.connections.find(e=>e.id===o.target);if(!all.includes(o.target)||!Number.isInteger(o.period)||o.period<1||!Number.isFinite(o.noise)||!Number.isFinite(o.offset)||o.noise<0||!(node?o.key in node.initialState:edge&&o.key==='value'))throw Error('不正な観測');});
 s.faults.forEach(f=>{if(!ids.includes(f.targetId)||!Number.isFinite(f.severity)||!Number.isInteger(f.startStep)||f.startStep<0||!['stuck','drift','gain_change','leak','delay','intermittent'].includes(f.mode)||(f.mode==='delay'&&(!Number.isInteger(f.severity)||f.severity<0)))throw Error('不正な故障対象');if(f.condition)check(f.condition);});
 s.interventions.forEach(i=>{if(i.storage==='state'){const node=s.nodes.find(n=>n.id===i.target);if(!node||node.kind!=='inner'||!(i.parameter in node.initialState)||i.min>i.max)throw Error('不正な状態編集');return;}if(!all.includes(i.target)||i.min>i.max||i.defaultValue<i.min||i.defaultValue>i.max||!(s.nodes.find(n=>n.id===i.target)?.parameters.hasOwnProperty(i.parameter)??i.parameter==='enabled'))throw Error('不正な介入');});
 if(!Number.isInteger(s.solution.stableSteps)||s.solution.stableSteps<1||!s.behaviorCases?.length||!s.outputRequirements?.length)throw Error('不正な動作検証定義');
 for(const row of s.outputRequirements)if(!s.nodes.some(n=>n.id===row.nodeId&&n.kind==='output')||!row.rules.length)throw Error('不正な出力条件');
 for(const n of s.nodes.filter(n=>n.kind==='output'))if(s.outputRequirements.filter(r=>r.nodeId===n.id).length!==1)throw Error('出力条件が不足しています');
 for(const test of s.behaviorCases)if(!Number.isInteger(test.steps)||test.steps<1||test.inputs.some(i=>!s.inputs.some(x=>x.id===i.id&&validValue(x,i.value))||!Number.isInteger(i.time)||i.time<0||i.time>=test.steps))throw Error('不正な検証入力');
 s.faults.filter(f=>f.parameter).forEach(f=>{const node=s.nodes.find(n=>n.id===f.targetId);if(!node||!(f.parameter! in node.parameters))throw Error('不正な故障パラメータ');});
 validateContracts(s);
 if(s.visibleNodeIds.some(id=>!ids.includes(id))||s.visibleConnectionIds.some(id=>!s.connections.some(e=>e.id===id)))throw Error('不正な公開グラフ');
}

const copy = <T,>(value:T):T => structuredClone(value);
function evaluate(e:Expr,state:Record<string,number>,param:Record<string,number>,input:Record<string,number>,time:number):number {
 if(typeof e==='number')return e;
 if('ref'in e){const [kind,key]=e.ref.split('.');return kind==='time'?time:({state,param,input}[kind]?.[key]??0);}
 const a=e.args.map(v=>evaluate(v,state,param,input,time));
 switch(e.op){case 'sum':return a.reduce((x,y)=>x+y,0);case 'multiply':return a.reduce((x,y)=>x*y,1);case 'clamp':return Math.max(a[1],Math.min(a[2],a[0]));case 'threshold':return Number(a[0]>=a[1]);case 'delay':return a[0];case 'integrator':return a[0]+a[1];case 'filter':return a[0]+a[2]*(a[1]-a[0]);case 'switch':return a[0]?a[1]:a[2];case 'pulse':return time%Math.max(1,a[0])<a[1]?a[2]:a[3];}
}
const checked=(v:number)=>{if(!Number.isFinite(v)||Math.abs(v)>1e9)throw Error('計算が安定範囲を超えました。リセットして設定を確認してください。');return v;};
const period=(n:Node,w:World)=>{const p=w.parameters[n.id][n.trigger.periodParameter!];if(!Number.isInteger(p)||p<1||p>512)throw Error('タイマー周期は1〜512の整数で指定してください');return p;};
function draw(w:World,id:string,stream:'value'|'timing'){const state=w.random[id];state[stream]=(Math.imul(state[stream],1664525)+1013904223)>>>0;return state[stream]/4294967296;}
function interval(n:Node,w:World){return n.trigger.type==='random'?n.trigger.minInterval!+Math.floor(draw(w,n.id,'timing')*(n.trigger.maxInterval!-n.trigger.minInterval!+1)):period(n,w);}
function externalValue(n:Node,w:World){const v=n.externalInput!.value;return checked(v.type==='fixed'?v.value:v.min+(v.max-v.min)*draw(w,n.id,'value'));}
export function createWorld(s:Scenario):World {
 validate(s);
 const w:World={monitor:{history:[],alerts:{},logs:[],ready:false},random:{},frames:{},time:0,states:Object.fromEntries([...s.nodes.map(n=>[n.id,copy(n.initialState)]),...s.connections.map(e=>[e.id,{value:0}])]),parameters:Object.fromEntries([...s.nodes.map(n=>[n.id,copy(n.parameters)]),...s.connections.map(e=>[e.id,{enabled:Number(e.enabled)}])]),past:[],appliedFaults:[],inputEvents:[],edits:[],verification:{elapsed:0,stable:0,cleared:false},pending:[],sequence:0,signals:{},nextDue:{},versions:Object.fromEntries(s.nodes.map(n=>[n.id,0])),activity:Object.fromEntries(s.nodes.map(n=>[n.id,{count:0,lastAt:null,lastTrigger:'未発火'}])),trace:[]};
 materializeFaults(s,w);
 initializeRelations(s,w);
 for(const n of [...s.nodes].sort((a,b)=>a.id.localeCompare(b.id))){if(n.externalInput)w.random[n.id]={value:n.externalInput.seed>>>0,timing:(n.externalInput.seed^0x9e3779b9)>>>0};if(n.trigger.type==='timer'||n.trigger.type==='random')w.nextDue[n.id]=interval(n,w);}
 updateMonitor(s,w);return w;
}
function initializeRelations(s:Scenario,w:World){
 for(const e of s.connections){const value=w.parameters[e.id].enabled?w.states[e.from].value:0;w.signals[e.id]=value;w.states[e.id].value=value;}
 for(const n of s.nodes)w.frames[n.id]={time:null,inputs:Object.fromEntries(s.connections.filter(e=>e.to===n.id).map(e=>[e.id,w.signals[e.id]])),output:w.states[n.id].value};
}
function withInitialStateEdits(s:Scenario,w:World):Scenario {
 const next=copy(s);
 for(const edit of w.edits.filter(e=>e.storage==='state')){const n=next.nodes.find(n=>n.id===edit.target);if(n)n.initialState[edit.parameter]=edit.value;}
 return next;
}
function materializeFaults(s:Scenario,w:World){
 for(const f of s.faults){
  if(!f.parameter||w.appliedFaults.includes(f.id)||w.time<f.startStep||f.condition&&!evaluate(f.condition,w.states[f.targetId],w.parameters[f.targetId],{},w.time))continue;
  const p=w.parameters[f.targetId],value=p[f.parameter];
  p[f.parameter]=checked(f.mode==='gain_change'?value*f.severity:f.mode==='stuck'?f.severity:f.mode==='leak'?value-f.severity:value+f.severity);
  if(f.targetId in w.versions)w.versions[f.targetId]++;
  w.appliedFaults.push(f.id);
 }
}
function activeFaults(s:Scenario,w:World,id:string){return s.faults.filter(f=>!f.parameter&&f.targetId===id&&w.time>=f.startStep&&(!f.condition||evaluate(f.condition,w.states[id],w.parameters[id],{},w.time)));}
function applyFault(value:number,f:Fault,w:World){switch(f.mode){case 'stuck':return f.severity;case 'drift':return value+f.severity;case 'gain_change':return value*f.severity;case 'leak':return value-f.severity;case 'intermittent':return w.time%4<2?value*f.severity:value;case 'delay':return value;}}
function record(w:World,n:Node,trigger:string,value:number,requester?:string){
 const a=w.activity[n.id];a.count++;a.lastAt=w.time;a.lastTrigger=trigger;
 w.trace.push({time:w.time,nodeId:n.id,trigger,value,requester,version:w.versions[n.id]});
}
function inputsFor(s:Scenario,w:World,n:Node,stack:string[],ports:Record<string,number>):Record<string,number>{
 const input:Record<string,number>={};
 for(const e of [...s.connections].filter(e=>e.to===n.id).sort((a,b)=>a.id.localeCompare(b.id))){
  let v=w.parameters[e.id].enabled?(w.signals[e.id]??0):0;
  if(e.kind==='request'){
   v=0;
   if(w.parameters[e.id].enabled){
    const provider=s.nodes.find(node=>node.id===e.from)!;
    v=processNode(s,w,provider,'request',stack,n.id);
    checked(v);w.signals[e.id]=v;w.states[e.id].value=v;
    w.trace.push({time:w.time,nodeId:n.id,trigger:'fetch',requester:e.from,value:v,version:w.versions[e.from]});
   }
  }
  ports[e.id]=v;input[e.input]=(input[e.input]??0)+v;
 }
 return input;
}
function processNode(s:Scenario,w:World,n:Node,reason:string,stack:string[]=[],requester?:string):number {
 if(stack.includes(n.id))throw Error('問い合わせの循環を検出しました');
 const old={...w.states[n.id]},ports:Record<string,number>={};const input=inputsFor(s,w,n,[...stack,n.id],ports);
 const next={...old};for(const [key,expr]of Object.entries(n.update))next[key]=checked(evaluate(expr,old,w.parameters[n.id],input,w.time));
 for(const f of activeFaults(s,w,n.id))next[f.key]=checked(applyFault(next[f.key],f,w));
 if(Object.keys(next).some(k=>next[k]!==old[k]))w.versions[n.id]++;
 w.states[n.id]=next;w.frames[n.id]={time:w.time,inputs:ports,output:next.value};record(w,n,reason,next.value,requester);return next.value;
}
function emit(s:Scenario,w:World,n:Node,value:number){
 for(const e of s.connections.filter(e=>e.from===n.id&&e.kind!=='request').sort((a,b)=>a.id.localeCompare(b.id))){
  const p=w.parameters[e.id];if(!p.enabled)continue;
  const v=value;const delay=activeFaults(s,w,n.id).filter(f=>f.mode==='delay').reduce((sum,f)=>sum+f.severity,0);
  checked(v);if(!Number.isInteger(delay)||delay<0||delay>512)throw Error('ノードの出力遅延の範囲外です');
  w.states[e.id].value=v;
  w.pending.push({due:w.time+1+delay,seq:w.sequence++,target:e.to,source:n.id,connectionId:e.id,value:v,reason:'input'});
 }
}
export function step(s:Scenario,world:World,verify=true):World {
 // Local clone provides atomic failure: the caller's world is never half updated.
 const w=copy({...world,past:[]});w.time=world.time+1;materializeFaults(s,w);
 const due=w.pending.filter(e=>e.due<=w.time).sort((a,b)=>a.due-b.due||a.seq-b.seq);w.pending=w.pending.filter(e=>e.due>w.time);
 if(due.length>20000)throw Error('同一ステップのイベント数が上限を超えました。接続を確認してください。');
 for(const event of due){
  const n=s.nodes.find(n=>n.id===event.target)!;
  if(event.reason==='manual'){
   w.states[n.id].value=checked(event.value);w.versions[n.id]++;w.frames[n.id]={time:w.time,inputs:{},output:event.value};record(w,n,'manual',event.value);emit(s,w,n,event.value);continue;
  }
  if(!w.parameters[event.connectionId!]?.enabled)continue;
  w.signals[event.connectionId!]=event.value;
  if(n.kind==='output'){
   if(w.states[n.id].value!==event.value)w.versions[n.id]++;
   w.states[n.id].value=event.value;w.frames[n.id]={time:w.time,inputs:Object.fromEntries(s.connections.filter(e=>e.to===n.id).map(e=>[e.id,w.signals[e.id]])),output:event.value};record(w,n,'receive',event.value);
  }else if(n.trigger.type==='input')emit(s,w,n,processNode(s,w,n,'input'));
 }
 // Timer processors use the latest delivered inputs at this tick. Timer order is
 // canonical; nothing they emit is delivered in the same tick.
 for(const n of [...s.nodes].sort((a,b)=>a.id.localeCompare(b.id))){
  if(!['timer','random'].includes(n.trigger.type)||w.nextDue[n.id]>w.time)continue;
  w.nextDue[n.id]=w.time+interval(n,w);
  if(n.kind==='input'){
   const v=n.externalInput?externalValue(n,w):checked(w.parameters[n.id][n.inputParameter!]);if(w.states[n.id].value!==v)w.versions[n.id]++;w.states[n.id].value=v;w.frames[n.id]={time:w.time,inputs:{},output:v};record(w,n,n.trigger.type,v);emit(s,w,n,v);
  }else emit(s,w,n,processNode(s,w,n,'timer'));
 }
 if(w.pending.length>50000)throw Error('待機イベントが上限を超えました。接続を確認してください。');
 w.trace=w.trace.slice(-400);updateMonitor(s,w);if(verify)w.verification=verifyBehavior(s,w);return w;
}
export function validateBehavior(s:Scenario,candidate:World){
 for(const test of s.behaviorCases){
  const sc=withInitialStateEdits(s,candidate);if(test.seed!==undefined)for(const n of sc.nodes)if(n.externalInput)n.externalInput.seed=test.seed;
  let w=createWorld(sc);w.parameters=copy(candidate.parameters);for(const i of sc.inputs)w.parameters[i.nodeId][i.parameter]=i.defaultValue;w.appliedFaults=sc.faults.filter(f=>f.parameter).map(f=>f.id);initializeRelations(sc,w);
  for(const n of sc.nodes)if(n.trigger.type==='timer')w.nextDue[n.id]=period(n,w);
  for(let t=0;t<test.steps;t++){
   for(const input of test.inputs.filter(i=>i.time===t))w=setInput(sc,w,input.id,input.value);
   try{w=step(sc,w,false);}catch{return {passed:false,time:candidate.time,failedCase:test.name,caseTime:w.time,issues:[]};}
   const result=checkOutputs(sc,w);if(result.issues.length)return {passed:false,time:candidate.time,failedCase:test.name,caseTime:w.time,issues:result.issues};
  }
  if(!w.monitor.ready)return {passed:false,time:candidate.time,failedCase:test.name,caseTime:w.time,issues:[]};
 }
 return {passed:true,time:candidate.time,issues:[]};
}
function verifyBehavior(s:Scenario,w:World):World['verification']{
 const elapsed=w.verification.elapsed+1;
 if(!w.monitor.ready||Object.keys(w.monitor.alerts).length)return {elapsed,stable:0,cleared:false};
 if(w.verification.cleared)return {...w.verification,elapsed};
 const fingerprint=JSON.stringify({parameters:w.parameters,initialEdits:w.edits.filter(e=>e.storage==='state')});if(w.monitor.lastValidation?.passed===false&&w.monitor.lastValidation.fingerprint===fingerprint)return {elapsed,stable:0,cleared:false};
 const stable=w.verification.stable+1;
 if(stable<s.solution.stableSteps)return {elapsed,stable,cleared:false};
 const validation=validateBehavior(s,w);w.monitor.lastValidation={...validation,fingerprint};
 return {elapsed,stable:validation.passed?stable:0,cleared:validation.passed};
}
function validValue(i:{min:number;max:number;step?:number},value:number){return Number.isFinite(value)&&value>=i.min&&value<=i.max&&(!i.step||Math.abs((value-i.min)/i.step-Math.round((value-i.min)/i.step))<1e-7);}
export function setInput(s:Scenario,world:World,id:string,value:number):World {
 const i=s.inputs.find(i=>i.id===id);if(i&&s.nodes.find(n=>n.id===i.nodeId)?.externalInput)throw Error('外乱INPUTは編集禁止です');if(!i||!validValue(i,value))throw Error('入力値が範囲外です');
 const before=world.parameters[i.nodeId][i.parameter];if(before===value)return world;
 const w=copy(world),n=s.nodes.find(n=>n.id===i.nodeId)!;w.parameters[n.id][i.parameter]=value;w.versions[n.id]++;
 w.inputEvents.push({id,time:w.time,before,value});w.verification={elapsed:0,stable:0,cleared:false};delete w.monitor.lastValidation;
 if(n.trigger.type==='manual'&&i.parameter===n.inputParameter)w.pending.push({due:w.time+1,seq:w.sequence++,target:n.id,source:'user',value,reason:'manual'});
 if(n.trigger.type==='timer'&&i.parameter===n.trigger.periodParameter)w.nextDue[n.id]=w.time+interval(n,w);
 return w;
}
export function intervene(s:Scenario,world:World,id:string,value:number,purpose:Edit['purpose']='experiment'):World {
 const i=s.interventions.find(i=>i.id===id);if(i&&s.nodes.find(n=>n.id===i.target)?.externalInput)throw Error('外乱INPUTは編集禁止です');if(!i||!validValue(i,value))throw Error('編集値が範囲外です');
 const storage=i.storage==='state'?'states':'parameters',before=world[storage][i.target][i.parameter];if(before===value)return world;
 const w=copy(world);w[storage][i.target][i.parameter]=value;if(i.target in w.versions)w.versions[i.target]++;
 w.edits.push({time:w.time,target:i.target,parameter:i.parameter,before,value,purpose,storage:i.storage??'parameter'});w.verification={elapsed:0,stable:0,cleared:false};delete w.monitor.lastValidation;
 const edge=s.connections.find(e=>e.id===i.target);
 if(edge&&i.parameter==='enabled'){w.signals[edge.id]=0;w.states[edge.id].value=0;w.pending=w.pending.filter(e=>e.connectionId!==edge.id);}
 const n=s.nodes.find(n=>n.id===i.target);if(n?.trigger.type==='timer'&&i.parameter===n.trigger.periodParameter)w.nextDue[n.id]=w.time+interval(n,w);
 return w;
}
export function observe(s:Scenario,w:World,id:string):number|null {
 const o=s.observations.find(o=>o.id===id);if(!o||!o.available||o.permission==='afterStep'&&w.time<o.unlockStep||w.time%o.period!==0)return null;
 const seed=[...id].reduce((a,c)=>a+c.charCodeAt(0),0);return w.states[o.target][o.key]+o.offset+Math.sin((w.time+1)*12.9898+seed)*o.noise;
}
export function requestNode(s:Scenario,world:World,id:string):{world:World;value:number}{
 const node=s.nodes.find(n=>n.id===id);if(!node||node.kind!=='inner'||node.trigger.type!=='request')throw Error('問い合わせできるノードではありません');
 const w=copy(world);const value=processNode(s,w,node,'request',[],'inspector');w.trace=w.trace.slice(-400);return {world:w,value};
}
export function restartWithSettings(s:Scenario,w:World):World {
 const next=createWorld(withInitialStateEdits(s,w));next.parameters=copy(w.parameters);initializeRelations(s,next);next.appliedFaults=[...w.appliedFaults];next.edits=copy(w.edits);
 for(const n of s.nodes)if(n.trigger.type==='timer')next.nextDue[n.id]=period(n,next);
 for(const i of s.inputs)if(next.parameters[i.nodeId][i.parameter]!==i.defaultValue){
  next.inputEvents.push({id:i.id,time:0,before:i.defaultValue,value:next.parameters[i.nodeId][i.parameter]});
  const n=s.nodes.find(n=>n.id===i.nodeId)!;
  if(n.trigger.type==='manual'&&i.parameter===n.inputParameter)next.pending.push({due:1,seq:next.sequence++,target:n.id,source:'user',value:next.parameters[n.id][i.parameter],reason:'manual'});
 }
 return next;
}
export const outputObservationIds=(s:Scenario)=>s.observations.filter(o=>s.nodes.some(n=>n.id===o.target&&n.kind==='output')&&o.available).map(o=>o.id);
