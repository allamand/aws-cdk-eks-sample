[![awscdk-run](https://img.shields.io/badge/Deploy%20with-AWSCDK.RUN-blue)](https://awscdk.run)
# aws-cdk-eks-sample

A sample CDK application to create a sample Amazon EKS cluster.

# sample

create a default eks clsuter in a **new vpc** with 2 x `m5.large` for the managed nodegroup.
```sh
npx cdk deploy
```

create a default eks clsuter in the **default vpc**

```sh
npx cdk deploy -c use_default_vpc=1
```

create a default eks clsuter in a specific `VpcId`
```sh
npx cdk deploy -c use_vpc_id=vpc-xxxxxx
```

create spot-only self-managed autoscaling nodegroup(2 x `m5.large` spot instances)
```sh
npx cdk deploy -c spot_only=1
```
(Node: you don't have to specify `spotPrice`)

specify different `instance type`
```sh
npx cdk deploy -c instance_type=t3.large
```

specify different `capacity`
```sh
npx cdk deploy -c default_capacity=3
```
(this will create `3` x `m5.large` instances)

## Advanced Usage

This will create `1` x `t3.large` spot instance in the `default vpc` for the Amazon EKS
```sh
npx deploy \
-c use_default_vpc=1 \
-c spot_only=1 \
-c default_capacity=1 \
-c instance_type=t3.large
```
