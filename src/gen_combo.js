// Random search for a "combo" level where the launch pad, a ramp and a black-hole bend are all REQUIRED.
const fs=require('fs');const SIM=new Function(fs.readFileSync(__dirname+'/sim.js','utf8'))();
let seed=+process.argv[2]||1;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};const ri=n=>Math.floor(rnd()*n);
const W=11,Hh=12;
function solve(map,allow){const L=SIM.parseLevel({map});const key=s=>s.i+','+s.j;const st0=SIM.newState(L);const seen=new Map([[key(st0),null]]);const q=[st0];const edges=new Map();let win=null,deaths=0;
 while(q.length){const s=q.shift();edges.set(key(s),[]);for(const a of['L','R','U','D','TAP']){if(!allow(a))continue;const r=SIM.simulate(L,s,a);if(!r.ok)continue;
  const tags=new Set(r.events.map(e=>e.type));if(a==='TAP')tags.add('tap');
  if(r.st.mode==='exit'){edges.get(key(s)).push('EXIT');if(!win){win=[];let k=key(s);win.push(a);let p=seen.get(k);while(p){win.push(p.a);p=seen.get(p.k);}win.reverse();}continue;}
  if(r.st.mode==='dead'){deaths++;continue;}
  edges.get(key(s)).push(key(r.st));if(!seen.has(key(r.st))){seen.set(key(r.st),{k:key(s),a});q.push(r.st);}}}
 const cw=new Set();let ch=true;while(ch){ch=false;for(const[k,es]of edges)if(!cw.has(k)&&es.some(e=>e==='EXIT'||cw.has(e))){cw.add(k);ch=true;}}
 return {win,deaths,dead:[...edges.keys()].filter(k=>!cw.has(k)).length,states:seen.size};}
function straightFlight(L,st){/* is any flight curved */}
let best=null;
for(let it=0;it<+(process.argv[3]||3000);it++){
 const g=[];for(let j=0;j<Hh;j++){g.push([]);for(let i=0;i<W;i++)g[j].push(i==0||j==0||i==W-1||j==Hh-1?'#':'.');}
 const free=()=>{for(;;){const i=1+ri(W-2),j=1+ri(Hh-2);if(g[j][i]==='.')return[i,j];}};
 const nst=3+ri(4);for(let k=0;k<nst;k++){const[i,j]=free();g[j][i]='#';if(rnd()<0.4){const[i2,j2]=rnd()<0.5?[i+1,j]:[i,j+1];if(i2<W-1&&j2<Hh-1&&g[j2][i2]==='.')g[j2][i2]='#';}}
 // pad on an outer wall
 const side=ri(4);let pc; if(side==0)pc=[1+ri(W-2),0];else if(side==1)pc=[1+ri(W-2),Hh-1];else if(side==2)pc=[0,1+ri(Hh-2)];else pc=[W-1,1+ri(Hh-2)];
 g[pc[1]][pc[0]]='P';
 const[hx,hy]=free();g[hy][hx]='O';
 const nr=1+ri(2);for(let k=0;k<nr;k++){const[i,j]=free();g[j][i]='abcd'[ri(4)];}
 const[ex,ey]=free();g[ey][ex]='E';
 let[sx,sy]=free();g[sy][sx]='S';
 const map=g.map(r=>r.join(''));const L=SIM.parseLevel({map});if(SIM.contacts(L,sx,sy).length===0)continue;
 const r=solve(map,()=>true);if(!r.win||r.dead>0||r.win.length<4||r.win.length>7)continue;
 if(solve(map,a=>a!=='TAP').win)continue;           // pad must be needed
 // check ramp + bend actually used along the solution
 let st=SIM.newState(L),tags=new Set();for(const a of r.win){const s=SIM.simulate(L,st,a);s.events.forEach(e=>tags.add(e.type));const before=[st.i,st.j];st=s.st;}
 if(!tags.has('deflect'))continue;
 { // every TAP in the solution must be from a spot whose only contact is the pad (so the kick is the only way "away")
   let st3=SIM.newState(L),okk=true;for(const a of r.win){if(a==='TAP'){const c=SIM.contacts(L,st3.i,st3.j);if(c.length!==1)okk=false;}st3=SIM.simulate(L,st3,a).st;}
   if(!okk)continue; }
 // bend: hole-free version must not have the same solution
 const map2=map.map(row=>row.replace('O','.'));const L2=SIM.parseLevel({map:map2});let st2=SIM.newState(L2),same=true;for(const a of r.win){const s=SIM.simulate(L2,st2,a);if(!s.ok){same=false;break;}st2=s.st;if(st2.mode==='exit')break;}
 if(same&&st2.mode==='exit')continue;
 const score=r.win.length*2+r.deaths+Math.min(r.states,25)/5;
 if(!best||score>best.score){best={score,map,r};console.log(score.toFixed(1),r.win.join(' '),'deaths',r.deaths,'states',r.states);console.log(map.join('\n'));}
}
