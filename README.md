[![awscdk-run](https://img.shields.io/badge/Deploy%20with-AWSCDK.RUN-blue)](https://awscdk.run)
# aws-cdk-eks-sample

A sample CDK application to create a sample Amazon EKS cluster.

# install AWS CLI CLI

```sh
npm i -g aws-cdk
```

# sample

create a default eks clsuter in a **new vpc** with 2 x `m5.large` for the managed nodegroup.
```sh
cdk deploy
```

create a default eks clsuter in the **default vpc**

```sh
cdk deploy -c use_default_vpc=1
```

create a default eks clsuter in a specific `VpcId`
```sh
cdk deploy -c use_vpc_id=vpc-xxxxxx
```

## Managed Nodegroup

When you specify `spot_only=1`, you will get a [spot managed nodegroup](https://aws.amazon.com/tw/blogs/containers/amazon-eks-now-supports-provisioning-and-managing-ec2-spot-instances-in-managed-node-groups/) diversified and distributed with predefined instance types : `t3.large`, `c5.large` and `m5.large`.

create **spot-only** managed nodegroup
```sh
cdk deploy -c spot_only=1
```
(Node: you don't have to specify `spotPrice`)

specify different `instance type` for a **on-demand** managed nodegroup.
```sh
cdk deploy -c instance_type=t3.large
```

specify different `capacity`
```sh
cdk deploy -c default_capacity=3
```
(this will create `3` x `m5.large` instances)

## Advanced Usage

This will create `1` x `t3.large` spot instance in the `default vpc` for the Amazon EKS
```sh
npx cdk deploy \
-c use_default_vpc=1 \
-c spot_only=1 \
-c default_capacity=1 \
-c instance_type=t3.large
```
