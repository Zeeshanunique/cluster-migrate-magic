export interface KubernetesResource {
  name: string;
  namespace: string;
  kind: string;
  apiVersion: string;
  uid: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  [key: string]: any;
}

export interface Pod extends KubernetesResource {
  status?: {
    phase?: string;
    conditions?: Array<{ type: string; status: string }>;
    containerStatuses?: Array<{ ready: boolean; restartCount: number; name: string }>;
  };
  spec?: {
    nodeName?: string;
    containers?: Array<{ name: string; image: string }>;
  };
}

export interface Deployment extends KubernetesResource {
  spec?: {
    replicas?: number;
    selector?: {
      matchLabels?: Record<string, string>;
    };
    template?: {
      spec?: {
        containers?: Array<{ name: string; image: string }>;
      };
    };
  };
  status?: {
    availableReplicas?: number;
    readyReplicas?: number;
    replicas?: number;
    updatedReplicas?: number;
  };
}

export interface Service extends KubernetesResource {
  spec?: {
    type?: string;
    clusterIP?: string;
    ports?: Array<{
      port: number;
      targetPort?: number | string;
      protocol?: string;
      name?: string;
    }>;
    selector?: Record<string, string>;
  };
}

export interface ConfigMap extends KubernetesResource {
  data?: Record<string, string>;
}

export interface Secret extends KubernetesResource {
  type?: string;
  data?: Record<string, string>;
}

export interface PersistentVolumeClaim extends KubernetesResource {
  spec?: {
    accessModes?: string[];
    resources?: {
      requests?: {
        storage?: string;
      };
    };
    storageClassName?: string;
  };
  status?: {
    phase?: string;
    capacity?: {
      storage?: string;
    };
  };
}

export interface StatefulSet extends KubernetesResource {
  spec?: {
    replicas?: number;
    serviceName?: string;
    selector?: {
      matchLabels?: Record<string, string>;
    };
  };
  status?: {
    replicas?: number;
    readyReplicas?: number;
  };
}

export interface Namespace extends KubernetesResource {
  status?: {
    phase?: string;
  };
}

export interface Node extends KubernetesResource {
  kind: 'Node';
  status?: {
    conditions?: Array<{
      type: string;
      status: string;
      reason?: string;
      message?: string;
    }>;
    addresses?: Array<{
      type: string;
      address: string;
    }>;
    capacity?: Record<string, string>;
    allocatable?: Record<string, string>;
    nodeInfo?: {
      kernelVersion?: string;
      osImage?: string;
      containerRuntimeVersion?: string;
      kubeletVersion?: string;
      kubeProxyVersion?: string;
      operatingSystem?: string;
      architecture?: string;
    };
  };
}

export interface ResourceMap {
  pods?: Pod[];
  deployments?: Deployment[];
  services?: Service[];
  configMaps?: ConfigMap[];
  secrets?: Secret[];
  persistentVolumeClaims?: PersistentVolumeClaim[];
  statefulSets?: StatefulSet[];
  namespaces?: Namespace[];
  nodes?: Node[];
  [key: string]: KubernetesResource[] | undefined;
} 