import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import path from 'path';
import utils from '@eventcatalog/sdk';
import { createVersionedMap, satisfies, findInMap } from './util';

const CACHE_ENABLED = process.env.DISABLE_EVENTCATALOG_CACHE !== 'true';

export type Actor = Omit<CollectionEntry<'actors'>, 'data'> & {
  data: Omit<CollectionEntry<'actors'>['data'], 'reads' | 'issues'> & {
    versions?: string[];
    latestVersion?: string;
    reads?: CollectionEntry<'views'>[];
    issues?: CollectionEntry<'commands'>[];
    readsRaw?: Array<{ id: string; version?: string }>;
    issuesRaw?: Array<{ id: string; version?: string }>;
  };
  catalog: {
    path: string;
    filePath: string;
    type: 'actor';
    publicPath: string;
  };
};

interface Props {
  getAllVersions?: boolean;
}

let memoryCache: Record<string, Actor[]> = {};

export const getActors = async ({ getAllVersions = true }: Props = {}): Promise<Actor[]> => {
  const cacheKey = getAllVersions ? 'allVersions' : 'currentVersions';

  if (memoryCache[cacheKey] && memoryCache[cacheKey].length > 0 && CACHE_ENABLED) {
    return memoryCache[cacheKey];
  }

  const [allActors, allViews, allCommands] = await Promise.all([
    getCollection('actors'),
    getCollection('views'),
    getCollection('commands'),
  ]);

  const viewMap = createVersionedMap(allViews);
  const commandMap = createVersionedMap(allCommands);
  const actorMap = createVersionedMap(allActors);

  const targetActors = allActors.filter((actor) => {
    if (actor.data.hidden === true) return false;
    if (!getAllVersions && actor.filePath?.includes('versioned')) return false;
    return true;
  });

  const { getResourceFolderName } = utils(process.env.PROJECT_DIR ?? '');

  const processedActors = await Promise.all(
    targetActors.map(async (actor) => {
      const actorVersions = actorMap.get(actor.data.id) || [];
      const latestVersion = actorVersions[0]?.data.version || actor.data.version;
      const versions = actorVersions.map((a) => a.data.version);

      // Hydrate reads (views this actor reads)
      const reads = (actor.data.reads || [])
        .map((v) => findInMap(viewMap, v.id, v.version))
        .filter((v): v is CollectionEntry<'views'> => !!v);

      // Hydrate issues (commands this actor issues)
      const issues = (actor.data.issues || [])
        .map((c) => findInMap(commandMap, c.id, c.version))
        .filter((c): c is CollectionEntry<'commands'> => !!c);

      const readsRaw = actor.data.reads || [];
      const issuesRaw = actor.data.issues || [];

      const folderName = await getResourceFolderName(
        process.env.PROJECT_DIR ?? '',
        actor.data.id,
        actor.data.version.toString()
      );
      const actorFolderName = folderName ?? actor.id.replace(`-${actor.data.version}`, '');

      return {
        ...actor,
        data: {
          ...actor.data,
          versions,
          latestVersion,
          reads,
          issues,
          readsRaw,
          issuesRaw,
        },
        catalog: {
          path: path.join(actor.collection, actor.id.replace('/index.mdx', '')),
          filePath: path.join(process.cwd(), 'src', 'catalog-files', actor.collection, actor.id.replace('/index.mdx', '')),
          publicPath: path.join('/generated', actor.collection, actorFolderName),
          type: 'actor' as const,
        },
      };
    })
  );

  processedActors.sort((a, b) => (a.data.name || a.data.id).localeCompare(b.data.name || b.data.id));
  memoryCache[cacheKey] = processedActors;
  return processedActors;
};

/**
 * Find actors that read a given view.
 */
export const getActorsReadingView = (actors: CollectionEntry<'actors'>[], view: CollectionEntry<'views'>) => {
  return actors.filter((actor) => {
    return actor.data.reads?.some((r) => {
      const idMatch = r.id === view.data.id;
      if (!r.version) return idMatch;
      if (r.version === 'latest') return idMatch;
      return idMatch && satisfies(view.data.version, r.version);
    });
  });
};

/**
 * Find actors that issue a given command.
 */
export const getActorsIssuingCommand = (actors: CollectionEntry<'actors'>[], command: CollectionEntry<'commands'>) => {
  return actors.filter((actor) => {
    return actor.data.issues?.some((i) => {
      const idMatch = i.id === command.data.id;
      if (!i.version) return idMatch;
      if (i.version === 'latest') return idMatch;
      return idMatch && satisfies(command.data.version, i.version);
    });
  });
};
