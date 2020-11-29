import { App, Construct, Stack, StackProps, Fn } from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';

export interface EksClusterProps {
  readonly vpc?: ec2.IVpc;
}

export class EksCluster extends Construct {
  constructor(scope: Construct, id: string, props: EksClusterProps = {}) {
    super(scope ,id);

    const vpc = props.vpc ?? new ec2.Vpc(this, 'Vpc', { natGateways: 1 });
    const spotOnly = this.node.tryGetContext('spot_only') == 1 ? true : false;
    const instanceType = this.node.tryGetContext('instance_type') || 'm5.large';
    const version = eks.KubernetesVersion.V1_18;
    const stack = Stack.of(this);

    if (spotOnly) {
      const cluster = new eks.Cluster(this, 'Cluster', {
        vpc,
        version,
        defaultCapacity: 0,
      });
      const asg = cluster.addAutoScalingGroupCapacity('SpotASG', {
        instanceType: new ec2.InstanceType(instanceType),
      });
      // prepare a launch template with spot options
      const lt = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
        launchTemplateData: {
          imageId: new eks.EksOptimizedImage().getImage(stack).imageId,
          instanceType: instanceType.toString(),
          instanceMarketOptions: {
            marketType: 'spot',
            spotOptions: {
              spotInstanceType: 'one-time',
            },
          },
          userData: Fn.base64(asg.userData.render()),
        },
      });
      // override the ASG
      const cfnAsg = asg.node.tryFindChild('ASG') as autoscaling.CfnAutoScalingGroup | undefined;
      cfnAsg!.addPropertyDeletionOverride('LaunchConfigurationName');
      cfnAsg!.addPropertyOverride('LaunchTemplate', {
        LaunchTemplateId: lt.ref,
        Version: lt.attrLatestVersionNumber,
      });

    } else {
      new eks.Cluster(this, 'Cluster', {
        vpc,
        version,
        defaultCapacityInstance: new ec2.InstanceType(instanceType),
      })
    }

  }
}


export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // force use_default_vpc=1
    // this.node.setContext('use_default_vpc', '1');

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
