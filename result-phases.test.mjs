import test from 'node:test';
import assert from 'node:assert/strict';
import {resultPhasesFields,collectResultPhases,resultScoreText} from './result-phases.mjs';
import * as phases from './result-phases.mjs';
import {renderAccountSecurity,renderRecoveryForm,renderRecoveryCodes} from './account-security-ui.mjs';
const esc=v=>String(v??'').replaceAll('<','&lt;').replaceAll("'",'&#39;');
test('OCR final score never silently overwrites regulation when extra time is permitted',()=>{
 assert.equal(typeof phases.recognitionScoreFields,'function');
 const input={scores:{left:3,right:1},scoreSide:'host',matchRules:{extraTime:true}};
 assert.equal(phases.recognitionScoreFields(input),null);
 assert.deepEqual(phases.recognitionScoreFields({...input,extraTimeSelected:true}),{extraTimeHome:3,extraTimeAway:1});
 assert.deepEqual(phases.recognitionScoreFields({...input,extraTimeSelected:true,scoreSide:'guest'}),{extraTimeHome:1,extraTimeAway:3});
 assert.deepEqual(phases.recognitionScoreFields({...input,matchRules:{extraTime:false}}),{homeScore:3,awayScore:1});
 assert.equal(phases.recognitionScoreFields({...input,scoreSide:''}),null);
});
test('penalty score shown separately, oriented for each player',()=>{
 const result={homeScore:1,awayScore:1,extraTime:{homeScore:2,awayScore:2},penalties:{homeScore:5,awayScore:3}};
 assert.equal(resultScoreText(result),'2 × 2 · pênaltis 5 × 3');assert.equal(resultScoreText(result,{reverse:true}),'2 × 2 · pênaltis 3 × 5');
});
test('result form supports agreed phases and sends only enabled complete score pairs',()=>{
 const d={matchRules:{extraTime:true,penalties:true},result:null};assert.match(resultPhasesFields(d,{esc}),/Houve prorrogação/);assert.match(resultPhasesFields(d,{esc}),/Houve disputa de pênaltis/);
 const data=new FormData();data.set('usePenalties','yes');data.set('penaltiesHome','5');data.set('penaltiesAway','3');assert.deepEqual(collectResultPhases(data),{penalties:{homeScore:5,awayScore:3}});
 data.set('penaltiesAway','');assert.throws(()=>collectResultPhases(data),/Informe/);
});
test('security HTML has labeled private controls and does not echo CSRF or credentials',()=>{
 const html=renderAccountSecurity({hasPassword:true,sessions:[{id:'123',current:true,createdAt:0,expiresAt:1000,csrfToken:'secret'}],passwordHash:'secret'},{esc,owner:'<user>'});
 assert.ok(!html.includes('secret'));assert.match(html,/current-password/);assert.match(html,/&lt;user>/);
 assert.match(renderRecoveryForm({esc}),/uso único/);assert.match(renderRecoveryCodes(['<code>'],{esc}),/&lt;code>/);
});
