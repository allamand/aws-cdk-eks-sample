import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as eks from '@aws-cdk/aws-eks';
import * as iam from '@aws-cdk/aws-iam';
import { App, Construct, Stack, StackProps, Fn } from '@aws-cdk/core';

export interface EksClusterProps {
  readonly vpc?: ec2.IVpc;
}

export class EksCluster extends Construct {
  constructor(scope: Construct, id: string, props: EksClusterProps = {}) {
    super(scope, id);

    const vpc = props.vpc ?? new ec2.Vpc(this, 'Vpc', { natGateways: 1 });
    const spotOnly = this.node.tryGetContext('spot_only') == 1 ? true : false;
    const instanceType = this.node.tryGetContext('instance_type') || 'm5.large';
    const defaultCapacity: number = this.node.tryGetContext('default_capacity') || 2;
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
        minCapacity: defaultCapacity,
        // placeholder for the launch configuration creation
        spotPrice: '0.1094',
        updatePolicy: autoscaling.UpdatePolicy.rollingUpdate(),
      });
      // create the connection
      this._connectAutoScalingGroup(cluster, asg);
      const cfnInstnceProfile = asg.node.tryFindChild('InstanceProfile') as iam.CfnInstanceProfile;
      // prepare a launch template with spot options
      const lt = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
        launchTemplateData: {
          imageId: new eks.EksOptimizedImage({
            kubernetesVersion: version.version,
          }).getImage(stack).imageId,
          instanceType: instanceType.toString(),
          iamInstanceProfile: {
            arn: cfnInstnceProfile.attrArn,
          },
          instanceMarketOptions: {
            marketType: 'spot',
            spotOptions: {
              spotInstanceType: 'one-time',
            },
          },
          userData: Fn.base64(asg.userData.render()),
          securityGroupIds: asg.connections.securityGroups.map(sg => sg.securityGroupId),
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
        defaultCapacity,
      });
    }
  }
  private _connectAutoScalingGroup(cluster: ec2.IConnectable, autoScalingGroup: autoscaling.AutoScalingGroup) {
    // self rules
    autoScalingGroup.connections.allowInternally(ec2.Port.allTraffic());

    // Cluster to:nodes rules
    autoScalingGroup.connections.allowFrom(cluster, ec2.Port.tcp(443));
    autoScalingGroup.connections.allowFrom(cluster, ec2.Port.tcpRange(1025, 65535));

    // Allow HTTPS from Nodes to Cluster
    autoScalingGroup.connections.allowTo(cluster, ec2.Port.tcp(443));

    // Allow all node outbound traffic
    autoScalingGroup.connections.allowToAnyIpv4(ec2.Port.allTcp());
    autoScalingGroup.connections.allowToAnyIpv4(ec2.Port.allUdp());
    autoScalingGroup.connections.allowToAnyIpv4(ec2.Port.allIcmp());
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

const stackName = app.node.tryGetContext('stackName') || 'cdk-eks-demo-stack';

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

