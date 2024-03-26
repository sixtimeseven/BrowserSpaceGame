/**
 * Event emitter to publish & subscribe to messages
 */
class EventEmitter {
    constructor() {
        this.listeners = {};
    }

    // subscribe to messages
    on(message, listener) {
        if (!this.listeners[message]) {
            this.listeners[message] = [];
        }
        this.listeners[message].push(listener);
    }

    // publish a message
    emit(message, payload = null) {
        if (this.listeners[message]) {
            this.listeners[message].forEach((l) => l(message, payload));
        }
    }
}


/**
 * Super class for game objects.
 */
class GameObject {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.dead = false;
        this.type = "";
        this.width = 0;
        this.height = 0;
        this.img = undefined;
    }
    
    // draws the object to the canvas
    draw(ctx) {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }
    
    // get a rectangle representation of a GameObject
    rectFromGameObject() {
        return {
            top: this.y,
            left: this.x,
            bottom: this.y + this.height,
            right: this.x + this.width
        };
    }
}


/**
 * Hero game object.
 * Image size is 99 x 75
 */
class Hero extends GameObject {
    constructor(x, y) {
        super(x, y);
        this.width = 99;
        this.height = 75;
        this.type = 'Hero';
        this.speed = { x: 0, y: 0 };
    }
}


/**
 * Enemy game object. 
 * Image size is 98 x 50
 */
class Enemy extends GameObject {
    constructor(x, y) {
        super(x, y);
        this.width = 98;
        this.height = 50;
        this.type = 'Enemy';
        this.img = enemyImg;
        let id = setInterval(() => {
            if (!this.dead) {
                this.y = this.y < canvas.height - this.height ? this.y + 5 : this.y;
                if (this.y >= canvas.height - this.height) {
                    this.dead = true;
                    eventEmitter.emit(Messages.ENEMY_OUT_OF_BOUNDS); // TODO: handle enemy out of bounds
                }
            // }
            // if (this.y < canvas.height - this.height) {
            //     this.y += 5;
            } else {
                // console.log(`Stopped at ${this.y}`)
                clearInterval(id);
            }
        }, 300);
    }
}


/**
 * Laser object that moves gradually towards the top of the screen
 */
class Laser extends GameObject {
    constructor(x, y) {
        super(x, y);
        this.width = 9;
        this.height = 33;
        this.type = 'Laser';
        this.img = laserImg;
        let id = setInterval(() => {
            if (this.y > 0) {
                this.y -= 15;
            } else {
                this.dead = true;
                clearInterval(id);
            }
        }, 100);
    }
}


/**
 * Explosion object that appears when an enemy is shot
 */
class Explosion extends GameObject {
    constructor(x, y, img = explosionRed) {
        super(x, y);
        this.img = img;
        this.type = 'Explosion';
        this.width = 56 * 2;
        this.height = 54 * 2;
        setTimeout(() => {
            this.dead = true;
        }, 300);
    }
}


/**
 * Game holds player's score, lives, and sub logic
 */
