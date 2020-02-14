import { pvStorageClassAssignmentKey } from '../../app/plan/components/Wizard/StorageClassTable';
import { pvCopyMethodAssignmentKey } from '../../app/plan/components/Wizard/StorageClassTable';

export function createTokenSecret(name: string, namespace: string, rawToken: string) {
  // btoa => to base64, atob => from base64
  const encodedToken = btoa(rawToken);
  return {
    apiVersion: 'v1',
    data: {
      saToken: encodedToken,
    },
    kind: 'Secret',
    metadata: {
      name,
      namespace,
    },
    type: 'Opaque',
  };
}

export function updateTokenSecret(rawToken: string) {
  // btoa => to base64, atob => from base64
  const encodedToken = btoa(rawToken);
  return {
    data: {
      saToken: encodedToken,
    },
  };
}

export function tokenFromSecret(secret: any) {
  return atob(secret.data.token);
}

export function createMigCluster(
  name: string,
  namespace: string,
  clusterUrl: string,
  tokenSecret: any,
  isAzure: boolean,
  azureResourceGroup: string,
  requireSSL: boolean,
  caBundle: string
) {
  let specObject;
  if (isAzure) {
    specObject = {
      azureResourceGroup,
      isHostCluster: false,
      url: clusterUrl,
      serviceAccountSecretRef: {
        name: tokenSecret.metadata.name,
        namespace: tokenSecret.metadata.namespace,
      },
      insecure: !requireSSL,
    };
  } else {
    specObject = {
      isHostCluster: false,
      url: clusterUrl,
      serviceAccountSecretRef: {
        name: tokenSecret.metadata.name,
        namespace: tokenSecret.metadata.namespace,
      },
      insecure: !requireSSL,
    };
  }
  if (caBundle) {
    specObject['caBundle'] = caBundle
  }


  return {
    apiVersion: 'migration.openshift.io/v1alpha1',
    kind: 'MigCluster',
    metadata: {
      name,
      namespace,
    },
    spec: specObject,
  };
}

export function createMigStorage(
  name: string,
  bslProvider: string,
  namespace: string,
  tokenSecret: any,
  requireSSL: boolean,
  caBundle: string,
  awsBucketName?: string,
  awsBucketRegion?: string,
  s3Url?: string,
  gcpBucket?: string,
  azureResourceGroup?: string,
  azureStorageAccount?: string,
) {
  switch (bslProvider) {
    case 'aws':
      return {
        apiVersion: 'migration.openshift.io/v1alpha1',
        kind: 'MigStorage',
        metadata: {
          name,
          namespace,
        },
        spec: {
          backupStorageProvider: 'aws',
          volumeSnapshotProvider: 'aws',
          backupStorageConfig: {
            awsBucketName,
            awsRegion: awsBucketRegion,
            awsS3Url: s3Url,
            credsSecretRef: {
              name: tokenSecret.metadata.name,
              namespace: tokenSecret.metadata.namespace,
            },
            insecure: !requireSSL,
            s3CustomCABundle: caBundle || null,
          },
          volumeSnapshotConfig: {
            awsRegion: awsBucketRegion,
            credsSecretRef: {
              name: tokenSecret.metadata.name,
              namespace: tokenSecret.metadata.namespace,
            },
          },
        },
      };
    case 'gcp':
      return {
        apiVersion: 'migration.openshift.io/v1alpha1',
        kind: 'MigStorage',
        metadata: {
          name,
          namespace,
        },
        spec: {
          backupStorageProvider: 'gcp',
          volumeSnapshotProvider: 'gcp',
          backupStorageConfig: {
            gcpBucket,
            credsSecretRef: {
              name: tokenSecret.metadata.name,
              namespace: tokenSecret.metadata.namespace,
            },
          },
          volumeSnapshotConfig: {
            //gcp specific config
            credsSecretRef: {
              name: tokenSecret.metadata.name,
              namespace: tokenSecret.metadata.namespace,
            },
          },
        },
      };

    case 'azure':
      return {
        apiVersion: 'migration.openshift.io/v1alpha1',
        kind: 'MigStorage',
        metadata: {
          name,
          namespace,
        },
        spec: {
          backupStorageProvider: 'azure',
          volumeSnapshotProvider: 'azure',
          backupStorageConfig: {
            azureResourceGroup,
            azureStorageAccount,
            azureStorageContainer: 'velero',
            credsSecretRef: {
              name: tokenSecret.metadata.name,
              namespace: tokenSecret.metadata.namespace,
            },
          },
          volumeSnapshotConfig: {
            //azure specific config
            azureApiTimeout: '30s',
            azureResourceGroup,
            credsSecretRef: {
              name: tokenSecret.metadata.name,
              namespace: tokenSecret.metadata.namespace,
            },
          },
        },
      };


  }
}

