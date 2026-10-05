const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function extract(name) {
  const start = html.indexOf('      function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = html.indexOf('\n      }', start) + '\n      }'.length;
  return html.slice(start, end);
}
const context = {
  Number, Math, Object,
  OPTION_CATALOG: [{id:'host',label:'사회자'}],
  selectedOptionKeys: () => [],
  optionForKey: () => null,
};
runInNewContext(['quoteMissing','personalCalculation','discountTotals'].map(extract).join('\n'),context);
const quote = {personal:true,meal:50000,rental:1000000,required:0,minGuests:150,flowerKnown:true,serviceMode:'included',vatMode:'included'};
test('included taxes and free required costs produce the base total', () => {
  assert.equal(context.personalCalculation(quote, {}).total, 8500000);
});
test('service on meals, VAT on subtotal including service', () => {
  const q = {...quote, serviceMode:'separate',serviceBase:'meal',servicePercent:5,vatMode:'separate',vatBase:'total',vatPercent:10};
  assert.equal(context.personalCalculation(q, {}).total, 9762500);
});
test('missing mandatory costs, tax mode or tax rate prevent totals', () => {
  for (const patch of [{required:null},{rental:null},{minGuests:null},{vatMode:'unknown'},{serviceMode:'unknown'},{vatMode:'separate',vatPercent:null}]) {
    assert.equal(context.personalCalculation({...quote,...patch},{}).total,null);
  }
});
test('selected options are taxed once; unknown option costs block totals', () => {
  context.selectedOptionKeys = () => ['host'];
  assert.equal(context.personalCalculation(quote,{}).total,null);
  const q = {...quote,optionPrices:{host:100000},serviceMode:'separate',serviceBase:'subtotal',servicePercent:5,vatMode:'separate',vatBase:'total',vatPercent:10};
  assert.equal(context.personalCalculation(q,{}).total,9933000);
  assert.equal(context.personalCalculation({...quote,optionPrices:{host:0}},{}).total,8500000);
  context.selectedOptionKeys = () => [];
});
test('public quote missing required fees remains incomplete', () => {
  assert.equal(context.discountTotals({discountQuotes:[{meal:66000,rental:3000000,minGuests:200,required:null,flowerKnown:false} ]})[0].total,null);
});
