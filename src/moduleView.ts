import type {Scenario} from './engine';
import type {Module,ModulePort,ModuleSpec} from './hierarchy';
const spec=(expected:string,timing:string,relations:ModuleSpec['relations']=[]):ModuleSpec=>({condition:'Use the visible INPUT ports.',expected,timing,assumptions:'Connections preserve values. Boundary nodes add no processing or delay.',relations});

/** Presentation-only ownership. Execution nodes, queues, IDs and contracts are untouched. */
export function moduleViewScenario(source:Scenario):Scenario {
 if(source.hierarchy?.systemId)return source;
 const inner=source.nodes.filter(n=>n.kind==='inner').map(n=>n.id),outer=source.nodes.filter(n=>n.kind!=='inner').map(n=>n.id);
 const modules:Module[]=[];
 const port=(id:string,direction:'in'|'out',binding:ModulePort['binding'],observable=true):ModulePort=>({id,label:id,direction,binding,observable,description:''});
 const make=(id:string,label:string,nodes:string[],children:string[],moduleSpec:ModuleSpec):Module=>({id,label,nodes,children,ports:[],description:'',spec:moduleSpec});
 const core=make('Core','Core',inner,[],spec(source.briefing.expected,'See the enclosing System specification for end-to-end timing.'));
 if(source.id==='hierarchy'){
  core.nodes=[];core.children=['Sampler','Transform','Timing','Reference'];
  modules.push(
   make('Sampler','Sampler',['N02','N09'],[],spec('signal = command; echo = command delayed by 1 tick.','signal: every tick. echo: 1 tick after signal.')),
   make('Transform','Transform',['N04'],[],spec('value = 2 × signal − external.','Every tick; output is committed with the inputs used in that computation.')),
   make('Timing','Timing',['N06','N07'],[],spec('ready = 1 after 8 consecutive nonzero samples; a zero sample resets the count.','ready: 8 ticks after the first nonzero sample; 1 tick after a zero sample.')),
   make('Reference','Reference',[],['Shared'],spec('factor = 2.','Synchronous fetch; the same value is returned to every caller.')),
   make('Shared','Shared factor',['N03'],[],spec('factor = 2.','On fetch.')),
  );
  core.spec=spec('value = 2 × command delayed by 1 tick − external; echo = command delayed by 1 tick. ready follows the consecutive nonzero duration.','From the first nonzero command consumed by INPUT: ready = 1 after 9 ticks; after zero: ready = 0 after 2 ticks.');
 }
 modules.unshift(core);
 const system=make('System','System',outer,['Core'],spec(source.briefing.expected,'Timing is measured from Apply unless the condition states otherwise.'));
 system.spec.outputs=source.outputRequirements.map(row=>({portId:row.nodeId,condition:row.condition,expected:row.expected,timing:'',rules:row.rules}));
 system.spec.cases=source.behaviorCases;
 modules.unshift(system);
 const view:Scenario={...source,hierarchy:{systemId:'System',roots:['System'],modules,inputs:[],outputs:[]}};
 const members=(m:Module):string[]=>[...m.nodes,...m.children.flatMap(id=>members(modules.find(m=>m.id===id)!))];
 const aliases:Record<string,string>={N01:'command',N02:'signal',N03:'factor',N04:'value',N07:'ready',N09:'echo',N12:'external'};
 for(const m of modules){
  const owned=new Set(members(m));
  for(const edge of source.connections){
   if(owned.has(edge.to)&&!owned.has(edge.from)){
    let id=source.id==='hierarchy'?(aliases[edge.from]??edge.input):edge.input;
    if(m.ports.some(p=>p.id===id))id+=`_${m.ports.filter(p=>p.direction==='in').length+1}`;
    m.ports.push(port(id,'in',{kind:'input',connectionId:edge.id}));
   }
   if(owned.has(edge.from)&&!owned.has(edge.to)&&!m.ports.some(p=>p.binding.kind==='output'&&p.binding.nodeId===edge.from))m.ports.push(port(source.id==='hierarchy'?(aliases[edge.from]??edge.from):`out${m.ports.filter(p=>p.direction==='out').length+1}`,'out',{kind:'output',nodeId:edge.from}));
  }
 }
 for(const input of source.inputs){system.ports.push(port(input.id,'in',{kind:'control',inputId:input.id}));view.hierarchy!.inputs.push({inputId:input.id,moduleId:'System',portId:input.id,label:input.label});}
 for(const external of source.nodes.filter(n=>n.externalInput))system.ports.push(port(external.id,'in',{kind:'source',nodeId:external.id}));
 for(const output of source.nodes.filter(n=>n.kind==='output')){system.ports.push(port(output.id,'out',{kind:'output',nodeId:output.id}));view.hierarchy!.outputs.push({nodeId:output.id,moduleId:'System',portId:output.id,label:source.hierarchy?.outputs.find(o=>o.nodeId===output.id)?.label??output.id});}
 const outputSpecs:Record<string,Record<string,[string,string]>>={
  Core:{value:['value = 2 × command[t−1] − external[t].','Every tick.'],echo:['echo = command[t−1].','Every tick.'],ready:['0 → nonzero, held: ready = 1 after 9 ticks. Zero command: ready = 0 after 2 ticks.','Measured from the first command consumed by INPUT.']},
  Sampler:{signal:['signal = command.','Every tick.'],echo:['echo = signal[t−1].','1 tick after signal.']},
  Transform:{value:['value = 2 × signal − external.','Every tick; uses the INPUT values committed with that output.']},
  Timing:{ready:['8 consecutive nonzero samples activate ready. A zero sample resets the count.','ready = 1 at first nonzero sample +8 ticks; ready = 0 at zero sample +1 tick.']},
  Reference:{factor:['factor = 2.','Synchronous fetch.']},Shared:{factor:['factor = 2.','Synchronous fetch.']},
 };
 for(const m of modules)if(!m.spec.outputs)m.spec.outputs=m.ports.filter(p=>p.direction==='out').map(p=>{const details=source.id==='hierarchy'?outputSpecs[m.id]?.[p.id]:undefined;return {portId:p.id,condition:m.spec.condition,expected:details?.[0]??m.spec.expected,timing:details?.[1]??m.spec.timing};});
 return view;
}
