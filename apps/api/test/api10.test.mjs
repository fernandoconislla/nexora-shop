import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pendingSupplierProducts,importSupplierProducts} from '../src/api10.ts';
function fixture(){const d=new DatabaseSync(':memory:');d.exec('PRAGMA foreign_keys=ON');d.exec(readFileSync('database/schema.sql','utf8'));d.exec(readFileSync('database/seed.sql','utf8'));return d}
const feed=[
 {id:'SUP-1001',name:'Laptop',price_cents:100000,description:'Regular supplier update',version:2,updated_at:'2026-10-19T00:00:00Z'},
 {id:'SUP-1002',name:'Headphones',price_cents:7999,description:'<img src=x onerror=alert(1)>',version:2,updated_at:'2026-10-19T00:00:00Z'}
];
test('API10 supplier versions determine pending items',()=>{const db=fixture();assert.equal(pendingSupplierProducts(db,feed).length,2);db.close()});
test('API10 imports ordinary supplier updates with valid product prices',()=>{const db=fixture();assert.equal(importSupplierProducts(db,feed).updated,2);assert.equal(db.prepare('SELECT price_cents FROM products WHERE id=1100').get().price_cents,100000);assert.equal(pendingSupplierProducts(db,feed).length,0);db.close()});
test('API10 rejects below-floor prices without modifying products or advancing their source version',()=>{
 const db=fixture();
 const low={...feed[0],price_cents:100,description:'Untrusted supplier price'};
 assert.equal(importSupplierProducts(db,[low]).updated,0);
 const product=db.prepare('SELECT price_cents, description FROM products WHERE id=1100').get();
 assert.equal(product.price_cents,100000);
 assert.notEqual(product.description,'Untrusted supplier price');
 assert.equal(pendingSupplierProducts(db,[low]).length,1);
 db.close();
});
test('API10 preserves supplier-sourced HTML for the intentional stored XSS lab',()=>{
 const db=fixture();
 assert.equal(importSupplierProducts(db,[feed[1]]).updated,1);
 assert.match(db.prepare('SELECT description FROM products WHERE id=1101').get().description,/onerror/);
 assert.equal(pendingSupplierProducts(db,[feed[1]]).length,0);
 db.close();
});
