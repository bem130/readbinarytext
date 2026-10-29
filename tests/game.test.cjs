'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert.ok(!html.includes('\uFFFD'),'UTF-8 text');
assert.ok(!/<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:/i.test(html),'no external assets');
assert.ok(!/<form\b|\btype=["']submit["']/i.test(html),'swipla forbids native form submission');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const listeners={},nodes=new Map(),messages=[];
let markup='',focusedId=null,scrolledId=null;
const app={addEventListener:(name,handler)=>listeners[name]=handler};
Object.defineProperty(app,'innerHTML',{get:()=>markup,set:value=>{
 markup=value;nodes.clear();focusedId=null;
 for(const match of value.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g))nodes.set(match[1],{value:match[0].match(/\bvalue="([^"]*)"/)?.[1]??'',textContent:'',className:'',focus(){focusedId=match[1]},scrollIntoView(){scrolledId=match[1]}});
}});
const window={parent:{postMessage:(message,origin)=>messages.push({message,origin})}};
const context=vm.createContext({console,window,document:{getElementById:id=>id==='app'?app:nodes.get(id)}});
const run=code=>vm.runInContext(code,context);
vm.runInContext(script,context);
const plain=code=>JSON.parse(JSON.stringify(run(code)));
function submit(value){nodes.get('answer').value=value;click('answer')}
function click(action){listeners.click({target:{closest:()=>({dataset:{action},disabled:false})}})}
function keydown(overrides={}){
 let prevented=false;
 listeners.keydown({target:{id:'answer'},key:'Enter',isComposing:false,keyCode:13,repeat:false,...overrides,preventDefault(){prevented=true}});
 return prevented;
}
assert.equal(listeners.submit,undefined,'answering must not depend on a submit event');

// Compare every ASCII byte against its independently generated binary string,
// then verify the actual SVG pixel colors, including timing and spacing rows.
for(let byte=0;byte<128;byte++){
 const char=String.fromCharCode(byte),expression=JSON.stringify(char);
 const expected=[1,...byte.toString(2).padStart(8,'0').split('').map(Number),0];
 assert.deepEqual(plain(`encodeColumns(${expression})`),[expected]);
 const svg=run(`board(${expression})`);
 const colors=[...svg.matchAll(/<rect\b[^>]*fill="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(colors,expected.map(bit=>bit?'#a9ced0':'#03071a'));
 const description=svg.match(/<svg\b[^>]*aria-label="([^"]+)"/)[1];
 assert.ok(description.includes('1列目：'+expected.slice(1,9).join('、')), 'readable data excludes timing/spacer');
}
assert.deepEqual(plain("encodeColumns('AAAAAAAA').map(column=>column[0])"),[1,1,0,0,1,1,0,0]);
assert.deepEqual(plain("encodeColumns('A')[0]"),[1,0,1,0,0,0,0,0,1,0]);
assert.throws(()=>run("encodeColumns('あ')"),/ASCII/);
const chart=run('reference()');
const referenceColors=[...chart.matchAll(/<rect\b[^>]*fill="([^"]+)"/g)].map(match=>match[1]);
const expectedReference=[];
for(let byte=65;byte<=90;byte++){
 const column=(byte-65)%13;
 expectedReference.push(column%4<2?1:0,...byte.toString(2).padStart(8,'0').split('').map(Number),0);
}
assert.deepEqual(referenceColors,expectedReference.map(bit=>bit?'#a9ced0':'#03071a'));
assert.ok(!chart.includes('10進数'));
const referenceDescriptions=[...chart.matchAll(/<svg\b[^>]*aria-label="([^"]+)"/g)].map(match=>match[1]).join('');
for(let byte=65;byte<=90;byte++)assert.ok(referenceDescriptions.includes(String.fromCharCode(byte)+'：'+byte.toString(2).padStart(8,'0').split('').join('、')));
const questionLabel=run("board('CODE')").match(/<svg\b[^>]*aria-label="([^"]+)"/)[1];
assert.ok(!questionLabel.includes('CODE'), 'do not disclose decoded answer');
assert.notEqual(run("board('AA')").match(/<svg\b[^>]*aria-label="([^"]+)"/)[1],run("board('ZZ')").match(/<svg\b[^>]*aria-label="([^"]+)"/)[1]);
console.log('PASS: all 128 ASCII codes, MSB-first SVG pixels, timing 1100, dark spacer');
console.log('PASS: A-Z reference chart uses matching bit images');

run(`for(let seed=0;seed<500;seed++){
 let x=seed;const random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
 const questions=makeQuestions(random);
 if(questions.length!==8||new Set(questions).size!==8)throw Error('count / duplicates');
 if(questions.some((word,i)=>word.length!==ROUND_LENGTHS[i]||!/^[A-Z]+$/.test(word)))throw Error('question domain');
}`);
console.log('PASS: 500 question sets, lengths 2/2/3/3/4/4/5/6, unique uppercase ASCII words');

click('practice');assert.equal(run('question()'),'A');assert.equal(focusedId,'answer');submit('a');assert.equal(run('state.screen'),'review');
assert.equal(run('state.score'),0);assert.equal(messages.length,0);click('next');
assert.equal(focusedId,'answer');assert.equal(scrolledId,'answer');
assert.equal(run('state.practice'),false);assert.equal(run('state.index'),0);
submit('');submit('あ');submit('TOOLONG');assert.equal(run('state.wrong'),0);
const first=run('question()');submit('ZZ');assert.equal(run('state.wrong'),1);
click('hint');click('hint');assert.equal(run('availablePoints()'),40);
assert.equal(focusedId,'hint-title');assert.equal(scrolledId,'hint-title');
assert.equal(nodes.get('answer').value,'ZZ', 'keep input when opening reference');
click('return-input');assert.equal(focusedId,'answer');assert.equal(scrolledId,'answer');
listeners.input({target:{id:'answer',value:'test'}});nodes.get('answer').value='test';
click('hint');assert.equal(nodes.get('answer').value,'test');assert.equal(focusedId,'hint-title');
assert.equal(run('availablePoints()'),40,'revisiting the reference is not penalized again');
submit(first.toLowerCase());assert.equal(run('state.score'),40);run(`submit(${JSON.stringify(first)})`);assert.equal(run('state.score'),40);
click('next');assert.equal(run('availablePoints()'),100);
assert.equal(focusedId,'answer');assert.equal(scrolledId,'answer');
for(let i=0;i<7;i++)submit('ZZ');assert.equal(run('availablePoints()'),0);
submit(run('question()'));assert.equal(run('state.score'),40);click('next');
click('reveal');assert.equal(run('state.earned'),0);assert.equal(run('state.results[2].revealed'),true);click('next');
while(run('state.screen')!=='result'){submit(run('question()'));click('next')}
assert.equal(run('state.score'),540);assert.equal(messages.length,1);
assert.equal(focusedId,'result-title');assert.equal(scrolledId,'result-title');
assert.deepEqual(JSON.parse(JSON.stringify(messages[0])),{message:{type:'gameover',score:540},origin:'https://swipla.co'});
click('next');assert.equal(messages.length,1);
click('start');assert.equal(run('state.score'),0);assert.equal(run('state.results.length'),0);
while(run('state.screen')!=='result'){submit(run('question()'));click('next')}
assert.equal(run('state.score'),800);assert.equal(messages.length,2);
window.parent=window;click('start');
while(run('state.screen')!=='result'){click('reveal');click('next')}
assert.equal(run('state.score'),0);assert.equal(messages.length,2);
click('menu');assert.equal(focusedId,'menu-title');assert.equal(scrolledId,'menu-title');
console.log('PASS: click handlers, practice, invalid input, penalties, reveal, restart, scores 0..800, single trusted-origin notification, standalone mode');
console.log('PASS: accessible question/reference bits, heading focus/scroll, reference return, input preservation and one-time hint penalty');

// Both answer paths work without dispatching any form-submit events.
const beforeEnterRound=messages.length;
window.parent={postMessage:(message,origin)=>messages.push({message,origin})};
click('practice');nodes.get('answer').value='A';
assert.equal(keydown({isComposing:true}),false);
assert.equal(keydown({keyCode:229}),false);
assert.equal(keydown({key:'a'}),false);
assert.equal(keydown({target:{id:'next'}}),false);
assert.equal(run('state.screen'),'question');assert.equal(run('state.wrong'),0);
assert.equal(keydown(),true);assert.equal(run('state.screen'),'review');
assert.doesNotThrow(()=>click('answer'),'late answer clicks do not access removed inputs');
assert.doesNotThrow(()=>keydown(),'late key events do not access removed inputs');
click('next');nodes.get('answer').value='ZZ';
keydown();assert.equal(run('state.wrong'),1);
assert.equal(keydown({repeat:true}),true);assert.equal(run('state.wrong'),1);
submit(run('question()'));click('next');
while(run('state.screen')!=='result'){
 nodes.get('answer').value=run('question()').toLowerCase();
 keydown();click('next');
}
assert.equal(run('state.score'),780);
assert.equal(messages.length,beforeEnterRound+1);
assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1))),{message:{type:'gameover',score:780},origin:'https://swipla.co'});
click('next');keydown();assert.equal(messages.length,beforeEnterRound+1);
console.log('PASS: form-free click/Enter answers, IME confirmation ignored, key repeat ignored, full round via Enter');

