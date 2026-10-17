import {useEffect,useRef} from 'react';
/** Display speeds. Speed only changes how often a tick is shown, never how a tick is computed. */
export const SPEEDS=[1,4,8];
export const tickInterval=(speed:number)=>Math.round(480/speed);
/**
 * Calls onTick once per interval while running. There is only ever one timer: pausing or changing
 * speed clears the previous one before a new one starts. `active` is checked on every call, so a
 * timer callback that fires between Pause and React's commit does not advance the world.
 */
export function useTicker(running:boolean,speed:number,onTick:()=>void){
 const callback=useRef(onTick),active=useRef(running);
 useEffect(()=>{callback.current=onTick;});
 useEffect(()=>{active.current=running;if(!running)return;const id=setInterval(()=>{if(active.current)callback.current();},tickInterval(speed));return()=>{active.current=false;clearInterval(id);};},[running,speed]);
 return active;
}
