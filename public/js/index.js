/* global cvh_game, cvh_object_manager, log */

const canvas = document.getElementById("mainCanvas");
const game = new cvh_game(
  canvas,
  [() => window.innerWidth, () => window.innerHeight],
  { backgroundColor: "#000" }
);
const om = new cvh_object_manager(game, {
  killOutOfBounds: true,
});
const pm = new cvh_physics_manager(game, {
  quadTreeCapacity: 1,
  drag: 0.05,
  gravity: 3,
});

pm.draw_quad_tree = false;

// Create a triangle of fixed balls pointing upward
const rows = 16; // Number of rows in the triangle
const ballRadius = 4; // Radius of each ball
const spacingY = 25 + ballRadius * 2; // Spacing between balls
const spacingX = 30 + ballRadius * 2;

const maxMultiplier = 500;
const minMultiplier = 0.2;

const rectangleHeight = 20;

// Calculate the starting position for the top ball (apex)
const startX = window.innerWidth / 2;
const startY = window.innerHeight / 6;

function scoreMultiply(x) {
  let stretch = (maxMultiplier - minMultiplier) / Math.pow((rows + 1) / 2, 2);
  let fx =
    Math.round(
      (stretch * Math.pow(x - (rows + 1) / 2, 2) + minMultiplier) * 10
    ) / 10;
  if (`${Math.ceil(fx)}`.length > 1) {
    fx = Math.floor(fx);
  }
  return fx;
}

// Create the triangle row by row
for (let row = 2; row < rows + 1; row++) {
  // Calculate number of balls in this row
  const ballsInRow = row + 1;

  // Calculate the starting X position for this row to center it
  const rowStartX = startX - (spacingX * (ballsInRow - 1)) / 2;

  // Create balls for this row
  for (let col = 0; col < ballsInRow; col++) {
    if (row == rows) {
      //create rectangles instead
      const goal = om.create.rectangle(
        rowStartX + col * spacingX - spacingX / 2,
        startY + row * spacingY,
        35,
        rectangleHeight,
        {
          fill: "#fff",
          fixed: true,
          text: `${scoreMultiply(col)}x`,
          collideWithFixedOnly: true,
        }
      );
      continue;
    }
    const ball = om.create.circle(
      rowStartX + col * spacingX,
      startY + row * spacingY,
      ballRadius,
      { fixed: true, fill: "#fff" }
    );
  }
}

//create a ball with physics that drops from a random x location from the top(near the middle)
let lastSpawnTime = 0;
const spawnCooldown = 200; // ms cooldown

function dropBall() {
  const currentTime = Date.now();
  if (currentTime - lastSpawnTime < spawnCooldown) return;

  lastSpawnTime = currentTime;
  const ball = om.create.circle(
    startX -
      (ballRadius * 4 + spacingX) / 2 +
      Math.random() * (ballRadius * 4 + spacingX),
    startY + 10,
    8,
    {
      fill: "#fff",
      bounciness: 0.5,
      collideWithFixedOnly: true,
    }
  );
}

window.addEventListener("keydown", (e) => {
  if (e.key === " ") {
    if (om.objects.length > 200) return;
    dropBall();
  }
});

let badballs = new Set();
let dontdrop = [0, 1, 11, 14, 18, 19, 2, 21, 25, 26, 27, 28, 30, 4, 6, 7, 9];
/*
for (let i = 0; i < 50; i++) {
  if (dontdrop.includes(i)) continue;
  const ball = om.create.circle(
    startX - (ballRadius * 4 + spacingX) / 2 + i,
    startY + 10,
    7,
    {
      fill: "#fff",
      bounciness: 0.7,
      collideWithFixedOnly: true,
      startOffset: i,
      update: (o) => {
        if (o.x < 100 || o.x > 640) {
          badballs.add(i);
        }
      },
    }
  );
}*/

const ball = om.create.circle(
  startX - (ballRadius * 4 + spacingX) / 2 + 11,
  startY + 10,
  7,
  {
    fill: "#fff",
    bounciness: 0.5,
    collideWithFixedOnly: true,
  }
);
console.log(pm.simulateObjectSteps(ball, 50));

game.start();
