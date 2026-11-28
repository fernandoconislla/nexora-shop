import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('persistent pre-rebrand SQLite data migrates without losing student changes',async t=>{
  if(!existsSync('apps/api/dist/db.js'))return t.skip('Build API before migration integration test');
  const dir=mkdtempSync(join(tmpdir(),'sits-migration-'));
  const originalDbPath=process.env.DB_PATH;
  const dbFile=join(dir,'legacy.db');
  try{
    const old=new DatabaseSync(dbFile);
    old.exec(readFileSync('database/schema.sql','utf8'));
    old.exec(readFileSync('database/seed.sql','utf8'));
    for(const [name,priorDomain] of [['alice','nexora.example'],['bob','superinsecuretechstore.example'],['admin','superinsecuretechstore.example']]){
      old.prepare('UPDATE users SET email=? WHERE email=?').run(name+'@'+priorDomain,name+'@tech-store.com');
    }
    const insert=old.prepare("INSERT INTO products(id,name,description,price_cents,stock,is_limited_edition,created_at,updated_at) VALUES(?,?,?,?,?,0,'2026-01-01','2026-01-01')");
    insert.run(2000,'Legacy Keyboard','Nexora mechanical keyboard for everyday work. Model 0001.',2200,17);
    insert.run(2001,'Edited Mouse','Nexora custom learner-provided description',3300,9);
    old.prepare('UPDATE cart_items SET quantity=4 WHERE id=8001').run();
    old.close();

    process.env.DB_PATH=dbFile;
    const {initialize}=await import('../dist/db.js?rebrand-migration-regression');
    let db=initialize();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,3);
    assert.equal(db.prepare('SELECT email FROM users WHERE id=101').get().email,'alice@tech-store.com');
    assert.equal(db.prepare('SELECT email FROM users WHERE id=102').get().email,'bob@tech-store.com');
    assert.equal(db.prepare('SELECT email FROM users WHERE id=900').get().email,'admin@tech-store.com');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,2);
    assert.equal(db.prepare('SELECT quantity FROM cart_items WHERE id=8001').get().quantity,4);
    assert.equal(db.prepare('SELECT stock FROM products WHERE id=2000').get().stock,17);
    assert.equal(db.prepare('SELECT description FROM products WHERE id=2000').get().description,'Super Insecure Tech Store mechanical keyboard for everyday work. Model 0001.');
    assert.equal(db.prepare('SELECT description FROM products WHERE id=2001').get().description,'Nexora custom learner-provided description');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n,40000);
    db.close();

    db=initialize();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE email LIKE ?').get('%@tech-store.com').n,3);
    assert.equal(db.prepare('SELECT quantity FROM cart_items WHERE id=8001').get().quantity,4);
    assert.equal(db.prepare('SELECT description FROM products WHERE id=2000').get().description,'Super Insecure Tech Store mechanical keyboard for everyday work. Model 0001.');
    db.close();
  }finally{
    if(originalDbPath===undefined)delete process.env.DB_PATH;else process.env.DB_PATH=originalDbPath;
    rmSync(dir,{recursive:true,force:true});
  }
});
