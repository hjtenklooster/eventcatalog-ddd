import { getNodesAndEdges } from '../../node-graphs/view-node-graph';
import { expect, describe, it, vi, beforeEach } from 'vitest';
import { mockViews, mockEvents, mockActors, mockCommands, mockServices, mockEntities, mockChannels } from './mocks';
import type { ContentCollectionKey } from 'astro:content';

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'views':
          return Promise.resolve(mockViews);
        case 'events':
          return Promise.resolve(mockEvents);
        case 'actors':
          return Promise.resolve(mockActors);
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

describe('View NodeGraph', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNodesAndEdges', () => {
    it('should return nodes and edges for a given view', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderSummaryView', version: '1.0.0' });

      // The view node itself
      const viewNode = nodes.find((n) => n.id === 'OrderSummaryView-1.0.0');
      expect(viewNode).toBeDefined();
      expect(viewNode?.type).toBe('view');

      // Events the view subscribes to
      const eventNode1 = nodes.find((n) => n.id === 'OrderConfirmed-0.0.1');
      expect(eventNode1).toBeDefined();
      expect(eventNode1?.type).toBe('events');

      const eventNode2 = nodes.find((n) => n.id === 'OrderAmended-0.0.1');
      expect(eventNode2).toBeDefined();
      expect(eventNode2?.type).toBe('events');

      // Actor the view informs
      const actorNode = nodes.find((n) => n.id === 'CustomerSupportAgent-1.0.0');
      expect(actorNode).toBeDefined();
      expect(actorNode?.type).toBe('actor');
    });

    it('should return empty nodes and edges if view not found', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'UnknownView', version: '1.0.0' });

      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });

    it('should use "subscribes" label for event-to-view edges', async () => {
      const { edges } = await getNodesAndEdges({ id: 'OrderSummaryView', version: '1.0.0' });

      const eventToViewEdge = edges.find(
        (e) => e.source === 'OrderConfirmed-0.0.1' && e.target === 'OrderSummaryView-1.0.0'
      );
      expect(eventToViewEdge).toBeDefined();
      expect(eventToViewEdge?.label).toBe('subscribes');
    });

    it('should use "informs" label for view-to-actor edges', async () => {
      const { edges } = await getNodesAndEdges({ id: 'OrderSummaryView', version: '1.0.0' });

      const viewToActorEdge = edges.find(
        (e) => e.source === 'OrderSummaryView-1.0.0' && e.target === 'CustomerSupportAgent-1.0.0'
      );
      expect(viewToActorEdge).toBeDefined();
      expect(viewToActorEdge?.label).toBe('informs');
    });

    it('should show entity producers of events (left expansion)', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderSummaryView', version: '1.0.0' });

      // OrderEntity sends OrderConfirmed
      const entityNode = nodes.find((n) => n.id === 'OrderEntity-1.0.0');
      expect(entityNode).toBeDefined();
      expect(entityNode?.type).toBe('entities');

      const entityToEventEdge = edges.find(
        (e) => e.source === 'OrderEntity-1.0.0' && e.target === 'OrderConfirmed-0.0.1'
      );
      expect(entityToEventEdge).toBeDefined();
      expect(entityToEventEdge?.label).toBe('emits');
    });

    it('should show service producers of events (left expansion)', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderSummaryView', version: '1.0.0' });

      // OrderService sends OrderConfirmed
      const serviceNode = nodes.find((n) => n.id === 'OrderService-1.0.0');
      expect(serviceNode).toBeDefined();
      expect(serviceNode?.type).toBe('services');

      const serviceToEventEdge = edges.find(
        (e) => e.source === 'OrderService-1.0.0' && e.target === 'OrderConfirmed-0.0.1'
      );
      expect(serviceToEventEdge).toBeDefined();
    });

    it('should show commands issued by actors (right expansion)', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderSummaryView', version: '1.0.0' });

      // CustomerSupportAgent issues UpdateInventory
      const commandNode = nodes.find((n) => n.id === 'UpdateInventory-1.0.0');
      expect(commandNode).toBeDefined();
      expect(commandNode?.type).toBe('commands');

      const actorToCommandEdge = edges.find(
        (e) => e.source === 'CustomerSupportAgent-1.0.0' && e.target === 'UpdateInventory-1.0.0'
      );
      expect(actorToCommandEdge).toBeDefined();
      expect(actorToCommandEdge?.label).toBe('issues');
    });

    it('should show terminal consumers of commands (right expansion)', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderSummaryView', version: '1.0.0' });

      // OrderEntity receives UpdateInventory
      const entityNode = nodes.find((n) => n.id === 'OrderEntity-1.0.0');
      expect(entityNode).toBeDefined();

      const commandToEntityEdge = edges.find(
        (e) => e.source === 'UpdateInventory-1.0.0' && e.target === 'OrderEntity-1.0.0'
      );
      expect(commandToEntityEdge).toBeDefined();
      expect(commandToEntityEdge?.label).toBe('subscribes to');

      // OrderService receives UpdateInventory
      const serviceNode = nodes.find((n) => n.id === 'OrderService-1.0.0');
      expect(serviceNode).toBeDefined();

      const commandToServiceEdge = edges.find(
        (e) => e.source === 'UpdateInventory-1.0.0' && e.target === 'OrderService-1.0.0'
      );
      expect(commandToServiceEdge).toBeDefined();
    });
  });
});
