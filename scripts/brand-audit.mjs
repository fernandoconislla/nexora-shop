import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const relevant=files.filter(path=>/\.(?:ts|tsx|js|mjs|sql|svg|md|html|yml|yaml|json|css|sh)$/.test(path));
const failures=[];
for(const path of relevant){
  const source=readFileSync(path,'utf8');
  for(const match of source.matchAll(/Nexora Shop|NEXORA SHOP|Nexora ·|NEXORA \/ PERFORMANCE/g)){
    const line=source.slice(0,match.index).split('\n').length;
    failures.push(path+':'+line+' stale public brand: '+match[0]);
  }
  if(path!=='apps/api/src/db.ts' && path!=='apps/api/test/rebrand-migration.test.mjs'){
    for(const match of source.matchAll(/(?:alice|bob|admin)@nexora\.example/g)){
      const line=source.slice(0,match.index).split('\n').length;
      failures.push(path+':'+line+' stale demo login: '+match[0]);
    }
  }
}
for(const variant of ['principal','negativo','app-movil']){
  const path='apps/storefront/public/icons/super-insecure-tech-store-isotipo-'+variant+'-roto.svg';
  assert.ok(files.includes(path),'missing canonical SVG: '+path);
  assert.match(readFileSync(path,'utf8'),/Super Insecure Tech Store/);
}
assert.ok(files.includes('apps/api/test/rebrand-migration.test.mjs'),'migration regression test missing');
if(failures.length){
  console.error(failures.join('\n'));
  process.exitCode=1;
}else{
  console.log('PASS brand audit: '+relevant.length+' tracked text sources checked, no stale public brand or demo logins');
}
