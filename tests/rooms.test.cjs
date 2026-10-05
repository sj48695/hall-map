const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function extract(name) {
  const start = html.indexOf('      function ' + name + '(');
  assert.ok(start >= 0,name);
  const end = html.indexOf('\n      }',start) + '\n      }'.length;
  return html.slice(start,end);
}
const stored = {};
const state = {overrides:{},scores:{},checks:{}};
const context = {state,plannerData:(key,fallback)=>stored[key] || fallback,selectedOptionKeys:()=>[],optionForKey:()=>null,selectedOptionTotal:()=>0,fixedRequiredTotal:()=>0,OPTION_CATALOG:[],persist:()=>true,renderAll:()=>{},renderChecklist:()=>{},paintDetailChecks:()=>{},openId:'jkart'};
const catalogs = html.slice(html.indexOf('      const ROOM_SOURCES ='),html.indexOf('      function normalizeRoom('));
runInNewContext(catalogs + ['normalizeRoom','findRoom','roomKey','roomMatches','roomView','personalQuotes','activePersonalQuote','quoteMissing','personalCalculation','discountTotals','bestDiscount','quoteTotals','comparisonTotal','setHallCheck','setMark','markOf'].map(extract).join('\n'),context);
const venue = {id:'jkart',name:'JK',meal:86000,rental:10000000,minGuests:200,image:'legacy.jpg',options:[{name:'legacy',price:50000}],discountQuotes:[{hall:'아트리움홀',meal:50000,rental:1000000,required:0,minGuests:200},{meal:45000,rental:500000,required:0,minGuests:200}],reviews:[{hall:'아트리움홀',food:true},{food:true}]};
test('unselected company prices, photos and unknown-hall quotes never enter comparison',()=>{
  stored.selectedRooms={};
  const view=context.roomView(venue);
  assert.equal(view.meal,null);
  assert.equal(view.image,null);
  assert.equal(view.discountQuotes.length,0);
  assert.equal(view.reviews.length,0);
  assert.equal(context.comparisonTotal(view),null);
  assert.equal(view.legacyImage,'legacy.jpg');
});
test('switching JK rooms changes public price, interval and image, not just the name',()=>{
  for(const [room,rental,interval] of [['grand',11000000,120],['atrium',16000000,60],['amber',17000000,90]]) {
    stored.selectedRooms={jkart:room};
    const view=context.roomView(venue);
    assert.equal(view.rental,rental);
    assert.equal(view.interval,interval);
    assert.ok(view.image.includes(room));
    assert.equal(view.minGuests,null,'recommendation is not a guarantee');
    assert.equal(view.options.length,0,'legacy room options cannot migrate');
    assert.equal(view.discountQuotes.length,room==='atrium'?1:0);
  }
});
test('aliases match but unknown hall names do not',()=>{
  assert.equal(context.findRoom('jkart','앰버루체홀').id,'amber');
  assert.equal(context.roomMatches({id:'jkart',roomId:'atrium'},{hall:'아트리움'}),true);
  assert.equal(context.roomMatches({id:'jkart',roomId:'grand'},{hall:'아트리움홀'}),false);
  assert.equal(context.roomMatches({id:'jkart',roomId:'grand'},{}),false);
});
test('quotes, amounts, photos, checks and scores stay with their selected room',()=>{
  stored.selectedRooms={jkart:'atrium'};
  const q={id:'quote-a',hall:'아트리움홀',personal:true,label:'A',meal:50000,rental:1000000,required:0,minGuests:150,serviceMode:'included',vatMode:'included'};
  stored.personalQuotes={jkart:[q]};
  stored.activeQuotes={'jkart::atrium':q.id};
  state.overrides['jkart::atrium']={rental:1230000,image:'my-atrium.jpg'};
  const a=context.roomView(venue);
  assert.equal(a.rental,1230000);
  assert.equal(a.image,'my-atrium.jpg');
  assert.equal(context.comparisonTotal(a),8500000);
  context.setHallCheck('jkart','7-3',true);
  context.setMark('p_height',5);
  stored.selectedRooms={jkart:'grand'};
  const g=context.roomView(venue);
  assert.equal(g.rental,11000000);
  assert.ok(g.image.endsWith('jk-grand.png'));
  assert.equal(context.activePersonalQuote(g),null);
  assert.equal(context.markOf('jkart','p_height'),null);
  assert.equal(state.checks['jkart::grand'],undefined);
  assert.equal(state.checks['jkart::atrium']['7-3'],true);
  assert.equal(state.scores['jkart::atrium'].p_height,5);
});
test('synthetic platform minimum combinations cannot become a contract quote',()=>{
  const q={meal:50000,rental:1000000,required:0,minGuests:200,comparisonEligible:false};
  assert.equal(context.bestDiscount({discountQuotes:[q]}),null);
});
test('two rooms from one company compare independently of the active room picker',()=>{
  stored.selectedRooms={jkart:'grand'};
  const q=stored.personalQuotes.jkart[0];
  const a=context.roomView(venue,'atrium');
  const g=context.roomView(venue,'grand');
  assert.equal(context.activePersonalQuote(a).id,q.id);
  assert.equal(context.comparisonTotal(a),8500000);
  assert.equal(context.activePersonalQuote(g),null);
  assert.equal(context.comparisonTotal(g),null);
  assert.equal(stored.selectedRooms.jkart,'grand','comparison must not mutate the picker');
});
