import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',workers:1,timeout:60_000,expect:{timeout:15_000},reporter:'list',
  use:{baseURL:'http://127.0.0.1:5175',browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1500,height:1120},launchOptions:{args:['--use-angle=swiftshader']},trace:{mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true}},
  webServer:{command:'npm run dev -- --port 5175 --strictPort',url:'http://127.0.0.1:5175/auth',reuseExistingServer:!process.env.CI,timeout:60_000}});
