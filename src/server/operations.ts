import '@tanstack/react-start/server-only'
import { initGraphQLTada } from 'gql.tada'
import type { introspection } from './graphql-env.d.ts'

// Every GraphQL document the app sends to Railway, typed against the schema
// snapshot in schema.graphql (refresh both with `pnpm schema`).
export const graphql = initGraphQLTada<{
  introspection: introspection
  scalars: {
    DateTime: string
    EnvironmentConfig: unknown
    EnvironmentVariables: Record<string, string>
  }
}>()

// One request for the whole list. Variable values are null unless decrypted;
// only SPINNED_BY and SPINNED_AT are kept from them (see snapshot.ts).
export const SnapshotQuery = graphql(`
  query Snapshot($environmentId: String!) {
    environment(id: $environmentId) {
      config(decryptVariables: true)
      serviceInstances(first: 100) {
        edges {
          node {
            serviceId
            serviceName
            createdAt
            hasEverDeployed
            source {
              image
            }
            domains {
              serviceDomains {
                domain
              }
            }
            latestDeployment {
              id
              status
            }
          }
        }
      }
    }
  }
`)

export const ServiceCreate = graphql(`
  mutation ServiceCreate($input: ServiceCreateInput!) {
    serviceCreate(input: $input) {
      id
    }
  }
`)

export const ServiceDomainCreate = graphql(`
  mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
    serviceDomainCreate(input: $input) {
      domain
    }
  }
`)

// Deploys the service's current source. Used for the first deploy and to start
// a stopped instance: serviceInstanceRedeploy does nothing without a deployment.
export const ServiceInstanceDeploy = graphql(`
  mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String!) {
    serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
  }
`)

// Stops an instance. deploymentStop would leave the status at SUCCESS.
export const DeploymentRemove = graphql(`
  mutation DeploymentRemove($id: String!) {
    deploymentRemove(id: $id)
  }
`)

export const DeploymentRestart = graphql(`
  mutation DeploymentRestart($id: String!) {
    deploymentRestart(id: $id)
  }
`)

// Scoped to the sandbox environment: a project token is refused a project-wide
// delete, and the service goes away once no environment holds it anymore.
export const ServiceDelete = graphql(`
  mutation ServiceDelete($id: String!, $environmentId: String!) {
    serviceDelete(id: $id, environmentId: $environmentId)
  }
`)

export const DeploymentLogsQuery = graphql(`
  query DeploymentLogs($deploymentId: String!, $limit: Int!) {
    deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
      timestamp
      message
      severity
    }
  }
`)

export const DeploymentsQuery = graphql(`
  query Deployments($input: DeploymentListInput!) {
    deployments(input: $input, first: 20) {
      edges {
        node {
          id
          status
          createdAt
        }
      }
    }
  }
`)

export const MetricsQuery = graphql(`
  query Metrics($environmentId: String!, $serviceId: String!, $startDate: DateTime!) {
    metrics(
      environmentId: $environmentId
      serviceId: $serviceId
      startDate: $startDate
      measurements: [CPU_USAGE, MEMORY_USAGE_GB]
      sampleRateSeconds: 60
    ) {
      measurement
      values {
        ts
        value
      }
    }
  }
`)
