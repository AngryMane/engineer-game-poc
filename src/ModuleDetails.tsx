import {expressionText} from './expressionFormat';
import type {Scenario,World} from './engine';
import {ruleLabel} from './contracts';
import {boundaryText,moduleById,publicText,type ModuleSpec} from './hierarchy';
export function ModuleSpecification({s,spec}:{s:Scenario;spec:ModuleSpec}){
 const text=(value:string)=>publicText(s,value);
 return <div className="module-specification">{spec.outputs?<table><thead><tr><th>Output</th><th>When</th><th>Expected</th></tr></thead><tbody>{spec.outputs.map(row=><tr key={row.portId}><th>{text(row.portId)}</th><td>{text(row.condition)}</td><td>{text(row.expected)}{row.timing&&<small>{text(row.timing)}</small>}{row.rules?.map((r,i)=><code className="contract-rule" key={i}>{text(ruleLabel(r))}</code>)}</td></tr>)}</tbody></table>:<><dl><dt>When</dt><dd>{spec.condition}</dd><dt>Expected</dt><dd>{spec.expected}</dd><dt>Timing</dt><dd>{spec.timing}</dd><dt>Assumes</dt><dd>{spec.assumptions}</dd></dl>{spec.relations.map((r,i)=><code className="processing-rule" key={i}>{r.output} = {expressionText(r.expression)}</code>)}</>}{spec.cases&&<details><summary>Test cases</summary><ul>{spec.cases.map((c,i)=><li key={i}><code>{c.inputs.map(input=>`t=${input.time}: ${text(input.id)}=${input.value}`).join(' · ')||'No input changes'} · {c.steps} ticks{c.seed!==undefined?` · seed ${c.seed}`:''}</code></li>)}</ul></details>}</div>;
}
export function ModuleDetails({s,w,id,onExpand}:{s:Scenario;w:World;id:string;onExpand:(id:string)=>void}){
 const m=moduleById(s,id);
 return <section className="panel module-details"><div className="panel-title"><h2>{m.label}</h2><button onClick={()=>onExpand(id)}>Open</button></div><div className="details-body"><h3>Spec</h3><ModuleSpecification s={s} spec={m.spec}/><h3>Values</h3>{m.ports.map(p=><div className="boundary-observation" key={p.id}><b>{p.direction.toUpperCase()} / <code>{p.id}</code></b><output>{boundaryText(s,w,p)}</output></div>)}<small>IN: last consumed · OUT: last computed</small></div></section>;
}
