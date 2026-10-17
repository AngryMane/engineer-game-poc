import {it,expect} from 'vitest';
import {createWorld,setInput,step,intervene,restartWithSettings} from './engine';
import {scenarios} from './scenarios';
it('a disabled relationship excludes old inputs and queued deliveries without rewriting completed frames',()=>{
 const s=scenarios[2];let w=createWorld(s);
 for(let i=0;i<5;i++)w=step(s,w,false);
 expect(w.frames.N06.inputs.E11).toBe(-.05);
 const frame=structuredClone(w.frames.N06);
 w=intervene(s,w,'E11.enabled',0);
 expect(w.frames.N06).toEqual(frame);
 w=step(s,w,false);
 expect(w.frames.N06.inputs.E11).toBe(0);
 const t=scenarios[0];let q=step(t,setInput(t,createWorld(t),'N01.level',16),false);
 expect(q.pending.some(e=>e.connectionId==='E01')).toBe(true);
 q=intervene(t,q,'E01.enabled',0);
 q=step(t,q,false);expect(q.activity.N02.count).toBe(0);
 q=intervene(t,q,'E01.enabled',1);
 q=step(t,q,false);expect(q.activity.N02.count).toBe(0);
});
it('restarts from manually edited initial state, matching acceptance',()=>{
 const s=scenarios[2];let w=createWorld(s);
 w=intervene(s,w,'N06.state.value',2);
 w=step(s,w,false);
 const restarted=restartWithSettings(s,w);
 expect(restarted.states.N06.value).toBe(2);
 expect(restarted.frames.N06.output).toBe(2);
 expect(restarted.signals.E05).toBe(2);
 expect(restarted.states.E05.value).toBe(2);
});
it('invalidates the last case result when configuration or input changes',()=>{
 const s=scenarios[0];let w=createWorld(s);
 w.monitor.lastValidation={passed:true,time:0,issues:[]};
 expect(intervene(s,w,'N02.gain',1.05).monitor.lastValidation).toBeUndefined();
 expect(setInput(s,w,'N01.level',16).monitor.lastValidation).toBeUndefined();
 expect(w.monitor.lastValidation?.passed).toBe(true);
});
