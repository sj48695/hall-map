const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('      function visualSummaryHtml(');
const end = html.indexOf('\n      }', start) + '\n      }'.length;
const context = {state:{budgetWon:30000000},comparisonTotal:v=>v.total,esc:String,won:v=>String(v)};
runInNewContext(html.slice(start,end),context);
test('budget visuals distinguish unknown totals and cap over-budget bars without hiding overspend',()=>{
  const unknown=context.visualSummaryHtml({total:null,groomMin:null,brideMin:undefined});
  assert.ok(unknown.includes('총액 확인 필요'));
  assert.ok(!unknown.includes('예산의 0%'));
  assert.ok(!unknown.includes('NaN'));
  const over=context.visualSummaryHtml({total:45000000,groomMin:120,brideMin:30});
  assert.ok(over.includes('예산의 150%'));
  assert.ok(over.includes('15000000 초과'));
  assert.ok(over.includes('width:100%'));
  assert.ok(!over.includes('width:150%'));
});
test('photo index labels unselected rooms and routes each photo to its own room',()=>{
  const begin=html.indexOf('      function photoIndexHtml(');
  const finish=html.indexOf('\n      }',begin)+'\n      }'.length;
  Object.assign(context,{ROOM_CATALOG:{example:[{id:'a',name:'A홀',image:'a.avif'},{id:'b',name:'B홀',image:'b.avif'}]},safeImage:v=>v || ''});
  runInNewContext(html.slice(begin,finish),context);
  const output=context.photoIndexHtml({id:'example',name:'예시'});
  assert.ok(output.includes('data-open-room="a"') && output.includes('data-open-room="b"'));
  assert.ok(output.includes('눌러서 이 홀 선택'));
  assert.ok(!output.includes('undefined'));
  const selected=context.photoIndexHtml({id:'example',name:'예시',roomId:'b',roomName:'B홀',image:'b.avif',extraImages:['b2.avif']});
  assert.ok(selected.includes('b2.avif'));
  assert.ok(!selected.includes('a.avif'));
});
test('recent quote previews distinguish basic amounts, taxes and room selection', () => {
  const begin=html.indexOf('      function recentQuoteHtml(');
  const finish=html.indexOf('\n      }',begin)+'\n      }'.length;
  runInNewContext(html.slice(begin,finish),context);
  const quotes=[{checkedAt:'2026-11-13',date:'2027-02-13',meal:54000,rental:2100000,minGuests:200,required:200000},{checkedAt:'2026-11-13',date:'2027-02-20',meal:49000,rental:1500000,minGuests:200,required:200000}];
  const output=context.recentQuoteHtml({discountQuotes:quotes});
  assert.ok(output.includes('11500000 ~ 13100000'));
  assert.ok(output.includes('기본 합계') && output.includes('200명 기준'));
  assert.ok(output.includes('2027-02-13') && output.includes('2027-02-20'));
  const missing=context.recentQuoteHtml({roomScoped:true,discountQuotes:[]});
  assert.ok(missing.includes('세부 홀을 선택'));
  const complete=context.recentQuoteHtml({discountQuotes:[{...quotes[0],serviceMode:'included',vatMode:'included'}]});
  assert.ok(complete.includes('세금 포함'));
  const requiredUnknown=context.recentQuoteHtml({discountQuotes:[{...quotes[0],required:null,serviceMode:'included',vatMode:'included'}]});
  assert.ok(requiredUnknown.includes('미확인 세금·필수비용'));
});
test('overview keeps explicit room scope and shows cafe links without pretending to verify bodies', () => {
  for (const name of ['overviewHtml','cafeSourcesHtml']) {
    const begin=html.indexOf('      function '+name+'(');
    const finish=html.indexOf('\n      }',begin)+'\n      }'.length;
    runInNewContext(html.slice(begin,finish),context);
  }
  let selectedRoom;
  context.shown=view=>view.ranked;
  context.roomView=(venue,room)=>{selectedRoom=room;return {...venue,roomName:'다이너스티홀',roomId:room,discountQuotes:[{checkedAt:'2026-11-13',meal:59000,rental:4800000,minGuests:200,required:0}]};};
  const output=context.overviewHtml({ranked:[{id:'westernsindorim',station:'신도림역',discountQuotes:[],interval:70}]});
  assert.equal(selectedRoom,'dynasty');
  assert.ok(output.includes('data-open-room="dynasty"'));
  assert.ok(output.includes('16600000'));
  assert.ok(output.includes('선택 전 다이너스티홀'));
  const cafe=context.cafeSourcesHtml({cafeSources:[{date:'2026-11-12',title:'문래점 후기',url:'https://cafe.naver.com/directwedding/9566081',bodyVerified:false}]});
  assert.ok(cafe.includes('본문 미확인') && cafe.includes('금액·평가·뷔페 점수에 반영하지 않았습니다'));
  assert.ok(!cafe.includes('로그인한 회원'));
});
test('comparison photos retain a fallback for missing and failed images', () => {
  const begin=html.indexOf('      function comparisonPhotoHtml(');
  const finish=html.indexOf('\n      }',begin)+'\n      }'.length;
  runInNewContext(html.slice(begin,finish),context);
  const missing=context.comparisonPhotoHtml({name:'더에스비'});
  assert.ok(missing.includes('is-missing') && missing.includes('등록된 사진이 없어요'));
  const undecided=context.comparisonPhotoHtml({name:'웨스턴',roomScoped:true});
  assert.ok(undecided.includes('세부 홀을 선택'));
  const image=context.comparisonPhotoHtml({name:'홀',image:'hall.jpg'});
  assert.ok(image.includes('onerror=') && image.includes('compare-photo-fallback'));
});
test('cost checklist uses eight stable keys without replacing existing records', () => {
  const begin=html.indexOf('      const COST_CHECKS =');
  const finish=html.indexOf('      const AUTO_CHECK_KEYS',begin);
  runInNewContext(html.slice(begin,finish),context);
  const fnStart=html.indexOf('      function costChecksHtml(');
  const fnEnd=html.indexOf('\n      }',fnStart)+'\n      }'.length;
  runInNewContext(html.slice(fnStart,fnEnd),context);
  const saved={'0-2':true,'cost-tax':true};
  const output=context.costChecksHtml(saved,'data-hall-check');
  assert.equal((output.match(/type="checkbox"/g)||[]).length,8);
  assert.ok(output.includes('1 / 8 확인'));
  assert.ok(output.includes('data-hall-check="cost-tax" checked'));
  assert.deepEqual(saved,{'0-2':true,'cost-tax':true});
  assert.ok(output.includes('외부업체 반입비') && output.includes('부가세·봉사료'));
});
test('saving concise common checks preserves keys outside the visible checklist', () => {
  const begin=html.indexOf('      document.getElementById("checklist-container").addEventListener("change", () => {');
  const finish=html.indexOf('\n      });',begin)+'\n      });'.length;
  let change, stored;
  const count={textContent:''};
  const sandbox={
    COST_CHECKS:[['cost-tax']],
    readJSON:()=>({'legacy-custom':true,'0-2':true,'cost-tax':true}),
    localStorage:{setItem:(key,value)=>{stored=JSON.parse(value);}},
    document:{getElementById:()=>({addEventListener:(name,fn)=>{change=fn;}}),querySelectorAll:()=>[{dataset:{check:'cost-tax'},checked:false}],querySelector:()=>count},
  };
  runInNewContext(html.slice(begin,finish),sandbox);
  change();
  assert.deepEqual(stored,{'legacy-custom':true,'0-2':true,'cost-tax':false});
  assert.equal(count.textContent,'0 / 1 확인');
});
