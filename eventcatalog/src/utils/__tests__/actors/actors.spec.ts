import type { ContentCollectionKey } from 'astro:content';
import { expect, describe, it, vi } from 'vitest';
import {
  mockActors,
  mockViews,
  mockCommands,
  mockSimpleActor,
  mockCustomerSupportAgentOld,
} from './mocks';
import { getActors, getActorsReadingView, getActorsIssuingCommand } from '@utils/collections/actors';

const allActors = [...mockActors, mockSimpleActor, mockCustomerSupportAgentOld];

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'actors':
          return Promise.resolve(allActors);
        case 'views':
          return Promise.resolve(mockViews);
        case 'commands':
          return Promise.resolve(mockCommands);
        default:
          return Promise.resolve([]);
      }
    },
  };
});

describe('Actors', () => {
  describe('getActors', () => {
    it('should hydrate reads with resolved view entries', async () => {
      const actors = await getActors();
      const agent = actors.find((a) => a.data.id === 'CustomerSupportAgent' && a.data.version === '1.0.0');

      expect(agent).toBeDefined();
      expect(agent!.data.reads).toHaveLength(1);
      expect(agent!.data.reads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'OrderSummaryView', version: '1.0.0' }) }),
        ])
      );
    });

    it('should hydrate issues with resolved command entries', async () => {
      const actors = await getActors();
      const agent = actors.find((a) => a.data.id === 'CustomerSupportAgent' && a.data.version === '1.0.0');

      expect(agent).toBeDefined();
      expect(agent!.data.issues).toHaveLength(1);
      expect(agent!.data.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ id: 'UpdateInventory', version: '1.0.0' }) }),
        ])
      );
    });

    it('should include readsRaw and issuesRaw for graph building', async () => {
      const actors = await getActors();
      const agent = actors.find((a) => a.data.id === 'CustomerSupportAgent' && a.data.version === '1.0.0') as any;

      expect(agent).toBeDefined();
      expect(agent.data.readsRaw).toEqual([{ id: 'OrderSummaryView', version: '1.0.0' }]);
      expect(agent.data.issuesRaw).toEqual([{ id: 'UpdateInventory', version: '1.0.0' }]);
    });

    it('should return empty arrays for actor without reads/issues', async () => {
      const actors = await getActors();
      const simpleActor = actors.find((a) => a.data.id === 'SimpleActor') as any;

      expect(simpleActor).toBeDefined();
      expect(simpleActor.data.reads).toEqual([]);
      expect(simpleActor.data.issues).toEqual([]);
      expect(simpleActor.data.readsRaw).toEqual([]);
      expect(simpleActor.data.issuesRaw).toEqual([]);
    });
  });

  describe('getActorsReadingView', () => {
    it('should find actor that reads view with matching version', () => {
      const view = mockViews[0] as any; // OrderSummaryView 1.0.0
      const result = getActorsReadingView(mockActors as any, view);

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('CustomerSupportAgent');
    });

    it('should return empty when no actor reads view', () => {
      const unknownView = { data: { id: 'UnknownView', version: '1.0.0' }, collection: 'views' } as any;
      const result = getActorsReadingView(mockActors as any, unknownView);

      expect(result).toHaveLength(0);
    });

    it('should match when actor reads with version "latest"', () => {
      const actorWithLatest = {
        ...mockActors[0],
        data: {
          ...mockActors[0].data,
          reads: [{ id: 'OrderSummaryView', version: 'latest' }],
        },
      };
      const view = mockViews[0] as any; // OrderSummaryView 1.0.0
      const result = getActorsReadingView([actorWithLatest] as any, view);

      expect(result).toHaveLength(1);
    });

    it('should match when actor reads without version (implicit latest)', () => {
      const actorWithoutVersion = {
        ...mockActors[0],
        data: {
          ...mockActors[0].data,
          reads: [{ id: 'OrderSummaryView' }], // no version
        },
      };
      const view = mockViews[0] as any; // OrderSummaryView 1.0.0
      const result = getActorsReadingView([actorWithoutVersion] as any, view);

      expect(result).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const actorWithSemver = {
        ...mockActors[0],
        data: {
          ...mockActors[0].data,
          reads: [{ id: 'OrderSummaryView', version: '^1.0.0' }],
        },
      };
      const view = { ...mockViews[0], data: { ...mockViews[0].data, version: '1.5.0' } } as any;
      const result = getActorsReadingView([actorWithSemver] as any, view);

      expect(result).toHaveLength(1);
    });
  });

  describe('getActorsIssuingCommand', () => {
    it('should find actor that issues command with matching version', () => {
      const command = mockCommands[0] as any; // UpdateInventory 1.0.0
      const result = getActorsIssuingCommand(mockActors as any, command);

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('CustomerSupportAgent');
    });

    it('should return empty when no actor issues command', () => {
      const unknownCommand = { data: { id: 'UnknownCommand', version: '1.0.0' }, collection: 'commands' } as any;
      const result = getActorsIssuingCommand(mockActors as any, unknownCommand);

      expect(result).toHaveLength(0);
    });

    it('should match when actor issues with version "latest"', () => {
      const actorWithLatest = {
        ...mockActors[0],
        data: {
          ...mockActors[0].data,
          issues: [{ id: 'UpdateInventory', version: 'latest' }],
        },
      };
      const command = mockCommands[0] as any; // UpdateInventory 1.0.0
      const result = getActorsIssuingCommand([actorWithLatest] as any, command);

      expect(result).toHaveLength(1);
    });

    it('should match when actor issues without version (implicit latest)', () => {
      const actorWithoutVersion = {
        ...mockActors[0],
        data: {
          ...mockActors[0].data,
          issues: [{ id: 'UpdateInventory' }], // no version
        },
      };
      const command = mockCommands[0] as any; // UpdateInventory 1.0.0
      const result = getActorsIssuingCommand([actorWithoutVersion] as any, command);

      expect(result).toHaveLength(1);
    });

    it('should match semver ranges', () => {
      const actorWithSemver = {
        ...mockActors[0],
        data: {
          ...mockActors[0].data,
          issues: [{ id: 'UpdateInventory', version: '^1.0.0' }],
        },
      };
      const command = { ...mockCommands[0], data: { ...mockCommands[0].data, version: '1.5.0' } } as any;
      const result = getActorsIssuingCommand([actorWithSemver] as any, command);

      expect(result).toHaveLength(1);
    });
  });
});
