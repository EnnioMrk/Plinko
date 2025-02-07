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
  gravity: 4,
});

pm.draw_quad_tree = false;

// Create a triangle of fixed balls pointing upward
const rows = 16; // Number of rows in the triangle
const ballRadius = 4; // Radius of each ball
const spacingY = 25 + ballRadius * 2; // Spacing between balls
const spacingX = 30 + ballRadius * 2;

const ballBounciness = 0.5;

const risk = 8;

const maxMultiplier = 500;
const minMultiplier = 0.2;

const rectangleHeight = 20;

// Calculate the starting position for the top ball (apex)
const startX = window.innerWidth / 2;
const startY = window.innerHeight / 6;

function scoreMultiply(x) {
  // Adjust this exponent to change steepness:
  // p = 2 gives the original quadratic;
  // p > 2 makes the transition steeper (more curved)
  let exponent = risk;
  let halfRows = (rows + 2) / 2;
  let ratio = Math.abs(x - halfRows) / halfRows; // normalized distance from the center
  let fx =
    (maxMultiplier - minMultiplier) * Math.pow(ratio, exponent) + minMultiplier;

  // Rounding as in your original code
  fx = Math.round(fx * 10) / 10;
  if (`${Math.ceil(fx)}`.length > 1) {
    fx = Math.floor(fx);
  }
  return fx;
}

class cvh_gradient {
  constructor(gradientStr) {
    this.gradientStr = gradientStr;
    this.colors = this.parseGradient();
  }
  parseGradient() {
    const colors = [];
    const gradientRegex = /(\d+%)\s*([^,]+)/g;
    let match;
    while ((match = gradientRegex.exec(this.gradientStr))) {
      const percent = parseFloat(match[1]) / 100;
      const color = match[2].trim();
      colors.push({ percent, color });
    }
    return colors;
  }
}

function gradientColorAtPercent(gradientStr, percent) {
  const gradient = new cvh_gradient(gradientStr);
  // Ensure percent is within 0-1 range
  percent = Math.max(0, Math.min(1, percent));
  // Calculate the index in the gradient array
  const index = Math.floor(percent * (gradient.colors.length - 1));
  // Calculate the color at the given percent
  const color1 = gradient.colors[index];
  const color2 = gradient.colors[index + 1];
  if (!color2) return color1.color;

  // Calculate interpolation factor
  const range = color2.percent - color1.percent;
  const factor = (percent - color1.percent) / range;

  // Convert hex colors to RGB
  const rgb1 = hexToRgb(color1.color);
  const rgb2 = hexToRgb(color2.color);

  // Interpolate between colors
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);

  // Convert back to hex
  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r, g, b) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Create the triangle row by row
for (let row = 2; row < rows + 3; row++) {
  // Calculate number of balls in this row
  const ballsInRow = row + 1;

  // Calculate the starting X position for this row to center it
  const rowStartX = startX - (spacingX * (ballsInRow - 1)) / 2;

  // Create balls for this row
  for (let col = 0; col < ballsInRow; col++) {
    if (row == rows + 2) {
      //create rectangles instead
      const goal = om.create.rectangle(
        rowStartX + col * spacingX - spacingX / 2,
        startY + row * spacingY,
        35,
        rectangleHeight,
        {
          fill: gradientColorAtPercent(
            "0% #ff0000, 50% #ffff00, 100% #ff0000",
            col / (ballsInRow - 1)
          ),
          fixed: true,
          text: `${scoreMultiply(col)}x`,
          textColor: "#000",
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
      bounciness: ballBounciness,
      collideWithFixedOnly: true,
      onPassthrough: (other) => {
        // Change color on collision
        ball.fill = "#" + Math.floor(Math.random() * 16777215).toString(16);
      },
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

game.start();
