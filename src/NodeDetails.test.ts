import {describe,it,expect} from 'vitest';
import {processingText} from './NodeDetails';
import type {Expr} from './engine';

describe('processing formula steps',()=>{
 it('shows nested subtraction, clamp and conditional in calculation order',()=>{
  const e:Expr={op:'multiply',args:[{ref:'N02.gain'},{op:'switch',args:[{ref:'N01'},{op:'clamp',args:[{op:'sum',args:[{ref:'N02.level'},{op:'multiply',args:[-1,{ref:'N07'}]}]},0,30]},{ref:'N02.level'}]}]};
  expect(processingText(e,'N02.value')).toBe([
   'difference = (N02.level − N07)',
   'upperClamped = min(difference, 30)',
   'clamped = max(0, upperClamped)',
   'selectedValue = (N01 ≠ 0 ? clamped : N02.level)',
   'N02.value = (N02.gain × selectedValue)',
  ].join('\n'));
 });
 it('keeps repeated operations distinct and resolves source references only once',()=>{
  const e:Expr={op:'sum',args:[{op:'clamp',args:[{ref:'input.a'},0,10]},{op:'clamp',args:[{ref:'input.b'},1,20]}]};
  const text=processingText(e,'N02.value',r=>r==='input.a'?'N01':r==='input.b'?'(N06 + N12)':r);
  expect(text).toContain('upperClamped2 = min((N06 + N12), 20)');
  expect(text).toContain('clamped2 = max(1, upperClamped2)');
  expect(text).toContain('N02.value = (clamped + clamped2)');
  expect(text).not.toContain('input.');
 });
 it('keeps a simple reference as one assignment',()=>{
  expect(processingText({ref:'state.value'},'N02.value',()=> 'N02.value')).toBe('N02.value = N02.value');
 });
});
