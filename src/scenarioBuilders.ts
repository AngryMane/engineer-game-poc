import type {Expr,Node,Connection,Observation,Intervention} from './engine';
export const r=(ref:string):Expr=>({ref});
export const op=(name:Exclude<Expr,number|{ref:string}>['op'],...args:Expr[]):Expr=>({op:name,args});
export const n=(id:string,x:number,y:number,expr:Expr,parameters:Record<string,number>={},initial=0,description='到着する信号を処理し、次のステップへ伝えます。'):Node=>({trigger:{type:'input'},kind:'inner',id,label:id,description,ports:[{id:'in',direction:'in'},{id:'value',direction:'out'}],initialState:{value:initial},parameters:{gain:1,...parameters},update:{value:op('multiply',r('param.gain'),expr)},x,y});
export const e=(id:string,from:string,to:string,input='signal',kind='signal'):Connection=>({id,from,to,input,enabled:true,kind,unit:'abstract'});
export const obs=(target:string,offset=0):Observation=>({id:`o-${target}`,label:`${target} / 信号`,target,key:'value',period:1,noise:0,offset,available:true,permission:'public',unlockStep:0,cost:0});
export const control=(id:string,label:string,target:string,parameter:string,min:number,max:number,defaultValue:number,description:string,step=1):Intervention=>({id,label,target,parameter,min,max,defaultValue,description,step});
export const signal=(id:string,x:number,y:number,initial=0,description?:string)=>n(id,x,y,r('input.signal'),{},initial,description);
export function configure(nodes:Node[],edges:Connection[],inputValues:Record<string,string>,timers:string[]=[],providers:string[]=[]){
 for(const node of nodes){
  if(node.kind==='output'){delete node.parameters.gain;node.update={value:r('input.signal')};node.trigger={type:'input'};continue;}
  if(node.kind==='input'){
   delete node.parameters.gain;node.inputParameter=inputValues[node.id];node.update={value:r(`param.${node.inputParameter}`)};
   node.trigger={type:'manual'};
   if(timers.includes(node.id)){node.parameters.interval=1;node.trigger={type:'timer',periodParameter:'interval'};}
  }else if(providers.includes(node.id))node.trigger={type:'request'};
  else if(timers.includes(node.id)){node.parameters.interval=1;node.trigger={type:'timer',periodParameter:'interval'};}
 }
 return edges;
}
export function editors(nodes:Node[],edges:Connection[]):Intervention[]{
 return [...nodes.flatMap(node=>Object.entries(node.parameters).filter(()=>node.kind==='inner').map(([key,value])=>control(`${node.id}.${key}`,`${node.id} / ${key}`,node.id,key,key===node.trigger.periodParameter?1:0,key===node.trigger.periodParameter?24:key==='gain'?3:key==='enabled'?1:key==='period'?36:key==='load'?12:20,value,`${key} を直接編集します。正常な対象にも変更できます。`,key==='gain'||key==='level'?0.05:1))),...nodes.filter(node=>node.kind==='inner').flatMap(node=>Object.entries(node.initialState).map(([key,value])=>({...control(`${node.id}.state.${key}`,`${node.id} / state.${key}`,node.id,key,-100,100,value,'このノードが保持する値を変更します。次に処理が実行されると、計算結果で更新されることがあります。',0.05),storage:'state' as const}))),...edges.flatMap(edge=>[
 control(`${edge.id}.enabled`,`${edge.id} / enabled`,edge.id,'enabled',0,1,Number(edge.enabled),'0で関係を無効にし、受信済みの値と配送待ちの値を除外します。1に戻すと、次の出力・問い合わせから再び受け取ります。')])];
}
