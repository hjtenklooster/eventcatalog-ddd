import { getNodesAndEdges } from '../../node-graphs/actor-node-graph';
import { expect, describe, it, vi, beforeEach } from 'vitest';
import { mockActors, mockViews, mockEvents, mockCommands, mockServices, mockEntities, mockChannels } from './mocks';
import type { ContentCollectionKey } from 'astro:content';

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'actors':
          return Promise.resolve(mockActors);
        case 'views':
          return Promise.resolve(mockViews);
        case 'events':
          return Promise.resolve(mockEvents);
        case 'commands':
          return Promise.resolve(mockCommands);
        case 'services':
          return Promise.resolve(mockServices);
        case 'entities':
          return Promise.resolve(mockEntities);
        case 'channels':
          return Promise.resolve(mockChannels);
        default:
          return Promise.resolve([]);
      }
    },
  };
});

describe('Actor NodeGraph', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNodesAndEdges', () => {
    it('should return nodes and edges for a given actor', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'CustomerSupportAgent', version: '1.0.0' });

      // The actor node itself
      const actorNode = nodes.find((n) => n.id === 'CustomerSupportAgent-1.0.0');
      expect(actorNode).toBeDefined();
      expect(actorNode?.type).toBe('actor');

      // View the actor reads
      const viewNode = nodes.find((n) => n.id === 'OrderSummaryView-1.0.0');
      expect(viewNode).toBeDefined();
      expect(viewNode?.type).toBe('view');

      // Command the actor issues
      const commandNode = nodes.find((n) => n.id === 'UpdateInventory-1.0.0');
      expect(commandNode).toBeDefined();
      expect(commandNode?.type).toBe('commands');
    });

    it('should return empty nodes and edges if actor not found', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'UnknownActor', version: '1.0.0' });

      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });

    it('should use "informs" label for view-to-actor edges', async () => {
      const { edges } = await getNodesAndEdges({ id: 'CustomerSupportAgent', version: '1.0.0' });

      const viewToActorEdge = edges.find(
        (e) => e.source === 'OrderSummaryView-1.0.0' && e.target === 'CustomerSupportAgent-1.0.0'
      );
      expect(viewToActorEdge).toBeDefined();
      expect(viewToActorEdge?.label).toBe('informs');
    });

    it('should use "issues" label for actor-to-command edges', async () => {
      const { edges } = await getNodesAndEdges({ id: 'CustomerSupportAgent', version: '1.0.0' });

      const actorToCommandEdge = edges.find(
        (e) => e.source === 'CustomerSupportAgent-1.0.0' && e.target === 'UpdateInventory-1.0.0'
      );
      expect(actorToCommandEdge).toBeDefined();
      expect(actorToCommandEdge?.label).toBe('issues');
    });

    it('should show events that views subscribe to (left expansion)', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'CustomerSupportAgent', version: '1.0.0' });

      // OrderSummaryView subscribes to OrderConfirmed
      const eventNode1 = nodes.find((n) => n.id === 'OrderConfirmed-0.0.1');
      expect(eventNode1).toBeDefined();
      expect(eventNode1?.type).toBe('events');

      const eventToViewEdge1 = edges.find(
        (e) => e.source === 'OrderConfirmed-0.0.1' && e.target === 'OrderSummaryView-1.0.0'
      );
      expect(eventToViewEdge1).toBeDefined();
      expect(eventToViewEdge1?.label).toBe('subscribes');

      // OrderSummaryView subscribes to OrderAmended
      const eventNode2 = nodes.find((n) => n.id === 'OrderAmended-0.0.1');
      expect(eventNode2).toBeDefined();

      const eventToViewEdge2 = edges.find(
        (e) => e.source === 'OrderAmended-0.0.1' && e.target === 'OrderSummaryView-1.0.0'
      );
      expect(eventToViewEdge2).toBeDefined();
    });

    it('should show entity consumers of commands (right expansion)', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'CustomerSupportAgent', version: '1.0.0' });

      // InventoryEntity receives UpdateInventory
      const entityNode = nodes.find((n) => n.id === 'InventoryEntity-1.0.0');
      expect(entityNode).toBeDefined();
      expect(entityNode?.type).toBe('entities');

      const commandToEntityEdge = edges.find(
        (e) => e.source === 'UpdateInventory-1.0.0' && e.target === 'InventoryEntity-1.0.0'
      );
      expect(commandToEntityEdge).toBeDefined();
      expect(commandToEntityEdge?.label).toBe('subscribes to');
    });

    it('should show service consumers of commands (right expansion)', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'CustomerSupportAgent', version: '1.0.0' });

      // InventoryService receives UpdateInventory
      const serviceNode = nodes.find((n) => n.id === 'InventoryService-1.0.0');
      expect(serviceNode).toBeDefined();
      expect(serviceNode?.type).toBe('services');

      const commandToServiceEdge = edges.find(
        (e) => e.source === 'UpdateInventory-1.0.0' && e.target === 'InventoryService-1.0.0'
      );
      expect(commandToServiceEdge).toBeDefined();
    });
  });
});
