class QuadTree {
  constructor(boundary, capacity) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.objects = [];
    this.divided = false;
    this.northwest = null;
    this.northeast = null;
    this.southwest = null;
    this.southeast = null;
  }

  draw(ctx) {
    // Draw current boundary
    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(
      this.boundary.x,
      this.boundary.y,
      this.boundary.w,
      this.boundary.h
    );
    ctx.stroke();

    // If this node contains objects, highlight it
    if (this.objects.length > 0) {
      ctx.fillStyle = "rgba(255, 255, 0, 0.1)";
      ctx.fillRect(
        this.boundary.x,
        this.boundary.y,
        this.boundary.w,
        this.boundary.h
      );
    }

    // Recursively draw subdivisions
    if (this.divided) {
      this.northwest.draw(ctx);
      this.northeast.draw(ctx);
      this.southwest.draw(ctx);
      this.southeast.draw(ctx);
    }
  }

  intersects(rect) {
    return !(
      rect.x > this.boundary.x + this.boundary.w ||
      rect.x + rect.w < this.boundary.x ||
      rect.y > this.boundary.y + this.boundary.h ||
      rect.y + rect.h < this.boundary.y
    );
  }

  subdivide() {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.w / 2;
    const h = this.boundary.h / 2;

    this.northwest = new QuadTree({ x: x, y: y, w: w, h: h }, this.capacity);
    this.northeast = new QuadTree(
      { x: x + w, y: y, w: w, h: h },
      this.capacity
    );
    this.southwest = new QuadTree(
      { x: x, y: y + h, w: w, h: h },
      this.capacity
    );
    this.southeast = new QuadTree(
      { x: x + w, y: y + h, w: w, h: h },
      this.capacity
    );
    this.divided = true;
  }

  insert(object) {
    if (
      !this.intersects({
        x: object.x - (object.r || 0),
        y: object.y - (object.r || 0),
        w: object.r ? object.r * 2 : object.w || 0,
        h: object.r ? object.r * 2 : object.h || 0,
      })
    )
      return false;

    if (this.objects.length < this.capacity) {
      this.objects.push(object);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
      // Redistribute existing objects
      const existingObjects = this.objects;
      this.objects = [];
      for (let obj of existingObjects) {
        this.northwest.insert(obj) ||
          this.northeast.insert(obj) ||
          this.southwest.insert(obj) ||
          this.southeast.insert(obj);
      }
    }

    return (
      this.northwest.insert(object) ||
      this.northeast.insert(object) ||
      this.southwest.insert(object) ||
      this.southeast.insert(object)
    );
  }

  contains(object) {
    // For circles, check if the circle's bounding box is within the boundary
    if (object.r) {
      return (
        object.x - object.r >= this.boundary.x &&
        object.x + object.r <= this.boundary.x + this.boundary.w &&
        object.y - object.r >= this.boundary.y &&
        object.y + object.r <= this.boundary.y + this.boundary.h
      );
    }
    // For rectangles, check if the rectangle is within the boundary
    return (
      object.x >= this.boundary.x &&
      object.x + (object.w || 0) <= this.boundary.x + this.boundary.w &&
      object.y >= this.boundary.y &&
      object.y + (object.h || 0) <= this.boundary.y + this.boundary.h
    );
  }

  query(range, found = []) {
    if (!this.intersects(range)) return found;

    for (let object of this.objects) {
      if (this.pointInRange(object, range)) {
        found.push(object);
      }
    }

    if (this.divided) {
      this.northwest.query(range, found);
      this.northeast.query(range, found);
      this.southwest.query(range, found);
      this.southeast.query(range, found);
    }

    return found;
  }

  intersects(range) {
    return !(
      range.x > this.boundary.x + this.boundary.w ||
      range.x + range.w < this.boundary.x ||
      range.y > this.boundary.y + this.boundary.h ||
      range.y + range.h < this.boundary.y
    );
  }

  pointInRange(point, range) {
    return (
      point.x >= range.x &&
      point.x <= range.x + range.w &&
      point.y >= range.y &&
      point.y <= range.y + range.h
    );
  }
}

class cvh_physics_manager {
  constructor(game, opt) {
    this.game = game;
    this.ctx = game.ctx;
    this.om = game.om;
    game.pm = this;
    this.drag = opt?.drag || 0;
    this.gravity = opt?.gravity || 0;
    this.quadTreeCapacity = opt?.quadTreeCapacity || 1;
    this.draw_quad_tree = opt?.draw_quad_tree || false;

    // Initialize FPS tracking
    this.fps = 0;
    this.fpsAlpha = 0.1; // Smoothing factor
  }