export function updateMigStorage(
  bslProvider: string,
  bucketName: string,
  bucketRegion: string,
  s3Url: string,
  gcpBucket: string,
  azureResourceGroup: string,
  azureStorageAccount: string,
  requireSSL: boolean,
  caBundle: string,
) {
  switch (bslProvider) {
    case 'aws':
      return {
        spec: {
          backupStorageConfig: {
            awsBucketName: bucketName,
            awsRegion: bucketRegion,
            awsS3Url: s3Url,
            insecure: !requireSSL,
            s3CustomCABundle: caBundle || null,
          },
          volumeSnapshotConfig: {
            awsRegion: bucketRegion,
          },
        },
      };
    case 'gcp':
      return {
        spec: {
          backupStorageConfig: {
            gcpBucket
          },
        },
      };
    case 'azure':
      return {
        spec: {
          backupStorageConfig: {
            azureResourceGroup,
            azureStorageAccount
          },
          volumeSnapshotConfig: {
            azureResourceGroup,
          },
        },
      };
  }
}

export function createStorageSecret(
  name: string,
  namespace: string,
  bslProvider: string,
  secretKey?: any,
  accessKey?: string,
  gcpBlob?: any,
  azureBlob?: any,
) {

  switch (bslProvider) {
    case 'aws':
      const encodedAccessKey = btoa(accessKey);
      const encodedSecretKey = btoa(secretKey);
      return {
        apiVersion: 'v1',
        data: {
          'aws-access-key-id': encodedAccessKey,
          'aws-secret-access-key': encodedSecretKey,
        },
        kind: 'Secret',
        metadata: {
          name,
          namespace,
        },
        type: 'Opaque',
      };

    case 'gcp':
      const gcpCred = btoa(gcpBlob);
      return {
        apiVersion: 'v1',
        data: {
          'gcp-credentials': gcpCred
        },
        kind: 'Secret',
        metadata: {
          name,
          namespace,
        },
        type: 'Opaque',
      };

    case 'azure':
      const azureCred = btoa(azureBlob);
      return {
        apiVersion: 'v1',
        data: {
          'azure-credentials': azureCred
        },
        kind: 'Secret',
        metadata: {
          name,
          namespace,
        },
        type: 'Opaque',
      };

  }
  // btoa => to base64, atob => from base64
}

export function updateStorageSecret(
  bslProvider: string,
  secretKey: any,
  accessKey: string,
  gcpBlob: any,
  azureBlob: any
) {
  switch (bslProvider) {
    case 'aws':

      // btoa => to base64, atob => from base64
      const encodedAccessKey = btoa(accessKey);
      const encodedSecretKey = btoa(secretKey);
      return {
        data: {
          'aws-access-key-id': encodedAccessKey,
          'aws-secret-access-key': encodedSecretKey,
        },
      };
    case 'gcp':
      const gcpCred = btoa(gcpBlob);
      return {
        data: {
          'gcp-credentials': gcpCred
        },
      };
    case 'azure':
      const azureCred = btoa(azureBlob);
      return {
        data: {
          'azure-credentials': azureCred
        },
      };
  }
}

