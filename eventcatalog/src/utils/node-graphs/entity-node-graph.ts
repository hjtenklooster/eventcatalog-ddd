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
      return 'subscribes to';
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
  const [entities, services, events, commands, queries, channels] = await Promise.all([
    getCollection('entities'),
    getCollection('services'),
    getCollection('events'),
    getCollection('commands'),
    getCollection('queries'),
    getCollection('channels'),
  ]);

  const allMessages = [...events, ...commands, ...queries];
  const entityMap = createVersionedMap(entities);
  const messageMap = createVersionedMap(allMessages);
  const channelMap = createVersionedMap(channels);

  // Find the entity
  const entity = findInMap(entityMap, id, version);
  if (!entity) {
    return { nodes: [], edges: [] };
  }

  // Hydrate sends/receives
  const sendsRaw = entity.data.sends || [];
  const receivesRaw = entity.data.receives || [];

  const sends = sendsRaw
    .map((m: { id: string; version?: string }) => findInMap(messageMap, m.id, m.version))
    .filter((e): e is CollectionEntry<CollectionMessageTypes> => !!e);

  const receives = receivesRaw
    .map((m: { id: string; version?: string }) => findInMap(messageMap, m.id, m.version))
    .filter((e): e is CollectionEntry<CollectionMessageTypes> => !!e);

  // Add entity node first (center) - always show even if isolated
  nodes.push({
    id: generateIdForNode(entity),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      mode,
      entity: { ...entity.data },
    },
    position: { x: 0, y: 0 },
    type: 'entities',
  });

  const entityNodeId = generateIdForNode(entity);

  // Process received messages - get producers (services/entities that send what this entity receives)
  for (const message of receives) {
    // Extract channel configuration from entity's receives
    const targetChannels = receivesRaw.find((receiveRaw) => receiveRaw.id === message.data.id)?.from;

    const { nodes: consumedMessageNodes, edges: consumedMessageEdges } = getNodesAndEdgesForConsumedMessage({
      message,
      targetChannels,
      services,
      channels,
      currentNodes: nodes,
      target: entity,
      mode,
      channelMap,
      entities,
    });

    nodes.push(...consumedMessageNodes);

    // Fix edge labels for entity-specific edges (message → entity)
    const fixedEdges = consumedMessageEdges.map((edge: Edge) => {
      // If edge targets the entity, use entity-specific labels
      if (edge.target === entityNodeId) {
        return { ...edge, label: getReceivesLabelByMessageType(message.collection) };
      }
      return edge;
    });
    edges.push(...fixedEdges);
  }

  // Process sent messages - get consumers (services/entities that receive what this entity sends)
  for (const message of sends) {
    // Extract channel configuration from entity's sends
    const sourceChannels = sendsRaw.find((sendRaw) => sendRaw.id === message.data.id)?.to;

    const { nodes: producedMessageNodes, edges: producedMessageEdges } = getNodesAndEdgesForProducedMessage({
      message,
      sourceChannels,
      services,
      channels,
      currentNodes: nodes,
      currentEdges: edges,
      source: entity,
      mode,
      channelMap,
      entities,
    });

    nodes.push(...producedMessageNodes);
    edges.push(...producedMessageEdges);
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
