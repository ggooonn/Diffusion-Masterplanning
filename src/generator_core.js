// Space Colonization Algorithm - Grid Analysis View
// 3x3 Parallel Simulation + More Angular and Rough Terrain Shape

// --- Global Settings (Common to all 9 simulations) ---
// *Reduced count for performance (2000 -> 600)*
let ATTRACTION_COUNT_PER_CELL = 600; 
let INFLUENCE_RADIUS = 25;   // Radius to detect attractors
let KILL_RADIUS = 4;         // Radius to remove attractors
let BRANCH_LENGTH = 4;       // Length of each branch segment
// -------------------------

// Grid Settings
let COLS = 3;
let ROWS = 3;
let CELL_SIZE = 280; // Size of each simulation cell
let PADDING = 10;    // Padding between cells
let simulations = []; // Array to store 9 simulation objects

function setup() {
  // Calculate total canvas size (Grid + Padding)
  let totalWidth = COLS * CELL_SIZE + (COLS + 1) * PADDING;
  let totalHeight = ROWS * CELL_SIZE + (ROWS + 1) * PADDING;
  createCanvas(totalWidth, totalHeight);
  
  // Create and place simulations on the 3x3 grid
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      let x = PADDING + i * (CELL_SIZE + PADDING);
      let y = PADDING + j * (CELL_SIZE + PADDING);
      // Create simulation object passing x, y, and size
      simulations.push(new Simulation(x, y, CELL_SIZE));
    }
  }
}

function draw() {
  background(245); // Light gray background (for grid separation)

  let allFinished = true;
  // Run and draw each of the 9 stored simulations
  for (let sim of simulations) {
    sim.run();
    if (!sim.finished) {
      allFinished = false;
    }
  }

  if (allFinished) {
    noLoop();
    console.log("All 9 Simulations Complete");
  }
}

// =========================================================
// 📦 Simulation Class: Manages a single independent simulation unit
// =========================================================
class Simulation {
  constructor(offsetX, offsetY, size) {
    this.offsetX = offsetX; // Top-left X on grid
    this.offsetY = offsetY; // Top-left Y on grid
    this.size = size;
    this.centerX = this.offsetX + this.size / 2;
    this.centerY = this.offsetY + this.size / 2;
    this.finished = false;

    // Set zone radius relative to cell size
    let avgR = this.size * 0.35; 
    this.zone = new ContaminatedZone(this.centerX, this.centerY, avgR);
    // Pass zone info to the Tree
    this.tree = new Tree(this.zone); 
  }

  run() {
    // Draw cell boundary (Optional)
    noFill(); stroke(220); rect(this.offsetX, this.offsetY, this.size, this.size);
    
    // Draw and update simulation elements
    this.zone.showZoneOutline();
    this.zone.showAttractors();
    
    if (!this.finished) {
      this.tree.grow();
    }
    this.tree.show();

    // Check termination condition
    if (!this.finished) {
        let active = this.zone.attractors.filter(a => !a.reached).length;
        if (active === 0 && frameCount > 50) {
            this.finished = true;
        }
    }
  }
}

// =========================================================
// 1. ContaminatedZone Class: 💥 Core Modification (Angular & Rough Shape)
// =========================================================
class ContaminatedZone {
  constructor(x, y, avgR) {
    this.pos = createVector(x, y);
    this.avgR = avgR;
    this.attractors = [];
    this.points = []; 

    // --- Terrain Shape Generation Algorithm ---
    // Reduced point count (80) to emphasize straight angular sections
    let numPoints = 80; 
    
    // Using two noise layers:
    // 1. Base Noise: Overall large curvature
    // 2. Rough Noise: Jagged and angular details
    let baseNoiseScale = 2.0;
    let roughNoiseScale = 8.0; // High frequency (rougher)
    let noiseOffset = random(1000); // Unique shape for each simulation

    for (let i = 0; i < numPoints; i++) {
      let angle = map(i, 0, numPoints, 0, TWO_PI);
      
      // Base noise
      let bx = map(cos(angle), -1, 1, 0, baseNoiseScale);
      let by = map(sin(angle), -1, 1, 0, baseNoiseScale);
      let baseN = noise(bx + noiseOffset, by + noiseOffset);
      
      // Rough detail noise
      let rx = map(cos(angle), -1, 1, 0, roughNoiseScale);
      let ry = map(sin(angle), -1, 1, 0, roughNoiseScale);
      let roughN = noise(rx + noiseOffset + 500, ry + noiseOffset + 500);

      // Combine noises. Rough noise adds sharp changes to radius
      let r = avgR * map(baseN, 0, 1, 0.8, 1.2);
      r += map(roughN, 0, 1, -15, 15); // Add abrupt changes (-15 ~ +15 px)

      // Occasionally add sharp protrusions (Emphasize angular look)
      if (random() < 0.08) {
         r += random(15, 30) * (random() > 0.5 ? 1 : -1);
      }

      let px = x + r * cos(angle);
      let py = y + r * sin(angle);
      this.points.push(createVector(px, py));
    }

    // --- Generate Attractors ---
    let count = 0;
    let safetyLoops = 0;
    while (count < ATTRACTION_COUNT_PER_CELL && safetyLoops < 5000) {
      let rx = random(x - avgR * 1.5, x + avgR * 1.5);
      let ry = random(y - avgR * 1.5, y + avgR * 1.5);
      let p = createVector(rx, ry);

      if (this.isInside(p)) {
        this.attractors.push(new Attractor(p));
        count++;
      }
      safetyLoops++;
    }
  }

