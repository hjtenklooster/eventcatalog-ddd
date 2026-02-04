import type { ContentCollectionKey } from 'astro:content';
import { expect, describe, it, vi } from 'vitest';
import { mockServices, mockEntities, mockDomains, mockEvents, mockCommands, mockQueries } from './mocks';
import { getEntities, getEntityProducersOfMessage, getEntityConsumersOfMessage } from '@utils/collections/entities';

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'services':
          return Promise.resolve(mockServices);
        case 'entities':
          return Promise.resolve(mockEntities);
        case 'domains':
          return Promise.resolve(mockDomains);
        case 'events':
          return Promise.resolve(mockEvents);
        case 'commands':
          return Promise.resolve(mockCommands);
        case 'queries':
          return Promise.resolve(mockQueries);
        default:
          return Promise.resolve([]);
      }
    },
  };
});

describe('Entities', () => {
  describe('getEntities', () => {
    it('should returns an array of entities', async () => {
      const entities = await getEntities();

      const expectedEntities = [
        {
          id: 'Supplier',
          slug: 'Supplier',
          collection: 'entities',
          data: expect.objectContaining({
            id: 'Supplier',
            version: '0.0.1',
            services: [mockServices[0]],
            domains: [mockDomains[0]],
          }),
        },
      ];

      expect(entities).toEqual(expect.arrayContaining(expectedEntities.map((e) => expect.objectContaining(e))));
    });

    it('should hydrate sends with resolved message entries', async () => {
      const entities = await getEntities();
      const orderEntity = entities.find((e) => e.data.id === 'Order');

      expect(orderEntity).toBeDefined();
      expect(orderEntity!.data.sends).toHaveLength(2);
      expect(orderEntity!.data.sends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'OrderCreated', version: '1.0.0' }) }),
          expect.objectContaining({ data: expect.objectContaining({ id: 'OrderShipped', version: '1.0.0' }) }),
        ])
      );
    });

    it('should hydrate receives with resolved message entries', async () => {
      const entities = await getEntities();
      const orderEntity = entities.find((e) => e.data.id === 'Order');

      expect(orderEntity).toBeDefined();
      expect(orderEntity!.data.receives).toHaveLength(2);
      expect(orderEntity!.data.receives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'CreateOrder', version: '1.0.0' }) }),
          expect.objectContaining({ data: expect.objectContaining({ id: 'ShipOrder', version: '1.0.0' }) }),
        ])
      );
    });

    it('should include sendsRaw and receivesRaw for graph building', async () => {
      const entities = await getEntities();
      const orderEntity = entities.find((e) => e.data.id === 'Order') as any;

      expect(orderEntity).toBeDefined();
      expect(orderEntity.data.sendsRaw).toEqual([
        { id: 'OrderCreated', version: '1.0.0' },
        { id: 'OrderShipped', version: '1.0.0' },
      ]);
      expect(orderEntity.data.receivesRaw).toEqual([
        { id: 'CreateOrder', version: '1.0.0' },
        { id: 'ShipOrder', version: '1.0.0' },
      ]);
    });

    it('should return empty arrays for entity without sends/receives', async () => {
      const entities = await getEntities();
      const simpleEntity = entities.find((e) => e.data.id === 'SimpleEntity') as any;

      expect(simpleEntity).toBeDefined();
      expect(simpleEntity.data.sends).toEqual([]);
      expect(simpleEntity.data.receives).toEqual([]);
      expect(simpleEntity.data.sendsRaw).toEqual([]);
      expect(simpleEntity.data.receivesRaw).toEqual([]);
    });
  });

  describe('getEntityProducersOfMessage', () => {
    it('should find entity that sends a message with matching version', () => {
      const message = mockEvents[0] as any; // OrderCreated 1.0.0
      const producers = getEntityProducersOfMessage(mockEntities as any, message);

      expect(producers).toHaveLength(1);
      expect(producers[0].data.id).toBe('Order');
    });

    it('should return empty array when no entity produces the message', () => {
      const message = mockQueries[0] as any; // GetOrder - not produced by any entity
      const producers = getEntityProducersOfMessage(mockEntities as any, message);

      expect(producers).toHaveLength(0);
    });

    it('should match when entity sends with version "latest"', () => {
      const entityWithLatest = {
        ...mockEntities[1],
        data: {
          ...mockEntities[1].data,
          sends: [{ id: 'OrderCreated', version: 'latest' }],
        },
      };
      const message = mockEvents[0] as any; // OrderCreated 1.0.0
      const producers = getEntityProducersOfMessage([entityWithLatest] as any, message);

      expect(producers).toHaveLength(1);
    });

    it('should match when entity sends without version (treated as latest)', () => {
      const entityWithoutVersion = {
        ...mockEntities[1],
        data: {
          ...mockEntities[1].data,
          sends: [{ id: 'OrderCreated' }], // no version
        },
      };
      const message = mockEvents[0] as any; // OrderCreated 1.0.0
      const producers = getEntityProducersOfMessage([entityWithoutVersion] as any, message);

      expect(producers).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const entityWithSemver = {
        ...mockEntities[1],
        data: {
          ...mockEntities[1].data,
          sends: [{ id: 'OrderCreated', version: '^1.0.0' }],
        },
      };
      const message = { ...mockEvents[0], data: { ...mockEvents[0].data, version: '1.2.3' } } as any;
      const producers = getEntityProducersOfMessage([entityWithSemver] as any, message);

      expect(producers).toHaveLength(1);
    });
  });

  describe('getEntityConsumersOfMessage', () => {
    it('should find entity that receives a message with matching version', () => {
      const message = mockCommands[0] as any; // CreateOrder 1.0.0
      const consumers = getEntityConsumersOfMessage(mockEntities as any, message);

      expect(consumers).toHaveLength(1);
      expect(consumers[0].data.id).toBe('Order');
    });

    it('should return empty array when no entity consumes the message', () => {
      const message = mockEvents[0] as any; // OrderCreated - not received by the Order entity
      const consumers = getEntityConsumersOfMessage(mockEntities as any, message);

      expect(consumers).toHaveLength(0);
    });

    it('should match when entity receives with version "latest"', () => {
      const entityWithLatest = {
        ...mockEntities[1],
        data: {
          ...mockEntities[1].data,
          receives: [{ id: 'CreateOrder', version: 'latest' }],
        },
      };
      const message = mockCommands[0] as any; // CreateOrder 1.0.0
      const consumers = getEntityConsumersOfMessage([entityWithLatest] as any, message);

      expect(consumers).toHaveLength(1);
    });

    it('should match when entity receives without version (treated as latest)', () => {
      const entityWithoutVersion = {
        ...mockEntities[1],
        data: {
          ...mockEntities[1].data,
          receives: [{ id: 'CreateOrder' }], // no version
        },
      };
      const message = mockCommands[0] as any; // CreateOrder 1.0.0
      const consumers = getEntityConsumersOfMessage([entityWithoutVersion] as any, message);

      expect(consumers).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const entityWithSemver = {
        ...mockEntities[1],
        data: {
          ...mockEntities[1].data,
          receives: [{ id: 'CreateOrder', version: '^1.0.0' }],
        },
      };
      const message = { ...mockCommands[0], data: { ...mockCommands[0].data, version: '1.5.0' } } as any;
      const consumers = getEntityConsumersOfMessage([entityWithSemver] as any, message);

      expect(consumers).toHaveLength(1);
    });
  });
});
