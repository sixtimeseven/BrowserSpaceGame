/**
 * Event emitter to publish & subscribe to messages
 */
class EventEmitter {
    constructor() {
        this.listeners = {};
    }

    on(message, listener) {
        if (!this.listeners[message]) {
            this.listeners[message] = [];
        }
        this.listeners[message].push(listener);
    }

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
    
    // function to draw the object on the screen.
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
        this.coolDown = 0;
        this.life = 3;
        this.score = 0;
    }

    /**
     * Fires the hero's laser. Laser requires 500ms to cool down.
     */
    fire() {
        gameObjects.push(new Laser(this.x + 45, this.y - 10));
        this.coolDown = 500;
        
        let id = setInterval(() => {
            if (this.coolDown > 0) {
                this.coolDown -= 100;
            } else {
                clearInterval(id);
            }
        }, 200);
    }

    /**
     * True if laser has cooled down and can be fired.
     * @returns {boolean}
     */
    canFire() {
        return this.coolDown === 0;
    }

    /**
     * Remove a life from the players remaining lives.
     */
    decrementLife() {
        this.life--;
        if (this.life === 0) {
            this.dead = true;
        }
    }

    /**
     * Add 100 points for every laser collision with an enemy
     */
    incrementScore() {
        this.score += 100;
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
        let id = setInterval(() => {
            if (this.y < canvas.height - this.height) {
                this.y += 5;
            } else {
                console.log(`Stopped at ${this.y}`)
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


// VARIABLES
// Event emitter messages
const Messages = {
    KEY_EVENT_UP: "KEY_EVENT_UP",
    KEY_EVENT_DOWN: "KEY_EVENT_DOWN",
    KEY_EVENT_LEFT: "KEY_EVENT_LEFT",
    KEY_EVENT_RIGHT: "KEY_EVENT_RIGHT",
    KEY_EVENT_SPACE: "KEY_EVENT_SPACE",
    COLLISION_ENEMY_LASER: "COLLISION_ENEMY_LASER",
    COLLISION_ENEMY_HERO: "COLLISION_ENEMY_HERO",
};

let heroImg,
    enemyImg,
    laserImg,
    lifeImg,
    score = 0,
    lives = 3,
    canvas, ctx,
    gameObjects = [],
    hero,
    eventEmitter = new EventEmitter();

/**
 * Prevent default actions (like scrolling) for arrow keys and the space bar
 */
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
            break;  // do not block other keys
    }
};

// GAME FUNCTIONS
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
 * Create enemy ships in a grid at the top of the screen
 * then add each to gameObjects[].
 */
function createEnemies() {
    const MONSTER_TOTAL = 5;
    const MONSTER_WIDTH = MONSTER_TOTAL * 98;
    const START_X = (canvas.width - MONSTER_WIDTH) / 2;
    const STOP_X = START_X + MONSTER_WIDTH;

    for (let x = START_X; x < STOP_X; x += 98) {
        for (let y = 0; y < 50 * 5; y += 50) {
            const enemy = new Enemy(x, y);
            enemy.img = enemyImg;
            gameObjects.push(enemy);
        }
    }
}


/**
 * Create the hero object and position it in the middle of canvas
 * then add it to gameObjects[]
 */
function createHero() {
    hero = new Hero(
        canvas.width / 2 - 45,
        canvas.height - canvas.height / 4
    );
    hero.img = heroImg;
    gameObjects.push(hero);
}


/**
 * draw all game objects from the gameObjects array
 */
function drawGameObjects() {
    gameObjects.forEach(go => go.draw(ctx));
}


/**
 * Draw hero lives remaining on the screen
 */
function drawLife() {
    const START_POS = canvas.width - 180;
    for (let i = 0; i < hero.life; i++) {
        ctx.drawImage(
            lifeImg,
            START_POS + (45 * (i + 1)),
            canvas.height - 37
        );
    }
}

/**
 * Draw player score to the screen
 */
function drawScore() {
    ctx.font = "30px Courier";
    ctx.fillStyle = "green";
    ctx.textAlign = "left";
    drawText("Score: " + hero.score, 10, canvas.height - 20);
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
 * Check for collisions between rectangular GameObjects
 * @param r1 {Object} A rectangle representation of a GameObject
 * @param r2 {Object} A rectangle representation of a GameObject to compare to r1
 * @returns {boolean}
 */
function intersectRect(r1, r2) {
    return !(r2.left > r1.right ||
            r2.right < r1.left ||
            r2.top > r1.bottom ||
            r2.bottom < r1.top
    );
}


/**
 * Test game objects for collisions
 */
function updateGameObjects() {
    const enemies = gameObjects.filter(go => go.type === 'Enemy');
    const lasers = gameObjects.filter((go) => go.type === 'Laser');
    
    // laser collision
    lasers.forEach((l) => {
        enemies.forEach((m) => {
            if (intersectRect(l.rectFromGameObject(), m.rectFromGameObject())) {
                eventEmitter.emit(
                    Messages.COLLISION_ENEMY_LASER, 
                    { first: l, second: m }
                );
            }
        });
    });
    
    // hero & enemy collisions
    enemies.forEach(m => {
        const heroRect = hero.rectFromGameObject();
        if (intersectRect(heroRect, m.rectFromGameObject())) {
            eventEmitter.emit(Messages.COLLISION_ENEMY_HERO, { m });
        }
    });
    
    // filter out dead objects
    gameObjects = gameObjects.filter(go => !go.dead);
}

/**
 * Initialize the game, create enemies & hero,
 * set up event emitters for key up
 */
function initGame() {
    gameObjects = [];
    createEnemies();
    createHero();

    eventEmitter.on(Messages.KEY_EVENT_UP, () => {
        hero.y -= 5;
    });

    eventEmitter.on(Messages.KEY_EVENT_DOWN, () => {
        hero.y += 5;
    });

    eventEmitter.on(Messages.KEY_EVENT_LEFT, () => {
        hero.x -= 5;
    });

    eventEmitter.on(Messages.KEY_EVENT_RIGHT, () => {
        hero.x += 5;
    });

    // On space key, check if weapon is cooled down before firing
    eventEmitter.on(Messages.KEY_EVENT_SPACE, () => {
        if (hero.canFire()) {
            hero.fire();
        }
    });
    
    // mark enemies as dead when hit with laser and add points
    eventEmitter.on(Messages.COLLISION_ENEMY_LASER, (_, { first, second }) => {
        first.dead = true;
        second.dead = true;
        hero.incrementScore();
    });
    
    // mark enemy as dead when collides with hero, remove a hero life
    eventEmitter.on(Messages.COLLISION_ENEMY_HERO, (_, { enemy }) => {
        enemy.dead = true;
        hero.decrementLife();
    })
}


// event listener to prevent default key functions
window.addEventListener("keydown", onKeyDown);

// Event listener for keyup events to send to event emitter
window.addEventListener("keyup", (evt) => {
    if (evt.key === "ArrowUp") {
        eventEmitter.emit(Messages.KEY_EVENT_UP);
    } else if (evt.key === "ArrowDown") {
        eventEmitter.emit(Messages.KEY_EVENT_DOWN);
    } else if (evt.key === "ArrowLeft") {
        eventEmitter.emit(Messages.KEY_EVENT_LEFT);
    } else if (evt.key === "ArrowRight") {
        eventEmitter.emit(Messages.KEY_EVENT_RIGHT);
    } else if (evt.key === " ") {
        eventEmitter.emit(Messages.KEY_EVENT_SPACE);
    }
});

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
    
    initGame();
    
    // create game loop to redraw the canvas every 100ms
    let gameLoopId = setInterval(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // filter out objects that have had collisions
        updateGameObjects();
        // draw lives and score to the canvas
        drawScore();
        drawLife();
        // draw game objects
        drawGameObjects(ctx);
    }, 100);
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
 * Cool down can be implemented with a timer using a Cooldown & Weapon class.
 */