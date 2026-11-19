// Random level search with mechanic requirements. Uses the real sim.
// node gen_level.js <seed> <iters> '<json opts>'
// opts: {W,H,stubs:[a,b],holes,ramps,pads,minLen,maxLen,needTap,needDeflect,needBend}
const fs=require('fs');const SIM=new Function(fs.readFileSync(__dirname+'/sim.js','utf8'))();
let seed=+process.argv[2]||1;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};const ri=n=>Math.floor(rnd()*n);
const O=Object.assign({mirrors:0,dmirrors:0,stars:0,needEvents:[],needDeath:null,W:11,H:12,stubs:[3,7],holes:1,ramps:2,pads:1,minLen:5,maxLen:9,needTap:false,needDeflect:false,needBend:false},JSON.parse(process.argv[4]||'{}'));
function solve(map,allow){const L=SIM.parseLevel({map});const key=s=>s.i+','+s.j;const st0=SIM.newState(L);const seen=new Map([[key(st0),null]]);const q=[st0];const edges=new Map();let win=null,deaths=0;const dtypes=new Set();
 while(q.length){const s=q.shift();edges.set(key(s),[]);for(const a of['L','R','U','D','TAP']){if(!allow(a))continue;const r=SIM.simulate(L,s,a);if(!r.ok)continue;
  if(r.st.mode==='exit'){edges.get(key(s)).push('EXIT');if(!win){win=[a];let p=seen.get(key(s));while(p){win.push(p.a);p=seen.get(p.k);}win.reverse();}continue;}
  if(r.st.mode==='dead'){deaths++;dtypes.add(r.st.deathType);continue;}
  edges.get(key(s)).push(key(r.st));if(!seen.has(key(r.st))){seen.set(key(r.st),{k:key(s),a});q.push(r.st);}}}
 const cw=new Set();let ch=true;while(ch){ch=false;for(const[k,es]of edges)if(!cw.has(k)&&es.some(e=>e==='EXIT'||cw.has(e))){cw.add(k);ch=true;}}
 return {win,deaths,dtypes,dead:[...edges.keys()].filter(k=>!cw.has(k)).length,states:seen.size};}
function pathCells(L,win){let st=SIM.newState(L);const cells=[];const tags=new Set();for(const a of win){const s=JSON.parse(JSON.stringify(st));s.events=[];
  if(a==='TAP')SIM.startFlight(s,SIM.padLaunchDir(L,s.i,s.j,s.normal),true);else SIM.startFlight(s,a,false);
  while(s.mode==='fly'){SIM.step(L,s,1/120);s.events.forEach(e=>tags.add(e.type));s.events=[];const c=[Math.floor(s.x/48),Math.floor(s.y/48)];const k=c+'';if(!cells.some(x=>x+''===k))cells.push(c);}
  st=s;}return {cells,tags};}
let best=null;const iters=+process.argv[3]||20000;
for(let it=0;it<iters;it++){
 const W=O.W,H=O.H,g=[];for(let j=0;j<H;j++){g.push([]);for(let i=0;i<W;i++)g[j].push(i==0||j==0||i==W-1||j==H-1?'#':'.');}
 const free=()=>{for(let t=0;t<200;t++){const i=1+ri(W-2),j=1+ri(H-2);if(g[j][i]==='.')return[i,j];}return[1,1];};
 const nst=O.stubs[0]+ri(O.stubs[1]-O.stubs[0]+1);for(let k=0;k<nst;k++){const[i,j]=free();g[j][i]='#';if(rnd()<0.45){const[i2,j2]=rnd()<0.5?[i+1,j]:[i,j+1];if(i2<W-1&&j2<H-1&&g[j2][i2]==='.')g[j2][i2]='#';}}
 for(let k=0;k<O.pads;k++){if(rnd()<0.6){const side=ri(4);let pc;if(side==0)pc=[1+ri(W-2),0];else if(side==1)pc=[1+ri(W-2),H-1];else if(side==2)pc=[0,1+ri(H-2)];else pc=[W-1,1+ri(H-2)];g[pc[1]][pc[0]]='P';}else{const[i,j]=free();g[j][i]='P';}}
 for(let k=0;k<O.holes;k++){const[i,j]=free();g[j][i]='O';}
 for(let k=0;k<O.ramps;k++){const[i,j]=free();g[j][i]='abcd'[ri(4)];}
 for(let k=0;k<O.mirrors;k++){const[i,j]=free();g[j][i]='M';}
 for(let k=0;k<O.dmirrors;k++){const[i,j]=free();g[j][i]='mn'[ri(2)];}
 for(let k=0;k<O.stars;k++){const[i,j]=free();g[j][i]='X';}
 const[ex,ey]=free();g[ey][ex]='E';const[sx,sy]=free();g[sy][sx]='S';
 const map=g.map(r=>r.join(''));const L=SIM.parseLevel({map});if(SIM.contacts(L,sx,sy).length===0)continue;
 const r=solve(map,()=>true);if(!r.win||r.dead>0||r.win.length<O.minLen||r.win.length>O.maxLen)continue;
 if(O.needTap){if(solve(map,a=>a!=='TAP').win)continue;let st3=SIM.newState(L),okk=true;for(const a of r.win){if(a==='TAP'&&SIM.contacts(L,st3.i,st3.j).length!==1)okk=false;st3=SIM.simulate(L,st3,a).st;}if(!okk)continue;}
 const pc=pathCells(L,r.win);
 if(O.needDeflect&&!pc.tags.has('deflect'))continue;
 if(O.needEvents.some(e=>!pc.tags.has(e)))continue;
 if(O.needDeath&&!r.dtypes.has(O.needDeath))continue;
 if(O.needBend){const map2=map.map(row=>row.replace(/O/g,'.'));const L2=SIM.parseLevel({map:map2});let st2=SIM.newState(L2),same=true;for(const a of r.win){const s=SIM.simulate(L2,st2,a);if(!s.ok){same=false;break;}st2=s.st;if(st2.mode==='exit')break;}if(same&&st2.mode==='exit')continue;}
 const score=r.win.length*2+[...pc.tags].filter(t=>O.needEvents.includes(t)).length+Math.min(r.deaths,6)+Math.min(r.states,30)/5+(pc.tags.has('deflect')?2:0);
 if(!best||score>best.score){best={score,map,win:r.win,deaths:r.deaths,states:r.states,cells:pc.cells};}
}
if(best){ // breadcrumb shards on empty cells along the solution (spread out)
 const g=best.map.map(r=>r.split(''));const cand=best.cells.filter(([i,j])=>g[j]&&g[j][i]==='.');const n=Math.min(3,cand.length);
 for(let k=0;k<n;k++){const [i,j]=cand[Math.floor((k+0.5)*cand.length/n)];g[j][i]='*';}
 best.map=g.map(r=>r.join(''));console.log(JSON.stringify(best));}
else console.log('null');
