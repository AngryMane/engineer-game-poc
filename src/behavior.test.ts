import {it,expect} from 'vitest';
import {scenarios} from './scenarios';
import {createWorld,step,validateBehavior,setInput,intervene} from './engine';
it('healthy output behavior passes public cases',()=>{for(const original of scenarios){const s={...original,faults:[]},w=createWorld(s),result=validateBehavior(s,w);expect(result,JSON.stringify(result)).toMatchObject({passed:true});}});
it('keeps one onset while a late response persists, then logs recovery and removes the alert',()=>{
 const s=scenarios[2];let w=setInput(s,createWorld(s),'N01.enabled',1);
 for(let i=0;i<10;i++)w=step(s,w,false);expect(w.monitor.alerts.N04).toBeUndefined();
 w=step(s,w,false);expect(w.monitor.alerts.N04[0]).toMatchObject({expected:'4',actual:10});
 for(let i=0;i<21;i++)w=step(s,w,false);expect(w.monitor.logs.filter(l=>l.nodeId==='N04'&&l.type==='onset')).toHaveLength(1);
 w=step(s,w,false);expect(w.time).toBe(33);expect(w.monitor.alerts.N04).toBeUndefined();expect(w.monitor.logs.filter(l=>l.nodeId==='N04').map(l=>[l.time,l.type])).toEqual([[11,'onset'],[33,'recovery']]);
 expect(w.monitor.logs.at(-1)?.issues[0].actual).toBe(4);
});
it('logs periodic recurrences without logging every bad step and preserves logs in snapshots',()=>{
 const s=scenarios[1];let w=createWorld(s);for(let i=0;i<72;i++)w=step(s,w,false);
 const logs=w.monitor.logs.filter(l=>l.nodeId==='N08');expect(logs.filter(l=>l.type==='onset').length).toBeGreaterThan(2);expect(logs.length).toBeLessThan(40);
 const restored=JSON.parse(JSON.stringify(w));expect(step(s,restored,false).monitor).toEqual(step(s,w,false).monitor);
 expect(createWorld(s).monitor.logs).toHaveLength(0);
});
it('rejects constant output and wrong timing even if a single observed final value matches',()=>{
 const s=structuredClone(scenarios[0]);s.nodes[1].update.value=4;expect(validateBehavior(s,createWorld(s)).passed).toBe(false);
 const delayed=structuredClone(scenarios[2]),w=createWorld(delayed);w.parameters.N05.gain=.2;expect(validateBehavior(delayed,w)).toMatchObject({passed:false,issues:[{nodeId:'N04',expected:'4',actual:10}]});
});
it('monitor and acceptance use the same expected-output rules, not cause metadata',()=>{
 const s=scenarios[2];let w=createWorld(s);w=intervene(s,w,'N05.level',5);expect(w.parameters.N05.gain).toBe(.2);expect(validateBehavior(s,w).passed).toBe(true);
 const wrong=structuredClone(s);wrong.outputRequirements.find(r=>r.nodeId==='N14')!.rules=[{kind:'equals',expected:-.1}];expect(validateBehavior(wrong,w).passed).toBe(false);
 const actual=step(wrong,createWorld(wrong),false);expect(actual.monitor.alerts.N14[0]).toMatchObject({expected:'-0.1',actual:-.05});
});

it('candidate verification leaves the running simulation and its random/log state untouched',()=>{const s=scenarios[1];let w=createWorld(s);for(let i=0;i<36;i++)w=step(s,w,false);const before=structuredClone(w);validateBehavior(s,w);expect(w).toEqual(before);});
