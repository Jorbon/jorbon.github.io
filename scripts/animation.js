let main_div = document.getElementById("main_container");
let canvas = document.getElementById("background");
let ctx = canvas.getContext("2d"); // Get the drawing context

let boids = []; // Declare list so that the on_resize call doesn't error
let boid_density = 1/15000; // One boid per 15,000 pixels
let num_boids = 0;

let mobile = false;


function on_resize(event) {
    main_div.style.width = "60%";
    mobile = (window.innerHeight > window.innerWidth || main_div.clientWidth + 15 >= window.innerWidth); // Best I can do on a static file server
    if (mobile) main_div.style.width = "auto";
    
    if (main_div.scrollHeight < window.innerHeight)
        main_div.style.marginTop = (window.innerHeight - main_div.scrollHeight) / 2 + "px";
    else main_div.style.marginTop = "0";
    
    if (boids.length > 0) for (let boid of boids) {
        if (boid.p.x > 0.5 * canvas.width) {
            boid.p.x += window.innerWidth - canvas.width; // Keep boids same distance from nearest vertical edge
        }
    }
    
    canvas.width = window.innerWidth;
    canvas.height = Math.max(main_div.scrollHeight, window.innerHeight);
    canvas.style.width = canvas.width;
    canvas.style.height = canvas.height;
    
    
    num_boids = Math.round(canvas.width * canvas.height * boid_density);
    let change = num_boids - boids.length;
    
    if (change > 0) {
        for (let i = 0; i < change; i++) boids.push(new Boid());
    } else if (change < 0) {
        for (let i = 0; i < change; i++) {
            boids.splice(Math.floor(Math.random() * boids.length), 1);
        }
    }
    
}

window.addEventListener("resize", on_resize);


function mod(a, b) { // Real modulo function since % is actually remainder
    return (a % b + b) % b;
}


class Vec2 {
    constructor(x, y) {
        if (x instanceof Vec2) {
            this.x = x.x;
            this.y = x.y;
        } else {
            this.x = x;
            this.y = y;
        }
    }
    static from_polar(r, theta) {
        return new Vec2(r * Math.cos(theta), r * Math.sin(theta));
    }
    len2() { return this.x * this.x + this.y * this.y; }
    len() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    neg() { return new Vec2(-this.x, -this.y); }
    mult(c) { return new Vec2(this.x * c, this.y * c); }
    norm() { return this.mult(1 / this.len()); }
}


class Boid {
    
    constructor(boid) {
        if (boid) {
            this.p = new Vec2(boid.p);
            this.v = new Vec2(boid.v);
            this.comfort_distance = boid.comfort_distance;
            this.follow_distance = boid.follow_distance;
            this.group_distance = boid.group_distance;
            this.preferred_direction = new Vec2(boid.preferred_direction);
            this.preferred_speed = boid.preferred_speed;
        } else {
            this.p = new Vec2(Math.random() * canvas.width, Math.random() * canvas.height);
            this.v = Vec2.from_polar(40, Math.random() * 2 * Math.PI);
            // Give the boids some unique personalities
            this.comfort_distance = 50 * (1 + 0.2 * (Math.random() - 0.5));
            this.follow_distance = 100 * (1 + 0.2 * (Math.random() - 0.5));
            this.group_distance = 200 * (1 + 0.2 * (Math.random() - 0.5));
            this.preferred_direction = Vec2.from_polar(1 + 0.4 * (Math.random() - 0.5), Math.random() * 2 * Math.PI);
            this.preferred_speed = 40 * (1 + 0.2 * (Math.random() - 0.5));
        }
    }
    
