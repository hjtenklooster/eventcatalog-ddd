import { getCollection, type CollectionEntry } from 'astro:content';
import dagre from 'dagre';
import { type Node, type Edge, Position } from '@xyflow/react';
import { createDagreGraph, generateIdForNode, calculatedNodes } from '@utils/node-graphs/utils/utils';

import { findInMap, createVersionedMap } from '@utils/collections/util';
import type { CollectionMessageTypes } from '@types';
import { getNodesAndEdgesForConsumedMessage, getNodesAndEdgesForProducedMessage } from './message-node-graph';

type DagreGraph = any;

interface Props {
  id: string;
  version: string;
  mode?: 'simple' | 'full';
  defaultFlow?: DagreGraph;
}

const getReceivesLabelByMessageType = (messageType: string) => {
  switch (messageType) {
    case 'events':
      return 'triggered by';
    case 'commands':
      return 'handles';
    case 'queries':
      return 'handles';
    default:
      return 'receives';
  }
};

export const getNodesAndEdges = async ({ id, version, mode = 'simple', defaultFlow }: Props) => {
  const flow = defaultFlow || createDagreGraph({ ranksep: 300, nodesep: 50 });
  let nodes: Node[] = [];
  let edges: Edge[] = [];

  // Fetch all collections in parallel
  const [policies, services, events, commands, channels, entities] = await Promise.all([
    getCollection('policies'),
    getCollection('services'),
    getCollection('events'),
    getCollection('commands'),
    getCollection('channels'),
    getCollection('entities'),
  ]);

  // Policies can only receive events and send commands
  const policyMap = createVersionedMap(policies);
  const eventMap = createVersionedMap(events);
  const commandMap = createVersionedMap(commands);
  const channelMap = createVersionedMap(channels);

  // Find the policy
  const policy = findInMap(policyMap, id, version);
  if (!policy) {
    return { nodes: [], edges: [] };
  }

  // Hydrate sends/receives
  const sendsRaw = policy.data.sends || [];
  const receivesRaw = policy.data.receives || [];

  // Policies receive events (triggers)
  const receives = receivesRaw
    .map((m: { id: string; version?: string }) => findInMap(eventMap, m.id, m.version))
    .filter((e): e is CollectionEntry<'events'> => !!e);

  // Policies send commands (dispatches)
  const sends = sendsRaw
    .map((m: { id: string; version?: string }) => findInMap(commandMap, m.id, m.version))
    .filter((e): e is CollectionEntry<'commands'> => !!e);

  // Add policy node first (center) - always show even if isolated
  nodes.push({
    id: generateIdForNode(policy),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      mode,
      policy: { ...policy.data },
    },
    position: { x: 0, y: 0 },
    type: 'policies',
  });

  const policyNodeId = generateIdForNode(policy);

  // Process received messages (events that trigger this policy)
  for (const message of receives) {
    // Extract channel configuration from policy's receives
    const targetChannels = receivesRaw.find((receiveRaw) => receiveRaw.id === message.data.id)?.from;

    const { nodes: consumedMessageNodes, edges: consumedMessageEdges } = getNodesAndEdgesForConsumedMessage({
      message,
      targetChannels,
      services,
      channels,
      currentNodes: nodes,
      target: policy,
      mode,
      channelMap,
      entities,
    });

    nodes.push(...consumedMessageNodes);

    // Fix edge labels for policy-specific edges (message → policy)
    const fixedEdges = consumedMessageEdges.map((edge: Edge) => {
      // If edge targets the policy, use policy-specific labels
      if (edge.target === policyNodeId) {
        return { ...edge, label: getReceivesLabelByMessageType(message.collection) };
      }
      return edge;
    });
    edges.push(...fixedEdges);
  }

  // Process sent messages (commands this policy dispatches)
  for (const message of sends) {
    // Extract channel configuration from policy's sends
    const sourceChannels = sendsRaw.find((sendRaw) => sendRaw.id === message.data.id)?.to;

    const { nodes: producedMessageNodes, edges: producedMessageEdges } = getNodesAndEdgesForProducedMessage({
      message,
      sourceChannels,
      services,
      channels,
      currentNodes: nodes,
      currentEdges: edges,
      source: policy,
      mode,
      channelMap,
      entities,
    });

    nodes.push(...producedMessageNodes);

    // Update edge labels from policy to command
    const fixedEdges = producedMessageEdges.map((edge: Edge) => {
      if (edge.source === policyNodeId) {
        return { ...edge, label: 'dispatches' };
      }
      return edge;
    });
    edges.push(...fixedEdges);
  }

  // Make sure all nodes are unique
  const uniqueNodes = nodes.filter((node, index, self) => index === self.findIndex((t) => t.id === node.id));

  const uniqueEdges = edges.filter(
    (edge: Edge, index: number, self: Edge[]) => index === self.findIndex((t: Edge) => t.id === edge.id)
  );

  // Apply dagre layout
  uniqueNodes.forEach((node) => {
    flow.setNode(node.id, { width: 150, height: 100 });
  });
  uniqueEdges.forEach((edge) => {
    flow.setEdge(edge.source, edge.target);
  });
  dagre.layout(flow);

  const finalNodes = calculatedNodes(flow, uniqueNodes);
  return {
    nodes: finalNodes,
    edges: uniqueEdges,
  };
};
