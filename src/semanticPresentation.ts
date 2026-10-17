import type {Scenario} from './engine';
import type {ModulePort} from './hierarchy';
import type {DisplayMode} from './semanticModel';
const letter=(i:number)=>String.fromCharCode(65+i);
/** Only labels/explanations change. Bindings, expressions, visibility and numerical rules are shared. */
export function presentScenario(source:Scenario,mode:DisplayMode):Scenario {
 const model=source.hierarchy?.semantics;if(!model)return source;
 const modules=source.hierarchy!.modules.map((m,index)=>{
  const meaning=model.modules[m.id];let ins=0,outs=0;
  const ports=m.ports.map(p=>({...p,label:mode==='functional'?(meaning?.ports[p.id]?.name??p.id):`${p.direction==='in'?'Input':'Output'}${letter(p.direction==='in'?ins++:outs++)}`,description:mode==='functional'?(meaning?.ports[p.id]?.role??''):''}));
  const labels=Object.fromEntries(ports.map(p=>[p.id,p.label]));
  const math=(text:string)=>text.replace(/\{\{([^}]+)\}\}|\b([a-z][a-z0-9]*)\b/g,(token,ref,word)=>labels[ref??word]??token);
  return {...m,label:mode==='functional'?(meaning?.name??m.label):`Module ${letter(index)}`,description:mode==='functional'?(meaning?.purpose??''):'',meaning:mode==='functional'?meaning:undefined,ports,spec:{...m.spec,outputs:m.spec.outputs?.map(row=>({...row,expected:math(row.expected)}))}};
 });
 const hierarchy={...source.hierarchy!,modules,inputLabels:Object.fromEntries(source.connections.map(e=>[e.id,mode==='abstract'?`Input${letter(source.connections.filter(other=>other.to===e.to).findIndex(other=>other.id===e.id))}`:e.input]))};
 const find=(moduleId:string,portId:string):ModulePort=>modules.find(m=>m.id===moduleId)!.ports.find(p=>p.id===portId)!;
 hierarchy.inputs=hierarchy.inputs.map(p=>({...p,label:find(p.moduleId,p.portId).label}));
 hierarchy.outputs=hierarchy.outputs.map(p=>({...p,label:find(p.moduleId,p.portId).label}));
 const root=modules.find(m=>m.id===hierarchy.systemId)!;
 const nodeLabels:Record<string,string>=Object.fromEntries(root.ports.filter(p=>p.binding.kind==='output'||p.binding.kind==='source').map(p=>[(p.binding as {nodeId:string}).nodeId,p.label]));
 for(const p of hierarchy.inputs){const input=source.inputs.find(i=>i.id===p.inputId)!;nodeLabels[input.nodeId]=p.label;}
 return {...source,solution:mode==='abstract'&&model.abstractDebrief?{...source.solution,...model.abstractDebrief}:source.solution,hierarchy,nodes:source.nodes.map(n=>({...n,label:nodeLabels[n.id]??n.id,description:''})),inputs:source.inputs.map(input=>{const p=hierarchy.inputs.find(p=>p.inputId===input.id)!;return {...input,label:p.label,description:find(p.moduleId,p.portId).description};}),observations:source.observations.map(o=>({...o,label:nodeLabels[o.target]??o.target})),hints:model.hints?.[mode]??source.hints};
}
