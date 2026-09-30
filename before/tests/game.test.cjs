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
const {angle, frame} = g.math;

// Harvest at the farm until every remaining neighbour has a cup.
function harvest(s) {
  s.n = g.FARM.n;
  let picks = 0;
  while (g.interact(s)) picks++;
  return picks;
}
// Deliver the first `count` remaining orders.
function deliver(s, count) {
  for (const site of g.ORDERS.filter(o => !s.done.includes(o.id)).slice(0, count)) {
    s.n = site.door;
    assert.equal(g.interact(s), true);
  }
}
function place(s, n) { s.n = n; s.north = frame(n).u; }

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
  assert.equal(s.target,'farm');
  s.n = g.math.at(0,-1.4);
  assert.equal(g.interact(s),false);
});

test('the cafe no longer hands out coffee; beans come from the farm one cup at a time', () => {
  const s = g.newGame();g.start(s);
  s.n = g.CAFE.door;
  assert.equal(g.interact(s), false);
  assert.equal(s.carrying, 0);
  s.n = g.FARM.n;
  assert.equal(g.interact(s), true);assert.equal(s.carrying, 1);
  assert.equal(s.target, 'farm');
  assert.equal(harvest(s), 3);assert.equal(s.carrying, 4);
  assert.equal(g.interact(s), false, 'cannot carry more than the remaining orders');
  assert.equal(s.target, g.ORDERS[0].id);
});

test('delivering all four clears the round and moves to the next season', () => {
  const s = g.newGame();g.start(s);
  harvest(s);
  for (const [i, site] of g.ORDERS.entries()) {
    s.n = site.door;assert.equal(g.interact(s), true);
    assert.equal(s.done.length, i + 1);
    if (i < 3) {assert.equal(g.interact(s), false);assert.equal(s.done.length, i + 1);}
  }
  assert.equal(s.status, 'intermission');
  assert.deepEqual({...s.lastRound}, {reason: 'clear', delivered: 4});
  assert.equal(s.total, 4);
  g.start(s);
  assert.equal(s.status, 'playing');
  assert.equal(g.SEASONS[s.season].id, 'summer');
  assert.equal(s.done.length, 0);assert.equal(s.carrying, 0);
  assert.equal(s.timeLeft, g.SEASONS[1].limit);
  assert.equal(s.total, 4, 'total carries across seasons');
});

test('running out of time ends the round with partial deliveries; spilt coffee is not kept', () => {
  const s = g.newGame();g.start(s);
  harvest(s);deliver(s, 2);
  g.step(s, .05);
  s.timeLeft = .01;g.step(s, .05);
  assert.equal(s.status, 'intermission');
  assert.equal(s.lastRound.reason, 'timeout');
  assert.equal(s.lastRound.delivered, 2);
  g.start(s);
  assert.equal(s.carrying, 0);
});

test('four seasons in order, then the game ends with the total success count', () => {
  const s = g.newGame();g.start(s);
  assert.deepEqual([...g.SEASONS.map(x => x.id)], ['spring', 'summer', 'autumn', 'winter']);
  const plan = [4, 3, 0, 2];
  for (const [i, count] of plan.entries()) {
    assert.equal(g.SEASONS[s.season].id, g.SEASONS[i].id);
    if (count) {harvest(s);deliver(s, count);}
    if (s.status === 'playing') {s.timeLeft = .01;g.step(s, .05);}
    if (i < plan.length - 1) {assert.equal(s.status, 'intermission');g.start(s);}
  }
  assert.equal(s.status, 'over');
  assert.equal(s.total, 9);
  assert.deepEqual([...s.results], plan);
  g.step(s, .05, {x: 1});
  assert.equal(s.status, 'over', 'no play after the final season');
});

test('dust and heat zones slow walking; outside a zone the pace is normal', () => {
  const moved = (season) => {
    const s = g.newGame();g.start(s);
    while (s.season < season) {s.timeLeft = .01;g.step(s, .05);g.start(s);}
    const z = g.SEASONS[season].zones[0];
    place(s, z.n);const a = s.n;g.step(s, .05, {x: 1});
    const inside = angle(a, s.n);
    place(s, g.math.at(-.13, -.025));const b = s.n;g.step(s, .05, {x: 1});
    return {inside, outside: angle(b, s.n), hazard: g.SEASONS[season].hazard};
  };
  for (const season of [0, 1, 2]) {
    const r = moved(season);
    assert.ok(r.outside > 0);
    assert.ok(Math.abs(r.inside / r.outside - g.HAZARD[r.hazard].slow) < .01, r.hazard + ' slows walking');
  }
});

test('winter cold freezes the courier for a moment, then gives time to escape', () => {
  const s = g.newGame();g.start(s);
  while (s.season < 3) {s.timeLeft = .01;g.step(s, .05);g.start(s);}
  const z = g.SEASONS[3].zones[0];
  place(s, z.n);g.step(s, .05, {x: 1});
  assert.ok(s.frozen > 0, 'entering the cold zone freezes');
  const frozenAt = s.n;
  for (let i = 0; i < 20; i++) g.step(s, .05, {x: 1});
  assert.ok(angle(frozenAt, s.n) < 1e-6, 'no movement while frozen');
  s.n = g.FARM.n;assert.equal(g.interact(s), false, 'no harvesting while frozen');s.n = frozenAt;
  for (let i = 0; i < 12; i++) g.step(s, .05, {x: 1});
  assert.equal(s.frozen, 0);
  assert.ok(angle(frozenAt, s.n) > .005, 'moves again after thawing');
});

test('hazard zones never cover the start, the farm, or a neighbour door', () => {
  const start = g.math.at(-.13, -.025);
  for (const season of g.SEASONS) for (const z of season.zones) {
    assert.ok(angle(z.n, start) > z.r + .1, season.id + ' zone clears start');
    assert.ok(angle(z.n, g.FARM.n) > z.r + .1, season.id + ' zone clears farm');
    for (const o of g.ORDERS) assert.ok(angle(z.n, o.door) > z.r + .05, season.id + ' zone clears ' + o.id);
  }
});
