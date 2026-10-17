import type {Expr} from './engine';
export function expressionText(e:Expr,reference:(ref:string)=>string=ref=>ref):string {
 if(typeof e==='number')return String(e);
 if('ref'in e)return reference(e.ref);
 const a=e.args.map(arg=>expressionText(arg,reference));
 switch(e.op){case 'sum':return `(${e.args.map((arg,i)=>{
  if(i>0&&typeof arg!=='number'&&'op'in arg&&arg.op==='multiply'&&arg.args.length===2&&arg.args[0]===-1)return `− ${expressionText(arg.args[1],reference)}`;
  return `${i>0?'+ ':''}${a[i]}`;
 }).join(' ')})`;case 'multiply':return `(${a.join(' × ')})`;case 'clamp':return `max(${a[1]}, min(${a[0]}, ${a[2]}))`;case 'threshold':return `(${a[0]} ≥ ${a[1]} ? 1 : 0)`;case 'integrator':return `(${a[0]} + ${a[1]})`;case 'filter':return `(${a[0]} + ${a[2]} × (${a[1]} − ${a[0]}))`;case 'switch':return `(${a[0]} ≠ 0 ? ${a[1]} : ${a[2]})`;case 'pulse':return `(time mod max(1, ${a[0]}) < ${a[1]} ? ${a[2]} : ${a[3]})`;case 'delay':return a[0];}
}
// Intermediate names describe arithmetic operations, not inferred domain roles.
export function processingText(e:Expr,target:string,reference:(ref:string)=>string=ref=>ref):string {
 const lines:string[]=[],counts:Record<string,number>={};
 const assign=(base:string,value:string)=>{
  const count=(counts[base]??0)+1;counts[base]=count;
  const name=count===1?base:`${base}${count}`;
  lines.push(`${name} = ${value}`);return name;
 };
 const names={sum:'sum',multiply:'product',threshold:'comparison',integrator:'sumValue',filter:'interpolatedValue',switch:'selectedValue',pulse:'pulseValue',delay:'inputValue'};
 const render=(expr:Expr,root=false):string=>{
  if(typeof expr==='number'||'ref'in expr)return expressionText(expr,reference);
  // Keep subtraction recognizable instead of introducing a separate negative product.
  const args=expr.args.map((arg,i):Expr=>{
   if(expr.op==='sum'&&i>0&&typeof arg!=='number'&&'op'in arg&&arg.op==='multiply'&&arg.args.length===2&&arg.args[0]===-1)
    return {op:'multiply',args:[-1,{ref:render(arg.args[1])}]};
   return {ref:render(arg)};
  });
  if(expr.op==='clamp'){
   const a=args.map(arg=>expressionText(arg));
   const upper=assign('upperClamped',`min(${a[0]}, ${a[2]})`);
   const value=`max(${a[1]}, ${upper})`;
   return root?value:assign('clamped',value);
  }
  const value=expressionText({op:expr.op,args});
  if(root||expr.op==='delay')return value;
  const isDifference=expr.op==='sum'&&expr.args.some(arg=>typeof arg!=='number'&&'op'in arg&&arg.op==='multiply'&&arg.args[0]===-1);
  return assign(isDifference?'difference':names[expr.op],value);
 };
 const result=render(e,true);
 lines.push(`${target} = ${result}`);
 return lines.join('\n');
}
