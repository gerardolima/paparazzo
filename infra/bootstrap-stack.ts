import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as cr from 'aws-cdk-lib/custom-resources'
import type { Construct } from 'constructs'

export class BootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ------------------------------------------------------------------------
    // OIDC-provider: `GitHubOidc`
    // ------------------------------------------------------------------------
    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidc',
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    )

    // ------------------------------------------------------------------------
    // role: `GitHubActionsRole`
    // ------------------------------------------------------------------------
    const role = new iam.Role(this, 'GitHubActionsRole', {
      roleName: 'github-actions-paparazzo',
      assumedBy: new iam.WebIdentityPrincipal(oidcProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': 'repo:gerardolima/paparazzo:ref:refs/heads/main',
        },
      }),
    })

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'))

    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', { value: role.roleArn })

    // ------------------------------------------------------------------------
    // ecr: lifecycle policy on CDK bootstrap repository
    // ------------------------------------------------------------------------
    const bootstrapEcrRepoName = `cdk-hnb659fds-container-assets-${this.account}-${this.region}`

    new cr.AwsCustomResource(this, 'EcrLifecyclePolicy', {
      onCreate: {
        service: 'ECR',
        action: 'putLifecyclePolicy',
        parameters: {
          repositoryName: bootstrapEcrRepoName,
          lifecyclePolicyText: JSON.stringify({
            rules: [
              {
                rulePriority: 1,
                selection: {
                  tagStatus: 'any',
                  countType: 'imageCountMoreThan',
                  countNumber: 3,
                },
                action: { type: 'expire' },
              },
            ],
          }),
        },
        physicalResourceId: cr.PhysicalResourceId.of('ecr-lifecycle-policy'),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['ecr:PutLifecyclePolicy'],
          resources: [`arn:aws:ecr:${this.region}:${this.account}:repository/${bootstrapEcrRepoName}`],
        }),
      ]),
    })
  }
}
