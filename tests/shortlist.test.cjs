const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('      function loadState() {');
const end = html.indexOf('\n      }', start) + '\n      }'.length;
test('shortlist moves other venues to hold once and preserves later user choices', () => {
  const active = ['guropropose', 'thesbdongjak', 'westernsindorim', 'kyusoodang'];
  const saved = {'hallmap.manualParked': JSON.stringify(['guropropose']), 'hallmap.userVenues': JSON.stringify([{id:'custom'}]), 'hallmap.showParked':'1'};
  const context = {
    SEED: [...active, 'jkart'].map(id => ({id})),
    localStorage: {getItem:key => saved[key] ?? null, setItem:(key,value) => {saved[key]=value;}},
    readJSON:(key,fallback) => saved[key] ? JSON.parse(saved[key]) : fallback,
    DEFAULT_ORIGINS:[], readCriteria:()=>[], loadWeights:()=>({}), readScores:()=>({}), loadSort:()=>'', readPriorityOptions:()=>[], readRadius:()=>8, readBudget:()=>30000000,
  };
  runInNewContext(html.slice(start,end),context);
  const state = context.loadState();
  assert.deepEqual(Array.from(state.manualParked).sort(), ['custom','jkart']);
  assert.equal(state.showParked,false);
  saved['hallmap.manualParked'] = JSON.stringify(['thesbdongjak']);
  saved['hallmap.showParked'] = '1';
  assert.deepEqual(Array.from(context.loadState().manualParked),['thesbdongjak']);
  assert.equal(context.loadState().showParked,true);
});
