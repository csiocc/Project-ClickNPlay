"use strict";
 
    const ROWS = 25;
    const COLS = 25;
    const TILE_SIZE = 25;
 
    const WINDOW_WIDTH = TILE_SIZE * COLS;
    const WINDOW_HEIGHT = TILE_SIZE * ROWS;
 
    const canvas = document.getElementById("gameCanvas");
    /** @type {CanvasRenderingContext2D} */
    const ctx = canvas.getContext("2d");
    canvas.width = WINDOW_WIDTH;
    canvas.height = WINDOW_HEIGHT;
 
    const restartBtn = document.getElementById("restartBtn");
 
    class Tile {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
    }
 
    let snake, food, snakeBody, velocityX, velocityY, currentVX, currentVY, gameOver, score, highscore;
 
    function initGame() {
      snake = new Tile(5 * TILE_SIZE, 5 * TILE_SIZE);
      food = new Tile(randInt(0, COLS - 1) * TILE_SIZE, randInt(0, ROWS - 1) * TILE_SIZE);
      snakeBody = [];
      velocityX = 0;
      velocityY = 0;
      currentVX = 0;
      currentVY = 0;
      gameOver = false;
      score = 0;
      restartBtn.style.display = "none";
 
      // Highscore aus localStorage laden
      highscore = parseInt(localStorage.getItem("highscore") || "0", 10);
    }
 
    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
 
    function changeDirection(e) {
      if (gameOver) return;
      switch (e.key) {
        case "ArrowUp":
        case "w":
          if (currentVY !== 1) { velocityX = 0; velocityY = -1; }
          break;
        case "ArrowDown":
        case "s":
          if (currentVY !== -1) { velocityX = 0; velocityY = 1; }
          break;
        case "ArrowLeft":
        case "a":
          if (currentVX !== 1) { velocityX = -1; velocityY = 0; }
          break;
        case "ArrowRight":
        case "d":
          if (currentVX !== -1) { velocityX = 1; velocityY = 0; }
          break;
        default:
          break;
      }
    }
 
    function move() {
      if (gameOver) return;
 
      // Rand-Kollision
      if (snake.x < 0 || snake.x >= WINDOW_WIDTH || snake.y < 0 || snake.y >= WINDOW_HEIGHT) {
        setGameOver();
        return;
      }
 
      // Selbst-Kollision
      for (const tile of snakeBody) {
        if (snake.x === tile.x && snake.y === tile.y) {
          setGameOver();
          return;
        }
      }
 
      // Essen gefressen
      if (snake.x === food.x && snake.y === food.y) {
        snakeBody.push(new Tile(food.x, food.y));
        food.x = randInt(0, COLS - 1) * TILE_SIZE;
        food.y = randInt(0, ROWS - 1) * TILE_SIZE;
        score++;
      }
 
      // Körper bewegen
      for (let i = snakeBody.length - 1; i >= 0; i--) {
        if (i === 0) {
          snakeBody[i].x = snake.x;
          snakeBody[i].y = snake.y;
        } else {
          snakeBody[i].x = snakeBody[i - 1].x;
          snakeBody[i].y = snakeBody[i - 1].y;
        }
      }
 
      // Kopf bewegen
      snake.x += velocityX * TILE_SIZE;
      snake.y += velocityY * TILE_SIZE;
 
      currentVX = velocityX;
      currentVY = velocityY;
    }
 
    function draw() {
      move();
      ctx.clearRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
 
      // Food
      ctx.fillStyle = "red";
      ctx.fillRect(food.x, food.y, TILE_SIZE, TILE_SIZE);
 
      // Snake
      ctx.fillStyle = "lime";
      ctx.fillRect(snake.x, snake.y, TILE_SIZE, TILE_SIZE);
      for (const tile of snakeBody) {
        ctx.fillRect(tile.x, tile.y, TILE_SIZE, TILE_SIZE);
      }
 
      // Score & Highscore
      ctx.fillStyle = "white";
      ctx.font = "14px Arial";
      ctx.fillText(`Score: ${score}`, 10, 20);
 
      ctx.fillStyle = "yellow";
      ctx.fillText(`Highscore: ${highscore}`, WINDOW_WIDTH - 120, 20);
 
      if (gameOver) {
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`Game Over: ${score}`, WINDOW_WIDTH / 2, WINDOW_HEIGHT / 2);
        ctx.textAlign = "start";
        restartBtn.style.display = "inline-block";
      }
 
      requestAnimationFrame(() => setTimeout(draw, 100));
    }
 
    function setGameOver() {
      gameOver = true;
      if (score > highscore) {
        highscore = score;
        localStorage.setItem("highscore", String(highscore));
      }
    }
 
    function restartGame() {
      initGame();
    }
 
    function triggerCheat() {
      score = 60;
      setGameOver();
    }
 
    // Event-Listener
    document.addEventListener("keydown", changeDirection);
    restartBtn.addEventListener("click", restartGame);
    document.addEventListener("keydown", (e) => {
      if (e.code === "F12") triggerCheat();
    });
 
    // Start
    initGame();
    draw();