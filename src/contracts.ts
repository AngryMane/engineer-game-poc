export type ContractExpr=number|{source:'input'|'output'|'external';id:string;lag?:number;initial?:number}|{op:'sum'|'multiply'|'clamp'|'pulse'|'threshold'|'switch';args:ContractExpr[]};
export type ContractRule={kind:'equals';expected:ContractExpr;startAt?:number;afterInput?:{id:string;steps:number}}|{kind:'range';min:ContractExpr;max:ContractExpr;startAt?:number;afterInput?:{id:string;steps:number}}|{kind:'response';inputId:string;active:number;inactive:number;activateAfter:number;deactivateAfter:number};
export type BehaviorCase={name:string;steps:number;inputs:{time:number;id:string;value:number}[];seed?:number};
export type OutputIssue={nodeId:string;expected:string;actual:number;rule:number};
export type OutputLog={time:number;nodeId:string;type:'onset'|'recovery';issues:OutputIssue[]};
export type Monitor={history:{time:number;values:Record<string,number>}[];alerts:Record<string,OutputIssue[]>;logs:OutputLog[];ready:boolean;lastValidation?:{passed:boolean;time:number;failedCase?:string;caseTime?:number;issues:OutputIssue[];fingerprint?:string}};
import type {Scenario,World} from './engine';
const fmt=(v:number)=>Number(v.toFixed(4)).toString();
export function expressionLabel(e:ContractExpr):string{
 if(typeof e==='number')return fmt(e);
 if('source'in e)return `${e.id}${e.lag?`[${e.lag}ステップ前]`:''}`;
 const a=e.args.map(expressionLabel);return e.op==='sum'?`(${a.join(' + ')})`:e.op==='multiply'?`(${a.join(' × ')})`:e.op==='clamp'?`max(${a[1]}, min(${a[0]}, ${a[2]}))`:e.op==='threshold'?`(${a[0]} ≥ ${a[1]} ? 1 : 0)`:e.op==='switch'?`(${a[0]} ≠ 0 ? ${a[1]} : ${a[2]})`:`((t − ${a[3]}) mod ${a[0]} < ${a[1]} ? ${a[2]} : 0)`;
}
export function ruleLabel(r:ContractRule):string{const prefix='startAt'in r&&r.startAt?`t≥${r.startAt}から：`:'';return r.kind==='response'?`${r.inputId}を1に変更して${r.activateAfter}ステップ後：${r.active}、0に変更して${r.deactivateAfter}ステップ後：${r.inactive}`:r.kind==='range'?`${prefix}${expressionLabel(r.min)}〜${expressionLabel(r.max)}`:`${prefix}${expressionLabel(r.expected)}`;}
function inputAt(s:Scenario,w:World,id:string,time:number){return [...w.inputEvents].reverse().find(e=>e.id===id&&e.time<=time)?.value??s.inputs.find(i=>i.id===id)?.defaultValue??0;}
function value(e:ContractExpr,s:Scenario,w:World):number{
 if(typeof e==='number')return e;
 if('source'in e){const time=w.time-(e.lag??0);if(e.source==='input')return inputAt(s,w,e.id,time);return w.monitor.history.find(h=>h.time===time)?.values[e.id]??e.initial??NaN;}
 const a=e.args.map(x=>value(x,s,w));return e.op==='sum'?a.reduce((x,y)=>x+y,0):e.op==='multiply'?a.reduce((x,y)=>x*y,1):e.op==='clamp'?Math.max(a[1],Math.min(a[2],a[0])):e.op==='threshold'?Number(a[0]>=a[1]):e.op==='switch'?(a[0]?a[1]:a[2]):((w.time-a[3])%a[0]+a[0])%a[0]<a[1]?a[2]:0;
}
export function checkOutputs(s:Scenario,w:World):{issues:OutputIssue[];ready:boolean}{
 const issues:OutputIssue[]=[];let ready=true;
 for(const row of s.outputRequirements)for(const [index,r]of row.rules.entries()){
  if('startAt'in r&&w.time<(r.startAt??0)||'afterInput'in r&&r.afterInput&&w.inputEvents.some(e=>e.id===r.afterInput!.id&&w.time-e.time<r.afterInput!.steps)){ready=false;continue;}
  const actual=w.states[row.nodeId].value;let lo:number,hi:number;
  if(r.kind==='response'){lo=r.inactive;for(const event of w.inputEvents.filter(e=>e.id===r.inputId)){if(w.time>=event.time+(event.value===1?r.activateAfter:r.deactivateAfter))lo=event.value===1?r.active:r.inactive;}hi=lo;}
  else if(r.kind==='range'){lo=value(r.min,s,w);hi=value(r.max,s,w);}else lo=hi=value(r.expected,s,w);
  if(!Number.isFinite(lo)||!Number.isFinite(hi)){ready=false;continue;}
  if(!Number.isFinite(actual)||actual<lo-1e-7||actual>hi+1e-7)issues.push({nodeId:row.nodeId,expected:lo===hi?fmt(lo):`${fmt(lo)}〜${fmt(hi)}`,actual,rule:index});
 }
 return {issues,ready};
}
export function updateMonitor(s:Scenario,w:World){
 const m=w.monitor;m.history.push({time:w.time,values:Object.fromEntries(s.nodes.map(n=>[n.id,w.states[n.id].value]))});m.history=m.history.slice(-513);
 const {issues,ready}=checkOutputs(s,w),alerts:Monitor['alerts']={};for(const issue of issues)(alerts[issue.nodeId]??=[]).push(issue);
 for(const id of new Set([...Object.keys(m.alerts),...Object.keys(alerts)])){
  if(alerts[id]&&!m.alerts[id])m.logs.push({time:w.time,nodeId:id,type:'onset',issues:structuredClone(alerts[id])});
  if(!alerts[id]&&m.alerts[id])m.logs.push({time:w.time,nodeId:id,type:'recovery',issues:m.alerts[id].map(issue=>({...issue,actual:w.states[id].value}))});
 }
 m.alerts=alerts;m.ready=ready;
}
export function validateContracts(s:Scenario){
 const expression=(e:ContractExpr):void=>{
  if(typeof e==='number'){if(!Number.isFinite(e))throw Error('不正な出力式');return;}
  if(!e||typeof e!=='object')throw Error('不正な出力式');
  if('source'in e){if(!Number.isInteger(e.lag??0)||(e.lag??0)<0||(e.lag??0)>512||e.initial!==undefined&&!Number.isFinite(e.initial))throw Error('不正な出力式の遅延');const ok=e.source==='input'?s.inputs.some(i=>i.id===e.id):e.source==='external'?s.nodes.some(n=>n.id===e.id&&n.externalInput):e.source==='output'&&s.nodes.some(n=>n.id===e.id&&n.kind==='output');if(!ok)throw Error('不正な出力式の参照先');return;}
  if(!['sum','multiply','clamp','pulse','threshold','switch'].includes(e.op)||!Array.isArray(e.args)||!e.args.length||e.op==='clamp'&&e.args.length!==3||e.op==='pulse'&&e.args.length!==4||e.op==='threshold'&&e.args.length!==2||e.op==='switch'&&e.args.length!==3)throw Error('不正な出力式');e.args.forEach(expression);
 };
 for(const row of s.outputRequirements)for(const r of row.rules){if(r.kind==='response'){if(!s.inputs.some(i=>i.id===r.inputId)||![r.active,r.inactive].every(Number.isFinite)||![r.activateAfter,r.deactivateAfter].every(v=>Number.isInteger(v)&&v>=1&&v<=512))throw Error('不正な応答条件');continue;}if(!Number.isInteger(r.startAt??0)||(r.startAt??0)<0||r.afterInput&&(!s.inputs.some(i=>i.id===r.afterInput!.id)||!Number.isInteger(r.afterInput.steps)||r.afterInput.steps<0))throw Error('不正な出力待ち条件');if(r.kind==='equals')expression(r.expected);else if(r.kind==='range'){expression(r.min);expression(r.max);}else throw Error('不正な出力条件');}
 for(const c of s.behaviorCases)if(c.seed!==undefined&&(!Number.isInteger(c.seed)||c.seed<0||c.seed>0xffffffff))throw Error('不正な検証シード');
}
