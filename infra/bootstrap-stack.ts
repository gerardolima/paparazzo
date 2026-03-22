import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
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
  }
}
