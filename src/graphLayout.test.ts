import {describe,it,expect} from 'vitest';
import {scenarios} from './legacyScenarios';
import {moduleViewScenario} from './moduleView';
import {readGraphLayout} from './graphLayout';
import {createWorld} from './engine';
import {hierarchySample,readHierarchySession,type HierarchySession} from './hierarchySession';
const s=moduleViewScenario(scenarios.find(s=>s.id==='hierarchy')!);
describe('per-scope graph layout persistence',()=>{
 it('restores module, execution and boundary positions without affecting simulation state',()=>{
  const world=createWorld(s),layout={'@system':{Core:{x:50,y:80},N01:{x:20,y:0}},Transform:{N04:{x:-20,y:30},'boundary-in:factor':{x:10,y:40}}};
  const data:HierarchySession={version:14,sid:s.id,layout,world,view:{scope:'Transform',selected:'N04'},detailsOpen:false,points:[hierarchySample(s,world)],experiments:[],notes:'',prediction:'',hint:0};
  const loaded=readHierarchySession(s,JSON.stringify(data));expect(loaded.layout).toEqual(layout);expect(loaded.world).toEqual(world);
  delete data.layout;expect(readHierarchySession(s,JSON.stringify(data)).layout).toBeUndefined();expect(readGraphLayout(s,undefined)).toEqual({});
 });
 it('rejects unknown scopes, hidden nodes, malformed maps and nonfinite or excessive offsets',()=>{
  for(const layout of [null,[],{missing:{}},{'@system':{N04:{x:0,y:0}}},{Transform:{N04:{x:Infinity,y:0}}},{Transform:{N04:{x:100001,y:0}}},{Transform:{N04:{x:'1',y:0}}},{Transform:[]}])expect(()=>readGraphLayout(s,layout)).toThrow();
 });
});