// Focus the next action and associate the answer summary with it.
function feedbackText(){
 assert.equal(focusedId,'next');assert.equal(scrolledId,'next');
 assert.match(markup,/<button id="next"[^>]*aria-describedby="answer-result"/);
 assert.ok(markup.indexOf('id="answer-result"')<markup.indexOf('id="next"'));
 return markup.match(/<p id="answer-result"[^>]*>([^<]+)<\/p>/)[1];
}
click('practice');submit('A');assert.match(feedbackText(),/正解！ 答えは A。/);
click('practice');click('reveal');assert.match(feedbackText(),/答えは A。/);
for(const hint of [false,true]){
 click('start');if(hint)click('hint');
 const word=run('question()'),initialPoints=hint?60:100;
 for(let points=initialPoints;points>0;points-=20){
  submit('ZZ');assert.equal(run('availablePoints()'),points-20);
  assert.match(nodes.get('notice').textContent,/−20点/);
 }
 for(let i=0;i<2;i++){
  submit('ZZ');assert.equal(run('availablePoints()'),0);
  assert.equal(run('state.score'),0);
  assert.match(nodes.get('notice').textContent,/獲得可能点は0点/);
  assert.doesNotMatch(nodes.get('notice').textContent,/−20点/);
 }
 submit(word);assert.ok(feedbackText().includes(word));assert.match(feedbackText(),/0点獲得/);
}
click('start');const correctWord=run('question()');submit(correctWord);
assert.ok(feedbackText().includes(correctWord));assert.match(feedbackText(),/100点獲得/);
click('next');const revealedWord=run('question()');click('reveal');
assert.ok(feedbackText().includes(revealedWord));assert.match(feedbackText(),/この問題は0点/);
console.log('PASS: next-action focus with answer description for practice/correct/revealed answers, accurate zero-point feedback');
