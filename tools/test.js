// Test v Node: stavy, NaN, bot dokončí první vlnu, screenshoty. Použití: node tools/test.js <složka-pro-png>
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || '/tmp';
const g = H.load([root + '/js/speccy.js', root + '/js/game.js']);
const S = g.sandbox.GAME, Z = g.Z;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'CHYBA ') + m); if (!c) fails++; };

g.step(60); ok(S.state === 'title', 'titulní obrazovka');
g.png(out + '/title.png', 3);
g.key(32, true); g.step(2); g.key(32, false);
ok(S.state === 'play', 'start hry');
// bot: míří na nejbližší planetku a střílí
function bot() {
    const sh = S.ship; ['left', 'right', 'up', 'fire', 'alt'].forEach(a => g.release(a));
    if (!sh) return;
    let best = null, bd = 1e9;
    for (const k of S.rocks) { const d = Math.hypot(k.x - sh.x, k.y - sh.y); if (d < bd) { bd = d; best = k; } }
    if (S.saucer) { best = S.saucer; }
    if (!best) return;
    const t = Math.atan2(best.x - sh.x + best.vx * 8, -(best.y - sh.y + best.vy * 8));
    let da = t - sh.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (da > 0.05) g.press('right'); else if (da < -0.05) g.press('left');
    if (Math.abs(da) < 0.15) g.press('fire');
}
let shot = false, wave2 = false, maxScore = 0, bad = false, sawSaucer = false, sawDying = false;
for (let i = 0; i < 20000 && S.state !== 'title'; i++) {
    bot(); g.step(1);
    if (S.state === 'dying') sawDying = true;
    if (S.saucer) sawSaucer = true;
    if (S.wave >= 2) wave2 = true;
    if (S.state === 'play' && !shot && i > 300) { g.png(out + '/play.png', 3); shot = true; }
    if (i % 50 === 0 && g.hasNaN(S)) { bad = true; break; }
    maxScore = Math.max(maxScore, S.score);
}
ok(!bad, 'žádné NaN');
ok(wave2, 'bot dokončil první vlnu (wave>=2)');
ok(sawDying, 'ztráta života (dying)');
ok(sawSaucer, 'objevil se talíř');
ok(S.state === 'title' || S.state === 'play', 'stav po botovi: ' + S.state + ', skóre ' + maxScore + ', vlna ' + S.wave);
// vynucený konec hry
g.key(32, true); g.step(2); g.key(32, false);
if (S.state === 'title') { g.key(32, true); g.step(2); g.key(32, false); }
S.lives = 1; S.score = 10500; S.nextLife = 20000; S.ship.inv = 0; S.rocks = [{ size: 3, r: 15, x: S.ship.x, y: S.ship.y, vx: 0, vy: 0, rot: 0, vr: 0, shape: [[10, 0], [0, 10], [-10, 0], [0, -10]] }];
g.step(2); ok(S.state === 'dying', 'srážka -> dying');
g.step(130); ok(S.state === 'over', 'dying -> over'); g.png(out + '/over.png', 3);
ok(Z.hi.get('planetky') >= 10500, 'rekord uložen');
g.step(520); ok(S.state === 'title', 'over -> title');
// extra život + hyperprostor
g.key(32, true); g.step(2); g.key(32, false);
S.ship.inv = 0; const l0 = S.lives; S.score = 9990; S.rocks = [];
S.rocks.push({ size: 1, r: 5, x: 5, y: 5, vx: 0, vy: 0, rot: 0, vr: 0, shape: [[3, 0], [0, 3], [-3, 0]] });
S.bullets.push({ x: 5, y: 5, vx: 0, vy: 0, life: 10 }); g.step(2);
ok(S.lives === l0 + 1, 'extra život po 10000');
let died = 0, N = 400;
for (let i = 0; i < N; i++) { S.state = 'play'; S.ship = { x: 100, y: 100, vx: 0, vy: 0, a: 0, cool: 0, inv: 0, hyper: 0 }; S.rocks = []; S.lives = 3; g.press('alt'); g.step(1); g.release('alt'); if (!S.ship) died++; }
ok(died > 10 && died < 120, 'hyperprostor riziko výbuchu: ' + died + '/' + N);
console.log(fails ? 'SELHÁNÍ ' + fails : 'VŠE OK');
process.exit(fails ? 1 : 0);