class Game {
    constructor() {
        this.score = 0;
        this.life = 3;
        this.end = false;
        this.ready = false;
        
        // if enemy reaches bottom of canvas -> hero dies!
        eventEmitter.on(Messages.ENEMY_OUT_OF_BOUNDS, () => {
            hero.dead = true;
        });
        
        // laser hits an enemy: kill enemy, make an explosion, add 100 points to score
        eventEmitter.on(Messages.COLLISION_ENEMY_LASER, (_, { first: laser, second: enemy }) => {
            laser.dead = true;
            enemy.dead = true;
            game.score += 100;
            
            gameObjects.push(new Explosion(enemy.x, enemy.y));
        });
        
        // enemy hits hero: kill enemy, lose a life, check for hero death, make explosions
        eventEmitter.on(Messages.COLLISION_ENEMY_HERO, (_, { enemy: en, id }) => {
            game.life--;
            if (game.life === 0) {
                hero.dead = true;
                gameObjects.push(new Explosion(hero.x, hero.y, explosionGreen));
                // clearInterval(gameLoopId);
                eventEmitter.emit(Messages.GAME_END_LOSS, id);
            } 
            en.dead = true;
            hero.img = heroDamagedImg;
            gameObjects.push(new Explosion(en.x, en.y));
        });
        
        // game over: loser
        eventEmitter.on(Messages.GAME_END_LOSS, (_, gameLoopId) => {
            game.end = true;
            clearInterval(gameLoopId);
            setTimeout(() => {
                redrawCanvas();
                drawScore();
                displayMessage(`Don't panic. You died. Press ENTER to start again.`, 'red');
            }, 200);
        });
        
        // game over: winner
        eventEmitter.on(Messages.GAME_END_WIN, (_, gameLoopId) => {
            game.end = true;
            clearInterval(gameLoopId);
            setTimeout(() => {
                redrawCanvas();
                drawScore();
                displayMessage(`You did it!! Press ENTER to start a new game.`, 'green');
            }, 200);
        });
        
        // fire ze missiles
        eventEmitter.on(Messages.HERO_FIRE, () => {
            if (coolDown === 0) {
                let laser = new Laser(hero.x + 45, hero.y - 30);
                gameObjects.push(laser);
                cooling();
            }
        });
        
        // move left on left arrow key down
        eventEmitter.on(Messages.HERO_SPEED_LEFT, () => {
            hero.speed.x = -10;
            hero.img = heroLeftImg;
        });
        
        // move right on right arrow key down
        eventEmitter.on(Messages.HERO_SPEED_RIGHT, () => {
            hero.speed.x = 10;
            hero.img = heroRightImg;
        });
        
        // reset hero speed and hero image
        eventEmitter.on(Messages.HERO_SPEED_ZERO, () => {
            hero.speed = { x: 0, y: 0 };
            hero.img = game.life === 3 ? heroImg : heroDamagedImg;
        });
        
        // move up if not at top of canvas
        eventEmitter.on(Messages.KEY_EVENT_UP, () => {
            hero.y = hero.y > 0 ? hero.y - 5 : hero.y;
        });
        
        // move down if not at bottom of canvas
        eventEmitter.on(Messages.KEY_EVENT_DOWN, () => {
            hero.y = hero.y < canvas.height - hero.height ? hero.y + 5 : hero.y;
        });
        
        // move left if not at canvas edge
        eventEmitter.on(Messages.KEY_EVENT_LEFT, () => {
            hero.x = hero.x > 0 ? hero.x - 10 : hero.x;
        });
        
        // move right if not at canvas edge
        eventEmitter.on(Messages.KEY_EVENT_RIGHT, () => {
            hero.x = hero.x < canvas.width - hero.width ? hero.x + 10 : hero.x;
        });

        eventEmitter.on(Messages.GAME_START, () => {
            if (game.ready && game.end) {
                runGame();
            }
        });
    }
}

// VARIABLES
// Event emitter messages
const Messages = {
    KEY_EVENT_UP: "KEY_EVENT_UP",
    KEY_EVENT_DOWN: "KEY_EVENT_DOWN",
    KEY_EVENT_LEFT: "KEY_EVENT_LEFT",
    KEY_EVENT_RIGHT: "KEY_EVENT_RIGHT",
    // KEY_EVENT_SPACE: "KEY_EVENT_SPACE",
    // KEY_EVENT_ENTER: "KEY_EVENT_ENTER",
    GAME_START: "GAME_START",   // replaces KEY_EVENT_ENTER
    HERO_FIRE: "HERO_FIRE",     // replaces KEY_EVENT_SPACE
    HERO_SPEED_LEFT: "HERO_SPEED_LEFT",
    HERO_SPEED_RIGHT: "HERO_SPEED_RIGHT",
    HERO_SPEED_ZERO: "HERO_SPEED_ZERO",
    COLLISION_ENEMY_LASER: "COLLISION_ENEMY_LASER",
    COLLISION_ENEMY_HERO: "COLLISION_ENEMY_HERO",
    GAME_END_WIN: "GAME_END_WIN",
    GAME_END_LOSS: "GAME_END_LOSS",
    ENEMY_OUT_OF_BOUNDS: "ENEMY_OUT_OF_BOUNDS",
};

const eventEmitter = new EventEmitter();
const hero = new Hero(0, 0);

let gameLoopId;
let gameObjects = [];
let heroImg,
    enemyImg,
    laserImg,
    lifeImg,
    explosionRed,
    explosionGreen,
    heroLeftImg,
    heroRightImg,
    heroDamagedImg,
    canvas, ctx;
