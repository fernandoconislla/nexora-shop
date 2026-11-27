import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  fullyParallel:false,
  forbidOnly:!!process.env.CI,
  retries:0,
  workers:1,
  reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
  timeout:45_000,
  expect:{timeout:12_000},
  use:{
    baseURL:process.env.NEXORA_BASE??'http://127.0.0.1:8090',
    headless:true,
    viewport:{width:1366,height:900},
    trace:'retain-on-failure',
    screenshot:'only-on-failure'
  }
});
