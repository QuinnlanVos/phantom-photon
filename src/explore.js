// node explore.js '<json map array>' : prints, for each reachable state+move, cells traversed (for designing gravity levels)
const fs=require('fs'),path=require('path');const SIM=new Function(fs.readFileSync(path.join(__dirname,'sim.js'),'utf8'))();
const map=JSON.parse(process.argv[2]);const L=SIM.parseLevel({map});
const seen=new Map(),q=[SIM.newState(L)];seen.set(L.start+'',1);const cover=map.map(r=>r.split('').map(()=>0));
while(q.length){const s=q.shift();for(const a of ['L','R','U','D','TAP']){const st=JSON.parse(JSON.stringify(s));st.events=[];
 if(a==='TAP'){const d=SIM.padLaunchDir(L,st.i,st.j,st.normal);if(!d)continue;SIM.startFlight(st,d,true);}else{if(!SIM.checkMove(L,st.i,st.j,a).ok)continue;SIM.startFlight(st,a,false);}
 const cells=new Set();while(st.mode==='fly'){SIM.step(L,st,1/240);cells.add(Math.floor(st.x/48)+','+Math.floor(st.y/48));}
 console.log(`${s.i},${s.j} ${a} -> ${st.mode} ${st.mode==='stuck'?st.i+','+st.j:''} straight=${[...cells].every(c=>{const[i,j]=c.split(',').map(Number);return i===s.i||j===s.j;})}`);
 for(const c of cells){const[i,j]=c.split(',').map(Number);cover[j][i]++;}
 if(st.mode==='stuck'&&!seen.has(st.i+','+st.j)){seen.set(st.i+','+st.j,1);q.push(st);}}}
console.log(map.map((r,j)=>r.split('').map((ch,i)=>ch!=='.'?ch:(cover[j][i]?String.fromCharCode(96+Math.min(26,cover[j][i])):'.')).join(' ')).join('\n'));
