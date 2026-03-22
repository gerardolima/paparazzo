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

    // ------------------------------------------------------------------------
    // s3: `MediaBucket`
    // ------------------------------------------------------------------------
    const bucket = new s3.Bucket(this, 'MediaBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
    })

    // ------------------------------------------------------------------------
    // ssm: `/paparazzo/google-api-key`
    // ------------------------------------------------------------------------
    const apiKeyParam = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'GeminiApiKey', {
      parameterName: '/paparazzo/google-api-key',
    })

    // ------------------------------------------------------------------------
    // lambda: `PaparazzoLambda`
    // ------------------------------------------------------------------------
    const dockerImageDir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..')
    const dockerImageOpts = { file: 'Dockerfile' }

    const fn = new lambda.DockerImageFunction(this, 'PaparazzoLambda', {
      code: lambda.DockerImageCode.fromImageAsset(dockerImageDir, dockerImageOpts),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 2048, // 2GB
      ephemeralStorageSize: cdk.Size.gibibytes(2),
      timeout: cdk.Duration.minutes(15),
      environment: {
        S3_BUCKET: bucket.bucketName,
        SSM_API_KEY_NAME: '/paparazzo/google-api-key',
      },
    })

    apiKeyParam.grantRead(fn)
    bucket.grantReadWrite(fn)

    // ------------------------------------------------------------------------
    // cron-schedule: `DailySchedule`
    // ------------------------------------------------------------------------
    const rule = new events.Rule(this, 'DailySchedule', {
      schedule: events.Schedule.cron({ hour: '8', minute: '0' }),
    })
    rule.addTarget(new targets.LambdaFunction(fn))

    // ------------------------------------------------------------------------
    // outputs
    // ------------------------------------------------------------------------
    new cdk.CfnOutput(this, 'LambdaFunctionName', { value: fn.functionName })
    new cdk.CfnOutput(this, 'MediaBucketName', { value: bucket.bucketName })
    new cdk.CfnOutput(this, 'MediaBucketUrl', { value: `https://${bucket.bucketRegionalDomainName}` })
  }
}
