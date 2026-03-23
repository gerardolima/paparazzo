#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { BootstrapStack } from './bootstrap-stack.ts'
import { PaparazzoStack } from './paparazzo-stack.ts'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
}

new BootstrapStack(app, 'BootstrapStack', { env })
new PaparazzoStack(app, 'PaparazzoStack', { env })
