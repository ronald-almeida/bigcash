import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalStatus, monthEnd, monthResult } from '../src/monthly.ts';
import type { Entry } from '../src/finance.ts';
test('monthly statuses distinguish closed failure, ongoing, planned and absent targets',()=>{
 assert.equal(goalStatus(100,99,'2026-08','2026-09'),'Não atingida');
 assert.equal(goalStatus(100,100,'2026-08','2026-09'),'Atingida');
 assert.equal(goalStatus(100,-100,'2026-09','2026-09'),'Em andamento');
 assert.equal(goalStatus(100,0,'2026-10','2026-09'),'Planejada');
 assert.equal(goalStatus(0,100,'2026-08','2026-09'),'Sem meta');
 assert.equal(monthEnd('2028-02'),'2028-02-29');
});
test('monthly actuals exclude future paid entries and deduct recurring pro-labore',()=>{
 const base:Entry={id:'1',kind:'income',name:'Venda',amount:10000,date:'2026-09-01',category:'',notes:'',recurring:false,endDate:'',status:'paid',feeType:'fixed',feeValue:0,feeClass:'tax',incomeId:'',parts:[],review:false};
 const entries=[base,{...base,id:'2',kind:'salary' as const,amount:3000,recurring:true},{...base,id:'3',date:'2026-09-30',amount:90000}];
 assert.deepEqual(monthResult(entries,'2026-09','2026-09-15'),{actual_revenue:10000,actual_profit:7000});
 assert.deepEqual(monthResult(entries,'2026-09','2026-10-01'),{actual_revenue:100000,actual_profit:97000});
 assert.deepEqual(monthResult(entries,'2026-10','2026-09-15'),{actual_revenue:0,actual_profit:0});
});
