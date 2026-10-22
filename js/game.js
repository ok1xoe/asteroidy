// Planetky – hra ve stylu Asteroids (vektorová grafika čarami)
(function () {
    'use strict';
    var W = 256, H = 192, TAU = Math.PI * 2;
    var rnd = Math.random;
    var HI = 'planetky';
    var S = {};                       // stav hry (zpřístupněn jako GAME pro testy)
    window.GAME = S;

    function wrapX(x) { return x < 0 ? x + W : x >= W ? x - W : x; }
    function wrapY(y) { return y < 0 ? y + H : y >= H ? y - H : y; }
    function wdist(ax, ay, bx, by) {
        var dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
        if (dx > W / 2) { dx = W - dx; }
        if (dy > H / 2) { dy = H - dy; }
        return Math.sqrt(dx * dx + dy * dy);
    }
    // nejkratší vektor a -> b přes okraje
    function wdelta(ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay;
        if (dx > W / 2) { dx -= W; } else if (dx < -W / 2) { dx += W; }
        if (dy > H / 2) { dy -= H; } else if (dy < -H / 2) { dy += H; }
        return [dx, dy];
    }

    // kreslení polygonu (uzavřeného) s přesahem přes okraje
    function poly(pts, x, y, rot, sc, col, open) {
        var c = Math.cos(rot), s = Math.sin(rot), n = pts.length, i, q = [];
        for (i = 0; i < n; i++) {
            q.push([pts[i][0] * sc * c - pts[i][1] * sc * s, pts[i][0] * sc * s + pts[i][1] * sc * c]);
        }
        var ox = [0], oy = [0];
        if (x < 24) { ox.push(W); } else if (x > W - 24) { ox.push(-W); }
        if (y < 24) { oy.push(H); } else if (y > H - 24) { oy.push(-H); }
        ox.forEach(function (dx) {
            oy.forEach(function (dy) {
                for (var k = 0; k < (open ? n - 1 : n); k++) {
                    var a = q[k], b = q[(k + 1) % n];
                    Z.line(x + dx + a[0], y + dy + a[1], x + dx + b[0], y + dy + b[1], col);
                }
            });
        });
    }

    // ---------- Tvary
    var SHIP = [[0, -7], [5, 6], [0, 3], [-5, 6]];
    var FLAME = [[-2.5, 4.5], [0, 10], [2.5, 4.5]];
    var SAUCER = [[-4, -2], [-2, -5], [2, -5], [4, -2], [9, 1], [4, 4], [-4, 4], [-9, 1], [-4, -2], [4, -2], [9, 1], [-9, 1]];
    var SIZES = { 3: { r: 15, score: 20, col: 11 }, 2: { r: 9, score: 50, col: 14 }, 1: { r: 5, score: 100, col: 13 } };

    function makeShape(r) {
        var n = 9 + (rnd() * 4 | 0), p = [];
        for (var i = 0; i < n; i++) {
            var a = i / n * TAU, k = r * (0.72 + rnd() * 0.4);
            p.push([Math.cos(a) * k, Math.sin(a) * k]);
        }
        return p;
    }
    function newRock(size, x, y, vx, vy) {
        var sp = (0.35 + rnd() * 0.5) * (1 + (4 - size) * 0.35) * Math.min(1.5, 0.9 + S.wave * 0.06);
        if (vx === undefined) { var a = rnd() * TAU; vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; }
        return { size: size, r: SIZES[size].r, x: x, y: y, vx: vx, vy: vy, rot: rnd() * TAU, vr: (rnd() - 0.5) * 0.05, shape: makeShape(SIZES[size].r) };
    }

    // ---------- Pomocné herní funkce
    function addDebris(x, y, n, col, speed) {
        for (var i = 0; i < n; i++) {
            var a = rnd() * TAU, sp = (0.3 + rnd()) * (speed || 1);
            S.debris.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: rnd() * TAU, life: 30 + rnd() * 30, col: col });
        }
    }
    function newShip() {
        return { x: W / 2, y: H / 2, vx: 0, vy: 0, a: 0, cool: 0, inv: 150, hyper: 0 };
    }
    function startWave() {
        S.wave++;
        S.rocks = [];
        var n = Math.min(10, 3 + S.wave), i;
        for (i = 0; i < n; i++) {
            var x, y;
            do { x = rnd() * W; y = rnd() * H; } while (S.ship && wdist(x, y, S.ship.x, S.ship.y) < 60);
            S.rocks.push(newRock(3, x, y));
        }
        S.saucerT = 500 + (rnd() * 400 | 0);
        S.banner = 100;
    }
    function resetGame() {
        S.score = 0; S.lives = 3; S.wave = 0; S.nextLife = 10000;
        S.bullets = []; S.ebullets = []; S.debris = []; S.saucer = null; S.rocks = [];
        S.ship = newShip(); S.respawn = 0; S.waveT = 0; S.beat = 0;
        startWave();
    }
    function addScore(p) {
        S.score += p;
        if (S.score >= S.nextLife) {
            S.nextLife += 10000; S.lives = Math.min(9, S.lives + 1);
            Z.snd.win(); S.lifeMsg = 100;
        }
    }
    function killShip() {
        var sh = S.ship;
        addDebris(sh.x, sh.y, 14, 15, 1.2);
        S.ship = null; S.lives--; S.state = 'dying'; S.timer = 110;
        Z.snd.die(); Z.snd.boom();
    }
    function splitRock(i, byPlayer) {
        var k = S.rocks[i];
        S.rocks.splice(i, 1);
        if (byPlayer) { addScore(SIZES[k.size].score); }
        addDebris(k.x, k.y, 4 + k.size * 2, SIZES[k.size].col, 0.8);
        if (k.size > 1) {
            for (var j = 0; j < 2; j++) {
                var a = rnd() * TAU, sp = 0.6 + rnd() * 0.6 + (3 - k.size) * 0.4 + S.wave * 0.03;
                S.rocks.push(newRock(k.size - 1, k.x, k.y, k.vx * 0.5 + Math.cos(a) * sp, k.vy * 0.5 + Math.sin(a) * sp));
            }
        }
        if (k.size === 3) { Z.snd.beep(120, 0.3, 40, 0.06); Z.snd.noise(0.25, 0.05); }
        else if (k.size === 2) { Z.snd.noise(0.18, 0.05); } else { Z.snd.noise(0.1, 0.05); }
    }
    function spawnSaucer() {
        var small = rnd() < Math.min(0.85, 0.15 + S.score / 25000);
        var fromLeft = rnd() < 0.5;
        S.saucer = { x: fromLeft ? -9 : W + 9, y: 24 + rnd() * (H - 48), vx: (fromLeft ? 1 : -1) * (small ? 0.9 : 0.6), vy: 0,
            small: small, r: small ? 5 : 9, sc: small ? 0.55 : 1, shoot: 60, turn: 70 };
    }
    function saucerShoot() {
        var sa = S.saucer, sh = S.ship, a;
        if (sh && sa.small) {
            var d = wdelta(sa.x, sa.y, sh.x, sh.y);
            a = Math.atan2(d[1], d[0]) + (rnd() - 0.5) * Math.max(0.08, 0.6 - S.score / 40000);
        } else if (sh) {
            // velký talíř mířit neumí přesně
            var d2 = wdelta(sa.x, sa.y, sh.x, sh.y);
            a = rnd() < 0.3 ? Math.atan2(d2[1], d2[0]) + (rnd() - 0.5) * 0.5 : rnd() * TAU;
        } else { a = rnd() * TAU; }
        S.ebullets.push({ x: sa.x, y: sa.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 100 });
        Z.snd.beep(700, 0.08, 400, 0.03);
    }

    // ---------- Aktualizace
    function moveFree(o) { o.x = wrapX(o.x + o.vx); o.y = wrapY(o.y + o.vy); }

    function updateWorld(playing) {
        var i, j;
        S.rocks.forEach(function (k) { moveFree(k); k.rot += k.vr; });
        for (i = S.debris.length - 1; i >= 0; i--) {
            var d = S.debris[i];
            d.x += d.vx; d.y += d.vy; d.a += 0.1; d.life--;
            if (d.life <= 0) { S.debris.splice(i, 1); }
        }
        for (i = S.bullets.length - 1; i >= 0; i--) {
            var b = S.bullets[i];
            moveFree(b); b.life--;
            var dead = b.life <= 0;
            for (j = S.rocks.length - 1; j >= 0 && !dead; j--) {
                if (wdist(b.x, b.y, S.rocks[j].x, S.rocks[j].y) < S.rocks[j].r * 0.85) { splitRock(j, true); dead = true; }
            }
            if (!dead && S.saucer && wdist(b.x, b.y, S.saucer.x, S.saucer.y) < S.saucer.r + 1) {
                addScore(S.saucer.small ? 1000 : 200);
                addDebris(S.saucer.x, S.saucer.y, 12, 10, 1.1);
                Z.snd.boom(); S.saucer = null; dead = true;
            }
            if (dead) { S.bullets.splice(i, 1); }
        }
        for (i = S.ebullets.length - 1; i >= 0; i--) {
            var e = S.ebullets[i];
            moveFree(e); e.life--;
            if (e.life <= 0) { S.ebullets.splice(i, 1); }
        }
        var sa = S.saucer;
        if (sa) {
            sa.x += sa.vx; sa.y = wrapY(sa.y + sa.vy);
            if (--sa.turn <= 0) { sa.turn = 50 + (rnd() * 60 | 0); sa.vy = [-0.5, 0, 0.5][rnd() * 3 | 0]; }
            if (--sa.shoot <= 0 && playing) { sa.shoot = sa.small ? 55 : 85; saucerShoot(); }
            if (sa.x < -12 || sa.x > W + 12) { S.saucer = null; }
            else {
                for (j = S.rocks.length - 1; j >= 0; j--) {
                    if (wdist(sa.x, sa.y, S.rocks[j].x, S.rocks[j].y) < S.rocks[j].r + sa.r - 2) {
                        splitRock(j, false); addDebris(sa.x, sa.y, 12, 10, 1.1); S.saucer = null; break;
                    }
                }
            }
        }
        if (playing && !S.saucer && S.rocks.length > 0 && --S.saucerT <= 0) {
            spawnSaucer();
            S.saucerT = Math.max(350, 900 - S.wave * 60) + (rnd() * 300 | 0);
        }
    }

    function updateShip() {
        var sh = S.ship, inp = Z.input, i, j;
        if (inp.down('left')) { sh.a -= 0.075; }
        if (inp.down('right')) { sh.a += 0.075; }
        sh.thrust = inp.down('up');
        if (sh.thrust) {
            sh.vx += Math.sin(sh.a) * 0.055; sh.vy -= Math.cos(sh.a) * 0.055;
            if (Z.tickCount % 8 === 0) { Z.snd.noise(0.05, 0.015); }
        }
        var sp = Math.sqrt(sh.vx * sh.vx + sh.vy * sh.vy);
        if (sp > 3.2) { sh.vx *= 3.2 / sp; sh.vy *= 3.2 / sp; }
        sh.vx *= 0.995; sh.vy *= 0.995;
        sh.x = wrapX(sh.x + sh.vx); sh.y = wrapY(sh.y + sh.vy);
        if (sh.cool > 0) { sh.cool--; }
        if (sh.inv > 0) { sh.inv--; }
        if (inp.hit('fire') || (inp.down('fire') && sh.cool === 0)) {
            if (sh.cool === 0 && S.bullets.length < 4) {
                S.bullets.push({ x: sh.x + Math.sin(sh.a) * 7, y: sh.y - Math.cos(sh.a) * 7,
                    vx: sh.vx + Math.sin(sh.a) * 4.2, vy: sh.vy - Math.cos(sh.a) * 4.2, life: 48 });
                sh.cool = 9; Z.snd.shoot();
            }
        }
        if (inp.hit('alt')) {
            // hyperprostor: náhodná pozice, riziko výbuchu
            sh.x = 8 + rnd() * (W - 16); sh.y = 14 + rnd() * (H - 22); sh.vx = 0; sh.vy = 0; sh.hyper = 20;
            Z.snd.beep(1500, 0.25, 200, 0.04);
            if (rnd() < 0.14) { killShip(); return; }
        }
        if (sh.hyper > 0) { sh.hyper--; }
        if (sh.inv > 0) { return; }
        for (i = 0; i < S.rocks.length; i++) {
            if (wdist(sh.x, sh.y, S.rocks[i].x, S.rocks[i].y) < S.rocks[i].r * 0.85 + 3) { splitRock(i, true); killShip(); return; }
        }
        if (S.saucer && wdist(sh.x, sh.y, S.saucer.x, S.saucer.y) < S.saucer.r + 4) {
            addScore(S.saucer.small ? 1000 : 200); addDebris(S.saucer.x, S.saucer.y, 12, 10, 1.1);
            S.saucer = null; killShip(); return;
        }
        for (j = 0; j < S.ebullets.length; j++) {
            if (wdist(sh.x, sh.y, S.ebullets[j].x, S.ebullets[j].y) < 5) { S.ebullets.splice(j, 1); killShip(); return; }
        }
    }

    function safeSpot() {
        for (var i = 0; i < S.rocks.length; i++) { if (wdist(W / 2, H / 2, S.rocks[i].x, S.rocks[i].y) < S.rocks[i].r + 28) { return false; } }
        if (S.saucer && wdist(W / 2, H / 2, S.saucer.x, S.saucer.y) < 50) { return false; }
        return S.ebullets.length === 0 || S.ebullets.every(function (e) { return wdist(W / 2, H / 2, e.x, e.y) > 40; });
    }

    function heartbeat() {
        var n = S.rocks.length, per = Math.max(14, Math.min(60, 12 + n * 4));
        if (++S.beat >= per) { S.beat = 0; S.beatHi = !S.beatHi; Z.snd.beep(S.beatHi ? 90 : 70, 0.07, 0, 0.035); }
    }

    function startTitle() {
        S.state = 'title'; S.timer = 0; Z.pauseOk = false; Z.border = 0;
        S.rocks = []; S.bullets = []; S.ebullets = []; S.debris = []; S.saucer = null; S.ship = null; S.wave = 0;
        for (var i = 0; i < 7; i++) { S.rocks.push(newRock(i < 3 ? 3 : i < 5 ? 2 : 1, rnd() * W, rnd() * H)); }
    }
    function startGame() {
        resetGame(); S.state = 'play'; Z.pauseOk = true; S.timer = 0;
        Z.snd.seq([262, 330, 392, 523], 0.08);
    }

    var game = {
        tick: function () {
            var inp = Z.input;
            if (S.state === 'title') {
                updateWorld(false);
                if (inp.hit('fire') || inp.hit('up')) { startGame(); }
            } else if (S.state === 'play') {
                updateWorld(true);
                if (S.ship) { updateShip(); }
                else if (--S.respawn <= 0 && safeSpot()) { S.ship = newShip(); }
                if (S.state === 'play') {
                    heartbeat();
                    if (S.banner > 0) { S.banner--; }
                    if (S.lifeMsg > 0) { S.lifeMsg--; }
                    if (S.rocks.length === 0 && !S.saucer) {
                        if (++S.waveT > 120) { S.waveT = 0; S.ebullets = []; startWave(); }
                    }
                }
            } else if (S.state === 'dying') {
                updateWorld(true);
                if (--S.timer <= 0) {
                    if (S.lives <= 0) {
                        S.hi = Z.hi.submit(HI, S.score);
                        S.newHi = S.score >= S.hi && S.score > 0;
                        S.state = 'over'; S.timer = 0; Z.pauseOk = false; Z.snd.over();
                    } else { S.state = 'play'; S.respawn = 20; }
                }
            } else if (S.state === 'over') {
                updateWorld(false);
                S.timer++;
                if (S.timer > 60 && (inp.hit('fire') || inp.hit('up')) || S.timer > 500) { startTitle(); }
            }
        },
        draw: function () {
            Z.cls(0, 7);
            Z.border = 0;
            var st = S.state;
            S.rocks.forEach(function (k) { poly(k.shape, k.x, k.y, k.rot, 1, SIZES[k.size].col); });
            if (S.saucer) {
                var sa = S.saucer;
                poly(SAUCER, sa.x, sa.y, 0, sa.sc, sa.small ? 12 : 10, true);
            }
            S.ebullets.forEach(function (e) { Z.rect(e.x - 1, e.y - 1, 2, 2, 12); });
            S.bullets.forEach(function (b) { Z.rect(b.x - 1, b.y - 1, 2, 2, 15); });
            S.debris.forEach(function (d) {
                var l = d.life > 12 ? d.col : 1;
                Z.line(d.x - Math.cos(d.a) * 2, d.y - Math.sin(d.a) * 2, d.x + Math.cos(d.a) * 2, d.y + Math.sin(d.a) * 2, l);
            });
            var sh = S.ship;
            if (sh && !(sh.inv > 0 && (Z.tickCount >> 2) % 2 === 0)) {
                poly(SHIP, sh.x, sh.y, sh.a, 1, 15);
                if (sh.thrust && Z.tickCount % 4 < 3) { poly(FLAME, sh.x, sh.y, sh.a, 1, 14, true); }
                if (sh.hyper > 0) { Z.ring(sh.x, sh.y, 12 - sh.hyper / 2, 5); }
            }
            if (st === 'title') { drawTitle(); } else { drawHud(); }
            if (st === 'play' && S.banner > 0 && S.wave > 0) {
                Z.text(128, 70, 'VLNA ' + S.wave, 14, { align: 'center', scale: 2 });
            }
            if (st === 'play' && S.lifeMsg > 0) { Z.text(128, 100, 'EXTRA ŽIVOT!', 13, { align: 'center' }); }
            if (st === 'over') {
                Z.text(128, 70, 'KONEC HRY', 10, { align: 'center', scale: 2 });
                Z.text(128, 94, 'SKÓRE ' + S.score, 15, { align: 'center' });
                if (S.newHi) { Z.text(128, 106, 'NOVÝ REKORD!', 14, { align: 'center' }); }
                else { Z.text(128, 106, 'REKORD ' + S.hi, 11, { align: 'center' }); }
                if (S.timer > 60 && (S.timer >> 5) % 2 === 0) { Z.text(128, 130, 'STISKNI OHEŇ', 13, { align: 'center' }); }
            }
        }
    };

    function drawHud() {
        Z.text(4, 3, Z.pad(S.score, 5), 15);
        Z.text(128, 3, 'REKORD ' + Math.max(S.score, Z.hi.get(HI)), 11, { align: 'center' });
        for (var i = 0; i < S.lives; i++) { poly(SHIP, 244 - i * 11, 11, 0, 0.7, 12); }
    }

    function drawTitle() {
        Z.text(128, 22, 'PLANETKY', 14, { align: 'center', scale: 3 });
        Z.line(40, 50, 216, 50, 10);
        Z.text(128, 60, 'ZNIČ VŠECHNY PLANETKY A TALÍŘE.', 15, { align: 'center' });
        Z.text(128, 70, 'OKRAJE OBRAZOVKY JSOU PROPOJENÉ.', 15, { align: 'center' });
        Z.text(128, 86, 'VELKÁ 20  STŘEDNÍ 50  MALÁ 100', 11, { align: 'center' });
        Z.text(128, 96, 'TALÍŘ 200 / MALÝ TALÍŘ 1000', 10, { align: 'center' });
        Z.text(128, 106, 'EXTRA ŽIVOT KAŽDÝCH 10000 BODŮ', 13, { align: 'center' });
        Z.text(128, 122, 'ŠIPKY VLEVO/VPRAVO  OTÁČENÍ', 5, { align: 'center' });
        Z.text(128, 132, 'NAHORU  TAH       MEZERNÍK  OHEŇ', 5, { align: 'center' });
        Z.text(128, 142, 'X  HYPERPROSTOR (RIZIKO VÝBUCHU!)', 5, { align: 'center' });
        Z.text(128, 152, 'P  PAUZA      M  ZVUK', 5, { align: 'center' });
        Z.text(128, 168, 'REKORD ' + Z.hi.get(HI), 14, { align: 'center' });
        if ((Z.tickCount >> 5) % 2 === 0) { Z.text(128, 180, 'STISKNI OHEŇ', 12, { align: 'center' }); }
    }

    Z.init({
        title: 'Planetky',
        touch: [
            { act: 'left', label: '◀' }, { act: 'right', label: '▶' }, { act: 'up', label: 'TAH' },
            { act: 'alt', label: 'HYPER' }, { act: 'fire', label: 'OHEŇ', cls: 'big' }
        ]
    });
    S.hi = Z.hi.get(HI);
    startTitle();
    Z.run(game);
})();
