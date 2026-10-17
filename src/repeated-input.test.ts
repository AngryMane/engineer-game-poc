import {it,expect} from 'vitest';
import {scenarios} from './scenarios';
import {createWorld,setInput,step} from './engine';
it('keeps healthy repeated activation consistent with the declared response deadline',()=>{
 const s={...scenarios[2],faults:[]};let w=setInput(s,createWorld(s),'N01.enabled',1);
 for(let i=0;i<30;i++)w=step(s,w,false);
 w=setInput(s,w,'N01.enabled',0);
 for(let i=0;i<10;i++)w=step(s,w,false);
 const t=w.time;w=setInput(s,w,'N01.enabled',1);
 const issues=[];
 for(let i=0;i<11;i++){w=step(s,w,false);if(w.monitor.alerts.N04)issues.push({time:w.time,after:w.time-t,value:w.states.N04.value,issues:w.monitor.alerts.N04});}
 expect(issues).toEqual([]);
});
