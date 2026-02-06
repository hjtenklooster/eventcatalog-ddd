import type { ContentCollectionKey } from 'astro:content';
import { expect, describe, it, vi } from 'vitest';
import { mockPolicies, mockDomains, mockEvents, mockCommands } from './mocks';
import { getPolicies, getPoliciesTriggeredByEvent, getPoliciesDispatchingCommand } from '@utils/collections/policies';

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'policies':
          return Promise.resolve(mockPolicies);
        case 'domains':
          return Promise.resolve(mockDomains);
        case 'events':
          return Promise.resolve(mockEvents);
        case 'commands':
          return Promise.resolve(mockCommands);
        default:
          return Promise.resolve([]);
      }
    },
  };
});

describe('Policies', () => {
  describe('getPolicies', () => {
    it('should return an array of policies with hydrated domains', async () => {
      const policies = await getPolicies();

      const expectedPolicies = [
        {
          id: 'OrderPolicy-1.0.0',
          slug: 'OrderPolicy',
          collection: 'policies',
          data: expect.objectContaining({
            id: 'OrderPolicy',
            version: '1.0.0',
            domains: [mockDomains[0]],
          }),
        },
      ];

      expect(policies).toEqual(expect.arrayContaining(expectedPolicies.map((e) => expect.objectContaining(e))));
    });

    it('should hydrate sends with resolved command entries', async () => {
      const policies = await getPolicies();
      const orderPolicy = policies.find((p) => p.data.id === 'OrderPolicy' && p.data.version === '1.0.0');

      expect(orderPolicy).toBeDefined();
      expect(orderPolicy!.data.sends).toHaveLength(1);
      expect(orderPolicy!.data.sends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'ProcessOrder', version: '1.0.0' }) }),
        ])
      );
    });

    it('should hydrate receives with resolved event entries', async () => {
      const policies = await getPolicies();
      const orderPolicy = policies.find((p) => p.data.id === 'OrderPolicy' && p.data.version === '1.0.0');

      expect(orderPolicy).toBeDefined();
      expect(orderPolicy!.data.receives).toHaveLength(1);
      expect(orderPolicy!.data.receives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'OrderCreated', version: '1.0.0' }) }),
        ])
      );
    });

    it('should include sendsRaw and receivesRaw for graph building', async () => {
      const policies = await getPolicies();
      const orderPolicy = policies.find((p) => p.data.id === 'OrderPolicy' && p.data.version === '1.0.0') as any;

      expect(orderPolicy).toBeDefined();
      expect(orderPolicy.data.sendsRaw).toEqual([{ id: 'ProcessOrder', version: '1.0.0' }]);
      expect(orderPolicy.data.receivesRaw).toEqual([{ id: 'OrderCreated', version: '1.0.0' }]);
    });

    it('should return empty arrays for policy without sends/receives', async () => {
      const policies = await getPolicies();
      const simplePolicy = policies.find((p) => p.data.id === 'SimplePolicy') as any;

      expect(simplePolicy).toBeDefined();
      expect(simplePolicy.data.sends).toEqual([]);
      expect(simplePolicy.data.receives).toEqual([]);
      expect(simplePolicy.data.sendsRaw).toEqual([]);
      expect(simplePolicy.data.receivesRaw).toEqual([]);
    });
  });

  describe('getPoliciesTriggeredByEvent', () => {
    it('should find policy triggered by event with matching version', () => {
      const event = mockEvents[0] as any; // OrderCreated 1.0.0
      const result = getPoliciesTriggeredByEvent(mockPolicies as any, event);

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('OrderPolicy');
    });

    it('should return empty array when no policy is triggered by the event', () => {
      const unknownEvent = { data: { id: 'UnknownEvent', version: '1.0.0' }, collection: 'events' } as any;
      const result = getPoliciesTriggeredByEvent(mockPolicies as any, unknownEvent);

      expect(result).toHaveLength(0);
    });

    it('should match when policy receives with version "latest"', () => {
      const policyWithLatest = {
        ...mockPolicies[0],
        data: {
          ...mockPolicies[0].data,
          receives: [{ id: 'OrderCreated', version: 'latest' }],
        },
      };
      const event = mockEvents[0] as any; // OrderCreated 1.0.0
      const result = getPoliciesTriggeredByEvent([policyWithLatest] as any, event);

      expect(result).toHaveLength(1);
    });

    it('should match when policy receives without version (treated as latest)', () => {
      const policyWithoutVersion = {
        ...mockPolicies[0],
        data: {
          ...mockPolicies[0].data,
          receives: [{ id: 'OrderCreated' }], // no version
        },
      };
      const event = mockEvents[0] as any; // OrderCreated 1.0.0
      const result = getPoliciesTriggeredByEvent([policyWithoutVersion] as any, event);

      expect(result).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const policyWithSemver = {
        ...mockPolicies[0],
        data: {
          ...mockPolicies[0].data,
          receives: [{ id: 'OrderCreated', version: '^1.0.0' }],
        },
      };
      const event = { ...mockEvents[0], data: { ...mockEvents[0].data, version: '1.2.3' } } as any;
      const result = getPoliciesTriggeredByEvent([policyWithSemver] as any, event);

      expect(result).toHaveLength(1);
    });
  });

  describe('getPoliciesDispatchingCommand', () => {
    it('should find policy that dispatches a command with matching version', () => {
      const command = mockCommands[0] as any; // ProcessOrder 1.0.0
      const result = getPoliciesDispatchingCommand(mockPolicies as any, command);

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('OrderPolicy');
    });

    it('should return empty array when no policy dispatches the command', () => {
      const unknownCommand = { data: { id: 'UnknownCommand', version: '1.0.0' }, collection: 'commands' } as any;
      const result = getPoliciesDispatchingCommand(mockPolicies as any, unknownCommand);

      expect(result).toHaveLength(0);
    });

    it('should match when policy sends with version "latest"', () => {
      const policyWithLatest = {
        ...mockPolicies[0],
        data: {
          ...mockPolicies[0].data,
          sends: [{ id: 'ProcessOrder', version: 'latest' }],
        },
      };
      const command = mockCommands[0] as any; // ProcessOrder 1.0.0
      const result = getPoliciesDispatchingCommand([policyWithLatest] as any, command);

      expect(result).toHaveLength(1);
    });

    it('should match when policy sends without version (treated as latest)', () => {
      const policyWithoutVersion = {
        ...mockPolicies[0],
        data: {
          ...mockPolicies[0].data,
          sends: [{ id: 'ProcessOrder' }], // no version
        },
      };
      const command = mockCommands[0] as any; // ProcessOrder 1.0.0
      const result = getPoliciesDispatchingCommand([policyWithoutVersion] as any, command);

      expect(result).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const policyWithSemver = {
        ...mockPolicies[0],
        data: {
          ...mockPolicies[0].data,
          sends: [{ id: 'ProcessOrder', version: '^1.0.0' }],
        },
      };
      const command = { ...mockCommands[0], data: { ...mockCommands[0].data, version: '1.5.0' } } as any;
      const result = getPoliciesDispatchingCommand([policyWithSemver] as any, command);

      expect(result).toHaveLength(1);
    });
  });
});
