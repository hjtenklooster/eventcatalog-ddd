import type { ContentCollectionKey } from 'astro:content';
import { expect, describe, it, vi } from 'vitest';
import {
  mockViews,
  mockEvents,
  mockActors,
  mockDomains,
  mockSimpleView,
  mockOrderSummaryViewOld,
} from './mocks';
import { getViews, getViewsSubscribedToEvent, getViewsInformingActor } from '@utils/collections/views';

const allViews = [...mockViews, mockSimpleView, mockOrderSummaryViewOld];

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'views':
          return Promise.resolve(allViews);
        case 'domains':
          return Promise.resolve(mockDomains);
        case 'events':
          return Promise.resolve(mockEvents);
        case 'actors':
          return Promise.resolve(mockActors);
        default:
          return Promise.resolve([]);
      }
    },
  };
});

describe('Views', () => {
  describe('getViews', () => {
    it('should return views with hydrated domains', async () => {
      const views = await getViews();
      const orderView = views.find((v) => v.data.id === 'OrderSummaryView' && v.data.version === '1.0.0');

      expect(orderView).toBeDefined();
      expect(orderView!.data.domains).toHaveLength(1);
      expect(orderView!.data.domains![0].data.id).toBe('OrderDomain');
    });

    it('should hydrate subscribes with resolved event entries', async () => {
      const views = await getViews();
      const orderView = views.find((v) => v.data.id === 'OrderSummaryView' && v.data.version === '1.0.0');

      expect(orderView).toBeDefined();
      expect(orderView!.data.subscribes).toHaveLength(2);
      expect(orderView!.data.subscribes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'OrderConfirmed', version: '0.0.1' }) }),
          expect.objectContaining({ data: expect.objectContaining({ id: 'OrderAmended', version: '0.0.1' }) }),
        ])
      );
    });

    it('should hydrate informs with resolved actor entries', async () => {
      const views = await getViews();
      const orderView = views.find((v) => v.data.id === 'OrderSummaryView' && v.data.version === '1.0.0');

      expect(orderView).toBeDefined();
      expect(orderView!.data.informs).toHaveLength(1);
      expect(orderView!.data.informs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'CustomerSupportAgent', version: '1.0.0' }) }),
        ])
      );
    });

    it('should include readByActors reverse lookup', async () => {
      const views = await getViews();
      const orderView = views.find((v) => v.data.id === 'OrderSummaryView' && v.data.version === '1.0.0');

      expect(orderView).toBeDefined();
      // CustomerSupportAgent declares reads: [{ id: 'OrderSummaryView', version: '1.0.0' }]
      // but it's also in informs, so readByActors should be deduplicated (empty here)
      expect(orderView!.data.readByActors).toBeDefined();
    });

    it('should include subscribesRaw and informsRaw for graph building', async () => {
      const views = await getViews();
      const orderView = views.find((v) => v.data.id === 'OrderSummaryView' && v.data.version === '1.0.0') as any;

      expect(orderView).toBeDefined();
      expect(orderView.data.subscribesRaw).toEqual([
        { id: 'OrderConfirmed', version: '0.0.1' },
        { id: 'OrderAmended', version: '0.0.1' },
      ]);
      expect(orderView.data.informsRaw).toEqual([{ id: 'CustomerSupportAgent', version: '1.0.0' }]);
    });

    it('should return empty arrays for view without subscribes/informs', async () => {
      const views = await getViews();
      const simpleView = views.find((v) => v.data.id === 'SimpleView') as any;

      expect(simpleView).toBeDefined();
      expect(simpleView.data.subscribes).toEqual([]);
      expect(simpleView.data.informs).toEqual([]);
      expect(simpleView.data.subscribesRaw).toEqual([]);
      expect(simpleView.data.informsRaw).toEqual([]);
    });
  });

  describe('getViewsSubscribedToEvent', () => {
    it('should find view subscribed to event with matching version', () => {
      const event = mockEvents[0] as any; // OrderConfirmed 0.0.1
      const result = getViewsSubscribedToEvent(mockViews as any, event);

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('OrderSummaryView');
    });

    it('should return empty when no view subscribes to event', () => {
      const unknownEvent = { data: { id: 'UnknownEvent', version: '1.0.0' }, collection: 'events' } as any;
      const result = getViewsSubscribedToEvent(mockViews as any, unknownEvent);

      expect(result).toHaveLength(0);
    });

    it('should match when view subscribes with version "latest"', () => {
      const viewWithLatest = {
        ...mockViews[0],
        data: {
          ...mockViews[0].data,
          subscribes: [{ id: 'OrderConfirmed', version: 'latest' }],
        },
      };
      const event = mockEvents[0] as any; // OrderConfirmed 0.0.1
      const result = getViewsSubscribedToEvent([viewWithLatest] as any, event);

      expect(result).toHaveLength(1);
    });

    it('should match when view subscribes without version (implicit latest)', () => {
      const viewWithoutVersion = {
        ...mockViews[0],
        data: {
          ...mockViews[0].data,
          subscribes: [{ id: 'OrderConfirmed' }], // no version
        },
      };
      const event = mockEvents[0] as any; // OrderConfirmed 0.0.1
      const result = getViewsSubscribedToEvent([viewWithoutVersion] as any, event);

      expect(result).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const viewWithSemver = {
        ...mockViews[0],
        data: {
          ...mockViews[0].data,
          subscribes: [{ id: 'OrderConfirmed', version: '>=0.0.1' }],
        },
      };
      const event = { ...mockEvents[0], data: { ...mockEvents[0].data, version: '0.0.5' } } as any;
      const result = getViewsSubscribedToEvent([viewWithSemver] as any, event);

      expect(result).toHaveLength(1);
    });
  });

  describe('getViewsInformingActor', () => {
    it('should find view that informs actor with matching version', () => {
      const actor = mockActors[0] as any; // CustomerSupportAgent 1.0.0
      const result = getViewsInformingActor(mockViews as any, actor);

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('OrderSummaryView');
    });

    it('should return empty when no view informs actor', () => {
      const unknownActor = { data: { id: 'UnknownActor', version: '1.0.0' }, collection: 'actors' } as any;
      const result = getViewsInformingActor(mockViews as any, unknownActor);

      expect(result).toHaveLength(0);
    });

    it('should match when view informs with version "latest"', () => {
      const viewWithLatest = {
        ...mockViews[0],
        data: {
          ...mockViews[0].data,
          informs: [{ id: 'CustomerSupportAgent', version: 'latest' }],
        },
      };
      const actor = mockActors[0] as any; // CustomerSupportAgent 1.0.0
      const result = getViewsInformingActor([viewWithLatest] as any, actor);

      expect(result).toHaveLength(1);
    });

    it('should match when view informs without version (implicit latest)', () => {
      const viewWithoutVersion = {
        ...mockViews[0],
        data: {
          ...mockViews[0].data,
          informs: [{ id: 'CustomerSupportAgent' }], // no version
        },
      };
      const actor = mockActors[0] as any; // CustomerSupportAgent 1.0.0
      const result = getViewsInformingActor([viewWithoutVersion] as any, actor);

      expect(result).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const viewWithSemver = {
        ...mockViews[0],
        data: {
          ...mockViews[0].data,
          informs: [{ id: 'CustomerSupportAgent', version: '^1.0.0' }],
        },
      };
      const actor = { ...mockActors[0], data: { ...mockActors[0].data, version: '1.2.3' } } as any;
      const result = getViewsInformingActor([viewWithSemver] as any, actor);

      expect(result).toHaveLength(1);
    });
  });
});
