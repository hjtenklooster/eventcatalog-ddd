import { getNodesAndEdges } from '../../node-graphs/policy-node-graph';
import { expect, describe, it, vi, beforeEach } from 'vitest';
import { mockPolicies, mockServices, mockEvents, mockCommands, mockChannels, mockEntities } from './mocks';
import type { ContentCollectionKey } from 'astro:content';

vi.mock('astro:content', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('astro:content')>()),
    getCollection: (key: ContentCollectionKey) => {
      switch (key) {
        case 'policies':
          return Promise.resolve(mockPolicies);
        case 'services':
          return Promise.resolve(mockServices);
        case 'events':
          return Promise.resolve(mockEvents);
        case 'commands':
          return Promise.resolve(mockCommands);
        case 'channels':
          return Promise.resolve(mockChannels);
        case 'entities':
          return Promise.resolve(mockEntities);
        default:
          return Promise.resolve([]);
      }
    },
  };
});

describe('Policy NodeGraph', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNodesAndEdges', () => {
    it('should return nodes and edges for a given policy', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderPolicy', version: '1.0.0' });

      // The policy node itself
      const policyNode = nodes.find((n) => n.id === 'OrderPolicy-1.0.0');
      expect(policyNode).toBeDefined();
      expect(policyNode?.type).toBe('policies');

      // Event the policy receives (OrderCreated)
      const eventNode = nodes.find((n) => n.id === 'OrderCreated-1.0.0');
      expect(eventNode).toBeDefined();
      expect(eventNode?.type).toBe('events');

      // Command the policy dispatches (ProcessOrder)
      const commandNode = nodes.find((n) => n.id === 'ProcessOrder-1.0.0');
      expect(commandNode).toBeDefined();
      expect(commandNode?.type).toBe('commands');
    });

    it('should return empty nodes and edges if policy not found', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'UnknownPolicy', version: '1.0.0' });

      expect(nodes).toEqual([]);
      expect(edges).toEqual([]);
    });

    it('should show service as producer when service sends an event the policy receives', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderPolicy', version: '1.0.0' });

      // NotificationService sends OrderCreated which triggers OrderPolicy
      const serviceNode = nodes.find((n) => n.id === 'NotificationService-1.0.0');
      expect(serviceNode).toBeDefined();
      expect(serviceNode?.type).toBe('services');

      // Check edge from service to event
      const serviceToEventEdge = edges.find((e) => e.source === 'NotificationService-1.0.0' && e.target === 'OrderCreated-1.0.0');
      expect(serviceToEventEdge).toBeDefined();
    });

    it('should show service as consumer when service receives a command the policy dispatches', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'OrderPolicy', version: '1.0.0' });

      // NotificationService receives ProcessOrder which OrderPolicy dispatches
      const serviceNode = nodes.find((n) => n.id === 'NotificationService-1.0.0');
      expect(serviceNode).toBeDefined();

      // Check edge from command to service
      const commandToServiceEdge = edges.find(
        (e) => e.source === 'ProcessOrder-1.0.0' && e.target === 'NotificationService-1.0.0'
      );
      expect(commandToServiceEdge).toBeDefined();
    });

    it('should use "triggered by" label for event-to-policy edges', async () => {
      const { edges } = await getNodesAndEdges({ id: 'OrderPolicy', version: '1.0.0' });

      // Find edge targeting the policy node (event/channel → policy)
      const eventToPolicyEdge = edges.find((e) => e.target === 'OrderPolicy-1.0.0');
      expect(eventToPolicyEdge).toBeDefined();
      expect(eventToPolicyEdge?.label).toBe('triggered by');
    });

    it('should use "dispatches" label for policy-to-command edges', async () => {
      const { edges } = await getNodesAndEdges({ id: 'OrderPolicy', version: '1.0.0' });

      // Find edge from policy to command
      const policyToCommandEdge = edges.find((e) => e.source === 'OrderPolicy-1.0.0' && e.target === 'ProcessOrder-1.0.0');
      expect(policyToCommandEdge).toBeDefined();
      expect(policyToCommandEdge?.label).toBe('dispatches');
    });

    it('should handle policy with no sends/receives', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'SimplePolicy', version: '1.0.0' });

      // Should have just the policy node
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('SimplePolicy-1.0.0');
      expect(nodes[0].type).toBe('policies');

      // Should have no edges
      expect(edges).toHaveLength(0);
    });

    it('should render channels when policy receives event from a channel', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'ChannelPolicy', version: '1.0.0' });

      // Should have policy node
      const policyNode = nodes.find((n) => n.id === 'ChannelPolicy-1.0.0');
      expect(policyNode).toBeDefined();

      // Should have channel node
      const channelNode = nodes.find((n) => n.id === 'OrderChannel-1.0.0');
      expect(channelNode).toBeDefined();
      expect(channelNode?.type).toBe('channels');

      // Should have event node (PaymentReceived)
      const eventNode = nodes.find((n) => n.id === 'PaymentReceived-1.0.0');
      expect(eventNode).toBeDefined();

      // Edge from channel to policy should have 'triggered by' label
      const channelToPolicyEdge = edges.find((e) => e.target === 'ChannelPolicy-1.0.0');
      expect(channelToPolicyEdge).toBeDefined();
      expect(channelToPolicyEdge?.label).toBe('triggered by');
    });

    it('should render channels when policy sends command to a channel', async () => {
      const { nodes, edges } = await getNodesAndEdges({ id: 'ChannelPolicy', version: '1.0.0' });

      // Should have command node (ChargePayment)
      const commandNode = nodes.find((n) => n.id === 'ChargePayment-1.0.0');
      expect(commandNode).toBeDefined();

      // Edge from policy to command should have 'dispatches' label
      const policyToCommandEdge = edges.find((e) => e.source === 'ChannelPolicy-1.0.0' && e.target === 'ChargePayment-1.0.0');
      expect(policyToCommandEdge).toBeDefined();
      expect(policyToCommandEdge?.label).toBe('dispatches');

      // Should have edge from command to channel
      const commandToChannelEdge = edges.find((e) => e.source === 'ChargePayment-1.0.0' && e.target === 'OrderChannel-1.0.0');
      expect(commandToChannelEdge).toBeDefined();
      expect(commandToChannelEdge?.label).toBe('routes to');
    });
  });
});
