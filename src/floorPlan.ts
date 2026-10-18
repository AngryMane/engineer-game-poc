import type {Scenario} from './engine';

/**
 * Ship floor plan: where equipment sits, not how information flows. Positions are percentages of
 * the plan. Wiring is never drawn; the player learns it from manuals and measurement points.
 */
export type Compartment={id:string;label:string;x:number;y:number;w:number;h:number;outside?:boolean};
export type Device={nodeId:string;label?:string;compartment:string;x:number;y:number;icon:string;manual:string[]};
export type FloorPlan={compartments:Compartment[];devices:Device[];channels:number;diagnoses:number};
/** A measurement point on one connection. Live values are recorded from `since`; replays show the whole run. */
export type Probe={connectionId:string;since:number};
export type Investigation={probes:Probe[];diagnosed:string[];extraDiagnoses:number};
export const emptyInvestigation=():Investigation=>({probes:[],diagnosed:[],extraDiagnoses:0});

export function validateFloorPlan(s:Scenario){
 const f=s.floor;if(!f)return;
 const ids=f.compartments.map(c=>c.id);
 if(new Set(ids).size!==ids.length||!Number.isInteger(f.channels)||f.channels<1||!Number.isInteger(f.diagnoses)||f.diagnoses<0)throw Error('不正な配置図');
 const placed=new Set<string>();
 for(const d of f.devices){
  const n=s.nodes.find(n=>n.id===d.nodeId);
  if(!n||n.kind==='output'||placed.has(d.nodeId)||!ids.includes(d.compartment)||!d.manual.length)throw Error(`不正な設備配置：${d.nodeId}`);
  placed.add(d.nodeId);
 }
 // Every piece of equipment that computes something must be somewhere on the ship.
 for(const n of s.nodes)if(n.kind==='inner'&&!placed.has(n.id))throw Error(`配置されていない設備：${n.id}`);
}
export function validateInvestigation(s:Scenario,v:Investigation){
 const f=s.floor!;
 if(!v||!Array.isArray(v.probes)||!Array.isArray(v.diagnosed)||!Number.isInteger(v.extraDiagnoses)||v.extraDiagnoses<0)throw Error('不正な調査状態');
 if(v.probes.length>f.channels||new Set(v.probes.map(p=>p.connectionId)).size!==v.probes.length||v.probes.some(p=>!s.connections.some(e=>e.id===p.connectionId)||!Number.isInteger(p.since)||p.since<0))throw Error('不正な計測点');
 if(new Set(v.diagnosed).size!==v.diagnosed.length||v.diagnosed.some(id=>!f.devices.some(d=>d.nodeId===id))||v.diagnosed.length>f.diagnoses+v.extraDiagnoses)throw Error('不正な診断記録');
}
/** Connections attached to a device: what it receives and what it sends. */
export const deviceConnections=(s:Scenario,nodeId:string)=>({inputs:s.connections.filter(e=>e.to===nodeId),outputs:s.connections.filter(e=>e.from===nodeId)});
export const probeOf=(v:Investigation,connectionId:string)=>v.probes.find(p=>p.connectionId===connectionId);
export function addProbe(s:Scenario,v:Investigation,connectionId:string,time:number):Investigation{
 if(probeOf(v,connectionId))return v;
 if(v.probes.length>=s.floor!.channels)throw Error(`計測チャンネルは${s.floor!.channels}本までです。ほかの計測点を外してください。`);
 return {...v,probes:[...v.probes,{connectionId,since:time}]};
}
export const removeProbe=(v:Investigation,connectionId:string):Investigation=>({...v,probes:v.probes.filter(p=>p.connectionId!==connectionId)});
export const diagnosesLeft=(s:Scenario,v:Investigation)=>s.floor!.diagnoses+v.extraDiagnoses-v.diagnosed.length;
/** Diagnosis reveals a device's settings and internal state. Running out never blocks play: extra diagnoses are allowed and recorded. */
export function diagnose(s:Scenario,v:Investigation,nodeId:string,extra=false):Investigation{
 if(v.diagnosed.includes(nodeId))return v;
 if(!s.floor!.devices.some(d=>d.nodeId===nodeId)||s.nodes.find(n=>n.id===nodeId)?.kind==='input')throw Error('診断できる設備ではありません');
 const next=extra&&diagnosesLeft(s,v)<=0?{...v,extraDiagnoses:v.extraDiagnoses+1}:v;
 if(diagnosesLeft(s,next)<=0)throw Error('診断の残り回数がありません');
 return {...next,diagnosed:[...next.diagnosed,nodeId]};
}
/** After Reset or Restart the installed probes keep measuring from the new start. */
export const restartProbes=(v:Investigation,time:number):Investigation=>({...v,probes:v.probes.map(p=>({...p,since:time}))});
export const channelKey=(connectionId:string)=>`c:${connectionId}`;
