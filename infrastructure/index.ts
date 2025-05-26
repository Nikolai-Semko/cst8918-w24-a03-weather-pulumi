import * as pulumi from "@pulumi/pulumi";
import * as resources from '@pulumi/azure-native/resources'
import * as containerregistry from '@pulumi/azure-native/containerregistry'
import * as docker from '@pulumi/docker'
import * as containerinstance from '@pulumi/azure-native/containerinstance'
import * as cache from '@pulumi/azure-native/cache'

const config = new pulumi.Config()
const appPath = config.get('appPath') || '../'
const prefixName = config.get('prefixName') || 'cst8918-a03-student'
const imageName = prefixName
const imageTag = config.get('imageTag') || 'latest'
const containerPort = config.getNumber('containerPort') || 80
const publicPort = config.getNumber('publicPort') || 80
const cpu = config.getNumber('cpu') || 1
const memory = config.getNumber('memory') || 2

const resourceGroup = new resources.ResourceGroup(`${prefixName}-rg`)

// Create Redis (this will work)
const redis = new cache.Redis(`${prefixName}-redis`, {
  name: `${prefixName}weathercache`.replace(/-/g, ''),
  location: 'canadacentral',
  resourceGroupName: resourceGroup.name,
  enableNonSslPort: true,
  redisVersion: 'Latest',
  minimumTlsVersion: '1.2',
  redisConfiguration: {
    maxmemoryPolicy: 'allkeys-lru'
  },
  sku: {
    name: 'Basic',
    family: 'C',
    capacity: 0
  }
})

// PHASE 1: Use placeholder connection string (container will fallback to in-memory cache)
const redisConnectionString = pulumi.interpolate`redis://placeholder-will-update-in-phase2`

const registry = new containerregistry.Registry(`${prefixName}ACR`, {
  registryName: prefixName.replace(/-/g, '') + 'acr',
  resourceGroupName: resourceGroup.name,
  adminUserEnabled: true,
  sku: {
    name: containerregistry.SkuName.Basic
  }
})

const registryCredentials = containerregistry
  .listRegistryCredentialsOutput({
    resourceGroupName: resourceGroup.name,
    registryName: registry.name
  })
  .apply(creds => ({
    username: creds.username!,
    password: creds.passwords![0].value!
  }))

const image = new docker.Image(`${prefixName}-image`, {
  imageName: pulumi.interpolate`${registry.loginServer}/${imageName}:${imageTag}`,
  build: {
    context: appPath,
    platform: 'linux/amd64'
  },
  registry: {
    server: registry.loginServer,
    username: registryCredentials.username,
    password: registryCredentials.password
  }
})

const containerGroup = new containerinstance.ContainerGroup(
  `${prefixName}-container-group`,
  {
    resourceGroupName: resourceGroup.name,
    osType: 'linux',
    restartPolicy: 'always',
    imageRegistryCredentials: [{
      server: registry.loginServer,
      username: registryCredentials.username,
      password: registryCredentials.password
    }],
    containers: [{
      name: imageName,
      image: image.imageName,
      ports: [{ port: containerPort, protocol: 'tcp' }],
      environmentVariables: [
        { name: 'PORT', value: containerPort.toString() },
        { name: 'WEATHER_API_KEY', value: config.requireSecret('weatherApiKey') },
        { name: 'REDIS_URL', value: redisConnectionString } // Placeholder for now
      ],
      resources: {
        requests: { cpu: cpu, memoryInGB: memory }
      }
    }],
    ipAddress: {
      type: containerinstance.ContainerGroupIpAddressType.Public,
      dnsNameLabel: `${imageName}`,
      ports: [{ port: publicPort, protocol: 'tcp' }]
    }
  }
)

export const hostname = containerGroup.ipAddress.apply(addr => addr!.fqdn!)
export const ip = containerGroup.ipAddress.apply(addr => addr!.ip!)
export const url = containerGroup.ipAddress.apply(addr => `http://${addr!.fqdn!}:${containerPort}`)
export const resourceGroupName = resourceGroup.name
export const containerGroupName = containerGroup.name
export const redisHostName = redis.hostName
export const redisName = redis.name  // We'll need this for Phase 2
export const appUrl = containerGroup.ipAddress.apply(ip => `http://${ip?.ip}:${publicPort}`)