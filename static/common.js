// common helper
function parseCoords(text){
  const lines = text.trim().split('\n');
  const arr = [];
  for (let line of lines){
    const p = line.split(',').map(s => parseFloat(s.trim()));
    if (p.length===2 && !isNaN(p[0]) && !isNaN(p[1])) arr.push(p);
  }
  return arr;
}
