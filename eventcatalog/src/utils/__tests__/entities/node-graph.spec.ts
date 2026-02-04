import { getNodesAndEdges } from '../../node-graphs/entity-node-graph';
import { expect, describe, it, vi, beforeEach } from 'vitest';
import { mockCommands, mockEvents, mockQueries, mockEntities, mockServices, mockChannels } from './mocks';
import type { ContentCollectionKey } from 'astro:content';

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'entities':
          return Promise.resolve(mockEntities);
        case 'services':
          return Promise.resolve(mockServices);
        case 'events':
          return Promise.resolve(mockEvents);
        case 'commands':
          return Promise.resolve(mockCommands);
        case 'queries':
          return Promise.resolve(mockQueries);
        case 'channels':
          return Promise.resolve(mockChannels);
        default:
          return Promise.resolve([]);
      }
    },
  };
});

describe('Entity NodeGraph', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNodesAndEdges', () => {
    it('should return nodes and edges for a given entity', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'Order', version: '1.0.0' });

      // The entity node itself
      const entityNode = nodes.find((n) => n.id === 'Order-1.0.0');
      expect(entityNode).toBeDefined();
      expect(entityNode?.type).toBe('entities');

      // Messages the entity sends (OrderCreated, OrderShipped)
      const orderCreatedNode = nodes.find((n) => n.id === 'OrderCreated-1.0.0');
      expect(orderCreatedNode).toBeDefined();
      expect(orderCreatedNode?.type).toBe('events');

      const orderShippedNode = nodes.find((n) => n.id === 'OrderShipped-1.0.0');
      expect(orderShippedNode).toBeDefined();

      // Messages the entity receives (CreateOrder, ShipOrder)
      const createOrderNode = nodes.find((n) => n.id === 'CreateOrder-1.0.0');
      expect(createOrderNode).toBeDefined();
      expect(createOrderNode?.type).toBe('commands');

      const shipOrderNode = nodes.find((n) => n.id === 'ShipOrder-1.0.0');
      expect(shipOrderNode).toBeDefined();
    });

    it('should return empty nodes and edges if entity not found', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'UnknownEntity', version: '1.0.0' });

      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });

    it('should show service as producer when service sends a message the entity receives', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'Order', version: '1.0.0' });

      // NotificationService sends CreateOrder which Order entity receives
      const serviceNode = nodes.find((n) => n.id === 'NotificationService-1.0.0');
      expect(serviceNode).toBeDefined();
      expect(serviceNode?.type).toBe('services');

      // Check edge from service to message
      const serviceToMessageEdge = edges.find(
        (e) => e.source === 'NotificationService-1.0.0' && e.target === 'CreateOrder-1.0.0'
      );
      expect(serviceToMessageEdge).toBeDefined();
    });

    it('should show service as consumer when service receives a message the entity sends', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'Order', version: '1.0.0' });

      // NotificationService receives OrderCreated which Order entity sends
      const serviceNode = nodes.find((n) => n.id === 'NotificationService-1.0.0');
      expect(serviceNode).toBeDefined();

      // Check edge from message to service
      const messageToServiceEdge = edges.find(
        (e) => e.source === 'OrderCreated-1.0.0' && e.target === 'NotificationService-1.0.0'
      );
      expect(messageToServiceEdge).toBeDefined();
    });

    it('should not show self as producer or consumer', async () => {
      const { nodes } = await getNodesAndEdges({ id: 'Order', version: '1.0.0' });

      // Count how many times Order-1.0.0 appears - should be exactly once (the entity itself)
      const orderNodes = nodes.filter((n) => n.id === 'Order-1.0.0');
      expect(orderNodes).toHaveLength(1);
    });

    it('should handle entity with no sends/receives', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'SimpleEntity', version: '1.0.0' });

      // Should have just the entity node
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('SimpleEntity-1.0.0');
      expect(nodes[0].type).toBe('entities');

      // Should have no edges
      expect(edges).toHaveLength(0);
    });
  });
});
