import type {Expr,Scenario,World} from './engine';
import type {BehaviorCase,ContractRule} from './contracts';
import {expressionText} from './expressionFormat';

export type BoundaryBinding = {kind:'output';nodeId:string}|{kind:'input';connectionId:string}|{kind:'control';inputId:string}|{kind:'source';nodeId:string};
export type ModulePort = {id:string;label:string;direction:'in'|'out';description:string;binding:BoundaryBinding;observable:boolean};
export type ModuleSpec = {condition:string;expected:string;timing:string;assumptions:string;relations:{output:string;expression:Expr}[];outputs?:{portId:string;condition:string;expected:string;timing:string;rules?:ContractRule[]}[];cases?:BehaviorCase[]};
export type Module = {id:string;label:string;description:string;nodes:string[];children:string[];ports:ModulePort[];spec:ModuleSpec};
export type Hierarchy = {systemId?:string;roots:string[];modules:Module[];inputs:{inputId:string;moduleId:string;portId:string;label:string}[];outputs:{nodeId:string;moduleId:string;portId:string;label:string}[]};
export type HierarchyView = {scope:string|null;selected:string|null};
export type BoundaryValue = {value:number;time:number|null;method:'設定値'|'計算時の入力'|'計算出力'};
const number=(v:number)=>Number(v.toFixed(4)).toString();
export const boundaryKey=(moduleId:string,portId:string)=>`port:${moduleId}.${portId}`;
export function moduleById(s:Scenario,id:string){return s.hierarchy!.modules.find(m=>m.id===id)!;}
export function descendants(s:Scenario,id:string):string[]{const m=moduleById(s,id);return [...m.nodes,...m.children.flatMap(child=>descendants(s,child))];}
export function parentOf(s:Scenario,id:string){return s.hierarchy!.modules.find(m=>m.children.includes(id));}
export function scopeItems(s:Scenario,scope:string|null){const id=scope??s.hierarchy?.systemId;const m=id?moduleById(s,id):null;return {modules:m?.children??s.hierarchy!.roots,nodes:m?.nodes??[]};}
export function modulePath(s:Scenario,scope:string|null):Module[]{if(!scope)return [];const parent=parentOf(s,scope);return [...modulePath(s,parent?.id??null),moduleById(s,scope)].filter(m=>m.id!==s.hierarchy?.systemId);}
export function readBoundary(s:Scenario,w:World,port:ModulePort):BoundaryValue {
 const b=port.binding;
 if(b.kind==='output'||b.kind==='source'){const frame=w.frames[b.nodeId];return {value:frame.output,time:frame.time,method:'計算出力'};}
 if(b.kind==='control'){const input=s.inputs.find(i=>i.id===b.inputId)!;return {value:w.parameters[input.nodeId][input.parameter],time:[...w.inputEvents].reverse().find(e=>e.id===b.inputId)?.time??null,method:'設定値'};}
 const edge=s.connections.find(e=>e.id===b.connectionId)!,frame=w.frames[edge.to];return {value:frame.inputs[edge.id],time:frame.time,method:'計算時の入力'};
}
export function boundaryText(s:Scenario,w:World,p:ModulePort){if(!p.observable)return 'unobserved';const v=readBoundary(s,w,p);return `${number(v.value)} ／ ${v.time===null?'initial':`t=${v.time}`} · ${{'設定値':'set','計算時の入力':'consumed','計算出力':'computed'}[v.method]}`;}
export function moduleExpression(m:Module,e:Expr){return expressionText(e);}
export function publicLabels(s:Scenario):Record<string,string>{return Object.fromEntries([...(s.hierarchy?.modules.filter(m=>s.hierarchy!.roots.includes(m.id)).flatMap(m=>m.ports.filter(p=>p.observable&&p.binding.kind==='output').map(p=>[(p.binding as {nodeId:string}).nodeId,`${m.label} / ${p.label}`]))??[]),...(s.hierarchy?.inputs.map(p=>[p.inputId,p.label])??[]),...(s.hierarchy?.outputs.map(p=>[p.nodeId,p.label])??[])]);}
export function publicText(s:Scenario,text:string){let result=text;for(const [id,label]of Object.entries(publicLabels(s)).sort((a,b)=>b[0].length-a[0].length))result=result.replaceAll(id,label);return result.replaceAll('「入力を反映」','Apply').replaceAll('「設定を保持して再実行」','Restart');}
export function visibleSeries(s:Scenario,scope:string|null){
 const items=scopeItems(s,scope),modules=[...(scope?[scope]:[]),...items.modules];
 return [...modules.flatMap(id=>moduleById(s,id).ports.filter(p=>p.observable).map(p=>({id:boundaryKey(id,p.id),label:`${moduleById(s,id).label} / ${p.label}`}))),...s.observations.filter(o=>items.nodes.includes(o.target)||s.connections.some(e=>e.id===o.target&&items.nodes.includes(e.from)&&items.nodes.includes(e.to))).map(o=>({id:o.id,label:o.label}))];
}
export type ProjectedEndpoint={item:string;port:string;label:string};
export type ProjectedConnection={id:string;connectionId:string;from:ProjectedEndpoint;to:ProjectedEndpoint;request:boolean;enabled:boolean};
export function projectConnections(s:Scenario,w:World|undefined,scope:string|null):ProjectedConnection[]{
 const items=scopeItems(s,scope),inside=scope?new Set(descendants(s,scope)):new Set(s.nodes.map(n=>n.id));
 const endpoint=(nodeId:string,edgeId:string,direction:'in'|'out'):ProjectedEndpoint|null=>{
  if(items.nodes.includes(nodeId))return {item:nodeId,port:direction==='out'?'output':edgeId,label:direction==='out'?'output':s.connections.find(e=>e.id===edgeId)!.input};
  const child=items.modules.find(id=>descendants(s,id).includes(nodeId));
  if(child){const port=moduleById(s,child).ports.find(p=>p.direction===direction&&(direction==='out'?p.binding.kind==='output'&&p.binding.nodeId===nodeId:p.binding.kind==='input'&&p.binding.connectionId===edgeId));return port?{item:child,port:port.id,label:port.label}:null;}
  return null;
 };
 const result:ProjectedConnection[]=[];
 for(const edge of s.connections){
  if(!inside.has(edge.from)&&!inside.has(edge.to))continue;
  let from=endpoint(edge.from,edge.id,'out'),to=endpoint(edge.to,edge.id,'in');
  if(from&&to&&from.item===to.item)continue;
  if(scope&&!inside.has(edge.from)){const p=moduleById(s,scope).ports.find(p=>p.binding.kind==='input'&&p.binding.connectionId===edge.id);if(p)from={item:'boundary-in',port:p.id,label:p.label};}
  if(scope&&!inside.has(edge.to)){const p=moduleById(s,scope).ports.find(p=>p.direction==='out'&&p.binding.kind==='output'&&p.binding.nodeId===edge.from);if(p)to={item:'boundary-out',port:p.id,label:p.label};}
  if(from&&to){const id=items.nodes.includes(from.item)&&items.nodes.includes(to.item)?edge.id:`link-${result.length+1}`;result.push({id,connectionId:edge.id,from,to,request:edge.kind==='request',enabled:w?Boolean(w.parameters[edge.id].enabled):edge.enabled});}
 }
 return result;
}
export function validateHierarchy(s:Scenario){
 const h=s.hierarchy;if(!h)return;
 const ids=h.modules.map(m=>m.id),nodeIds=s.nodes.map(n=>n.id),owners=new Map<string,string>();
 if(h.systemId&&(!h.roots.includes(h.systemId)||h.roots.length!==1))throw Error('不正なシステムモジュール');
 if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>nodeIds.includes(id)||s.connections.some(e=>e.id===id)))throw Error('不正なモジュールID');
 const parents=new Map<string,string>();
 for(const m of h.modules){
  if(new Set(m.children).size!==m.children.length||new Set(m.nodes).size!==m.nodes.length)throw Error('重複所属');
  for(const child of m.children){if(!ids.includes(child)||parents.has(child))throw Error('不正な子モジュール');parents.set(child,m.id);}
  for(const node of m.nodes){if(!nodeIds.includes(node)||owners.has(node))throw Error('不正なノード所属');owners.set(node,m.id);}
 }
 const visited=new Set<string>(),active=new Set<string>();
 const visit=(id:string)=>{if(active.has(id))throw Error('循環階層');if(visited.has(id))return;active.add(id);moduleById(s,id).children.forEach(visit);active.delete(id);visited.add(id);};ids.forEach(visit);
 if(owners.size!==nodeIds.length||new Set(h.roots).size!==h.roots.length||h.roots.some(id=>!ids.includes(id))||ids.filter(id=>!parents.has(id)).sort().join()!==[...h.roots].sort().join())throw Error('不正なルート・所属');
 for(const m of h.modules){
  const members=new Set(descendants(s,m.id));
  if(new Set(m.ports.map(p=>p.id)).size!==m.ports.length)throw Error('重複境界ポート');
  for(const p of m.ports){const b=p.binding;
   const valid=b.kind==='output'?p.direction==='out'&&members.has(b.nodeId):b.kind==='input'?p.direction==='in'&&s.connections.some(e=>e.id===b.connectionId&&members.has(e.to)&&!members.has(e.from)):b.kind==='control'?p.direction==='in'&&s.inputs.some(i=>i.id===b.inputId&&members.has(i.nodeId)):b.kind==='source'&&p.direction==='in'&&members.has(b.nodeId)&&s.nodes.some(n=>n.id===b.nodeId&&n.kind==='input');
   if(!valid||!p.id||!p.label||typeof p.observable!=='boolean')throw Error('不正な境界ポート');
  }
  for(const edge of s.connections){
   if(members.has(edge.from)===members.has(edge.to))continue;
   const valid=members.has(edge.from)?m.ports.some(p=>p.direction==='out'&&p.binding.kind==='output'&&p.binding.nodeId===edge.from):m.ports.some(p=>p.direction==='in'&&p.binding.kind==='input'&&p.binding.connectionId===edge.id);
   if(!valid)throw Error('公開境界を通らない越境接続');
  }
  const walk=(e:Expr):void=>{if(typeof e==='number'){if(!Number.isFinite(e))throw Error('不正な仕様式');return;}if('ref'in e){if(!m.ports.some(p=>p.id===e.ref)&&e.ref!=='time')throw Error('仕様に内部参照を記載できません');return;}const arity:Record<string,number>={clamp:3,threshold:2,delay:1,integrator:2,filter:3,switch:3,pulse:4};if(!['sum','multiply',...Object.keys(arity)].includes(e.op)||!Array.isArray(e.args)||!e.args.length||arity[e.op]!==undefined&&e.args.length!==arity[e.op])throw Error('不正な仕様式');e.args.forEach(walk);};
  for(const row of m.spec.outputs??[])if(!m.ports.some(p=>p.id===row.portId&&p.direction==='out'))throw Error('不正な仕様の出力');
  for(const relation of m.spec.relations){if(!m.ports.some(p=>p.id===relation.output&&p.direction==='out'))throw Error('不正な仕様の出力');walk(relation.expression);}
 }
 if(new Set(h.inputs.map(p=>p.inputId)).size!==h.inputs.length||new Set(h.outputs.map(p=>p.nodeId)).size!==h.outputs.length)throw Error('重複したシステム境界');
 for(const input of s.inputs){const p=h.inputs.find(p=>p.inputId===input.id),m=p&&h.modules.find(m=>m.id===p.moduleId);if(!p||!h.roots.includes(p.moduleId)||!m?.ports.some(port=>port.id===p.portId&&port.binding.kind==='control'&&port.binding.inputId===input.id&&port.observable))throw Error('公開されないシステム入力');}
 for(const node of s.nodes.filter(n=>n.kind==='output')){const p=h.outputs.find(p=>p.nodeId===node.id),m=p&&h.modules.find(m=>m.id===p.moduleId);if(!p||!h.roots.includes(p.moduleId)||!m?.ports.some(port=>port.id===p.portId&&port.direction==='out'&&port.binding.kind==='output'&&port.binding.nodeId===node.id&&port.observable))throw Error('公開されないシステム出力');}
 if(h.inputs.length!==s.inputs.length||h.outputs.length!==s.nodes.filter(n=>n.kind==='output').length)throw Error('不正なシステム境界');
}
export function validateHierarchyView(s:Scenario,v:HierarchyView){
 if(v.scope!==null&&!s.hierarchy?.modules.some(m=>m.id===v.scope))throw Error('不正な表示階層');
 const current=v.scope??s.hierarchy?.systemId;
 const boundaries=v.scope?moduleById(s,v.scope).ports.map(p=>`${p.direction==='in'?'boundary-in':'boundary-out'}:${p.id}`):[];
 const items=scopeItems(s,v.scope),allowed=[...boundaries,...items.nodes,...items.modules,...projectConnections(s,undefined,v.scope).map(l=>l.id),...((v.scope??s.hierarchy?.systemId)?[v.scope??s.hierarchy!.systemId!]:[])];
 if(v.selected!==null&&!allowed.includes(v.selected))throw Error('非表示の調査対象');
}