  update_physics(dt) {
    // Calculate and smooth FPS
    const currentFps = 1 / dt;
    this.fps = this.fps
      ? this.fps * (1 - this.fpsAlpha) + currentFps * this.fpsAlpha
      : currentFps;

    // Display FPS
    this.ctx.fillStyle = "white";
    this.ctx.font = "16px Arial";
    this.ctx.fillText(`FPS: ${Math.round(this.fps)}`, 40, 20);

    dt = dt * 10;
    this.om.objects.forEach((o) => {
      // Skip objects without physics or fixed objects
      if (!o.mass || o.fixed) return;

      // Apply gravity
      o.vy += this.gravity * dt;

      // Apply drag force
      o.vx *= 1 - this.drag * dt;
      o.vy *= 1 - this.drag * dt;

      // Update position
      o.x += o.vx * dt;
      o.y += o.vy * dt;

      // Check if object is out of bounds and should be removed
      if (this.om.killOutOfBounds) {
        if (
          o.x < -o.r ||
          o.x > this.game.canvas.width + o.r ||
          o.y < -o.r ||
          o.y > this.game.canvas.height + o.r
        ) {
          this.om.kill_object(o);
        }
      }
    });

    // Create quadtree for current frame
    this.quadTree = new QuadTree(
      {
        x: 0,
        y: 0,
        w: this.game.canvas.width,
        h: this.game.canvas.height,
      },
      this.quadTreeCapacity
    );

    // Insert objects into quadtree
    this.om.objects.forEach((o) => {
      if (!o.mass) return;
      this.quadTree.insert(o);
    });

    //collision check
    const collisions = this.getAllCollisions();
    collisions.forEach((collision) => {
      const [a, b] = collision;
      // Skip collision resolution if both objects are fixed
      if (a.fixed && b.fixed) return;
      this.resolveCollision(a, b, dt);
    });

    //this.positionalCorrection(collisions);
  }
  getCollisions(o) {
    const range = {
      x: o.x - (o.r || 0) * 2,
      y: o.y - (o.r || 0) * 2,
      w: o.r ? o.r * 2 * 2 : o.w || 0,
      h: o.r ? o.r * 2 * 2 : o.h || 0,
    };
    const potentialCollisions = this.quadTree.query(range);
    return potentialCollisions.filter((other) => {
      if (o === other) return false;
      // Skip collision if either object should only collide with fixed objects
      // and the other object is not fixed
      if (
        (o.collideWithFixedOnly && !other.fixed) ||
        (other.collideWithFixedOnly && !o.fixed)
      ) {
        // Handle onPassthrough event
        if (
          (o.fixed && o.collideWithFixedOnly && other.onPassthrough) ||
          (other.fixed && other.collideWithFixedOnly && o.onPassthrough)
        ) {
          const fixedObj = o.fixed ? o : other;
          const movingObj = o.fixed ? other : o;

          movingObj.onPassthrough(fixedObj);
        }
        return false;
      }
      return this.checkCollision(o, other);
    });
  }
  getAllCollisions() {
    const collisions = new Set();
    const processedPairs = new Set();

    this.om.objects.forEach((o) => {
      if (!o.mass) return;

      this.getCollisions(o).forEach((other) => {
        // Create a unique key for this collision pair
        const pairKey = [o.id, other.id].sort().join("-");

        // Only process if we haven't seen this pair before
        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          collisions.add([o, other]);
        }
      });
    });