export function createMigPlan(
  name: string,
  namespace: string,
  sourceClusterObj: any,
  destinationClusterObj: any,
  storageObj: any
) {
  return {
    apiVersion: 'migration.openshift.io/v1alpha1',
    kind: 'MigPlan',
    metadata: {
      name,
      namespace,
    },
    spec: {
      srcMigClusterRef: {
        name: sourceClusterObj,
        namespace,
      },
      destMigClusterRef: {
        name: destinationClusterObj,
        namespace,
      },
      migStorageRef: {
        name: storageObj,
        namespace,
      },
    },
  };
}

export function updateMigPlanFromValues(migPlan: any, planValues: any, isRerunPVDiscovery) {
  const updatedSpec = Object.assign({}, migPlan.spec);
  if (planValues.selectedStorage) {
    updatedSpec.migStorageRef = {
      name: planValues.selectedStorage,
      namespace: migPlan.metadata.namespace,
    };
  }
  if (planValues.sourceCluster) {
    updatedSpec.srcMigClusterRef = {
      name: planValues.sourceCluster,
      namespace: migPlan.metadata.namespace,
    };
  }
  if (planValues.targetCluster) {
    updatedSpec.destMigClusterRef = {
      name: planValues.targetCluster,
      namespace: migPlan.metadata.namespace,
    };
  }
  if (isRerunPVDiscovery) {
    //rerun pv discovery
    updatedSpec.namespaces = planValues.selectedNamespaces;
  } else {
    if (updatedSpec.persistentVolumes) {
      updatedSpec.persistentVolumes = updatedSpec.persistentVolumes.map(v => {
        const userPv = planValues.persistentVolumes.find(upv => upv.name === v.name);
        if (userPv) {
          v.selection.action = userPv.type;
          const selectedCopyMethodObj = planValues[pvCopyMethodAssignmentKey][v.name];
          if (selectedCopyMethodObj) {
            v.selection.copyMethod = selectedCopyMethodObj;
          }

          const selectedStorageClassObj = planValues[pvStorageClassAssignmentKey][v.name];
          if (selectedStorageClassObj) {
            v.selection.storageClass = selectedStorageClassObj.name;
          } else {
            v.selection.storageClass = '';
          }
        }
        return v;
      });
    }

  }
  if (planValues.planClosed) {
    updatedSpec.closed = true;
  }

  return {
    apiVersion: 'migration.openshift.io/v1alpha1',
    kind: 'MigPlan',
    metadata: migPlan.metadata,
    spec: updatedSpec,
  };
}

export function createInitialMigPlan(
  name: string,
  namespace: string,
  sourceClusterObj: any,
  destinationClusterObj: any,
  storageObj: any,
  namespaces: string[]
) {
  return {
    apiVersion: 'migration.openshift.io/v1alpha1',
    kind: 'MigPlan',
    metadata: {
      name,
      namespace,
    },
    spec: {
      srcMigClusterRef: {
        name: sourceClusterObj,
        namespace,
      },
      destMigClusterRef: {
        name: destinationClusterObj,
        namespace,
      },
      migStorageRef: {
        name: storageObj,
        namespace,
      },
      namespaces,
    },
  };
}

export function createMigMigration(
  migID: string,
  planName: string,
  namespace: string,
  isStage: boolean,
  disableQuiesce: boolean
) {
  return {
    apiVersion: 'migration.openshift.io/v1alpha1',
    kind: 'MigMigration',
    metadata: {
      name: migID,
      namespace,
    },
    spec: {
      migPlanRef: {
        name: planName,
        namespace,
      },
      quiescePods: !isStage && !disableQuiesce,
      stage: isStage,
    },
  };
}

export type IMigPlan = ReturnType<typeof createMigPlan>;
export type IMigCluster = ReturnType<typeof createMigCluster>;
export type IMigMigration = ReturnType<typeof createMigMigration>;
export type IMigStorage = ReturnType<typeof createMigStorage>;
export type IStorageSecret = ReturnType<typeof createStorageSecret>;
