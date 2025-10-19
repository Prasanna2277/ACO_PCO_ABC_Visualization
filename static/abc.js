const canvasA = document.querySelector('#c');
const ctxA = canvasA.getContext('2d');
document.getElementById('run').onclick = async ()=>{
  const payload = {
    food_sources: parseInt(document.getElementById('food_sources').value),
    iterations: parseInt(document.getElementById('iterations').value),
    snapshot_every: parseInt(document.getElementById('snapshot_every').value)
  };
  const btn = document.getElementById('run');
  btn.disabled = true; btn.textContent = 'Running...';
  try{
    const res = await fetch('/run_abc', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const data = await res.json();
    const snaps = data.snapshots;
    let idx=0; const delay=400;
    const timer = setInterval(()=>{
      if (idx>=snaps.length){ clearInterval(timer); btn.disabled=false; btn.textContent='Run & Animate'; document.getElementById('best_val').textContent = data.best_val.toFixed(3); return;}
      renderABC(snaps[idx]);
      idx++;
    }, delay);
  }catch(e){ console.error(e); alert('Error'); btn.disabled=false; btn.textContent='Run & Animate'; }
};

function renderABC(snap){
  ctxA.clearRect(0,0,canvasA.width,canvasA.height);
  const foods = snap.foods;
  for (let i=0;i<foods.length;i++){
    const x = map(foods[i][0], -5,5, 0, canvasA.width);
    const y = map(foods[i][1], -5,5, 0, canvasA.height);
    ctxA.beginPath(); ctxA.arc(x,y,6,0,Math.PI*2); ctxA.fillStyle='#fd7e14'; ctxA.fill();
  }
  const bf = snap.best_food;
  const bx = map(bf[0], -5,5, 0, canvasA.width);
  const by = map(bf[1], -5,5, 0, canvasA.height);
  ctxA.beginPath(); ctxA.arc(bx,by,10,0,Math.PI*2); ctxA.strokeStyle='#dc3545'; ctxA.lineWidth=2; ctxA.stroke();
  ctxA.fillStyle='#000'; ctxA.fillText('Iter: '+snap.iteration, 10, 20);
}

function map(v, a,b, c,d){ return c + ((v-a)/(b-a)) * (d-c); }