let coolDown = 0;
const game = new Game();

// CANVAS & WINDOW FUNCTIONS

/**
 * Load textures for game objects asynchronously.
 * @param path {String} The path to the image
 * @returns {Promise<unknown>}
 */
function loadTexture(path) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
            resolve(img);
        }
    });
}


/**
 * Redraws the canvas with black
 */
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw all game objects from the gameObjects array
 */
function drawGameObjects() {
    gameObjects.forEach(go => go.draw(ctx));
}


/**
 * Draw hero lives remaining on the screen
 */
function drawLife() {
    const START_POS = canvas.width - 180;
    for (let i = 0; i < game.life; i++) {
        ctx.drawImage(lifeImg, START_POS + (45 * (i + 1)), canvas.height - 37);
    }
}


/**
 * Draw player score to the screen
 */
function drawScore() {
    ctx.font = "30px Courier";
    ctx.fillStyle = "green";
    ctx.textAlign = "left";
    drawText("Score: " + game.score, 10, canvas.height - 20);
}


/**
 * Draw text to the canvas.
 * @param message {String} The text to write to the canvas
 * @param x {Number} x-coordinate to start drawing text
 * @param y {Number} y-coordinate to start drawing text
 */
function drawText(message, x, y) {
    ctx.fillText(message, x, y);
}


/**
 * Display a message in the center of the screen.
 * @param message {String} The message to display.
 * @param color {String} The color of the message text (default yellow).
 */
function displayMessage(message, color = 'yellow') {
    ctx.font = "30px monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}


// KEY EVENTS

// Prevent default actions (like scrolling) for arrow keys and the space bar
let onKeyDown = function (e) {
    console.log(e.key);
    switch (e.key) {
        case "ArrowDown":
        case "ArrowUp":
        case "ArrowLeft":
        case "ArrowRight":
        case " ":
            e.preventDefault(); // shut off default behavior of arrows & space
            break;
        default:
            break;              // do not block other keys
    }
};

window.addEventListener("keydown", onKeyDown);
// use key down on left and right arrow for movement
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case "ArrowLeft":
            eventEmitter.emit(Messages.HERO_SPEED_LEFT);
            break;
        case "ArrowRight":
            eventEmitter.emit(Messages.HERO_SPEED_RIGHT);
            break;
    }
});

// Event listener for keyup events to send messages
window.addEventListener("keyup", (evt) => {
    // reset hero speed on keyup
    eventEmitter.emit(Messages.HERO_SPEED_ZERO);
    if (evt.key === "ArrowUp") {
        eventEmitter.emit(Messages.KEY_EVENT_UP);
    } else if (evt.key === "ArrowDown") {
        eventEmitter.emit(Messages.KEY_EVENT_DOWN);
    } else if (evt.key === "ArrowLeft") {
        eventEmitter.emit(Messages.KEY_EVENT_LEFT);
    } else if (evt.key === "ArrowRight") {
        eventEmitter.emit(Messages.KEY_EVENT_RIGHT);
    } else if (evt.key === " ") {
        eventEmitter.emit(Messages.HERO_FIRE);
    } else if (evt.key === "Enter") {
        eventEmitter.emit(Messages.GAME_START);
    }
});


// GAME LOGIC FUNCTIONS

/**
 * Create enemy ships in a grid at the top of the screen
 * then add each to gameObjects[].
 */
function createEnemies() {
    const ENEMY_TOTAL = 5;
    const ENEMY_WIDTH = ENEMY_TOTAL * 98;
    const START_X = (canvas.width - ENEMY_WIDTH) / 2;
    const STOP_X = START_X + ENEMY_WIDTH;

    for (let x = START_X; x < STOP_X; x += 98) {
        for (let y = 0; y < 50 * 5; y += 50) {
            gameObjects.push(new Enemy(x, y));
        }
    }
}


/**
 * Create the hero object and position it in the middle of canvas
 * then add it to gameObjects[]
 */
function createHero() {
    hero.dead = false;
    hero.img = heroImg;
    hero.x = canvas.width / 2;
    hero.y = (canvas.height / 4) * 3;
    gameObjects.push(hero);
}


/**
 * Starts a cool down period for the laser
 */
function cooling() {
    coolDown = 500;
    let id = setInterval(() => {
        coolDown -= 100;
        if (coolDown === 0) {
            clearInterval(id);
        }
    }, 100);
}


