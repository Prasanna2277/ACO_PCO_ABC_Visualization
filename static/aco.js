const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const coordsInput = document.getElementById('coords');
const runBtn = document.getElementById('run');
const randBtn = document.getElementById('randomize');
const bestLenSpan = document.getElementById('best_len');

let coords = parseCoords(coordsInput.value);
let snapshots = [];
let animIdx = 0;
let animTimer = null;
const delay = 1000; // 2 seconds per iteration


function renderSnapshot(snap){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw edges by pheromone
  const pher = snap.pheromone;
  const n = coords.length;
  for (let i=0;i<n;i++){
    for (let j=i+1;j<n;j++){
      const p = pher[i][j];
      ctx.beginPath();
      ctx.moveTo(coords[i][0], coords[i][1]);
      ctx.lineTo(coords[j][0], coords[j][1]);
      ctx.lineWidth = 1 + 6 * p;
      ctx.strokeStyle = `rgba(13,110,253, ${0.12 + 0.7*p})`;
      ctx.stroke();
    }
  }
  // draw nodes
  for (let i=0;i<coords.length;i++){
    const [x,y] = coords[i];
    ctx.beginPath();
    ctx.arc(x,y,9,0,Math.PI*2);
    ctx.fillStyle = '#0d6efd';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText(i, x-4, y+4);
  }
  // show iteration label
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = '14px Arial';
  ctx.fillText('Iter: ' + snap.iteration, 10, 20);
}

async function runACO(){
  coords = parseCoords(coordsInput.value);
  const payload = {
    coords: coords,
    num_ants: parseInt(document.getElementById('num_ants').value),
    num_iterations: parseInt(document.getElementById('num_iterations').value),
    alpha: parseFloat(document.getElementById('alpha').value),
    beta: parseFloat(document.getElementById('beta').value),
    rho: parseFloat(document.getElementById('rho').value),
    snapshot_every: parseInt(document.getElementById('snapshot_every').value)
  };
  runBtn.disabled = true;
  runBtn.textContent = 'Running...';
  try {
    const res = await fetch('/run_aco',{method:'POST',headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const data = await res.json();
    snapshots = data.snapshots;
    coords = data.coords;
    document.getElementById('best_len').textContent = data.best_length.toFixed(2);
    animIdx = 0;
    if (animTimer) clearInterval(animTimer);
    animTimer = setInterval(()=>{
      if (animIdx >= snapshots.length){
        clearInterval(animTimer);
        runBtn.disabled = false;
        runBtn.textContent = 'Run & Animate';
        // final highlight: show best tour as red path:
        drawFinalTour(data.best_tour);
        return;
      }
      renderSnapshot(snapshots[animIdx]);
      animIdx++;
    }, delay);
  } catch(e){
    console.error(e);
    alert('Error running ACO');
    runBtn.disabled = false;
    runBtn.textContent = 'Run & Animate';
  }
}

function drawFinalTour(tour){
  // draw last pheromone snapshot then overlay path
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw faint edges
  for (let i=0;i<coords.length;i++){
    for (let j=i+1;j<coords.length;j++){
      ctx.beginPath();
      ctx.moveTo(coords[i][0], coords[i][1]);
      ctx.lineTo(coords[j][0], coords[j][1]);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = '#eee';
      ctx.stroke();
    }
  }
  // draw tour
  ctx.beginPath();
  for (let k=0;k<tour.length;k++){
    const idx = tour[k];
    const p = coords[idx];
    if (k===0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
  }
  // close
  ctx.lineTo(coords[tour[0]][0], coords[tour[0]][1]);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#dc3545';
  ctx.stroke();
  // nodes
  for (let i=0;i<coords.length;i++){
    const [x,y] = coords[i];
    ctx.beginPath();
    ctx.arc(x,y,9,0,Math.PI*2);
    ctx.fillStyle = '#0d6efd';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(i, x-4, y+4);
  }
}

runBtn.addEventListener('click', runACO);
randBtn.addEventListener('click', ()=>{
  const n = 4 + Math.floor(Math.random()*5);
  const arr = [];
  for (let i=0;i<n;i++){
    arr.push([60 + Math.random()*(canvas.width-120), 60 + Math.random()*(canvas.height-120)]);
  }
  coordsInput.value = arr.map(p=>`${Math.round(p[0])},${Math.round(p[1])}`).join('\n');
});
