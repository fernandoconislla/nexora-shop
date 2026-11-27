import {test,expect} from '@playwright/test';

const base=process.env.NEXORA_BASE??'http://127.0.0.1:8090';
const supplier=process.env.NEXORA_SUPPLIER??'http://127.0.0.1:8091';
const alice={email:'alice@nexora.example',password:'AliceDemo!2026'};
const admin={email:'admin@nexora.example',password:'AdminDemo!2026'};

async function reset(request){
  if(process.env.NEXORA_E2E_ALLOW_RESET!=='YES')throw new Error('Refusing destructive E2E tests: explicitly set NEXORA_E2E_ALLOW_RESET=YES on an isolated training deployment.');
  const response=await request.post(base+'/api/v1/admin/lab/reset',{data:{...admin,confirmation:'RESET LAB'}});
  expect(response.ok(),await response.text()).toBeTruthy();
  expect((await response.json()).reset).toBe(true);
}
async function login(page,credentials=alice){
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.locator('main form button[type="submit"]').click();
}
async function bearer(request,credentials=admin){
  const response=await request.post(base+'/api/v1/auth/login',{data:credentials});
  expect(response.status()).toBe(200);
  return (await response.json()).access_token;
}

test.describe('Nexora Shop browser regression — isolated lab',()=>{
  test.beforeEach(async({request})=>{await reset(request)});

  test('visitor cart survives login, checkout, order confirmation reload and history',async({page})=>{
    await page.goto('/shop');
    const first=page.locator('article.product').filter({hasText:'Laptop'}).first();
    await expect(first).toBeVisible();
    await first.getByRole('button',{name:'Add to cart'}).click();
    await expect(page.getByRole('heading',{name:'Your shopping cart'})).toBeVisible();
    await page.getByRole('button',{name:/Sign in to continue checkout/}).click();
    await page.getByLabel('Email').fill(alice.email);
    await page.getByLabel('Password').fill(alice.password);
    await page.locator('main form button[type="submit"]').click();
    await expect(page.getByRole('heading',{name:'Your shopping cart'})).toBeVisible();
    await expect(page.getByText('Laptop',{exact:true}).first()).toBeVisible();
    await expect(page.getByText('USB-C Hub',{exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:/Place order/}).click();
    await expect(page.getByRole('heading',{name:'Thank you for your order!'})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:'Order history'})).toBeVisible();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.locator('.order-card').first()).toBeVisible();
  });

  test('authenticated customer cart and payment methods work after refresh',async({page})=>{
    await login(page);
    // The guest navbar also contains Cart: wait for the authenticated identity
    // before reloading, otherwise navigation can interrupt an in-flight login.
    await expect(page.getByRole('button',{name:/Alice/})).toBeVisible();
    await page.reload();
    await page.getByRole('button',{name:/Cart \(/}).click();
    await expect(page.getByRole('heading',{name:'Your shopping cart'})).toBeVisible();
    await expect(page.getByText('USB-C Hub',{exact:true}).first()).toBeVisible();
    await expect(page.getByText(/Visa.*4242/).first()).toBeVisible();
  });

  test('login credentials help navigates back to the welcome page',async({page})=>{
    await page.goto('/login');
    await page.getByRole('link',{name:'lab welcome page'}).click();
    await expect(page).toHaveURL(base+'/');
    await expect(page.getByRole('heading',{name:'Sign in with a test account'})).toBeVisible();
  });

  test('footer About this lab opens the welcome page from the storefront',async({page})=>{
    await page.goto('/shop');
    await expect(page.getByRole('link',{name:'About this lab'})).toBeVisible();
    await page.getByRole('link',{name:'About this lab'}).click();
    await expect(page).toHaveURL(base+'/');
    await expect(page.getByRole('heading',{name:'Explore. Test. Understand API Security.'})).toBeVisible();
  });

  test('invalid saved JWT produces a sign-in prompt instead of a cart failure',async({page})=>{
    await page.goto('/shop');
    await page.evaluate(()=>{
      sessionStorage.setItem('nexora-tab-auth-v1',JSON.stringify({account:{id:101,email:'alice@nexora.example',display_name:'Alice Morgan',role:'customer'},token:'invalid.jwt.signature'}));
    });
    await page.reload();
    await expect(page.getByRole('heading',{name:'Sign in to Nexora'})).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('ten challenge objectives and progressive solutions are reachable',async({page})=>{
    for(let n=1;n<=10;n++){
      const id='api'+String(n).padStart(2,'0');
      await page.goto('/challenges?api='+id);
      await expect(page.locator('.challenge-detail-top')).toContainText('Challenge '+n+' of 10');
      await expect(page.getByRole('heading',{name:'Learning objective'})).toBeVisible();
      await page.getByRole('button',{name:'Reveal next hint'}).click();
      await expect(page.locator('.challenge-hint')).toHaveCount(1);
      await page.getByRole('button',{name:'Reveal solution'}).click();
      await expect(page.getByRole('heading',{name:'Verification after fix'})).toBeVisible();
    }
  });

  test('administrator sees monitoring charts and supplier integration',async({page})=>{
    await page.goto('/monitor');
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.locator('main form button[type="submit"]').click();
    await expect(page.getByRole('heading',{name:'Resource Monitor'})).toBeVisible();
    await expect(page.locator('.resource-history svg')).toHaveCount(3);
    await page.getByRole('button',{name:'Integrations'}).click();
    await expect(page.getByRole('heading',{name:'Supplier Integration'})).toBeVisible();
    await expect(page.getByText('Connection:')).toContainText('connected');
  });

  test('API10 stored HTML triggers browser JavaScript only in vulnerable storefront',async({page,request})=>{
    const response=await request.patch(supplier+'/supplier/products/SUP-1002',{
      headers:{authorization:'Basic '+Buffer.from('admin:admin').toString('base64')},
      data:{price:'79.99',description:'<img src=x onerror=alert(1)>'}
    });
    expect(response.status()).toBe(200);
    const token=await bearer(request);
    const sync=await request.post(base+'/api/v1/admin/integrations/supplier/sync',{headers:{authorization:'Bearer '+token}});
    expect(sync.status()).toBe(200);
    const dialogs=[];
    page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});
    await page.goto('/shop');
    await expect(page.locator('article.product').filter({hasText:'Wireless Headphones'}).first()).toBeVisible();
    await expect.poll(()=>dialogs.length).toBeGreaterThan(0);
    expect(dialogs).toContain('1');
  });

  test('Reset Lab Data restores supplier and store product changes',async({page,request})=>{
    const changed=await request.patch(supplier+'/supplier/products/SUP-1001',{
      headers:{authorization:'Basic '+Buffer.from('admin:admin').toString('base64')},
      data:{price:'1.00',description:'Changed for reset browser test'}
    });
    expect(changed.status()).toBe(200);
    const token=await bearer(request);
    const sync=await request.post(base+'/api/v1/admin/integrations/supplier/sync',{headers:{authorization:'Bearer '+token}});
    expect(sync.status()).toBe(200);
    await page.goto('/');
    await page.getByRole('button',{name:'Reset Lab Data'}).click();
    await page.getByLabel('Administrator password').fill(admin.password);
    await page.getByLabel('Type RESET LAB to confirm').fill('RESET LAB');
    await page.getByRole('button',{name:'Confirm reset'}).click();
    await expect(page.getByText(/Lab restored/)).toBeVisible();
    const product=await request.get(base+'/api/v1/products/1100');
    expect((await product.json()).product.price).toBe('1000.00');
    const feed=await request.get(supplier+'/supplier/feed/products');
    expect((await feed.json()).products.find(p=>p.id==='SUP-1001').price).toBe('1000.00');
  });

  test('mobile storefront and challenge pages avoid horizontal overflow',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    for(const path of ['/shop','/challenges?api=api01']){
      await page.goto(path);
      await expect(page.locator('body')).toBeVisible();
      const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:window.innerWidth}));
      expect(sizes.scroll,'Horizontal overflow on '+path).toBeLessThanOrEqual(sizes.view+2);
    }
  });
});
