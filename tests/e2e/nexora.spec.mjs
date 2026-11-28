import {test,expect} from '@playwright/test';

const base=process.env.NEXORA_BASE??'http://127.0.0.1:8090';
const supplier=process.env.NEXORA_SUPPLIER??'http://127.0.0.1:8091';
const alice={email:'alice@tech-store.com',password:'AliceDemo!2026'};
const admin={email:'admin@tech-store.com',password:'AdminDemo!2026'};

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

test.describe('Super Insecure Tech Store browser regression — isolated lab',()=>{
  test.beforeEach(async({request})=>{await reset(request)});

  test('presentation, login and API docs use only the three tech-store.com demo emails',async({page,request})=>{
    await page.goto('/');
    const credentials=page.locator('.guide-account');
    await expect(credentials).toHaveCount(3);
    for(const email of ['alice@tech-store.com','bob@tech-store.com','admin@tech-store.com']){
      await expect(credentials.getByText(email,{exact:true})).toBeVisible();
    }
    await expect(page.locator('body')).not.toContainText(/@(nexora\.example|superinsecuretechstore\.example)/);
    await page.getByRole('button',{name:/Reset lab data/i}).click();
    await expect(page.getByLabel('Administrator email')).toHaveValue('admin@tech-store.com');
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toHaveValue('alice@tech-store.com');
    const openapi=await (await request.get(base+'/api/openapi.json')).text();
    expect(openapi).toContain('alice@tech-store.com');
    expect(openapi).not.toMatch(/@(nexora\.example|superinsecuretechstore\.example)/);
  });

  test('stored legacy session profile email is normalized without invalidating a valid JWT',async({page,request})=>{
    const token=await bearer(request,alice);
    for(const formerDomain of ['nexora.example','superinsecuretechstore.example']){
      await page.goto('/shop');
      await page.evaluate(({email,token})=>{
        sessionStorage.setItem('nexora-tab-auth-v1',JSON.stringify({account:{id:101,email,display_name:'Alice Morgan',role:'customer'},token}));
      },{email:'alice@'+formerDomain,token});
      await page.reload();
      await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('nexora-tab-auth-v1')).account.email)).toBe('alice@tech-store.com');
      await expect(page.getByRole('button',{name:/Alice/})).toBeVisible();
    }
  });

  test('rebrand is consistent across API, generated catalog, monitoring and pages',async({page,request})=>{
    const health=await request.get(base+'/api/health');
    expect(health.ok()).toBe(true);
    expect((await health.json()).application).toBe('Super Insecure Tech Store');
    const openapi=await request.get(base+'/api/openapi.json');
    expect(openapi.ok()).toBe(true);
    expect((await openapi.json()).info.title).toBe('Super Insecure Tech Store API');
    const generated=await request.get(base+'/api/v1/products/2000');
    expect(generated.ok()).toBe(true);
    expect((await generated.json()).product.description).toMatch(/^Super Insecure Tech Store /);
    const monitor=await request.get((process.env.NEXORA_MONITOR??'http://127.0.0.1:8092')+'/');
    expect(monitor.ok()).toBe(true);
    expect(await monitor.text()).toContain('SUPER INSECURE TECH STORE / PERFORMANCE');
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Super Insecure Tech Store');
    await page.goto('/shop');
    await expect(page.locator('.shop-brand-name')).toHaveText('SUPER INSECURETECH STORE');
    await page.goto('/challenges');
    await expect(page.locator('.challenge-brand-name strong')).toHaveText('SUPER INSECURE');
    await expect(page.locator('.challenge-brand-name > b')).toHaveText('TECH STORE');
    await expect(page.locator('.challenge-brand-name small')).toHaveText('OWASP API SECURITY LAB');
  });

  test('new SVG shop isotypes load across storefront, welcome and challenges',async({page,request})=>{
    for(const icon of ['principal','negativo','app-movil']){
      const response=await request.get(base+'/icons/super-insecure-tech-store-isotipo-'+icon+'-roto.svg');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/svg+xml');
      expect(await response.text()).toContain('clip-path="url(#fracture)"');
    }
    await page.goto('/');
    await expect(page.locator('.welcome-brand img.mark')).toHaveAttribute('src','/icons/super-insecure-tech-store-isotipo-principal-roto.svg');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href','/icons/super-insecure-tech-store-isotipo-app-movil-roto.svg');
    await page.goto('/shop');
    await expect(page.locator('.shop-logo img.brand-icon')).toHaveAttribute('src','/icons/super-insecure-tech-store-isotipo-negativo-roto.svg');
    await expect(page.locator('.shop-brand-name')).toHaveText('SUPER INSECURETECH STORE');
    await expect(page).toHaveTitle('Super Insecure Tech Store');
    await page.goto('/challenges');
    await expect(page.locator('.challenge-brand img.challenge-brand-icon')).toHaveAttribute('src','/icons/super-insecure-tech-store-isotipo-principal-roto.svg');
  });

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
    await expect(page.getByRole('heading',{level:1,name:'Super Insecure Tech Store',exact:true})).toBeVisible();
  });

  test('invalid saved JWT produces a sign-in prompt instead of a cart failure',async({page})=>{
    await page.goto('/shop');
    await page.evaluate(()=>{
      sessionStorage.setItem('nexora-tab-auth-v1',JSON.stringify({account:{id:101,email:'alice@tech-store.com',display_name:'Alice Morgan',role:'customer'},token:'invalid.jwt.signature'}));
    });
    await page.reload();
    await expect(page.getByRole('heading',{name:'Sign in to Super Insecure Tech Store'})).toBeVisible();
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
    await expect(page.getByRole('heading',{name:/^Resource Monitor/})).toBeVisible();
    await expect(page.locator('.resource-history svg')).toHaveCount(3);
    await page.getByRole('button',{name:'Integrations'}).click();
    await expect(page.getByRole('heading',{name:'Supplier Integration'})).toBeVisible();
    await expect(page.locator('.integration-status')).toContainText('Connected');
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


  test('Super Insecure Tech Store Navy and Green storefront identity renders consistently at desktop and mobile',async({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.goto('/shop');
    await expect(page.locator('.shop-header')).toBeVisible();
    await expect(page.locator('.catalog-grid .product')).toHaveCount(10);
    const desktop=await page.evaluate(()=>{
      const color=s=>getComputedStyle(document.querySelector(s)).backgroundColor;
      const grid=getComputedStyle(document.querySelector('.catalog-grid')).gridTemplateColumns;
      return {header:color('.shop-header'),footer:color('.shop-footer'),action:color('.catalog-grid .add-cart'),columns:grid.split(' ').length};
    });
    expect(desktop.header).toBe('rgb(13, 37, 56)');
    expect(desktop.footer).toBe(desktop.header);
    expect(desktop.action).toBe('rgb(8, 127, 56)');
    expect(desktop.columns).toBe(4);
    for(const width of [1024,768,390,320]){
      await page.setViewportSize({width,height:844});
      const view=await page.evaluate(()=>({
        columns:getComputedStyle(document.querySelector('.catalog-grid')).gridTemplateColumns.split(' ').length,
        overflow:document.documentElement.scrollWidth>window.innerWidth+2
      }));
      expect(view.columns,'grid columns at '+width).toBe(width>=900?3:width>=600?2:1);
      expect(view.overflow,'horizontal overflow at '+width).toBe(false);
    }
  });

  test('Navy and Green identity covers welcome page and guided challenges',async({page})=>{
    await page.goto('/');
    await expect(page.getByRole('heading',{level:1,name:'Super Insecure Tech Store',exact:true})).toBeVisible();
    const welcome=await page.evaluate(()=>({
      header:getComputedStyle(document.querySelector('.welcome-nav')).backgroundColor,
      cta:getComputedStyle(document.querySelector('.primary-cta')).backgroundColor,
      footer:getComputedStyle(document.querySelector('.welcome-footer')).backgroundColor
    }));
    expect(welcome.header).toBe('rgb(13, 37, 56)');
    expect(welcome.cta).toBe('rgb(8, 127, 56)');
    expect(welcome.footer).toBe(welcome.header);
    await page.goto('/challenges?api=api01');
    await expect(page.getByRole('heading',{name:'Security Challenges'})).toBeVisible();
    const challenge=await page.evaluate(()=>({
      header:getComputedStyle(document.querySelector('.challenge-header')).backgroundColor,
      action:getComputedStyle(document.querySelector('.challenge-help button')).color
    }));
    expect(challenge.header).toBe('rgb(13, 37, 56)');
    expect(challenge.action).toBe('rgb(8, 127, 56)');
  });

  test('customer payment and administrator management use brand colors',async({page})=>{
    await login(page);
    await expect(page.getByRole('button',{name:/Alice/})).toBeVisible();
    await page.goto('/payment-methods');
    await expect(page.getByRole('heading',{name:'Payment methods'})).toBeVisible();
    const customer=await page.evaluate(()=>getComputedStyle(document.querySelector('.payment-card-mark')).backgroundColor);
    expect(customer).toBe('rgb(13, 37, 56)');
    await page.goto('/login');
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.locator('main form button[type="submit"]').click();
    await expect(page.getByRole('heading',{name:'Products'})).toBeVisible();
    const adminUi=await page.evaluate(()=>({
      header:getComputedStyle(document.querySelector('.shop-header')).backgroundColor,
      search:getComputedStyle(document.querySelector('.admin-product-search button[type="submit"]')).backgroundColor
    }));
    expect(adminUi.header).toBe('rgb(13, 37, 56)');
    expect(adminUi.search).toBe('rgb(8, 127, 56)');
  });


  test('cart empty state and product removal use the correct brand hierarchy',async({page})=>{
    await page.goto('/cart');
    await expect(page.getByRole('heading',{name:'Your cart is empty'})).toBeVisible();
    await expect(page.locator('.cart-page .empty-cart-action')).toHaveCSS('background-color','rgb(8, 127, 56)');
    await page.getByRole('button',{name:/Continue shopping/}).click();
    await expect(page).toHaveURL(/\/shop$/);
    await page.locator('article.product').filter({hasText:'Laptop'}).first().getByRole('button',{name:'Add to cart'}).click();
    await expect(page.locator('.cart-line')).toHaveCount(1);
    await expect(page.locator('.cart-remove svg')).toHaveCount(1);
    await expect(page.locator('.cart-page .checkout-button')).toHaveCSS('background-color','rgb(8, 127, 56)');
    await page.getByRole('button',{name:'Remove Laptop'}).click();
    await expect(page.getByRole('heading',{name:'Your cart is empty'})).toBeVisible();
  });

  test('orders, administration and integrations retain brand actions and compact layout',async({page})=>{
    await login(page);
    await expect(page.getByRole('button',{name:/Alice/})).toBeVisible();
    await page.goto('/orders');
    await expect(page.locator('.order-card').first()).toBeVisible();
    await expect(page.locator('.order-card button').first()).toHaveCSS('background-color','rgb(8, 127, 56)');
    await page.goto('/login');
    await page.getByLabel('Email').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.locator('main form button[type="submit"]').click();
    await expect(page.getByRole('heading',{name:'Products'})).toBeVisible();
    await expect(page.locator('.inventory-item').first()).toBeVisible();
    const row=await page.locator('.inventory-item').first().evaluate(e=>({
      flex:getComputedStyle(e).display,
      image:getComputedStyle(e.querySelector('.inventory-info')).flexDirection
    }));
    expect(row.flex).toBe('flex');
    expect(row.image).toBe('row');
    await page.getByRole('button',{name:'Integrations'}).click();
    await expect(page.locator('.integration-status')).toContainText('Connected');
    await expect(page.locator('.integration-actions .button-primary')).toHaveCSS('background-color','rgb(8, 127, 56)');
    await expect(page.locator('.integration-actions .button-secondary')).toHaveCSS('background-color','rgb(255, 255, 255)');
  });

  test('welcome CTA has readable secondary contrast and a filled services panel',async({page})=>{
    await page.goto('/');
    await expect(page.locator('.environment-service')).toHaveCount(3);
    const button=await page.locator('.welcome-actions .secondary-cta').evaluate(e=>({
      color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor
    }));
    expect(button.color).toBe('rgb(8, 127, 56)');
    expect(button.background).toBe('rgb(255, 255, 255)');
    await page.getByRole('button',{name:/Enter Super Insecure Tech Store/}).click();
    await expect(page).toHaveURL(/\/shop$/);
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
