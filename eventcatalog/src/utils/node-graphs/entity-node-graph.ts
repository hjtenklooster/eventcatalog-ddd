import { getCollection, type CollectionEntry } from 'astro:content';
import dagre from 'dagre';
import { type Node, type Edge, Position } from '@xyflow/react';
import {
  createDagreGraph,
  generateIdForNode,
  calculatedNodes,
  createNode,
  createEdge,
  generatedIdForEdge,
  getColorFromString,
  getEdgeLabelForServiceAsTarget,
  getEdgeLabelForMessageAsSource,
} from '@utils/node-graphs/utils/utils';

import { findInMap, createVersionedMap } from '@utils/collections/util';
import type { CollectionMessageTypes } from '@types';
import { getProducersOfMessage, getConsumersOfMessage } from '@utils/collections/services';
import { getEntityProducersOfMessage, getEntityConsumersOfMessage } from '@utils/collections/entities';
import { getPolicyChainNodesForCommand, getPolicyChainNodesForEvent } from '@utils/node-graphs/utils/policy-chain';
import { getViewActorChainNodesForEvent, getViewActorChainNodesForCommand } from '@utils/node-graphs/utils/view-actor-chain';

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
  const [entities, services, events, commands, queries, channels, policies, views, actors] = await Promise.all([
    getCollection('entities'),
    getCollection('services'),
    getCollection('events'),
    getCollection('commands'),
    getCollection('queries'),
    getCollection('channels'),
    getCollection('policies'),
    getCollection('views'),
    getCollection('actors'),
  ]);

  const allMessages = [...events, ...commands, ...queries];
  const entityMap = createVersionedMap(entities);
  const messageMap = createVersionedMap(allMessages);
  const channelMap = createVersionedMap(channels);
  const eventMap = createVersionedMap(events);
  const commandMap = createVersionedMap(commands);
  const actorMap = createVersionedMap(actors);

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
  const entityNodeId = generateIdForNode(entity);
  nodes.push({
    id: entityNodeId,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { mode, entity: { ...entity.data } },
    position: { x: 0, y: 0 },
    type: 'entities',
  });

  // ── RECEIVES SIDE ──
  // For each received message: [producers] → message → [entity's channel] → entity
  for (const message of receives) {
    const messageId = generateIdForNode(message);
    const receiveConfig = receivesRaw.find((r) => r.id === message.data.id);
    const fromChannels = receiveConfig?.from ?? [];

    // Create message node
    nodes.push(
      createNode({
        id: messageId,
        type: message.collection,
        data: { mode, message: { ...message.data } },
        position: { x: 0, y: 0 },
      })
    );

    // Create channel nodes and edges: message → channel → entity
    // Use a distinct node ID suffix so receives-side channels don't merge with sends-side channels
    if (fromChannels.length > 0) {
      for (const channelRef of fromChannels) {
        const channel = findInMap(channelMap, channelRef.id, channelRef.version);
        if (!channel) continue;

        const channelId = generateIdForNode(channel) + '-recv';

        nodes.push(
          createNode({
            id: channelId,
            type: 'channels',
            data: { mode, channel: { ...channel.data } },
            position: { x: 0, y: 0 },
          })
        );

        // message → channel
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, channel) + '-recv',
            source: messageId,
            target: channelId,
            label: 'routes to',
            data: { customColor: getColorFromString(message.data.id) },
          })
        );

        // channel → entity
        edges.push(
          createEdge({
            id: generatedIdForEdge(channel, entity) + '-recv',
            source: channelId,
            target: entityNodeId,
            label: getReceivesLabelByMessageType(message.collection),
            data: { customColor: getColorFromString(message.data.id) },
          })
        );
      }
    } else {
      // No channel — message → entity directly
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, entity),
          source: messageId,
          target: entityNodeId,
          label: getReceivesLabelByMessageType(message.collection),
          data: { customColor: getColorFromString(message.data.id) },
        })
      );
    }

    // Service producers → message
    const serviceProducers = getProducersOfMessage(services, message);
    for (const producer of serviceProducers) {
      nodes.push(
        createNode({
          id: generateIdForNode(producer),
          type: 'services',
          data: { mode, service: { ...producer.data } },
          position: { x: 0, y: 0 },
        })
      );

      edges.push(
        createEdge({
          id: generatedIdForEdge(producer, message),
          source: generateIdForNode(producer),
          target: messageId,
          label: getEdgeLabelForServiceAsTarget(message),
          data: { customColor: getColorFromString(message.data.id) },
        })
      );
    }

    // Entity producers → message (filter self)
    const entityProducers = getEntityProducersOfMessage(entities, message).filter(
      (ep) => !(ep.data.id === entity.data.id && ep.data.version === entity.data.version)
    );
    for (const ep of entityProducers) {
      nodes.push(
        createNode({
          id: generateIdForNode(ep),
          type: 'entities',
          data: { mode, entity: { ...ep.data } },
          position: { x: 0, y: 0 },
        })
      );

      edges.push(
        createEdge({
          id: generatedIdForEdge(ep, message),
          source: generateIdForNode(ep),
          target: messageId,
          label: 'emits',
          data: { customColor: getColorFromString(message.data.id) },
        })
      );
    }

    // Policy chain for commands: policies that dispatch this command → events triggering those policies → terminal producers
    if (message.collection === 'commands') {
      const { nodes: chainNodes, edges: chainEdges } = getPolicyChainNodesForCommand({
        message,
        messageNodeId: messageId,
        policies,
        eventMap,
        services,
        entities,
        mode,
        selfFilterEntity: { id: entity.data.id, version: entity.data.version, collection: 'entities' },
      });
      nodes.push(...chainNodes);
      edges.push(...chainEdges);

      // View/Actor chain for commands: actors that issue this command ← views they read
      const { nodes: vaNodes, edges: vaEdges } = getViewActorChainNodesForCommand({
        message,
        messageNodeId: messageId,
        actors,
        viewMap: createVersionedMap(views),
        mode,
      });
      nodes.push(...vaNodes);
      edges.push(...vaEdges);
    }
  }

  // ── SENDS SIDE ──
  // For each sent message: entity → message → [entity's channel] → [consumers]
  for (const message of sends) {
    const messageId = generateIdForNode(message);
    const sendConfig = sendsRaw.find((s) => s.id === message.data.id);
    const toChannels = sendConfig?.to ?? [];

    // Create message node
    nodes.push(
      createNode({
        id: messageId,
        type: message.collection,
        data: { mode, message: { ...message.data } },
        position: { x: 0, y: 0 },
      })
    );

    // Entity → message
    edges.push(
      createEdge({
        id: generatedIdForEdge(entity, message),
        source: entityNodeId,
        target: messageId,
        label: 'emits',
        data: { customColor: getColorFromString(message.data.id) },
      })
    );

    // Determine consumer connection point: if exactly 1 to-channel, consumers connect from the channel
    let consumerSourceId = messageId;
    let consumerSourceEntry: CollectionEntry<'channels'> | CollectionEntry<CollectionMessageTypes> = message;

    // Create channel nodes and edges: message → channel
    if (toChannels.length > 0) {
      for (const channelRef of toChannels) {
        const channel = findInMap(channelMap, channelRef.id, channelRef.version);
        if (!channel) continue;

        const channelId = generateIdForNode(channel);

        nodes.push(
          createNode({
            id: channelId,
            type: 'channels',
            data: { mode, channel: { ...channel.data } },
            position: { x: 0, y: 0 },
          })
        );

        // message → channel
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, channel),
            source: messageId,
            target: channelId,
            label: 'routes to',
            data: { customColor: getColorFromString(message.data.id) },
          })
        );

        // If exactly 1 to-channel, consumers will connect from it
        if (toChannels.length === 1) {
          consumerSourceId = channelId;
          consumerSourceEntry = channel;
        }
      }
    }

    // Service consumers: connect from channel (if 1) or message
    const serviceConsumers = getConsumersOfMessage(services, message);

    for (const consumer of serviceConsumers) {
      const consumerId = generateIdForNode(consumer);

      nodes.push(
        createNode({
          id: consumerId,
          type: 'services',
          data: { mode, service: { ...consumer.data } },
          position: { x: 0, y: 0 },
        })
      );

      edges.push(
        createEdge({
          id: generatedIdForEdge(consumerSourceEntry, consumer),
          source: consumerSourceId,
          target: consumerId,
          label: getEdgeLabelForMessageAsSource(message),
          data: { customColor: getColorFromString(message.data.id) },
        })
      );
    }

    // Entity consumers: connect from channel (if 1) or message (filter self)
    const entityConsumers = getEntityConsumersOfMessage(entities, message).filter(
      (ec) => !(ec.data.id === entity.data.id && ec.data.version === entity.data.version)
    );

    for (const ec of entityConsumers) {
      const ecId = generateIdForNode(ec);

      nodes.push(
        createNode({
          id: ecId,
          type: 'entities',
          data: { mode, entity: { ...ec.data } },
          position: { x: 0, y: 0 },
        })
      );

      edges.push(
        createEdge({
          id: generatedIdForEdge(consumerSourceEntry, ec),
          source: consumerSourceId,
          target: ecId,
          label: 'subscribes to',
          data: { customColor: getColorFromString(message.data.id) },
        })
      );
    }

    // Policy chain for events: policies triggered by this event → commands they dispatch → terminal consumers
    if (message.collection === 'events') {
      const { nodes: chainNodes, edges: chainEdges } = getPolicyChainNodesForEvent({
        message,
        messageNodeId: messageId,
        policies,
        commandMap,
        services,
        entities,
        mode,
        selfFilterEntity: { id: entity.data.id, version: entity.data.version, collection: 'entities' },
      });
      nodes.push(...chainNodes);
      edges.push(...chainEdges);

      // View/Actor chain for events: views subscribing to this event → actors they inform
      const { nodes: vaNodes, edges: vaEdges } = getViewActorChainNodesForEvent({
        message,
        messageNodeId: messageId,
        views,
        actorMap,
        mode,
      });
      nodes.push(...vaNodes);
      edges.push(...vaEdges);
    }
  }

  // Deduplicate nodes and edges
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