/**
 * Checks the state of enemies for collisions with lasers & hero, filters out the dead.
 * Updates the hero's position from keydown events.
 * @param gameLoopId
 */
function checkGameState(gameLoopId) {
    const enemies = gameObjects.filter((go) => go.type === 'Enemy');
    
    
    // update hero position
    if (hero.speed.x !== 0) {
        hero.x += hero.speed.x;
    }
    
    // check for laser collisions
    const lasers = gameObjects.filter((go) => go.type === 'Laser');
    lasers.forEach((laser) => {
        enemies.forEach((en) => {
            if (isCollision(laser.rectFromGameObject(), en.rectFromGameObject())) {
                eventEmitter.emit(Messages.COLLISION_ENEMY_LASER, { first: laser, second: en });
            }
        });
    });
    
    // hero & enemy collision
    enemies.forEach((en) => {
        if (isCollision(en.rectFromGameObject(), hero.rectFromGameObject())) {
            eventEmitter.emit(Messages.COLLISION_ENEMY_HERO, { enemy: en, gameLoopId })
        }
    });

    // check hero died or all enemies dead
    if (hero.dead) {
        eventEmitter.emit(Messages.GAME_END_LOSS, gameLoopId);
    } else if (enemies.length === 0) {
        eventEmitter.emit(Messages.GAME_END_WIN);
    }
    
    // filter out the dead
    gameObjects = gameObjects.filter((go) => !go.dead);
}


function runGame() {
    gameObjects = [];
    game.life = 3;
    game.score = 0;
    game.end = false;
    
    createEnemies();
    createHero();
    
    gameLoopId = setInterval(() => {
        redrawCanvas();
        drawScore();
        drawLife();
        checkGameState(gameLoopId);
        drawGameObjects();
    }, 100);
}


/**
 * Check for collisions between rectangular GameObjects
 * @param r1 {Object} A rectangle representation of a GameObject
 * @param r2 {Object} A rectangle representation of a GameObject to compare to r1
 * @returns {boolean}
 */
function isCollision(r1, r2) {
    return !(r2.left > r1.right ||
            r2.right < r1.left ||
            r2.top > r1.bottom ||
            r2.bottom < r1.top
    );
}


/**
 * When the window loads, initialize the game and set up game loop
 * @returns {Promise<void>}
 */
window.onload = async () => {
    // set up the canvas
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // load textures
    enemyImg = await loadTexture("assets/enemyShip.png");
    heroImg = await loadTexture("assets/player.png");
    laserImg = await loadTexture("assets/laserRed.png");
    lifeImg = await loadTexture("assets/life.png");
    heroDamagedImg = await loadTexture("assets/playerDamaged.png");
    heroLeftImg = await loadTexture("assets/playerLeft.png");
    heroRightImg = await loadTexture("assets/playerRight.png");
    explosionRed = await loadTexture("assets/explosionRed.png");
    explosionGreen = await loadTexture("assets/explosionGreen.png");
    
    game.ready = true;
    game.end = true;
    redrawCanvas();
    displayMessage(`* * Press ENTER to start the game!\npew pew pew * *`);
};


/**
 * * COLLISION DETECTION * *
 * Objective: The hero needs to hit all enemies with a laser before they 
 * get to the bottom of the screen. 
 * -------------------------------------
 * Laser hits enemy --> enemy dies
 * Laser hits top of screen --> laser is destroyed
 * Enemy collides with hero --> enemy & hero are destroyed
 * Enemy hits bottom of screen --> enemy & hero are destroyed
 * -------------------------------------
 * Game objects are rectangles with x, y position.
 * If 2 rectangles intersect --> this is a collision.
 * 
 * NEED:
 * 1. A rectangle representation of an object --> add to GameObject class
 * 2. A comparison function to compare two rectangles
 */

/**
 * FIRING LASERS
 * Laser fire happens after a key event, then the laser moves vertically
 * 1. Create a laser object from top of hero ship that moves up once created.
 * 2. Attach a code to a key event for laser fire.
 * 3. Create a game object for the laser when the key is pressed.
 * ALSO! Laser needs a cool down to prevent too many lasers.
 * Cool down can be implemented with a timer using a Cool down & Weapon class.
 */