    return Array.from(collisions);
  }
  positionalCorrection(collisions, iterations = 10) {
    for (let i = 0; i < iterations; i++) {
      // Assume getCollisions() returns an array of collision objects,
      // where each collision has properties 'a' and 'b'

      collisions.forEach((collision) => {
        const a = collision[0];
        const b = collision[1];

        // Compute the vector from a to b.
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);

        // If the centers are exactly overlapping, choose an arbitrary direction.
        if (distance === 0) {
          dx = 1;
          dy = 0;
          distance = 1;
        }

        // Calculate the overlap amount.
        const overlap = a.r + b.r - distance;

        // Only correct if there is an overlap.
        if (overlap > 0) {
          // Normalize the vector from a to b.
          const nx = dx / distance;
          const ny = dy / distance;

          // Each object will be moved half the overlap distance.
          const correctionX = nx * (overlap / 2);
          const correctionY = ny * (overlap / 2);

          // Only move non-fixed objects
          if (!a.fixed) {
            a.x -= correctionX;
            a.y -= correctionY;
          }
          if (!b.fixed) {
            b.x += correctionX;
            b.y += correctionY;
          }
          // If both objects are fixed, no movement occurs
        }
      });
    }
  }
  checkCollision(a, b) {
    // Skip collision check if either object should only collide with fixed objects
    // and the other object is not fixed
    if (
      (a.collideWithFixedOnly && !b.fixed) ||
      (b.collideWithFixedOnly && !a.fixed)
    ) {
      return false;
    }

    if (a.r && b.r) {
      // Only handle circle-circle collision
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = a.r + b.r;

      if (distance < minDistance) {
        // Iteratively separate objects over 6 iterations
        const iterations = 6;
        for (let i = 0; i < iterations; i++) {
          const currentDistance = Math.sqrt(
            (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)
          );
          const overlap = minDistance - currentDistance;
          const moveX = ((b.x - a.x) / currentDistance) * overlap * 0.5;
          const moveY = ((b.y - a.y) / currentDistance) * overlap * 0.5;

          if (!a.fixed) {
            a.x -= moveX / iterations;
            a.y -= moveY / iterations;
          }
          if (!b.fixed) {
            b.x += moveX / iterations;
            b.y += moveY / iterations;
          }
        }
        return true;
      }
    }
    return false;
  }

  resolveCollision(a, b, dt) {
    // If both objects are fixed, no need to resolve collision
    if (a.fixed && b.fixed) return;

    // Call onCollision handlers if they exist
    if (a.onCollision) a.onCollision(b);
    if (b.onCollision) b.onCollision(a);

    // Compute the vector between centers using consistent math operations
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy); // More precise than Math.sqrt(dx * dx + dy * dy)

    // Avoid divide–by–zero; if centers are identical, choose an arbitrary normal.
    if (dist === 0) {
      //dx = 1;
      //dy = 0;
      //dist = 1;
      return; // Skip collision resolution for perfectly overlapping objects
    }

    // Only resolve if the objects overlap
    if (dist >= a.r + b.r) return;

    // Normal vector (points from a to b)
    const nx = dx / dist;
    const ny = dy / dist;

    // Tangent vector (perpendicular to n)
    const tx = -ny;
    const ty = nx;

    // For fixed objects, treat their mass as infinite (inverse mass as 0)
    const invMassA = a.fixed ? 0 : 1 / a.mass;
    const invMassB = b.fixed ? 0 : 1 / b.mass;

    // If both objects are fixed, no need to continue
    if (invMassA === 0 && invMassB === 0) return;

    // Calculate velocities at the contact points
    const aContactVx = a.fixed ? 0 : a.vx - (a.vr || 0) * a.r * ny;
    const aContactVy = a.fixed ? 0 : a.vy + (a.vr || 0) * a.r * nx;
    const bContactVx = b.fixed ? 0 : b.vx + (b.vr || 0) * b.r * ny;
    const bContactVy = b.fixed ? 0 : b.vy - (b.vr || 0) * b.r * nx;

    // Relative velocity at the contact point
    const rvx = bContactVx - aContactVx;
    const rvy = bContactVy - aContactVy;

    // Decompose the relative velocity
    const vRelN = rvx * nx + rvy * ny;
    const vRelT = rvx * tx + rvy * ty;

    // Normal impulse with fixed coefficients
    const e = Math.min(a.bounciness || 1.0, b.bounciness || 1.0);
    const jnDenom = invMassA + invMassB;
    const jn = (-(1 + e) * vRelN) / jnDenom;

    // Apply normal impulse
    if (!a.fixed) {
      a.vx -= jn * nx * invMassA;
      a.vy -= jn * ny * invMassA;
    }
    if (!b.fixed) {
      b.vx += jn * nx * invMassB;
      b.vy += jn * ny * invMassB;
    }

    // Friction impulse with fixed coefficient
    if (!a.fixed || !b.fixed) {
      const mu = 0.2; // Fixed friction coefficient
      const I_a = a.fixed ? Infinity : 0.5 * a.mass * a.r * a.r;
      const I_b = b.fixed ? Infinity : 0.5 * b.mass * b.r * b.r;
      const frictionDenom =
        invMassA +
        invMassB +
        (a.fixed ? 0 : (a.r * a.r) / I_a) +
        (b.fixed ? 0 : (b.r * b.r) / I_b);
      let jt = -vRelT / frictionDenom;

      // Clamp friction impulse
      if (Math.abs(jt) > mu * Math.abs(jn)) {
        jt = mu * Math.abs(jn) * (jt < 0 ? -1 : 1);
      }

      // Apply friction impulse
      if (!a.fixed) {
        a.vx -= jt * tx * invMassA;
        a.vy -= jt * ty * invMassA;
        a.vr = (a.vr || 0) - (a.r * jt) / I_a;
      }
      if (!b.fixed) {
        b.vx += jt * tx * invMassB;
        b.vy += jt * ty * invMassB;
        b.vr = (b.vr || 0) + (b.r * jt) / I_b;
      }
    }
  }

  calculatePositionCorrection(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = a.r + b.r;

    if (distance < minDistance && distance > 0) {
      const correction = (minDistance - distance) / distance;
      return {
        x: -dx * correction * 0.5,
        y: -dy * correction * 0.5,
      };
    }
    return { x: 0, y: 0 };
  }
}
