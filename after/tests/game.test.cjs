const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
// Load the game's exported rules without mounting a browser canvas.
const core = script.slice(0, script.indexOf('const game=Daldongne.mount'));
const context = {module: {exports: {}}};
vm.runInNewContext(core, context);
const g = context.module.exports;

test('ready state does not move or deliver; start and pause control time', () => {
  const s = g.newGame();
  const initial = JSON.stringify(s.n);
  g.step(s, .02, {x: 1});
  assert.equal(JSON.stringify(s.n), initial);
  assert.equal(g.interact(s), false);
  g.start(s);g.step(s,.02);
  assert.equal(s.time,.02);
  g.pause(s);g.step(s,.02);
  assert.equal(s.time,.02);
  g.pause(s);assert.equal(s.status,'playing');
});
test('coffee is required and distant interaction cannot deliver', () => {
  const s = g.newGame();g.start(s);
  s.n = g.ORDERS[0].door;
  assert.equal(g.interact(s),false);
  assert.equal(s.done.length,0);
  assert.equal(s.target,'cafe');
  s.n = g.math.at(0,-1.4);
  assert.equal(g.interact(s),false);
});
test('pick up four cups; duplicate interactions do not add deliveries; all four end the round', () => {
  const s = g.newGame();g.start(s);s.n=g.CAFE.door;
  assert.equal(g.interact(s),true);assert.equal(s.carrying,4);
  assert.equal(g.interact(s),false);assert.equal(s.carrying,4);
  for (const [i,site] of g.ORDERS.entries()) {
    s.n=site.door;assert.equal(g.interact(s),true);
    assert.equal(s.done.length,i+1);assert.equal(s.carrying,3-i);
    assert.equal(g.interact(s),false);assert.equal(s.done.length,i+1);
  }
  assert.equal(s.status,'roundEnd');
  assert.equal(s.lastRound.reason,'clear');assert.equal(s.lastRound.delivered,4);
  const fresh=g.newGame();assert.equal(fresh.status,'ready');
  assert.equal(fresh.done.length,0);assert.equal(fresh.carrying,0);
});

const {angle, frame, at} = g.math;
const START = at(-.13, -.025);
function place(s, n) { s.n = n; s.north = frame(n).u; }
function timeUp(s) { s.roundTime = g.ROUND_TIME - .01; g.step(s, .05); }
function play(s, count) {
  s.n = g.CAFE.door; if (count) g.interact(s);
  for (const site of g.ORDERS.slice(0, count)) { s.n = site.door; g.interact(s); }
}

test('each round lasts 40 seconds and time running out ends it with the success count', () => {
  const s = g.newGame(); g.start(s);
  assert.equal(g.ROUND_TIME, 40); assert.equal(s.timeLeft, 40);
  play(s, 2);
  for (let i = 0; i < 20; i++) g.step(s, .05);
  assert.ok(Math.abs(s.timeLeft - 39) < 1e-9);
  timeUp(s);
  assert.equal(s.status, 'roundEnd');
  assert.equal(s.lastRound.reason, 'timeout'); assert.equal(s.lastRound.delivered, 2);
});

test('four seasons in order; the next round resets cups, deliveries, timer and position', () => {
  const s = g.newGame(); g.start(s);
  assert.deepEqual([...g.SEASONS.map(x => x.id)], ['spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual([...g.SEASONS.map(x => x.hazard)], ['dust', 'heat', 'dust', 'cold']);
  play(s, 1); timeUp(s); g.start(s);
  assert.equal(s.status, 'playing'); assert.equal(g.SEASONS[s.season].id, 'summer');
  assert.equal(s.done.length, 0); assert.equal(s.carrying, 0); assert.equal(s.timeLeft, 40);
  assert.ok(angle(s.n, START) < 1e-9); assert.equal(s.total, 1);
});

test('after four rounds the game ends with the total and a PERFECT / GREAT / GOOD grade', () => {
  const run = plan => {
    const s = g.newGame(); g.start(s);
    for (const [i, count] of plan.entries()) {
      play(s, count); if (s.status === 'playing') timeUp(s);
      if (i < 3) { assert.equal(s.status, 'roundEnd'); g.start(s); }
    }
    return s;
  };
  const s = run([4, 3, 0, 2]);
  assert.equal(s.status, 'over'); assert.equal(s.total, 9); assert.deepEqual([...s.results], [4, 3, 0, 2]);
  assert.equal(g.grade(s.total), 'GOOD');
  assert.equal(g.grade(run([4, 4, 4, 4]).total), 'PERFECT');
  assert.equal(g.grade(run([4, 3, 2, 1]).total), 'GREAT');
  g.step(s, .05, {x: 1}); assert.equal(s.status, 'over');
});

test('eight zones per season, about ten characters wide, drifting counterclockwise', () => {
  const s = g.newGame();
  for (const [i, season] of g.SEASONS.entries()) {
    s.season = i; s.roundTime = 0;
    const zones = g.zonesOf(s);
    assert.equal(zones.length, 8);
    for (const z of zones) {
      assert.equal(z.kind, season.hazard);
      assert.ok(Math.abs(2 * z.r * g.R / g.CHAR_SIZE - 10) < 1e-9, 'diameter is 10 characters');
      assert.ok(angle(z.n, START) > z.r + .1, 'start is clear when a round begins');
    }
    // Longitude grows over time: counterclockwise seen from above the north pole.
    const lon = n => Math.atan2(n[0], n[2]);
    s.roundTime = 1;
    const later = g.zonesOf(s);
    for (const [k, z] of zones.entries()) {
      const d = ((lon(later[k].n) - lon(z.n)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      assert.ok(d > 0, 'zone ' + k + ' moves counterclockwise');
    }
  }
});

test('touching a zone slows walking and the effect lasts 0.5 seconds after leaving', () => {
  for (const [i, season] of g.SEASONS.entries()) {
    const s = g.newGame(); g.start(s);
    while (s.season < i) { timeUp(s); g.start(s); }
    place(s, START); let a = s.n; g.step(s, .05, {x: 1});
    const normal = angle(a, s.n);
    const z = g.zonesOf(s)[0]; place(s, z.n); g.step(s, .05, {x: 0});
    assert.equal(s.fxKind, season.hazard); assert.equal(s.fxTime, g.FX_TIME);
    place(s, START); a = s.n; g.step(s, .05, {x: 1});
    assert.ok(Math.abs(angle(a, s.n) / normal - g.HAZARD[season.hazard].slow) < .01, season.id + ' slows');
    for (let k = 0; k < 8; k++) g.step(s, .05);
    assert.ok(s.fxTime > 0, 'still active 0.45s after leaving');
    g.step(s, .05); g.step(s, .05);
    assert.equal(s.fxTime, 0, 'effect ends after 0.5s');
    a = s.n; g.step(s, .05, {x: 1});
    assert.ok(Math.abs(angle(a, s.n) - normal) < 1e-6, 'normal speed again');
  }
});
