import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',
  timeout:45000,
  expect:{timeout:10000},
  fullyParallel:false,
  workers:1,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:process.env.LAGANI_EXTERNAL_SERVERS ? undefined : [
    {command:'npm run dev --prefix services/api',url:'http://127.0.0.1:4000/api/health',reuseExistingServer:!process.env.CI,timeout:60000},
    {command:'npm run dev --prefix apps/admin',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:60000}
  ]
});
