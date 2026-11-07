import { StrictMode } from 'react';
import { render,screen,waitFor } from '@testing-library/react';
import { it,expect,vi } from 'vitest';
import { PhaserWorld } from '../src/features/world/PhaserWorld';
import { WorldBridge } from '../src/features/world/bridge';
import { parseHoneyville } from '../src/features/world/map';
import raw from '../src/features/world/honeyville.json';
const state={active:0,max:0,created:0,disposed:0,fail:false};
const loadGame=async()=>({createHoneyvilleGame:(host:HTMLElement,_map:unknown,bridge:WorldBridge)=>{
  state.created++;state.active++;state.max=Math.max(state.max,state.active);host.appendChild(document.createElement('canvas'));
  if(state.fail)bridge.emit('error','Missing asset');else bridge.emit('ready',undefined);
  return()=>{state.active--;state.disposed++;host.replaceChildren();};
}});
it('does not duplicate instances under StrictMode and destroys the mounted game on route unmount',async()=>{
  state.active=state.max=state.created=state.disposed=0;state.fail=false;
  const view=render(<StrictMode><PhaserWorld map={parseHoneyville(raw)} bridge={new WorldBridge()} loadGame={loadGame}/></StrictMode>);
  await waitFor(()=>expect(state.active).toBe(1));expect(state.max).toBe(1);expect(document.querySelectorAll('canvas')).toHaveLength(1);
  view.unmount();expect(state.active).toBe(0);expect(state.disposed).toBe(state.created);expect(document.querySelectorAll('canvas')).toHaveLength(0);
});
it('surfaces missing assets and disposes a session before another is mounted',async()=>{
  state.fail=true;const view=render(<PhaserWorld map={parseHoneyville(raw)} bridge={new WorldBridge()} loadGame={loadGame}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Missing asset');view.unmount();expect(state.active).toBe(0);
  state.fail=false;const next=render(<PhaserWorld map={parseHoneyville(raw)} bridge={new WorldBridge()} loadGame={loadGame}/>);
  await waitFor(()=>expect(document.querySelectorAll('canvas')).toHaveLength(1));next.unmount();expect(state.active).toBe(0);
});
it('does not create a game when a late module finishes loading after unmount',async()=>{
  const create=vi.fn(()=>()=>{});let finish!: (module:{createHoneyvilleGame:typeof create})=>void;
  const delayed=()=>new Promise<{createHoneyvilleGame:typeof create}>(resolve=>{finish=resolve;});
  const view=render(<PhaserWorld map={parseHoneyville(raw)} bridge={new WorldBridge()} loadGame={delayed}/>);
  view.unmount();finish({createHoneyvilleGame:create});await Promise.resolve();expect(create).not.toHaveBeenCalled();
});
it('reports a failed renderer import without creating an instance',async()=>{
  const view=render(<PhaserWorld map={parseHoneyville(raw)} bridge={new WorldBridge()} loadGame={async()=>{throw new Error('chunk failed');}}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('The world renderer could not start');expect(document.querySelectorAll('canvas')).toHaveLength(0);view.unmount();
});
