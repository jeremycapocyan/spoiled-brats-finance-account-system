import {test} from "node:test";
import assert from "node:assert/strict";
import {sampleState} from "../src/lib/sample";
import {checkout,catalog,sanitizeDisplay} from "../src/lib/pos";
import {report} from "../src/lib/finance";
import {today,type Profile} from "../src/lib/model";
import {canReadFinance,canSell,validateAccountChange} from "../src/lib/permissions";
test("POS uses catalog prices and recipes, aggregates daily sales, and reduces stock",()=>{
 const s=sampleState(),p=s.products.find(p=>p.id==="latte")!,before=report(s,today(),today());
 const one=checkout(s,[{productId:p.id,qty:2}],{Cash:p.price*2,GCash:0,Bank:0},crypto.randomUUID());
 const two=checkout(one.state,[{productId:p.id,qty:1}],{Cash:0,GCash:p.price,Bank:0},crypto.randomUUID());
 assert.equal(two.state.sales.filter(x=>x.date===today()).length,1);
 const after=report(two.state,today(),today());assert.equal(after.revenue-before.revenue,p.price*3);assert(after.stockValue<before.stockValue);
 assert.equal(one.receipt.total,p.price*2);assert.equal(one.receipt.lines[0].price,p.price);assert.equal(one.receipt.lines[0].name,p.name);
 assert(!JSON.stringify(catalog(s)).includes('unitCost'));assert(!Object.hasOwn(catalog(s)[0],'cost'));
});
test("shared ingredient shortages, unavailable products and invalid payments reject checkout without mutating state",()=>{
 const s=sampleState(),before=JSON.stringify(s),p=s.products[0];
 assert.throws(()=>checkout(s,[{productId:p.id,qty:9999}],{Cash:p.price*9999,GCash:0,Bank:0},crypto.randomUUID()));
 assert.throws(()=>checkout(s,[{productId:p.id,qty:1}],{Cash:1,GCash:0,Bank:0},crypto.randomUUID()),/Payments/);
 assert.throws(()=>checkout(s,[{productId:p.id,qty:-1}],{Cash:0,GCash:0,Bank:0},crypto.randomUUID()),/quantity/);
 assert.throws(()=>checkout(s,[{productId:p.id,qty:1},{productId:p.id,qty:1}],{Cash:p.price*2,GCash:0,Bank:0},crypto.randomUUID()),/distinct/);
 p.archived=true;assert.throws(()=>checkout(s,[{productId:p.id,qty:1}],{Cash:p.price,GCash:0,Bank:0},crypto.randomUUID()),/Invalid product/);p.archived=false;
 assert.equal(JSON.stringify(s),before);
});
test("customer display strips private fields and rejects malformed totals",()=>{
 const input={lines:[{name:"Latte",qty:1,amount:10000,cost:1200}],total:10000,status:"order",sample:false,ownerEmail:"private@example.com",authToken:"secret"};
 assert.deepEqual(sanitizeDisplay(input),{lines:[{name:"Latte",qty:1,amount:10000}],total:10000,status:"order",sample:false});
 assert.throws(()=>sanitizeDisplay({...input,total:1}));assert.throws(()=>sanitizeDisplay({...input,lines:[{name:"x",qty:-1,amount:10000}]}));
});
test("roles enforce finance and POS access and protect the owner",()=>{
 const owner:Profile={id:"owner",name:"Owner",role:"admin",active:true,is_owner:true};
 for(const role of ["admin","cashier","viewer","employee"] as const){const p={...owner,id:role,role,is_owner:false};assert.equal(canReadFinance(p),role==="admin"||role==="viewer");assert.equal(canSell(p),role==="admin"||role==="cashier");assert.throws(()=>validateAccountChange(p,owner,"admin",true),/owner/i);}
 assert.throws(()=>validateAccountChange(owner,owner,"employee",false),/protected/);assert.throws(()=>validateAccountChange(owner,{...owner,id:"staff",is_owner:false},"toString",true),/valid/);
 assert(!canSell({...owner,active:false}));assert(!canReadFinance({...owner,active:false}));
});
