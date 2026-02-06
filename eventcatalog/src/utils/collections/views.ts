import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import path from 'path';
import utils from '@eventcatalog/sdk';
import { createVersionedMap, satisfies, findInMap } from './util';

const CACHE_ENABLED = process.env.DISABLE_EVENTCATALOG_CACHE !== 'true';

export type View = Omit<CollectionEntry<'views'>, 'data'> & {
  data: Omit<CollectionEntry<'views'>['data'], 'subscribes' | 'informs'> & {
    versions?: string[];
    latestVersion?: string;
    domains?: CollectionEntry<'domains'>[];
    subscribes?: CollectionEntry<'events'>[];
    informs?: CollectionEntry<'actors'>[];
    subscribesRaw?: Array<{ id: string; version?: string }>;
    informsRaw?: Array<{ id: string; version?: string }>;
  };
  catalog: {
    path: string;
    filePath: string;
    type: 'view';
    publicPath: string;
  };
};

interface Props {
  getAllVersions?: boolean;
}

let memoryCache: Record<string, View[]> = {};

export const getViews = async ({ getAllVersions = true }: Props = {}): Promise<View[]> => {
  const cacheKey = getAllVersions ? 'allVersions' : 'currentVersions';

  if (memoryCache[cacheKey] && memoryCache[cacheKey].length > 0 && CACHE_ENABLED) {
    return memoryCache[cacheKey];
  }

  const [allViews, allDomains, allEvents, allActors] = await Promise.all([
    getCollection('views'),
    getCollection('domains'),
    getCollection('events'),
    getCollection('actors'),
  ]);

  const eventMap = createVersionedMap(allEvents);
  const actorMap = createVersionedMap(allActors);
  const viewMap = createVersionedMap(allViews);

  const targetViews = allViews.filter((view) => {
    if (view.data.hidden === true) return false;
    if (!getAllVersions && view.filePath?.includes('versioned')) return false;
    return true;
  });

  const { getResourceFolderName } = utils(process.env.PROJECT_DIR ?? '');

  const processedViews = await Promise.all(
    targetViews.map(async (view) => {
      const viewVersions = viewMap.get(view.data.id) || [];
      const latestVersion = viewVersions[0]?.data.version || view.data.version;
      const versions = viewVersions.map((v) => v.data.version);

      // Find domains that reference this view
      const domainsThatReferenceView = allDomains.filter((domain) =>
        domain.data.views?.some((item) => {
          if (item.id !== view.data.id) return false;
          if (item.version === 'latest' || item.version === undefined) return view.data.version === latestVersion;
          return satisfies(view.data.version, item.version);
        })
      );

      // Hydrate subscribes (events this view subscribes to)
      const subscribes = (view.data.subscribes || [])
        .map((e) => findInMap(eventMap, e.id, e.version))
        .filter((e): e is CollectionEntry<'events'> => !!e);

      // Hydrate informs (actors this view informs)
      const informs = (view.data.informs || [])
        .map((a) => findInMap(actorMap, a.id, a.version))
        .filter((a): a is CollectionEntry<'actors'> => !!a);

      const subscribesRaw = view.data.subscribes || [];
      const informsRaw = view.data.informs || [];

      const folderName = await getResourceFolderName(
        process.env.PROJECT_DIR ?? '',
        view.data.id,
        view.data.version.toString()
      );
      const viewFolderName = folderName ?? view.id.replace(`-${view.data.version}`, '');

      return {
        ...view,
        data: {
          ...view.data,
          versions,
          latestVersion,
          domains: domainsThatReferenceView,
          subscribes,
          informs,
          subscribesRaw,
          informsRaw,
        },
        catalog: {
          path: path.join(view.collection, view.id.replace('/index.mdx', '')),
          filePath: path.join(process.cwd(), 'src', 'catalog-files', view.collection, view.id.replace('/index.mdx', '')),
          publicPath: path.join('/generated', view.collection, viewFolderName),
          type: 'view' as const,
        },
      };
    })
  );

  processedViews.sort((a, b) => (a.data.name || a.data.id).localeCompare(b.data.name || b.data.id));
  memoryCache[cacheKey] = processedViews;
  return processedViews;
};

/**
 * Find views that subscribe to a given event.
 */
export const getViewsSubscribedToEvent = (views: CollectionEntry<'views'>[], event: CollectionEntry<'events'>) => {
  return views.filter((view) => {
    return view.data.subscribes?.some((sub) => {
      const idMatch = sub.id === event.data.id;
      if (!sub.version) return idMatch;
      if (sub.version === 'latest') return idMatch;
      return idMatch && satisfies(event.data.version, sub.version);
    });
  });
};

/**
 * Find views that inform a given actor.
 */
export const getViewsInformingActor = (views: CollectionEntry<'views'>[], actor: CollectionEntry<'actors'>) => {
  return views.filter((view) => {
    return view.data.informs?.some((inf) => {
      const idMatch = inf.id === actor.data.id;
      if (!inf.version) return idMatch;
      if (inf.version === 'latest') return idMatch;
      return idMatch && satisfies(actor.data.version, inf.version);
    });
  });
};
