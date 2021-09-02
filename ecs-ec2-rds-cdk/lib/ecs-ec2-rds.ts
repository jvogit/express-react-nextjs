import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as path from 'path';
import { ApplicationLoadBalancerEcsEc2Stack } from './stacks/applicationloadbalancer-ecs-ec2';
import { PostgresRDSStack } from './stacks/postgres-rds-stack';
import { getPostgresUri } from './utils';

interface EcsEc2RdsProps extends cdk.StackProps {
  readonly accessTokenSecret: string;
  readonly refreshTokenSecret: string;
}

export class EcsEc2Rds extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: EcsEc2RdsProps) {
    super(scope, id, props);

    // Configure the `natGatewayProvider` when defining a Vpc
    const vpc = new ec2.Vpc(this, "Vpc", {
      natGatewayProvider: ec2.NatProvider.instance({
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      }),
      natGateways: 1,
      maxAzs: 2,
    });

    const postgresRDS = new PostgresRDSStack(this, 'PostgresRds', {
      vpc: vpc,
      instanceIdentifier: "express-react-nextjs",
      databaseName: "expressReactNextJs"
    });

    const secret = postgresRDS.databaseInstance.secret!;

    const ecsec2 = new ApplicationLoadBalancerEcsEc2Stack(this, 'ApplicationLoadBalancerEcsEc2Rds', {
      vpc: vpc,
      frontendImage: {
        directory: path.join(__dirname, "..", "..", "client")
      },
      backendImage: {
        directory: path.join(__dirname, "..", "..", "server")
      },
      databaseUri: getPostgresUri(secret),
      accessTokenSecret: props.accessTokenSecret,
      refreshTokenSecret: props.refreshTokenSecret
    });

    // grant permissions
    postgresRDS.databaseInstance.connections.allowFrom(ecsec2.service, ec2.Port.tcp(5432), "Allow ec2 to connect to postgres within vpc");
  }
}