  // Ray Casting Algorithm (Check if point is inside)
  isInside(p) {
    let x = p.x, y = p.y;
    let inside = false;
    for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
      let xi = this.points[i].x, yi = this.points[i].y;
      let xj = this.points[j].x, yj = this.points[j].y;
      let intersect = ((yi > y) != (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  showAttractors() {
    noStroke();
    fill(255, 50, 50, 80); // Red analysis points
    for (let a of this.attractors) {
      if (!a.reached) ellipse(a.pos.x, a.pos.y, 2.5, 2.5);
    }
  }

  showZoneOutline() {
    noFill();
    stroke(60); 
    strokeWeight(1.2);
    beginShape();
    // Use vertex() to maintain angular look
    for (let p of this.points) {
      vertex(p.x, p.y);
    }
    endShape(CLOSE);
  }
}

// =========================================================
// 2. Attractor & Branch Classes (Same logic, adjusted scale)
// =========================================================
class Attractor {
  constructor(pos) {
    this.pos = pos;
    this.reached = false;
  }
}

class Branch {
  constructor(parent, pos, dir, rootOrigin, zone) {
    this.parent = parent;
    this.pos = pos;
    this.dir = dir;
    this.origDir = this.dir.copy();
    this.rootOrigin = rootOrigin; 
    this.zone = zone; // Needs info about the Zone it belongs to

    this.attractorDirSum = createVector(0, 0);
    this.attractorCount = 0;
    this.len = BRANCH_LENGTH;
  }

  next() {
    if (this.attractorCount > 0) {
      let avgPullDir = this.attractorDirSum.div(this.attractorCount);
      avgPullDir.normalize();
      
      let nextDir = p5.Vector.add(this.origDir.copy().mult(0.3), avgPullDir.copy().mult(0.7));
      nextDir.normalize();
      let nextPos = p5.Vector.add(this.pos, nextDir.copy().mult(this.len));

      // Check inside/outside relative to its own zone
      if (!this.zone.isInside(nextPos)) return null;

      return new Branch(this, nextPos, nextDir, this.rootOrigin, this.zone);
    }
    return null;
  }

  show() {
    if (this.parent != null) {
      let d = dist(this.pos.x, this.pos.y, this.rootOrigin.x, this.rootOrigin.y);
      // Reduced max distance due to smaller scale (e.g., 100px)
      let t = map(d, 0, 100, 0, 1); 
      t = constrain(t, 0, 1);

      let col;
      let c1 = color(30, 80, 220, 200);   // Root (Blue)
      let c2 = color(30, 180, 60, 200);   // Mid (Green)
      let c3 = color(220, 230, 30, 200);  // Tip (Yellow/Lime)

      if (t < 0.5) {
        col = lerpColor(c1, c2, map(t, 0, 0.5, 0, 1));
      } else {
        col = lerpColor(c2, c3, map(t, 0.5, 1, 0, 1));
      }

      stroke(col);
      // Adjust stroke weight based on scale
      strokeWeight(map(t, 0, 1, 2.5, 0.8)); 
      line(this.pos.x, this.pos.y, this.parent.pos.x, this.parent.pos.y);
    }
  }

  reset() {
    this.attractorDirSum.set(0, 0);
    this.attractorCount = 0;
  }
}

// =========================================================
// 3. Tree Class (Bound to a specific Zone)
// =========================================================
class Tree {
  constructor(zone) {
    this.zone = zone; // The Zone this tree belongs to
    this.branches = [];
    this.attractors = this.zone.attractors;
    
    // Find 3 random starting points (Roots) inside the Zone
    let rootsFound = 0;
    let attempts = 0;
    // Limit search range around Zone center
    let searchRect = this.zone.avgR * 1.5; 

    while(rootsFound < 3 && attempts < 2000) {
      let rx = random(this.zone.pos.x - searchRect, this.zone.pos.x + searchRect);
      let ry = random(this.zone.pos.y - searchRect, this.zone.pos.y + searchRect);
      let p = createVector(rx, ry);

      if (this.zone.isInside(p)) {
        let tooClose = false;
        for (let b of this.branches) {
           // Prevent roots from being too close (30px considering scale)
           if (p5.Vector.dist(b.pos, p) < 30) tooClose = true;
        }
        
        if (!tooClose) {
          let dir = p5.Vector.random2D();
          // Pass zone info when creating branch
          this.branches.push(new Branch(null, p, dir, p, this.zone));
          rootsFound++;
        }
      }
      attempts++;
    }
  }

  grow() {
    // 1. Find Attractors
    for (let i = 0; i < this.attractors.length; i++) {
      let attractor = this.attractors[i];
      if (attractor.reached) continue;

      let closestBranch = null;
      let recordDist = INFLUENCE_RADIUS;

      for (let branch of this.branches) {
        let d = p5.Vector.dist(attractor.pos, branch.pos);
        if (d < KILL_RADIUS) {
          attractor.reached = true;
          closestBranch = null;
          break; 
        } else if (d < recordDist) {
          closestBranch = branch;
          recordDist = d;
        }
      }

      if (closestBranch != null) {
        let newDir = p5.Vector.sub(attractor.pos, closestBranch.pos);
        newDir.normalize();
        closestBranch.attractorDirSum.add(newDir);
        closestBranch.attractorCount++;
      }
    }

    // 2. Generate Branches
    let newBranches = [];
    for (let i = this.branches.length - 1; i >= 0; i--) {
      let branch = this.branches[i];
      let next = branch.next();
      if (next != null) {
        newBranches.push(next);
      }
      branch.reset();
    }
    this.branches.push(...newBranches);
  }

  show() {
    for (let branch of this.branches) {
      branch.show();
    }
  }
}