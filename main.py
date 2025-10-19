from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import math, random, time
import numpy as np

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ------------------ Utility ------------------
def euclidean(a,b):
    return math.hypot(a[0]-b[0], a[1]-b[1])

def build_distance_matrix(coords):
    n = len(coords)
    D = np.zeros((n,n))
    for i in range(n):
        for j in range(n):
            if i==j:
                D[i,j] = 1e-9
            else:
                D[i,j] = euclidean(coords[i], coords[j])
    return D

# ------------------ ACO with snapshots ------------------
def run_aco_snapshots(coords, num_ants=20, num_iterations=60,
                      alpha=1.0, beta=5.0, rho=0.5, q=100.0, snapshot_every=1):
    n = len(coords)
    D = build_distance_matrix(coords)
    pheromone = np.ones((n,n))
    best_tour = None
    best_len = float('inf')
    snapshots = []

    for it in range(num_iterations):
        all_tours = []
        all_lengths = []
        for ant in range(num_ants):
            start = random.randrange(n)
            tour = [start]
            visited = set(tour)
            current = start
            while len(visited) < n:
                probs = []
                denom = 0.0
                for j in range(n):
                    if j in visited:
                        probs.append(0.0)
                    else:
                        tau = pheromone[current,j] ** alpha
                        eta = (1.0 / D[current,j]) ** beta
                        val = tau * eta
                        probs.append(val)
                        denom += val
                if denom == 0:
                    choices = [j for j in range(n) if j not in visited]
                    nxt = random.choice(choices)
                else:
                    probs = [p/denom for p in probs]
                    r = random.random()
                    cum = 0.0
                    nxt = None
                    for idx,p in enumerate(probs):
                        cum += p
                        if r <= cum:
                            nxt = idx
                            break
                    if nxt is None:
                        nxt = np.argmax(probs)
                tour.append(nxt)
                visited.add(nxt)
                current = nxt

            tour_length = 0.0
            for i in range(len(tour)):
                a = tour[i]
                b = tour[(i+1)%len(tour)]
                tour_length += D[a,b]
            all_tours.append(tour)
            all_lengths.append(tour_length)
            if tour_length < best_len:
                best_len = tour_length
                best_tour = tour.copy()

        pheromone *= (1 - rho)
        for tour, length in zip(all_tours, all_lengths):
            deposit = q / (length + 1e-9)
            for i in range(len(tour)):
                a = tour[i]
                b = tour[(i+1)%len(tour)]
                pheromone[a,b] += deposit
                pheromone[b,a] += deposit

        if (it % snapshot_every) == 0:
            # normalize pheromone for visualization
            maxp = pheromone.max() if pheromone.max() > 0 else 1.0
            snapshots.append({
                "iteration": it,
                "pheromone": (pheromone / maxp).tolist(),
                "best_len": best_len
            })

    return {
        "coords": coords,
        "best_tour": best_tour,
        "best_length": best_len,
        "snapshots": snapshots
    }

# ------------------ PSO (2D minimization) with snapshots ------------------
def run_pso_snapshots(func, bounds, num_particles=30, iterations=60,
                      w=0.7, c1=1.4, c2=1.4, snapshot_every=1):
    # bounds: [(xmin,xmax), (ymin,ymax)]
    dim = 2
    lb = np.array([b[0] for b in bounds])
    ub = np.array([b[1] for b in bounds])
    pos = np.random.uniform(lb, ub, (num_particles, dim))
    vel = np.zeros_like(pos)
    pbest = pos.copy()
    pbest_val = np.array([func(p[0], p[1]) for p in pos])
    gbest_idx = int(np.argmin(pbest_val))
    gbest = pbest[gbest_idx].copy()
    snapshots = []

    for it in range(iterations):
        for i in range(num_particles):
            r1, r2 = random.random(), random.random()
            vel[i] = w*vel[i] + c1*r1*(pbest[i]-pos[i]) + c2*r2*(gbest-pos[i])
            pos[i] = pos[i] + vel[i]
            # clamp
            pos[i] = np.minimum(np.maximum(pos[i], lb), ub)
            val = func(pos[i,0], pos[i,1])
            if val < pbest_val[i]:
                pbest_val[i] = val
                pbest[i] = pos[i].copy()
        gbest_idx = int(np.argmin(pbest_val))
        gbest = pbest[gbest_idx].copy()
        gbest_val = float(pbest_val[gbest_idx])
        if (it % snapshot_every) == 0:
            snapshots.append({
                "iteration": it,
                "positions": pos.tolist(),
                "pbest": pbest.tolist(),
                "gbest": gbest.tolist(),
                "gbest_val": gbest_val
            })
    return {"snapshots": snapshots, "gbest": gbest.tolist(), "gbest_val": gbest_val}

