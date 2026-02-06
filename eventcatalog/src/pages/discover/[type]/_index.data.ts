// pages/discover/[type]/index.page.ts
import { isSSR } from '@utils/feature';
import { HybridPage } from '@utils/page-loaders/hybrid-page';
import { pageDataLoader } from '@utils/page-loaders/page-data-loader';

export class Page extends HybridPage {
  static get prerender(): boolean {
    return !isSSR();
  }

  static async getStaticPaths(): Promise<Array<{ params: any; props: any }>> {
    const { getFlows } = await import('@utils/collections/flows');
    const { getServices } = await import('@utils/collections/services');
    const { getDataProducts } = await import('@utils/collections/data-products');
    const { getEntities } = await import('@utils/collections/entities');
    const { getPolicies } = await import('@utils/collections/policies');

    const loaders = {
      ...pageDataLoader,
      flows: getFlows,
      services: getServices,
      'data-products': getDataProducts,
      entities: getEntities,
      policies: getPolicies,
    };

    const itemTypes = [
      'events',
      'commands',
      'queries',
      'domains',
      'services',
      'flows',
      'containers',
      'data-products',
      'entities',
      'policies',
    ] as const;
    const allItems = await Promise.all(itemTypes.map((type) => loaders[type]()));

    return allItems.flatMap((items, index) => ({
      params: {
        type: itemTypes[index],
      },
      props: {
        data: items,
        type: itemTypes[index],
      },
    }));
  }

  protected static async fetchData(params: any) {
    const { type } = params;

    if (!type) {
      return null;
    }

    const { getFlows } = await import('@utils/collections/flows');
    const { getServices } = await import('@utils/collections/services');
    const { getDataProducts } = await import('@utils/collections/data-products');
    const { getEntities } = await import('@utils/collections/entities');
    const { getPolicies } = await import('@utils/collections/policies');

    const loaders = {
      ...pageDataLoader,
      flows: getFlows,
      services: getServices,
      'data-products': getDataProducts,
      entities: getEntities,
      policies: getPolicies,
    };

    type DiscoverPageTypes = keyof typeof loaders;
    const loader = loaders[type as DiscoverPageTypes];
    if (!loader) {
      return null;
    }
    const items = await loader();

    return {
      type,
      data: items,
    };
  }

  protected static createNotFoundResponse(): Response {
    return new Response(null, {
      status: 404,
      statusText: 'Collection type not found',
    });
  }
}
