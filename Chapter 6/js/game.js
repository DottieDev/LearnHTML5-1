var canvas = document.createElement("canvas");
var worldWidth = 60;
var worldHeight = 32;
canvas.width = 16 * worldWidth;
canvas.height = 16 * worldHeight;
document.body.appendChild(canvas);

var renderer = new Renderer(canvas);
var renderTime = {
   last: 0,
   now: 0,
   //FVGCC: changed fps calculation to slow it down!
   // fps: 1000 / 30
   fps: 10000 / 30
};

var snake = new Snake(0, 0, canvas.width, canvas.height, 1000);
var skin = new Image();
snake.setSkin("img/block-green.png");
var head;
var fruit = {
   position: new Int8Array(2),
   reset: function() {
      this.position[0] = -1;
      this.position[1] = -1;
   },
   isAt: function(x, y) {
      return this.position[0] == x && this.position[1] == y;
   },
   img: null
};

fruit.reset();
fruit.img = new Image();
fruit.img.onload = function() {
   fruit.img.width = this.width;
   fruit.img.height = this.height;
};
fruit.img.src = "img/fruit-01.png";

var score = {
   el: document.querySelector("#scores h3:first-child span"),
   val: 0,
   up: function() {
      this.val = parseInt(this.val + 1 * 10);
      this.el.innerText = this.val;
   },
   reset: function() {
      this.val = 0;
      this.el.innerText = this.val;
   }
};

var cellGen = new Worker("js/next-empty.worker.js");

function setFruit(event) {
   var data = event.data;

   fruit.position[0] = data.x;
   fruit.position[1] = data.y;
}

var gameMenu = {
   el: document.querySelector("#gameMenu"),
   messageEl: document.querySelector("#gameMenu h3"),
   buttonEl: document.querySelector("#gameMenu button"),
   setText: function(menuText, buttonText) {
      this.messageEl.innerText = menuText;
      this.buttonEl.innerText = buttonText;
   },
   show: function() {
      this.el.classList.remove("hide");
      this.el.classList.add("show");
      this.buttonEl.focus();
   },
   hide: function() {
      this.el.classList.remove("show");
      this.el.classList.add("hide");
      this.buttonEl.blur();
   },
   play: function() {
      renderer.clear();
      //FVGCC: added a plane graphic to the background
      canvas.style.background = "url('img/plane.jpg')";
      score.reset();
      fruit.reset();
      clearEvent("eat");
      clearEvent("die");
      document.querySelector("#screenShots").innerHTML = "";

      cellGen.removeEventListener("message", setFruit);
      cellGen.addEventListener("message", gameMenu.start);
      cellGen.postMessage({
         points: snake.getBody(),
         width: worldWidth,
         height: worldHeight
      });
   },
   start: function(event) {
      var data = event.data;

      cellGen.removeEventListener("message", gameMenu.start);
      cellGen.addEventListener("message", setFruit);

      snake.reset(data.x, data.y);
      document.body.addEventListener("keydown", snake.doOnKeyDown);
      gameLoop();
   }
};

function gameLoop() {
   if (snake.isAlive()) {

      renderTime.now = Date.now();

      if (renderTime.now - renderTime.last >= renderTime.fps) {
         if (fruit.position[0] < 0) {
            cellGen.postMessage({
               points: snake.getBody(),
               width: worldWidth,
               height: worldHeight
            });
         }
         else {

            snake.move();
            head = snake.getHead();

            if (snake.isAt(head.x, head.y, false) || head.x < 0 || head.y < 0 || head.x >= worldWidth || head.y >= worldHeight) {
               snake.setDead(true);
            }

            if (fruit.isAt(head.x, head.y)) {

               // Save current game state
               saveEvent("eat", snake.getBody(), fruit.position);

               fruit.reset();
               snake.grow();
               score.up();

               // Save high score if needed
               setHighScore(document.querySelector("#scores h3:first-child span").textContent);
            }

            renderTime.last = renderTime.now;
         }
      }

      renderer.clear();
      renderer.draw(fruit.position, fruit.img);
      renderer.draw(snake.getBody(), snake.getSkin());
      requestAnimationFrame(gameLoop);
   }
   else {
      gameMenu.setText("Game Over", "Play Again");
      gameMenu.show();
      document.body.removeEventListener("keydown", snake.doOnKeyDown);

      saveEvent("die", snake.getBody(), fruit.position);

      var imgs = getEventPictures("eat", canvas);
      drawScreenShots(imgs);

      imgs = getEventPictures("die", canvas);
      drawScreenShots(imgs);
   }
}

function drawScreenShots(imgs) {
   var panel = document.querySelector("#screenShots");

   for (var i = 0, len = imgs.length; i < len; i++) {
      var a = document.createElement("a");
      a.target = "_blank";
      a.href = imgs[i].src;
      a.appendChild(imgs[i]);
      panel.appendChild(a);
   }
}

function getEventPictures(event, canvas) {
   var obj = sessionStorage.getItem(event);
   var screenShots = new Array();

   if (!obj)
      return screenShots

   obj = JSON.parse(obj);

   var canvas = canvas.cloneNode();
   var renderer = new Renderer(canvas);

   for (var i = 0, len = obj.snake.length; i < len; i++) {
      renderer.clear();
      renderer.draw(obj.snake[i], snake.getSkin());
      renderer.draw(obj.fruit[i], fruit.img);

      var screenShot = renderer.toImg();
      screenShots.push(screenShot);
   }

   return screenShots;
}

function clearEvent(event) {
   return sessionStorage.removeItem(event);
}

function saveEvent(event, snake, fruit) {
   var eventObj = sessionStorage.getItem(event);

   // If this is the first time the event is set, create its structure
   if (!eventObj) {
      eventObj = {
         snake: new Array(),
         fruit: new Array()
      };

      eventObj.snake.push(snake);
      eventObj.fruit.push(fruit);
      eventObj = JSON.stringify(eventObj);
      sessionStorage.setItem(event, eventObj);
   }
   else {
      eventObj = JSON.parse(eventObj);
      eventObj.snake.push(snake);
      eventObj.fruit.push(fruit);

      eventObj = JSON.stringify(eventObj);
      sessionStorage.setItem(event, eventObj);
   }

   return JSON.parse(eventObj);
}

function setHighScore(newScore) {
   var element = document.querySelector("#scores h3:last-child span");
   var score = localStorage.getItem("high-score") * 1;

   // Check if there is a numerical score saved
   if (score && !isNaN(score)) {

      // Check if new score is higher than current high score
      if (newScore > element.textContent * 1) {
         localStorage.setItem("high-score", newScore);
         element.textContent = newScore;
      }
      else {
         element.textContent = score;
      }
   }
   else {
      localStorage.setItem("high-score", newScore);
      element.textContent = newScore;
   }
}

(function main() {
   gameMenu.buttonEl.addEventListener("click", function() {
      gameMenu.hide();
      gameMenu.play();
   });

   setHighScore(0);

   setTimeout(function() {
      gameMenu.show();
   }, 1000);
})();