# ------------------ ABC (simple) with snapshots ------------------
def run_abc_snapshots(func, bounds, food_sources=15, iterations=60, limit=10, snapshot_every=1):
    dim = 2
    lb = np.array([b[0] for b in bounds])
    ub = np.array([b[1] for b in bounds])
    # initialize food sources randomly
    foods = np.random.uniform(lb, ub, (food_sources, dim))
    fitness = np.array([1.0/(1.0+func(x[0], x[1])) for x in foods])
    trials = np.zeros(food_sources, dtype=int)
    snapshots = []

    def neighbor(x):
        k = random.randrange(food_sources)
        phi = np.random.uniform(-1,1,dim)
        v = x + phi*(x - foods[k])
        return np.minimum(np.maximum(v, lb), ub)

    for it in range(iterations):
        # employed bees: search neighbors
        for i in range(food_sources):
            v = neighbor(foods[i])
            if func(v[0], v[1]) < func(foods[i,0], foods[i,1]):
                foods[i] = v
                fitness[i] = 1.0/(1.0+func(v[0], v[1]))
                trials[i] = 0
            else:
                trials[i] += 1
        # calculate probabilities for onlookers
        probs = fitness / fitness.sum()
        # onlooker bees
        for _ in range(food_sources):
            i = np.random.choice(range(food_sources), p=probs)
            v = neighbor(foods[i])
            if func(v[0], v[1]) < func(foods[i,0], foods[i,1]):
                foods[i] = v
                fitness[i] = 1.0/(1.0+func(v[0], v[1]))
                trials[i] = 0
            else:
                trials[i] += 1
        # scout bees: replace if limit exceeded
        for i in range(food_sources):
            if trials[i] > limit:
                foods[i] = np.random.uniform(lb, ub, dim)
                fitness[i] = 1.0/(1.0+func(foods[i,0], foods[i,1]))
                trials[i] = 0

        best_idx = int(np.argmax(fitness))
        best_val = func(foods[best_idx,0], foods[best_idx,1])
        if (it % snapshot_every) == 0:
            snapshots.append({
                "iteration": it,
                "foods": foods.tolist(),
                "best_food": foods[best_idx].tolist(),
                "best_val": best_val
            })

    return {"snapshots": snapshots, "best_food": foods[best_idx].tolist(), "best_val": best_val}

# ------------------ Web routes ------------------
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/aco", response_class=HTMLResponse)
async def aco_page(request: Request):
    return templates.TemplateResponse("aco.html", {"request": request})

@app.get("/pso", response_class=HTMLResponse)
async def pso_page(request: Request):
    return templates.TemplateResponse("pso.html", {"request": request})

@app.get("/abc", response_class=HTMLResponse)
async def abc_page(request: Request):
    return templates.TemplateResponse("abc.html", {"request": request})

@app.post("/run_aco")
async def run_aco(request: Request):
    payload = await request.json()
    coords = payload.get("coords")
    if not coords or len(coords) < 3:
        # provide default coords if invalid
        coords = [[100,100],[400,120],[300,350],[120,300],[520,320]]
    num_ants = int(payload.get("num_ants", 30))
    num_iterations = int(payload.get("num_iterations", 60))
    alpha = float(payload.get("alpha", 1.0))
    beta = float(payload.get("beta", 5.0))
    rho = float(payload.get("rho", 0.5))
    snapshot_every = int(payload.get("snapshot_every", 1))
    res = run_aco_snapshots(coords, num_ants, num_iterations, alpha, beta, rho, snapshot_every=snapshot_every)
    return JSONResponse(res)

@app.post("/run_pso")
async def run_pso(request: Request):
    payload = await request.json()
    # function: Rastrigin-like simple multimodal
    def f(x,y):
        return (x**2 + y**2) + 10*(2 - math.cos(2*math.pi*x) - math.cos(2*math.pi*y))
    bounds = [(-5,5), (-5,5)]
    num_particles = int(payload.get("num_particles", 30))
    iterations = int(payload.get("iterations", 60))
    snapshot_every = int(payload.get("snapshot_every", 1))
    res = run_pso_snapshots(f, bounds, num_particles, iterations, snapshot_every=snapshot_every)
    return JSONResponse(res)

@app.post("/run_abc")
async def run_abc(request: Request):
    payload = await request.json()
    def f(x,y):
        # simple sphere
        return x**2 + y**2
    bounds = [(-5,5), (-5,5)]
    food_sources = int(payload.get("food_sources", 15))
    iterations = int(payload.get("iterations", 60))
    snapshot_every = int(payload.get("snapshot_every", 1))
    res = run_abc_snapshots(f, bounds, food_sources, iterations, snapshot_every=snapshot_every)
    return JSONResponse(res)
