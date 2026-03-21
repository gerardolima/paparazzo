import * as path from 'node:path'
import * as url from 'node:url'
import * as cdk from 'aws-cdk-lib'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'

export class PaparazzoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const bucket = new s3.Bucket(this, 'MediaBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
    })

    const apiKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'GeminiApiKey', {
      parameterName: '/paparazzo/google-api-key',
    })

    const fn = new lambda.DockerImageFunction(this, 'PaparazzoLambda', {
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..'),
        { file: 'Dockerfile' },
      ),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 2048,
      timeout: cdk.Duration.minutes(15),
      environment: {
        S3_BUCKET: bucket.bucketName,
        SSM_API_KEY_NAME: '/paparazzo/google-api-key',
      },
    })

    apiKeyParam.grantRead(fn)
    bucket.grantReadWrite(fn)

    const rule = new events.Rule(this, 'DailySchedule', {
      schedule: events.Schedule.cron({ hour: '8', minute: '0' }),
    })
    rule.addTarget(new targets.LambdaFunction(fn))

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: fn.functionName,
    })

    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: bucket.bucketName,
    })

    new cdk.CfnOutput(this, 'MediaBucketUrl', {
      value: `https://${bucket.bucketRegionalDomainName}`,
    })
  }
}
