const canvasP = document.querySelector('#c');
const ctxP = canvasP.getContext('2d');
document.getElementById('run').onclick = async ()=>{
  const payload = {
    num_particles: parseInt(document.getElementById('num_particles').value),
    iterations: parseInt(document.getElementById('iterations').value),
    snapshot_every: parseInt(document.getElementById('snapshot_every').value)
  };
  const btn = document.getElementById('run');
  btn.disabled = true; btn.textContent = 'Running...';
  try{
    const res = await fetch('/run_pso', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const data = await res.json();
    const snaps = data.snapshots;
    let idx=0;
    const delay=400;
    const timer = setInterval(()=>{
      if (idx>=snaps.length){ clearInterval(timer); btn.disabled=false; btn.textContent='Run & Animate'; return;}
      renderPSO(snaps[idx]);
      idx++;
    }, delay);
  }catch(e){ console.error(e); alert('Error'); btn.disabled=false; btn.textContent='Run & Animate'; }
};

function renderPSO(snap){
  ctxP.clearRect(0,0,canvasP.width, canvasP.height);
  // draw particles
  const pos = snap.positions;
  for (let i=0;i<pos.length;i++){
    const x = mapToCanvas(pos[i][0], -5,5, canvasP.width);
    const y = mapToCanvas(pos[i][1], -5,5, canvasP.height, true);
    ctxP.beginPath();
    ctxP.arc(x,y,6,0,Math.PI*2);
    ctxP.fillStyle = '#198754'; ctxP.fill();
  }
  // draw gbest
  const gb = snap.gbest;
  const gx = mapToCanvas(gb[0], -5,5, canvasP.width);
  const gy = mapToCanvas(gb[1], -5,5, canvasP.height, true);
  ctxP.beginPath(); ctxP.arc(gx,gy,10,0,Math.PI*2); ctxP.strokeStyle='#0d6efd'; ctxP.lineWidth=2; ctxP.stroke();
  document.getElementById('gbest').textContent = snap.gbest_val.toFixed(3);
  ctxP.fillStyle='#000'; ctxP.fillText('Iter: '+snap.iteration, 10, 20);
}

function mapToCanvas(v, min, max, size, invert=false){
  const t = (v - min) / (max - min);
  return invert ? size - (t * size) : t * size;
}
