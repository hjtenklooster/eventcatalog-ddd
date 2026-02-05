import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import path from 'path';
import utils from '@eventcatalog/sdk';
import { createVersionedMap, satisfies, findInMap } from './util';

const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();

export type Policy = Omit<CollectionEntry<'policies'>, 'data'> & {
  data: Omit<CollectionEntry<'policies'>['data'], 'sends' | 'receives'> & {
    versions?: string[];
    latestVersion?: string;
    domains?: CollectionEntry<'domains'>[];
    sends?: CollectionEntry<'commands'>[];
    receives?: CollectionEntry<'events'>[];
    sendsRaw?: Array<{ id: string; version?: string }>;
    receivesRaw?: Array<{ id: string; version?: string }>;
  };
  catalog: {
    path: string;
    filePath: string;
    type: 'policy';
    publicPath: string;
  };
};

interface Props {
  getAllVersions?: boolean;
}

// cache for build time
let memoryCache: Record<string, Policy[]> = {};

export const getPolicies = async ({ getAllVersions = true }: Props = {}): Promise<Policy[]> => {
  const cacheKey = getAllVersions ? 'allVersions' : 'currentVersions';

  if (memoryCache[cacheKey] && memoryCache[cacheKey].length > 0) {
    return memoryCache[cacheKey];
  }

  // 1. Fetch collections in parallel
  const [allPolicies, allDomains, allEvents, allCommands] = await Promise.all([
    getCollection('policies'),
    getCollection('domains'),
    getCollection('events'),
    getCollection('commands'),
  ]);

  const eventMap = createVersionedMap(allEvents);
  const commandMap = createVersionedMap(allCommands);

  // 2. Build optimized maps
  const policyMap = createVersionedMap(allPolicies);

  // 3. Filter policies
  const targetPolicies = allPolicies.filter((policy) => {
    if (policy.data.hidden === true) return false;
    if (!getAllVersions && policy.filePath?.includes('versioned')) return false;
    return true;
  });

  const { getResourceFolderName } = utils(process.env.PROJECT_DIR ?? '');

  // 4. Enrich policies
  const processedPolicies = await Promise.all(
    targetPolicies.map(async (policy) => {
      // Version info
      const policyVersions = policyMap.get(policy.data.id) || [];
      const latestVersion = policyVersions[0]?.data.version || policy.data.version;
      const versions = policyVersions.map((p) => p.data.version);

      // Find Domains that reference this policy
      const domainsThatReferencePolicy = allDomains.filter((domain) =>
        domain.data.policies?.some((item) => {
          if (item.id !== policy.data.id) return false;
          if (item.version === 'latest' || item.version === undefined) return policy.data.version === latestVersion;
          return satisfies(policy.data.version, item.version);
        })
      );

      // Hydrate sends (commands this policy dispatches)
      const sends = (policy.data.sends || [])
        .map((m) => findInMap(commandMap, m.id, m.version))
        .filter((e): e is CollectionEntry<'commands'> => !!e);

      // Hydrate receives (events this policy is triggered by)
      const receives = (policy.data.receives || [])
        .map((m) => findInMap(eventMap, m.id, m.version))
        .filter((e): e is CollectionEntry<'events'> => !!e);

      // Store raw pointers for graph building (same pattern as services)
      const sendsRaw = policy.data.sends || [];
      const receivesRaw = policy.data.receives || [];

      const folderName = await getResourceFolderName(
        process.env.PROJECT_DIR ?? '',
        policy.data.id,
        policy.data.version.toString()
      );
      const policyFolderName = folderName ?? policy.id.replace(`-${policy.data.version}`, '');

      return {
        ...policy,
        data: {
          ...policy.data,
          versions,
          latestVersion,
          domains: domainsThatReferencePolicy,
          sends,
          receives,
          sendsRaw,
          receivesRaw,
        },
        catalog: {
          path: path.join(policy.collection, policy.id.replace('/index.mdx', '')),
          filePath: path.join(process.cwd(), 'src', 'catalog-files', policy.collection, policy.id.replace('/index.mdx', '')),
          publicPath: path.join('/generated', policy.collection, policyFolderName),
          type: 'policy' as const,
        },
      };
    })
  );

  // order them by the name of the policy
  processedPolicies.sort((a, b) => {
    return (a.data.name || a.data.id).localeCompare(b.data.name || b.data.id);
  });

  memoryCache[cacheKey] = processedPolicies;

  return processedPolicies;
};

/**
 * Find policies that are triggered by a given event.
 * Policy receives events (triggers).
 */
export const getPoliciesTriggeredByEvent = (
  policies: CollectionEntry<'policies'>[],
  event: CollectionEntry<'events'>
) => {
  return policies.filter((policy) => {
    return policy.data.receives?.some((receive) => {
      const idMatch = receive.id === event.data.id;

      // If no version specified in receive, treat as 'latest'
      if (!receive.version) return idMatch;

      // If version is 'latest', match any version
      if (receive.version === 'latest') return idMatch;

      // Use satisfies helper to handle non-strict versions (v1, 1, etc.)
      return idMatch && satisfies(event.data.version, receive.version);
    });
  });
};

/**
 * Find policies that dispatch a given command.
 * Policy sends commands (dispatches).
 */
export const getPoliciesDispatchingCommand = (
  policies: CollectionEntry<'policies'>[],
  command: CollectionEntry<'commands'>
) => {
  return policies.filter((policy) => {
    return policy.data.sends?.some((send) => {
      const idMatch = send.id === command.data.id;

      // If no version specified in send, treat as 'latest'
      if (!send.version) return idMatch;

      // If version is 'latest', match any version
      if (send.version === 'latest') return idMatch;

      // Use satisfies helper to handle non-strict versions (v1, 1, etc.)
      return idMatch && satisfies(command.data.version, send.version);
    });
  });
};
