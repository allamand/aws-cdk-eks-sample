import { App, Construct, Stack, StackProps } from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import * as ec2 from '@aws-cdk/aws-ec2';

export interface EksClusterProps {
  readonly vpc?: ec2.IVpc;
}

export class EksCluster extends Construct {
  constructor(scope: Construct, id: string, props: EksClusterProps = {}) {
    super(scope ,id);

    const vpc = props.vpc ?? new ec2.Vpc(this, 'Vpc', { natGateways: 1 });
    new eks.Cluster(this, 'Cluster', {
      vpc,
      version: eks.KubernetesVersion.V1_18,
    })


  }
}


export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // force use_default_vpc=1
    this.node.setContext('use_default_vpc', '1');

    new EksCluster(this, 'EksCluster', {
      vpc: getOrCreateVpc(this),
    });

  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const stackName = app.node.tryGetContext('stackName') || 'cdk-eks-demo-stack'

new MyStack(app, stackName, { env: devEnv });

app.synth();

function getOrCreateVpc(scope: Construct): ec2.IVpc {
  // use an existing vpc or create a new one
  return scope.node.tryGetContext('use_default_vpc') === '1' ?
    ec2.Vpc.fromLookup(scope, 'Vpc', { isDefault: true }) :
    scope.node.tryGetContext('use_vpc_id') ?
      ec2.Vpc.fromLookup(scope, 'Vpc', { vpcId: scope.node.tryGetContext('use_vpc_id') }) :
      new ec2.Vpc(scope, 'Vpc', { maxAzs: 3, natGateways: 1 });
}