    draw() {
        if (this.v.len2() == 0) return;
        let d = this.v.norm();
        
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#afafaf";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.p.x + d.x * boid_radius, this.p.y + d.y * boid_radius);
        ctx.lineTo(this.p.x - 0.5 * (d.x + d.y) * boid_radius, this.p.y - 0.5 * (d.y - d.x) * boid_radius);
        ctx.lineTo(this.p.x - 0.25 * d.x * boid_radius, this.p.y - 0.25 * d.y * boid_radius);
        ctx.lineTo(this.p.x - 0.5 * (d.x - d.y) * boid_radius, this.p.y - 0.5 * (d.y + d.x) * boid_radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    step(other, dt) { // Called for each pair of boids
        let delta = this.p.sub(other.p);
        // Use the shortest distance wrapped around edges
        if (delta.x > 0.5 * canvas.width) delta.x -= canvas.width;
        else if (delta.x < -0.5 * canvas.width) delta.x += canvas.width;
        if (delta.y > 0.5 * canvas.height) delta.y -= canvas.height;
        else if (delta.y < -0.5 * canvas.height) delta.y += canvas.height;
        
        let distance = delta.len();
        if (distance == 0) return;
        delta = delta.mult(1 / distance);
        
        if (distance < this.comfort_distance) this.v = this.v.add(delta.mult((1 - distance / this.comfort_distance) * 50 * dt)); // Repulsion force
        if (distance < this.follow_distance) this.v = this.v.add(other.v.sub(this.v).mult((1 - distance / this.follow_distance) * 0.2 * dt)); // Align to nearby velocities
        if (distance < this.group_distance) this.v = this.v.add(delta.mult((1 - distance / this.group_distance) * -0.2 * dt)); // Attract towards a larger group
    }
    
    tick(dt) { // Called for each boid
        this.v = this.v.add(this.preferred_direction.mult(2 * dt));
        
        let speed = this.v.len();
        if (speed > 60) { // Enforce speed limits
            this.v = this.v.mult(60 / speed);
        } else if (speed < 20) {
            this.v = this.v.mult(20 / speed);
        } else { // Move towards preferred speed
            this.v = this.v.mult(1 + (this.preferred_speed / speed - 1) * 1 * dt);
        }
        // Increment position and wrap over edges
        this.p = this.p.add(this.v.mult(dt));
        this.p.x = mod(this.p.x, canvas.width);
        this.p.y = mod(this.p.y, canvas.height);
    }
}


let boid_radius = 20;



function tick(dt) { // Simulate a time step
    for (let i = 0; i < boids.length; i++) {
        boids_next[i] = new Boid(boids[i]);
        for (let j = 0; j < boids.length; j++) {
            if (i == j) continue;
            boids_next[i].step(boids[j], dt);
        }
        boids_next[i].tick(dt);
    }
    
    [boids, boids_next] = [boids_next, boids];
}


let boids_next = [];





// Create initial boids
on_resize();

// Roughly simulate 30 seconds on page load so some flocks start forming
for (let i = 0; i < 30; i++) tick(1);


let previous_time = performance.now();

function draw() {
    requestAnimationFrame(draw);
    if (mobile) return;
    
    let now = performance.now();
    let dt = (now - previous_time) / 1000 * 0.25;
    previous_time = now;
    
    if (canvas.height != main_div.scrollHeight) on_resize();
    
    
    if (dt > 0.1) dt = 0.1; // Prevent flocks from scattering if the page pauses for a while
    
    tick(dt);
    
    
    ctx.fillStyle = "rgb(97, 134, 97)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let boid of boids) {
        boid.draw();
        
        // Draw copies of the boids if they are on the edge so they don't pop in/out when wrapping
        let wrap = new Boid(boid);
        let first_wrap = false;
        if (boid.p.x < boid_radius) {
            wrap.p.x += canvas.width;
            wrap.draw();
            first_wrap = true;
        } else if (boid.p.x > canvas.width - boid_radius) {
            wrap.p.x -= canvas.width;
            wrap.draw();
            first_wrap = true;
        }
        if (boid.p.y < boid_radius) {
            let wrap2 = new Boid(boid);
            wrap2.p.y += canvas.height;
            wrap2.draw();
            if (first_wrap) {
                wrap.p.y += canvas.height;
                wrap.draw();
            }
        } else if (boid.p.y > canvas.height - boid_radius) {
            let wrap2 = new Boid(boid);
            wrap2.p.y -= canvas.height;
            wrap2.draw();
            if (first_wrap) {
                wrap.p.y -= canvas.height;
                wrap.draw();
            }
        }
    }
}

draw();

