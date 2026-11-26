import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {sampleState} from "../src/lib/sample";
import {checkout} from "../src/lib/pos";
test("upgrade preserves data, protects ownership, isolates roles and commits POS once",async()=>{
 const db=new PGlite(),owner=crypto.randomUUID(),cashier=crypto.randomUUID(),viewer=crypto.randomUUID();
 try{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key,email text);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(await readFile("supabase/migrations/202611260001_coffee_shop.sql","utf8"));
 await db.query("insert into auth.users values($1,'owner@example.com'),($2,'cash@example.com'),($3,'viewer@example.com')",[owner,cashier,viewer]);
 await db.query("insert into shop_profiles values($1,'Owner','admin',true)",[owner]);const original=(await db.query("select state from shop_finance")).rows;
 await db.exec(await readFile("supabase/migrations/202611270002_brand_users_pos.sql","utf8"));assert.deepEqual((await db.query("select state from shop_finance")).rows,original);
 assert.equal((await db.query<{is_owner:boolean}>("select is_owner from shop_profiles")).rows[0].is_owner,true);
 await db.query("select shop_manage_account($1,$2,'Cashier','cashier',true,'cash@example.com')",[owner,cashier]);
 await db.query("select shop_manage_account($1,$2,'Viewer','viewer',true,'viewer@example.com')",[owner,viewer]);
 await assert.rejects(db.query("select shop_manage_account($1,$2,'Owner','employee',false,null)",[owner,owner]),/protected/);
 await assert.rejects(db.query("select shop_manage_account($1,$2,'Self','admin',true,null)",[cashier,cashier]),/owner/);
 for(const [id,count] of [[cashier,0],[viewer,1]] as const){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec("set role authenticated");assert.equal((await db.query("select * from shop_finance")).rows.length,count);await assert.rejects(db.query("select * from shop_pos_displays"),/permission denied/);await assert.rejects(db.query("update shop_profiles set role='admin'"),/permission denied/);await db.exec("reset role");}
 const s=sampleState(),p=s.products[0],op=crypto.randomUUID(),next=checkout(s,[{productId:p.id,qty:1}],{Cash:p.price,GCash:0,Bank:0},op);
 await db.query("update shop_finance set state=$1",[s]);
 await db.query("select shop_commit_pos($1,0,$2,$3,$4)",[cashier,next.state,next.receipt,op]);
 await db.query("select shop_commit_pos($1,0,$2,$3,$4)",[cashier,next.state,next.receipt,op]);
 assert.equal((await db.query("select * from shop_pos_receipts")).rows.length,1);assert.equal((await db.query<{revision:number}>("select revision from shop_finance")).rows[0].revision,1);
 await assert.rejects(db.query("select shop_commit_pos($1,0,$2,$3,$4)",[cashier,next.state,{...next.receipt,id:crypto.randomUUID()},crypto.randomUUID()]),/Revision conflict/);
 await assert.rejects(db.query("select shop_commit_pos($1,1,$2,$3,$4)",[viewer,next.state,next.receipt,crypto.randomUUID()]),/access denied/);
 await db.query("update shop_profiles set active=false where id=$1",[cashier]);await assert.rejects(db.query("select shop_commit_pos($1,1,$2,$3,$4)",[cashier,next.state,next.receipt,op]),/access denied/);
 }finally{await db.close();}
});
