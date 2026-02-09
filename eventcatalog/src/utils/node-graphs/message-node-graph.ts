// import { getColor } from '@utils/colors';
import { getEvents } from '@utils/collections/events';
import { getCollection, type CollectionEntry } from 'astro:content';
import dagre from 'dagre';
import {
  calculatedNodes,
  createDagreGraph,
  createEdge,
  generatedIdForEdge,
  generateIdForNode,
  getColorFromString,
  getEdgeLabelForMessageAsSource,
  getEdgeLabelForServiceAsTarget,
} from './utils/utils';
import { MarkerType, type Node, type Edge } from '@xyflow/react';
import {
  findMatchingNodes,
  getItemsFromCollectionByIdAndSemverOrLatest,
  getLatestVersionInCollectionById,
  createVersionedMap,
  findInMap,
} from '@utils/collections/util';
import type { CollectionMessageTypes } from '@types';
import { getCommands } from '@utils/collections/commands';
import { getQueries } from '@utils/collections/queries';
import { createNode } from './utils/utils';
import { getConsumersOfMessage, getProducersOfMessage } from '@utils/collections/services';
import { getEntityProducersOfMessage, getEntityConsumersOfMessage } from '@utils/collections/entities';
import { getPolicyChainNodesForCommand, getPolicyChainNodesForEvent, fullEdgeData } from '@utils/node-graphs/utils/policy-chain';
import {
  getViewActorChainNodesForEvent,
  getViewActorChainNodesForCommand,
  viewActorFullEdgeData,
} from '@utils/node-graphs/utils/view-actor-chain';
import { getNodesAndEdgesForChannelChain } from './channel-node-graph';
import { getChannelChain, isChannelsConnected } from '@utils/collections/channels';
import { getChannels } from '@utils/collections/channels';

type DagreGraph = any;

interface Props {
  id: string;
  version: string;
  defaultFlow?: DagreGraph;
  mode?: 'simple' | 'full';
  channelRenderMode?: 'flat' | 'single';
  collection?: CollectionEntry<CollectionMessageTypes>[];
  channels?: CollectionEntry<'channels'>[];
  // For expanding policy chains: show dispatched commands and their terminal consumers (event pages)
  policyChainCommands?: CollectionEntry<'commands'>[];
  // For expanding policy chains: show triggering events and their terminal producers (command pages)
  policyChainEvents?: CollectionEntry<'events'>[];
  // For expanding view/actor chains on event pages
  viewActorChainViews?: CollectionEntry<'views'>[];
  viewActorChainActors?: CollectionEntry<'actors'>[];
}

const getNodesAndEdges = async ({
  id,
  version,
  defaultFlow,
  mode = 'simple',
  channelRenderMode = 'flat',
  collection = [],
  channels = [],
  policyChainCommands,
  policyChainEvents,
  viewActorChainViews,
  viewActorChainActors,
}: Props) => {
  const flow = defaultFlow || createDagreGraph({ ranksep: 300, nodesep: 50 });
  const nodes = [] as any,
    edges = [] as any;

  const message = collection.find((message) => {
    return message.data.id === id && message.data.version === version;
  });

  // Nothing found...
  if (!message) {
    return {
      nodes: [],
      edges: [],
    };
  }

  // Pre-calculate channel map for O(1) lookups
  const channelMap = createVersionedMap(channels);

  // We always render the message itself
  nodes.push({
    id: generateIdForNode(message),
    sourcePosition: 'right',
    targetPosition: 'left',
    data: {
      mode,
      message: {
        ...message.data,
      },
    },
    position: { x: 0, y: 0 },
    type: message.collection,
  });

  const producers =
    (message.data.producers as (
      | CollectionEntry<'services'>
      | CollectionEntry<'data-products'>
      | CollectionEntry<'entities'>
      | CollectionEntry<'policies'>
    )[]) || [];
  const consumers =
    (message.data.consumers as (
      | CollectionEntry<'services'>
      | CollectionEntry<'data-products'>
      | CollectionEntry<'entities'>
      | CollectionEntry<'policies'>
    )[]) || [];

  // Track nodes that are both sent and received (only for services)
  const serviceProducers = producers.filter((p) => p.collection === 'services') as CollectionEntry<'services'>[];
  const serviceConsumers = consumers.filter((c) => c.collection === 'services') as CollectionEntry<'services'>[];
  const bothSentAndReceived = findMatchingNodes(serviceProducers, serviceConsumers);

  for (const producer of producers) {
    const isDataProduct = producer.collection === 'data-products';
    const isEntity = producer.collection === 'entities';
    const isPolicy = producer.collection === 'policies';

    // Create the producer node with appropriate data structure
    const getProducerNodeData = () => {
      if (isDataProduct) return { mode, dataProduct: { ...producer.data } };
      if (isEntity) return { mode, entity: { ...producer.data } };
      if (isPolicy) return { mode, policy: { ...producer.data } };
      return { mode, service: { ...producer.data } };
    };

    nodes.push({
      id: generateIdForNode(producer),
      type: isDataProduct ? 'data-products' : producer?.collection,
      sourcePosition: 'right',
      targetPosition: 'left',
      data: getProducerNodeData(),
      position: { x: 250, y: 0 },
    });

    // Data products don't have channel configuration, so connect directly to the message
    if (isDataProduct) {
      const rootSourceAndTarget = {
        source: { id: generateIdForNode(producer), collection: producer.collection },
        target: { id: generateIdForNode(message), collection: message.collection },
      };

      edges.push({
        id: generatedIdForEdge(producer, message),
        source: generateIdForNode(producer),
        target: generateIdForNode(message),
        label: 'produces',
        data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 40,
          height: 40,
        },
      });
      continue;
    }

    // Policies as producers (command pages): expand chain to show triggering events and their producers
    if (isPolicy) {
      edges.push({
        id: generatedIdForEdge(producer, message),
        source: generateIdForNode(producer),
        target: generateIdForNode(message),
        label: 'dispatches',
        data: {
          customColor: getColorFromString(message.data.id),
          rootSourceAndTarget: {
            source: { id: generateIdForNode(producer), collection: producer.collection },
            target: { id: generateIdForNode(message), collection: message.collection },
          },
        },
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 40, height: 40 },
      });

      // Expand: show events that trigger this policy and their producers
      if (policyChainEvents) {
        const policyReceives = (producer.data as any).receives || [];
        for (const receive of policyReceives) {
          const event = policyChainEvents.find(
            (e: any) =>
              e.data.id === receive.id && (!receive.version || receive.version === 'latest' || e.data.version === receive.version)
          );
          if (!event) continue;

          // Create event node
          nodes.push(
            createNode({
              id: generateIdForNode(event),
              type: event.collection,
              data: { mode, message: { ...event.data } },
              position: { x: 0, y: 0 },
            })
          );

          // Edge: Event --triggers--> Policy
          edges.push(
            createEdge({
              id: generatedIdForEdge(event, producer),
              source: generateIdForNode(event),
              target: generateIdForNode(producer),
              label: 'triggers',
              data: {
                customColor: getColorFromString(event.data.id),
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(event), collection: event.collection },
                  target: { id: generateIdForNode(producer), collection: producer.collection },
                },
              },
            })
          );

          // Find terminal producers of the event (services, entities, data-products — not policies)
          const eventProducers = (event.data.producers || []).filter((p: any) => p.collection !== 'policies');
          for (const terminalProducer of eventProducers) {
            const isTermEntity = terminalProducer.collection === 'entities';
            const isTermDP = terminalProducer.collection === 'data-products';
            const termNodeData = isTermEntity
              ? { mode, entity: { ...terminalProducer.data } }
              : isTermDP
                ? { mode, dataProduct: { ...terminalProducer.data } }
                : { mode, service: { ...terminalProducer.data } };

            nodes.push(
              createNode({
                id: generateIdForNode(terminalProducer),
                type: isTermDP ? 'data-products' : terminalProducer.collection,
                data: termNodeData,
                position: { x: 0, y: 0 },
              })
            );

            edges.push(
              createEdge({
                id: generatedIdForEdge(terminalProducer, event),
                source: generateIdForNode(terminalProducer),
                target: generateIdForNode(event),
                label: isTermEntity ? 'emits' : getEdgeLabelForServiceAsTarget(event),
                data: {
                  customColor: getColorFromString(event.data.id),
                  rootSourceAndTarget: {
                    source: { id: generateIdForNode(terminalProducer), collection: terminalProducer.collection },
                    target: { id: generateIdForNode(event), collection: event.collection },
                  },
                },
              })
            );
          }
        }
      }
      continue;
    }

    // Service and entity channel handling (both support sends.to configuration)
    const serviceOrEntityProducer = producer as CollectionEntry<'services'> | CollectionEntry<'entities'>;

    // Is the producer sending this message to a channel?
    const producerConfigurationForMessage = serviceOrEntityProducer.data.sends?.find((send) => send.id === message.data.id);
    const producerChannelConfiguration = producerConfigurationForMessage?.to ?? [];

    const producerHasChannels = producerChannelConfiguration?.length > 0;

    const rootSourceAndTarget = {
      source: { id: generateIdForNode(producer), collection: producer.collection },
      target: { id: generateIdForNode(message), collection: message.collection },
    };

    // If the producer does not have any channels defined, then we just connect the producer to the event directly
    if (!producerHasChannels) {
      edges.push({
        id: generatedIdForEdge(producer, message),
        source: generateIdForNode(producer),
        target: generateIdForNode(message),
        label: isEntity ? 'emits' : getEdgeLabelForServiceAsTarget(message),
        data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 40,
          height: 40,
        },
      });
      continue;
    }

    // If the producer has channels defined, we need to render them
    for (const producerChannel of producerChannelConfiguration) {
      const channel = findInMap(channelMap, producerChannel.id, producerChannel.version) as CollectionEntry<'channels'>;

      // If we cannot find the channel in EventCatalog, we just connect the producer to the event directly
      if (!channel) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(producer, message),
            source: generateIdForNode(producer),
            target: generateIdForNode(message),
            label: getEdgeLabelForMessageAsSource(message),
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
        continue;
      }

      // We render the channel node
      nodes.push(
        createNode({
          id: generateIdForNode(channel),
          type: channel.collection,
          data: { mode, channel: { ...channel.data } },
          position: { x: 0, y: 0 },
        })
      );

      // Connect the producer to the message
      edges.push(
        createEdge({
          id: generatedIdForEdge(producer, message),
          source: generateIdForNode(producer),
          target: generateIdForNode(message),
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          label: isEntity ? 'emits' : getEdgeLabelForServiceAsTarget(message),
        })
      );

      // Connect the message to the channel
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, channel),
          source: generateIdForNode(message),
          target: generateIdForNode(channel),
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          label: 'routes to',
        })
      );
    }
  }

  // The messages the service sends
  for (const consumer of consumers) {
    const isDataProduct = consumer.collection === 'data-products';
    const isEntity = consumer.collection === 'entities';
    const isPolicy = consumer.collection === 'policies';

    // Create the consumer node with appropriate data structure
    const getConsumerNodeData = () => {
      if (isDataProduct) return { title: consumer?.data.id, mode, dataProduct: { ...consumer.data } };
      if (isEntity) return { title: consumer?.data.id, mode, entity: { ...consumer.data } };
      if (isPolicy) return { title: consumer?.data.id, mode, policy: { ...consumer.data } };
      return { title: consumer?.data.id, mode, service: { ...consumer.data } };
    };

    // Render the consumer node with appropriate data structure
    nodes.push({
      id: generateIdForNode(consumer),
      sourcePosition: 'right',
      targetPosition: 'left',
      data: getConsumerNodeData(),
      position: { x: 0, y: 0 },
      type: isDataProduct ? 'data-products' : consumer?.collection,
    });

    // Data products don't have channel configuration, so connect directly from the message
    if (isDataProduct) {
      const rootSourceAndTarget = {
        source: { id: generateIdForNode(message), collection: message.collection },
        target: { id: generateIdForNode(consumer), collection: consumer.collection },
      };

      edges.push(
        createEdge({
          id: generatedIdForEdge(message, consumer),
          source: generateIdForNode(message),
          target: generateIdForNode(consumer),
          label: 'consumed by',
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        })
      );
      continue;
    }

    // Policies as consumers (event pages): expand chain to show dispatched commands and their consumers
    if (isPolicy) {
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, consumer),
          source: generateIdForNode(message),
          target: generateIdForNode(consumer),
          label: 'triggers',
          data: {
            customColor: getColorFromString(message.data.id),
            rootSourceAndTarget: {
              source: { id: generateIdForNode(message), collection: message.collection },
              target: { id: generateIdForNode(consumer), collection: consumer.collection },
            },
          },
        })
      );

      // Expand: show commands the policy dispatches and their consumers
      if (policyChainCommands) {
        const policySends = (consumer.data as any).sends || [];
        for (const send of policySends) {
          const command = policyChainCommands.find(
            (c: any) => c.data.id === send.id && (!send.version || send.version === 'latest' || c.data.version === send.version)
          );
          if (!command) continue;

          // Create command node
          nodes.push(
            createNode({
              id: generateIdForNode(command),
              type: command.collection,
              data: { mode, message: { ...command.data } },
              position: { x: 0, y: 0 },
            })
          );

          // Edge: Policy --dispatches--> Command
          edges.push(
            createEdge({
              id: generatedIdForEdge(consumer, command),
              source: generateIdForNode(consumer),
              target: generateIdForNode(command),
              label: 'dispatches',
              data: {
                customColor: getColorFromString(command.data.id),
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(consumer), collection: consumer.collection },
                  target: { id: generateIdForNode(command), collection: command.collection },
                },
              },
            })
          );

          // Find terminal consumers of the command (services, entities, data-products — not policies)
          const commandConsumers = (command.data.consumers || []).filter((c: any) => c.collection !== 'policies');
          for (const terminalConsumer of commandConsumers) {
            const isTermEntity = terminalConsumer.collection === 'entities';
            const isTermDP = terminalConsumer.collection === 'data-products';
            const termNodeData = isTermEntity
              ? { mode, entity: { ...terminalConsumer.data } }
              : isTermDP
                ? { mode, dataProduct: { ...terminalConsumer.data } }
                : { mode, service: { ...terminalConsumer.data } };

            nodes.push(
              createNode({
                id: generateIdForNode(terminalConsumer),
                type: isTermDP ? 'data-products' : terminalConsumer.collection,
                data: termNodeData,
                position: { x: 0, y: 0 },
              })
            );

            edges.push(
              createEdge({
                id: generatedIdForEdge(command, terminalConsumer),
                source: generateIdForNode(command),
                target: generateIdForNode(terminalConsumer),
                label: isTermEntity ? 'subscribes to' : getEdgeLabelForMessageAsSource(command),
                data: {
                  customColor: getColorFromString(command.data.id),
                  rootSourceAndTarget: {
                    source: { id: generateIdForNode(command), collection: command.collection },
                    target: { id: generateIdForNode(terminalConsumer), collection: terminalConsumer.collection },
                  },
                },
              })
            );
          }
        }
      }
      continue;
    }

    // Service and entity channel handling (both support receives.from configuration)
    const serviceOrEntityConsumer = consumer as CollectionEntry<'services'> | CollectionEntry<'entities'>;

    // Is the consumer receiving this message from a channel?
    const consumerConfigurationForMessage = serviceOrEntityConsumer.data.receives?.find(
      (receive) => receive.id === message.data.id
    );
    const consumerChannelConfiguration = consumerConfigurationForMessage?.from ?? [];

    const consumerHasChannels = consumerChannelConfiguration.length > 0;

    const rootSourceAndTarget = {
      source: { id: generateIdForNode(message), collection: message.collection },
      target: { id: generateIdForNode(consumer), collection: consumer.collection },
    };

    // If the consumer does not have any channels defined, connect the consumer to the event directly
    if (!consumerHasChannels) {
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, consumer),
          source: generateIdForNode(message),
          target: generateIdForNode(consumer),
          label: isEntity ? 'subscribes to' : getEdgeLabelForMessageAsSource(message),
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        })
      );
    }

    // If the consumer has channels defined, we try and render them
    for (const consumerChannel of consumerChannelConfiguration) {
      const channel = findInMap(channelMap, consumerChannel.id, consumerChannel.version) as CollectionEntry<'channels'>;

      // If we cannot find the channel in EventCatalog, we connect the message directly to the consumer
      if (!channel) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, consumer),
            source: generateIdForNode(message),
            target: generateIdForNode(consumer),
            label: getEdgeLabelForMessageAsSource(message),
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
        continue;
      }

      // Can any of the consumer channels be linked to any of the producer channels?
      // Consider both service and entity producers for channel linking (data products don't have sends/receives)
      const entityProducers = producers.filter((p) => p.collection === 'entities') as CollectionEntry<'entities'>[];
      const allProducersWithChannels = [...serviceProducers, ...entityProducers];
      const producerChannels = allProducersWithChannels
        .map((producer) => producer.data.sends?.find((send) => send.id === message.data.id)?.to ?? [])
        .flat();
      const consumerChannels =
        serviceOrEntityConsumer.data.receives?.find((receive) => receive.id === message.data.id)?.from ?? [];

      for (const producerChannel of producerChannels) {
        const producerChannelValue = findInMap(
          channelMap,
          producerChannel.id,
          producerChannel.version
        ) as CollectionEntry<'channels'>;

        // Skip if producer channel not found in catalog
        if (!producerChannelValue) continue;

        for (const consumerChannel of consumerChannels) {
          const consumerChannelValue = findInMap(
            channelMap,
            consumerChannel.id,
            consumerChannel.version
          ) as CollectionEntry<'channels'>;

          // Skip if consumer channel not found in catalog
          if (!consumerChannelValue) continue;

          const channelChainToRender = getChannelChain(producerChannelValue, consumerChannelValue, channels);

          // If there is a chain between them we need to render them al
          if (channelChainToRender.length > 0) {
            const { nodes: channelNodes, edges: channelEdges } = getNodesAndEdgesForChannelChain({
              source: message,
              target: consumer,
              channelChain: channelChainToRender,
              mode,
            });

            nodes.push(...channelNodes);
            edges.push(...channelEdges);
          } else {
            // There is no chain found, we need to render the channel between message and the consumers
            nodes.push(
              createNode({
                id: generateIdForNode(channel),
                type: channel.collection,
                data: { mode, channel: { ...channel.data } },
                position: { x: 0, y: 0 },
              })
            );
            edges.push(
              createEdge({
                id: generatedIdForEdge(message, channel),
                source: generateIdForNode(message),
                target: generateIdForNode(channel),
                label: 'routes to',
                data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
              })
            );
            edges.push(
              createEdge({
                id: generatedIdForEdge(channel, consumer),
                source: generateIdForNode(channel),
                target: generateIdForNode(consumer),
                label: isEntity ? 'subscribes to' : getEdgeLabelForMessageAsSource(message),
                data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
              })
            );
          }
        }
      }

      // If producer does not have a any channels defined, we need to connect the message to the consumer directly
      if (producerChannels.length === 0 && channel) {
        // Create the channel node
        nodes.push(
          createNode({
            id: generateIdForNode(channel),
            type: channel.collection,
            data: { mode, channel: { ...channel.data } },
            position: { x: 0, y: 0 },
          })
        );

        // Connect the message to the channel
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, channel),
            source: generateIdForNode(message),
            target: generateIdForNode(channel),
            label: 'routes to',
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );

        // Connect the channel to the consumer
        edges.push(
          createEdge({
            id: generatedIdForEdge(channel, consumer),
            source: generateIdForNode(channel),
            target: generateIdForNode(consumer),
            label: isEntity ? 'subscribes to' : getEdgeLabelForMessageAsSource(message),
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
      }
    }
  }

  // Handle messages that are both sent and received
  bothSentAndReceived.forEach((_message) => {
    if (message) {
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, _message) + '-both',
          source: generateIdForNode(message),
          target: generateIdForNode(_message),
          label: 'publishes and subscribes',
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget: { source: message, target: _message } },
        })
      );
    }
  });

  // View/Actor chain expansion for event pages: views subscribing → actors they inform
  if (message.collection === 'events' && viewActorChainViews && viewActorChainActors) {
    const actorMap = createVersionedMap(viewActorChainActors);
    const { nodes: vaNodes, edges: vaEdges } = getViewActorChainNodesForEvent({
      message: message as CollectionEntry<'events'>,
      messageNodeId: generateIdForNode(message),
      views: viewActorChainViews,
      actorMap,
      mode,
      edgeData: viewActorFullEdgeData,
    });
    nodes.push(...vaNodes);
    edges.push(...vaEdges);
  }

  // View/Actor chain expansion for command pages: actors issuing ← views they read
  if (message.collection === 'commands' && viewActorChainActors && viewActorChainViews) {
    const viewMap = createVersionedMap(viewActorChainViews);
    const { nodes: vaNodes, edges: vaEdges } = getViewActorChainNodesForCommand({
      message: message as CollectionEntry<'commands'>,
      messageNodeId: generateIdForNode(message),
      actors: viewActorChainActors,
      viewMap,
      mode,
      edgeData: viewActorFullEdgeData,
    });
    nodes.push(...vaNodes);
    edges.push(...vaEdges);
  }

  // Dedup nodes and edges (policy/view-actor chain expansion can create duplicates)
  const uniqueNodes = nodes.filter(
    (node: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === node.id)
  );
  const uniqueEdges = edges.filter(
    (edge: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === edge.id)
  );

  uniqueNodes.forEach((node: any) => {
    flow.setNode(node.id, { width: 150, height: 100 });
  });

  uniqueEdges.forEach((edge: any) => {
    flow.setEdge(edge.source, edge.target);
  });

  // Render the diagram in memory getting hte X and Y
  dagre.layout(flow);

  return {
    nodes: calculatedNodes(flow, uniqueNodes),
    edges: uniqueEdges,
  };
};

export const getNodesAndEdgesForQueries = async ({
  id,
  version,
  defaultFlow,
  mode = 'simple',
  channelRenderMode = 'flat',
}: Props) => {
  const [queries, channels] = await Promise.all([getQueries(), getChannels()]);
  return getNodesAndEdges({ id, version, defaultFlow, mode, channelRenderMode, collection: queries, channels });
};

export const getNodesAndEdgesForCommands = async ({
  id,
  version,
  defaultFlow,
  mode = 'simple',
  channelRenderMode = 'flat',
}: Props) => {
  const [commands, channels, events, views, actors] = await Promise.all([
    getCommands(),
    getChannels(),
    getEvents(),
    getCollection('views').then((r) => r.filter((v) => v.data.hidden !== true)),
    getCollection('actors').then((r) => r.filter((a) => a.data.hidden !== true)),
  ]);
  return getNodesAndEdges({
    id,
    version,
    defaultFlow,
    mode,
    channelRenderMode,
    collection: commands,
    channels,
    policyChainEvents: events,
    viewActorChainViews: views,
    viewActorChainActors: actors,
  });
};

export const getNodesAndEdgesForEvents = async ({
  id,
  version,
  defaultFlow,
  mode = 'simple',
  channelRenderMode = 'flat',
}: Props) => {
  const [events, channels, commands, views, actors] = await Promise.all([
    getEvents(),
    getChannels(),
    getCommands(),
    getCollection('views').then((r) => r.filter((v) => v.data.hidden !== true)),
    getCollection('actors').then((r) => r.filter((a) => a.data.hidden !== true)),
  ]);
  return getNodesAndEdges({
    id,
    version,
    defaultFlow,
    mode,
    channelRenderMode,
    collection: events,
    channels,
    policyChainCommands: commands,
    viewActorChainViews: views,
    viewActorChainActors: actors,
  });
};

export const getNodesAndEdgesForConsumedMessage = ({
  message,
  targetChannels = [],
  services,
  channels,
  currentNodes = [],
  target,
  mode = 'simple',
  channelMap,
  entities,
  policies,
  allEvents,
  actors,
  allViews,
}: {
  message: CollectionEntry<CollectionMessageTypes>;
  targetChannels?: { id: string; version: string }[];
  services: CollectionEntry<'services'>[];
  channels: CollectionEntry<'channels'>[];
  currentNodes: Node[];
  target: CollectionEntry<'services'> | CollectionEntry<'entities'> | CollectionEntry<'policies'> | CollectionEntry<'views'> | CollectionEntry<'actors'>;
  mode?: 'simple' | 'full';
  channelMap?: Map<string, CollectionEntry<'channels'>[]>;
  entities?: CollectionEntry<'entities'>[];
  policies?: CollectionEntry<'policies'>[];
  allEvents?: CollectionEntry<'events'>[];
  actors?: CollectionEntry<'actors'>[];
  allViews?: CollectionEntry<'views'>[];
}) => {
  let nodes = [] as Node[],
    edges = [] as any;

  // Use the provided map or create one if missing
  const map = channelMap || createVersionedMap(channels);

  const messageId = generateIdForNode(message);

  const rootSourceAndTarget = {
    source: { id: generateIdForNode(message), collection: message.collection },
    target: { id: generateIdForNode(target), collection: target.collection },
  };

  // Render the message node
  nodes.push(
    createNode({
      id: messageId,
      type: message.collection,
      data: { mode, message: { ...message.data } },
      position: { x: 0, y: 0 },
    })
  );

  // Render the target node (can be service, entity, policy, view, or actor)
  const isTargetEntity = target.collection === 'entities';
  const isTargetPolicy = target.collection === 'policies';
  const isTargetView = target.collection === 'views';
  const isTargetActor = target.collection === 'actors';
  const targetNodeData = isTargetEntity
    ? { mode, entity: { ...target.data } }
    : isTargetPolicy
      ? { mode, policy: { ...target.data } }
      : isTargetView
        ? { mode, view: { ...target.data } }
        : isTargetActor
          ? { mode, actor: { ...target.data } }
          : { mode, service: { ...target.data } };
  nodes.push(
    createNode({
      id: generateIdForNode(target),
      type: isTargetView ? 'view' : isTargetActor ? 'actor' : target.collection,
      data: targetNodeData,
      position: { x: 0, y: 0 },
    })
  );

  const targetMessageConfiguration =
    target.collection !== 'views' && target.collection !== 'actors'
      ? target.data.receives?.find((receive) => receive.id === message.data.id)
      : undefined;
  const channelsFromMessageToTarget = targetMessageConfiguration?.from ?? [];
  const hydratedChannelsFromMessageToTarget = channelsFromMessageToTarget
    .map((channel) => findInMap(map, channel.id, channel.version))
    .filter((channel): channel is CollectionEntry<'channels'> => channel !== undefined);

  // Now we get the producers of the message and create nodes and edges for them
  const producers = getProducersOfMessage(services, message);

  const hasProducers = producers.length > 0;
  const targetHasDefinedChannels = targetChannels.length > 0;

  // Warning edge if no producers or target channels are defined
  if (!hasProducers && !targetHasDefinedChannels) {
    edges.push(
      createEdge({
        id: generatedIdForEdge(message, target) + '-warning',
        source: messageId,
        target: generateIdForNode(target),
        label: getEdgeLabelForMessageAsSource(message),
        data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
      })
    );
  }

  // If the target defined channels they consume the message from, we need to create the channel nodes and edges
  if (targetHasDefinedChannels) {
    for (const targetChannel of targetChannels) {
      const channel = findInMap(map, targetChannel.id, targetChannel.version) as CollectionEntry<'channels'>;

      if (!channel) {
        // No channe found, we just connect the message to the target directly
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, target),
            source: messageId,
            target: generateIdForNode(target),
            label: getEdgeLabelForMessageAsSource(message),
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
        continue;
      }

      const channelId = generateIdForNode(channel);

      // Create the channel node
      nodes.push(
        createNode({
          id: channelId,
          type: channel.collection,
          data: { mode, channel: { ...channel.data, ...channel, id: channel.data.id } },
          position: { x: 0, y: 0 },
        })
      );

      // Connect the channel to the target
      edges.push(
        createEdge({
          id: generatedIdForEdge(channel, target),
          source: channelId,
          target: generateIdForNode(target),
          label: getEdgeLabelForMessageAsSource(message),
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        })
      );

      // If we dont have any producers, we will connect the message to the channel directly
      if (producers.length === 0) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, channel),
            source: messageId,
            target: channelId,
            label: 'routes to',
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
      }
    }
  }

  // Process the producers for the message
  for (const producer of producers) {
    const producerId = generateIdForNode(producer);

    // Create the producer node
    nodes.push(
      createNode({
        id: producerId,
        type: producer.collection,
        data: { mode, service: { ...producer.data } },
        position: { x: 0, y: 0 },
      })
    );

    // The message is always connected directly to the producer
    edges.push(
      createEdge({
        id: generatedIdForEdge(producer, message),
        source: producerId,
        target: messageId,
        label: getEdgeLabelForServiceAsTarget(message),
        data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
      })
    );

    // Check if the producer is sending the message to a channel
    const producerConfigurationForMessage = producer.data.sends?.find((send) => send.id === message.data.id);
    const producerChannelConfiguration = producerConfigurationForMessage?.to ?? [];

    const producerHasChannels = producerChannelConfiguration.length > 0;
    const targetHasChannels = hydratedChannelsFromMessageToTarget.length > 0;

    // If the producer or target (consumer) has no channels defined, we just connect the message to the consumer directly
    // of the target has no channels defined, we just connect the message to the target directly
    if ((!producerHasChannels && !targetHasChannels) || !targetHasChannels) {
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, target),
          source: messageId,
          target: generateIdForNode(target),
          label: getEdgeLabelForMessageAsSource(message),
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        })
      );
      continue;
    }

    // If the target has channels but the producer does not
    // We then connect the message to the channels directly
    if (targetHasChannels && !producerHasChannels) {
      for (const targetChannel of hydratedChannelsFromMessageToTarget) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, targetChannel),
            source: messageId,
            target: generateIdForNode(targetChannel),
            label: 'routes to',
            data: {
              customColor: getColorFromString(message.data.id),
              rootSourceAndTarget: {
                source: { id: generateIdForNode(message), collection: message.collection },
                target: { id: generateIdForNode(target), collection: target.collection },
              },
            },
          })
        );
      }
      continue;
    }

    // Process each producer channel configuration
    for (const producerChannel of producerChannelConfiguration) {
      const channel = findInMap(map, producerChannel.id, producerChannel.version) as CollectionEntry<'channels'>;

      // If we cannot find the channel in EventCatalog, we just connect the message to the target directly
      if (!channel) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, target),
            source: messageId,
            target: generateIdForNode(target),
            label: getEdgeLabelForMessageAsSource(message),
            data: {
              customColor: getColorFromString(message.data.id),
              rootSourceAndTarget: {
                source: { id: generateIdForNode(message), collection: message.collection },
                target: { id: generateIdForNode(target), collection: target.collection },
              },
            },
          })
        );
        continue;
      }

      // Does the producer have any channels defined? If not, we just connect the message to the target directly
      if (!producerHasChannels) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, target),
            source: messageId,
            target: generateIdForNode(target),
            label: getEdgeLabelForMessageAsSource(message),
            data: {
              customColor: getColorFromString(message.data.id),
              rootSourceAndTarget: {
                source: { id: generateIdForNode(message), collection: message.collection },
                target: { id: generateIdForNode(target), collection: target.collection },
              },
            },
          })
        );
        continue;
      }

      // The producer does have channels defined, we need to try and work out the path the message takes to the target
      for (const targetChannel of hydratedChannelsFromMessageToTarget) {
        const channelChainToRender = getChannelChain(channel, targetChannel, channels);
        if (channelChainToRender.length > 0) {
          const { nodes: channelNodes, edges: channelEdges } = getNodesAndEdgesForChannelChain({
            source: message,
            target: target,
            channelChain: channelChainToRender,
            mode,
          });

          nodes.push(...channelNodes);
          edges.push(...channelEdges);

          break;
        } else {
          // No chain found create the channel, and connect the message to the target channel directly
          nodes.push(
            createNode({
              id: generateIdForNode(targetChannel),
              type: targetChannel.collection,
              data: { mode, channel: { ...targetChannel.data, ...targetChannel } },
              position: { x: 0, y: 0 },
            })
          );
          edges.push(
            createEdge({
              id: generatedIdForEdge(message, targetChannel),
              source: messageId,
              target: generateIdForNode(targetChannel),
              label: 'routes to',
              data: {
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(message), collection: message.collection },
                  target: { id: generateIdForNode(targetChannel), collection: targetChannel.collection },
                },
              },
            })
          );
        }
      }
    }
  }

  // Process entity producers for the message (entities now support channel configuration)
  if (entities) {
    const entityProducers = getEntityProducersOfMessage(entities, message);
    // Filter out the target if it's an entity to avoid self-reference
    const filteredEntityProducers = entityProducers.filter(
      (entity) => !(isTargetEntity && entity.data.id === target.data.id && entity.data.version === target.data.version)
    );

    for (const entityProducer of filteredEntityProducers) {
      const entityProducerId = generateIdForNode(entityProducer);

      // Create the entity producer node
      nodes.push(
        createNode({
          id: entityProducerId,
          type: 'entities',
          data: { mode, entity: { ...entityProducer.data } },
          position: { x: 0, y: 0 },
        })
      );

      // Check if entity has channel configuration
      const entityProducerConfig = entityProducer.data.sends?.find((send) => send.id === message.data.id);
      const entityProducerChannels = entityProducerConfig?.to ?? [];
      const entityHasChannels = entityProducerChannels.length > 0;

      // Connect entity producer to message
      edges.push(
        createEdge({
          id: generatedIdForEdge(entityProducer, message),
          source: entityProducerId,
          target: messageId,
          label: 'emits',
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        })
      );

      const targetHasChannels = hydratedChannelsFromMessageToTarget.length > 0;

      // If neither entity producer nor target has channels, connect message directly to target
      if (!entityHasChannels && !targetHasChannels) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, target),
            source: messageId,
            target: generateIdForNode(target),
            label: getEdgeLabelForMessageAsSource(message),
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
        continue;
      }

      // If target has channels but entity producer doesn't, connect message to target channels directly
      if (targetHasChannels && !entityHasChannels) {
        for (const targetChannel of hydratedChannelsFromMessageToTarget) {
          edges.push(
            createEdge({
              id: generatedIdForEdge(message, targetChannel),
              source: messageId,
              target: generateIdForNode(targetChannel),
              label: 'routes to',
              data: {
                customColor: getColorFromString(message.data.id),
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(message), collection: message.collection },
                  target: { id: generateIdForNode(target), collection: target.collection },
                },
              },
            })
          );
        }
        continue;
      }

      // Entity producer has channels - process each one
      for (const entityChannel of entityProducerChannels) {
        const channel = findInMap(map, entityChannel.id, entityChannel.version) as CollectionEntry<'channels'>;

        // If channel not found, connect message directly to target
        if (!channel) {
          edges.push(
            createEdge({
              id: generatedIdForEdge(message, target),
              source: messageId,
              target: generateIdForNode(target),
              label: getEdgeLabelForMessageAsSource(message),
              data: {
                customColor: getColorFromString(message.data.id),
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(message), collection: message.collection },
                  target: { id: generateIdForNode(target), collection: target.collection },
                },
              },
            })
          );
          continue;
        }

        // If target has no channels, connect message directly to target
        if (!targetHasChannels) {
          edges.push(
            createEdge({
              id: generatedIdForEdge(message, target),
              source: messageId,
              target: generateIdForNode(target),
              label: getEdgeLabelForMessageAsSource(message),
              data: {
                customColor: getColorFromString(message.data.id),
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(message), collection: message.collection },
                  target: { id: generateIdForNode(target), collection: target.collection },
                },
              },
            })
          );
          continue;
        }

        // Both entity producer and target have channels - try to find channel chain
        for (const targetChannel of hydratedChannelsFromMessageToTarget) {
          const channelChainToRender = getChannelChain(channel, targetChannel, channels);
          if (channelChainToRender.length > 0) {
            const { nodes: channelNodes, edges: channelEdges } = getNodesAndEdgesForChannelChain({
              source: message,
              target: target,
              channelChain: channelChainToRender,
              mode,
            });

            nodes.push(...channelNodes);
            edges.push(...channelEdges);

            break;
          } else {
            // No chain found - create target channel node and connect message to it
            nodes.push(
              createNode({
                id: generateIdForNode(targetChannel),
                type: targetChannel.collection,
                data: { mode, channel: { ...targetChannel.data, ...targetChannel } },
                position: { x: 0, y: 0 },
              })
            );
            edges.push(
              createEdge({
                id: generatedIdForEdge(message, targetChannel),
                source: messageId,
                target: generateIdForNode(targetChannel),
                label: 'routes to',
                data: {
                  rootSourceAndTarget: {
                    source: { id: generateIdForNode(message), collection: message.collection },
                    target: { id: generateIdForNode(targetChannel), collection: targetChannel.collection },
                  },
                },
              })
            );
          }
        }
      }
    }
  }

  // Policy chain expansion: when target consumes a command, show policies that dispatch it,
  // the events that trigger those policies, and the terminal producers of those events
  if (policies && allEvents && message.collection === 'commands') {
    const policyEventMap = createVersionedMap(allEvents);
    const { nodes: chainNodes, edges: chainEdges } = getPolicyChainNodesForCommand({
      message,
      messageNodeId: messageId,
      policies,
      eventMap: policyEventMap,
      services,
      entities: entities || [],
      mode,
      edgeData: fullEdgeData,
      selfFilterPolicy: isTargetPolicy ? { id: target.data.id, version: target.data.version, collection: 'policies' } : undefined,
      selfFilterEntity: isTargetEntity ? { id: target.data.id, version: target.data.version, collection: 'entities' } : undefined,
    });
    nodes.push(...chainNodes);
    edges.push(...chainEdges);
  }

  // View/Actor chain expansion: when target consumes a command, show actors that issue it and views they read
  if (actors && allViews && message.collection === 'commands') {
    const viewActorViewMap = createVersionedMap(allViews);
    const { nodes: vaNodes, edges: vaEdges } = getViewActorChainNodesForCommand({
      message,
      messageNodeId: messageId,
      actors,
      viewMap: viewActorViewMap,
      mode,
      edgeData: viewActorFullEdgeData,
      selfFilterActor: isTargetActor ? { id: target.data.id, version: target.data.version } : undefined,
      selfFilterView: isTargetView ? { id: target.data.id, version: target.data.version } : undefined,
    });
    nodes.push(...vaNodes);
    edges.push(...vaEdges);
  }

  // Remove any nodes that are already in the current nodes (already on the UI)
  nodes = nodes.filter((node) => !currentNodes.find((n) => n.id === node.id));

  //  Make sure all nodes are unique
  const uniqueNodes = nodes.filter((node, index, self) => index === self.findIndex((t) => t.id === node.id));

  const uniqueEdges = edges.filter(
    (edge: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === edge.id)
  );

  return { nodes: uniqueNodes, edges: uniqueEdges };
};

export const getNodesAndEdgesForProducedMessage = ({
  message,
  sourceChannels,
  services,
  channels,
  currentNodes = [],
  currentEdges = [],
  source,
  mode = 'simple',
  channelMap,
  entities,
  policies,
  allCommands,
  views,
  allActors,
}: {
  message: CollectionEntry<CollectionMessageTypes>;
  sourceChannels?: { id: string; version: string }[];
  services: CollectionEntry<'services'>[];
  channels: CollectionEntry<'channels'>[];
  currentNodes: Node[];
  currentEdges: Edge[];
  source: CollectionEntry<'services'> | CollectionEntry<'entities'> | CollectionEntry<'policies'> | CollectionEntry<'views'> | CollectionEntry<'actors'>;
  mode?: 'simple' | 'full';
  channelMap?: Map<string, CollectionEntry<'channels'>[]>;
  entities?: CollectionEntry<'entities'>[];
  policies?: CollectionEntry<'policies'>[];
  allCommands?: CollectionEntry<'commands'>[];
  views?: CollectionEntry<'views'>[];
  allActors?: CollectionEntry<'actors'>[];
}) => {
  let nodes = [] as Node[],
    edges = [] as any;

  // Use provided map or create one
  const map = channelMap || createVersionedMap(channels);

  const messageId = generateIdForNode(message);

  const rootSourceAndTarget = {
    source: { id: generateIdForNode(source), collection: source.collection },
    target: { id: generateIdForNode(message), collection: message.collection },
  };

  // Render the message node
  nodes.push(
    createNode({
      id: messageId,
      type: message.collection,
      data: { mode, message: { ...message.data } },
      position: { x: 0, y: 0 },
    })
  );

  // Render the producer node (can be service, entity, policy, view, or actor)
  const isSourceEntity = source.collection === 'entities';
  const isSourcePolicy = source.collection === 'policies';
  const isSourceView = source.collection === 'views';
  const isSourceActor = source.collection === 'actors';
  const sourceNodeData = isSourceEntity
    ? { mode, entity: { ...source.data } }
    : isSourcePolicy
      ? { mode, policy: { ...source.data } }
      : isSourceView
        ? { mode, view: { ...source.data } }
        : isSourceActor
          ? { mode, actor: { ...source.data } }
          : { mode, service: { ...source.data } };
  nodes.push(
    createNode({
      id: generateIdForNode(source),
      type: isSourceView ? 'view' : isSourceActor ? 'actor' : source.collection,
      data: sourceNodeData,
      position: { x: 0, y: 0 },
    })
  );

  // Render the edge from the producer to the message
  const edgeLabel = isSourceEntity ? 'emits' : isSourcePolicy ? 'dispatches' : getEdgeLabelForServiceAsTarget(message);
  edges.push(
    createEdge({
      id: generatedIdForEdge(source, message),
      source: generateIdForNode(source),
      target: messageId,
      label: edgeLabel,
      data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
    })
  );

  const sourceMessageConfiguration =
    source.collection !== 'views' && source.collection !== 'actors'
      ? source.data.sends?.find((send) => send.id === message.data.id)
      : undefined;
  const channelsFromSourceToMessage = sourceMessageConfiguration?.to ?? [];

  const hydratedChannelsFromSourceToMessage = channelsFromSourceToMessage
    .map((channel) => findInMap(map, channel.id, channel.version))
    .filter((channel): channel is CollectionEntry<'channels'> => channel !== undefined);

  // If the source defined channels they send the message to, we need to create the channel nodes and edges
  if (sourceChannels && sourceChannels.length > 0) {
    for (const sourceChannel of sourceChannels) {
      const channel = findInMap(map, sourceChannel.id, sourceChannel.version) as CollectionEntry<'channels'>;

      if (!channel) {
        // No channel found, we just connect the source directly to the message
        edges.push(
          createEdge({
            id: generatedIdForEdge(source, message),
            source: generateIdForNode(source),
            target: messageId,
            label: getEdgeLabelForServiceAsTarget(message),
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
        continue;
      }

      const channelId = generateIdForNode(channel);

      // Create the channel node
      nodes.push(
        createNode({
          id: channelId,
          type: channel.collection,
          data: { mode, channel: { ...channel.data, ...channel, mode, id: channel.data.id } },
          position: { x: 0, y: 0 },
        })
      );

      // Connect the produced message to the channel
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, channel),
          source: messageId,
          target: channelId,
          label: 'routes to',
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        })
      );
    }
  }

  // Now we get the producers of the message and create nodes and edges for them
  const consumers = getConsumersOfMessage(services, message);

  // TODO: Make this a UI Switch in the future....
  const latestConsumers = consumers.filter(
    (consumer) => getLatestVersionInCollectionById(services, consumer.data.id) === consumer.data.version
  );

  // Process the consumers for the message
  for (const consumer of latestConsumers) {
    const consumerId = generateIdForNode(consumer);

    // Create the consumer node
    nodes.push(
      createNode({
        id: consumerId,
        type: consumer.collection,
        data: { mode, service: { ...consumer.data } },
        position: { x: 0, y: 0 },
      })
    );

    // Check if the consumer is consuming the message from a channel
    const consumerConfigurationForMessage = consumer.data.receives?.find((receive) => receive.id === message.data.id);
    const consumerChannelConfiguration = consumerConfigurationForMessage?.from ?? [];

    const consumerHasChannels = consumerChannelConfiguration.length > 0;
    const producerHasChannels = hydratedChannelsFromSourceToMessage.length > 0;

    // If the consumer and producer have no channels defined,
    // or the consumer has no channels defined, we just connect the message to the consumer directly
    if ((!consumerHasChannels && !producerHasChannels) || !consumerHasChannels) {
      edges.push(
        createEdge({
          id: generatedIdForEdge(message, consumer),
          source: messageId,
          target: consumerId,
          label: getEdgeLabelForMessageAsSource(message),
          data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
        })
      );
      continue;
    }

    // Process each consumer channel configuration
    for (const consumerChannel of consumerChannelConfiguration) {
      const channel = findInMap(map, consumerChannel.id, consumerChannel.version) as CollectionEntry<'channels'>;

      const edgeProps = { customColor: getColorFromString(message.data.id), rootSourceAndTarget };

      // If the channel cannot be found in EventCatalog, we just connect the message to the consumer directly
      // as a fallback, rather than just an empty node floating around
      if (!channel) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, consumer),
            source: messageId,
            target: consumerId,
            label: 'consumes',
            data: edgeProps,
          })
        );
        continue;
      }

      // We always add the consumer channel to be rendered
      nodes.push(
        createNode({
          id: generateIdForNode(channel),
          type: channel.collection,
          data: { mode, channel: { ...channel.data, ...channel } },
          position: { x: 0, y: 0 },
        })
      );

      // If the producer does not have any channels defined, we connect the message to the consumers channel directly
      if (!producerHasChannels) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, channel),
            source: messageId,
            target: generateIdForNode(channel),
            label: 'routes to',
            data: edgeProps,
          })
        );
        edges.push(
          createEdge({
            id: generatedIdForEdge(channel, consumer),
            source: generateIdForNode(channel),
            target: generateIdForNode(consumer),
            label: getEdgeLabelForMessageAsSource(message),
            data: {
              ...edgeProps,
              rootSourceAndTarget: {
                source: { id: generateIdForNode(message), collection: message.collection },
                target: { id: generateIdForNode(consumer), collection: consumer.collection },
              },
            },
          })
        );
        continue;
      }

      // The producer has channels defined, we need to try and work out the path the message takes to the consumer
      for (const sourceChannel of hydratedChannelsFromSourceToMessage) {
        const channelChainToRender = getChannelChain(sourceChannel, channel, channels);

        if (channelChainToRender.length > 0) {
          const { nodes: channelNodes, edges: channelEdges } = getNodesAndEdgesForChannelChain({
            source: message,
            target: consumer,
            channelChain: channelChainToRender,
            mode,
          });

          nodes.push(...channelNodes);
          edges.push(...channelEdges);
        } else {
          // No chain found, we need to connect to the message to the channel
          // And the channel to the consumer
          edges.push(
            createEdge({
              id: generatedIdForEdge(message, channel),
              source: messageId,
              target: generateIdForNode(channel),
              label: 'routes to',
              data: {
                ...edgeProps,
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(message), collection: message.collection },
                  target: { id: generateIdForNode(consumer), collection: consumer.collection },
                },
              },
            })
          );
          edges.push(
            createEdge({
              id: generatedIdForEdge(channel, consumer),
              source: generateIdForNode(channel),
              target: generateIdForNode(consumer),
              label: `${getEdgeLabelForMessageAsSource(message, true)} \n ${message.data.name}`,
              data: {
                ...edgeProps,
                rootSourceAndTarget: {
                  source: { id: generateIdForNode(message), collection: message.collection },
                  target: { id: generateIdForNode(consumer), collection: consumer.collection },
                },
              },
            })
          );
        }
      }
    }
  }

  // Process entity consumers for the message (entities now support channel configuration)
  if (entities) {
    const entityConsumers = getEntityConsumersOfMessage(entities, message);
    // Filter out the source if it's an entity to avoid self-reference
    const filteredEntityConsumers = entityConsumers.filter(
      (entity) => !(isSourceEntity && entity.data.id === source.data.id && entity.data.version === source.data.version)
    );

    for (const entityConsumer of filteredEntityConsumers) {
      const entityConsumerId = generateIdForNode(entityConsumer);

      // Create the entity consumer node
      nodes.push(
        createNode({
          id: entityConsumerId,
          type: 'entities',
          data: { mode, entity: { ...entityConsumer.data } },
          position: { x: 0, y: 0 },
        })
      );

      // Check if entity has channel configuration
      const entityConsumerConfig = entityConsumer.data.receives?.find((receive) => receive.id === message.data.id);
      const entityConsumerChannels = entityConsumerConfig?.from ?? [];
      const entityHasChannels = entityConsumerChannels.length > 0;

      const sourceHasChannels = hydratedChannelsFromSourceToMessage.length > 0;

      // If neither source nor entity consumer has channels, connect message directly to entity
      if (!sourceHasChannels && !entityHasChannels) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, entityConsumer),
            source: messageId,
            target: entityConsumerId,
            label: 'subscribes to',
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
        continue;
      }

      // If entity consumer has channels but source doesn't, connect message to entity channels directly
      if (entityHasChannels && !sourceHasChannels) {
        for (const entityChannel of entityConsumerChannels) {
          const channel = findInMap(map, entityChannel.id, entityChannel.version) as CollectionEntry<'channels'>;
          if (channel) {
            nodes.push(
              createNode({
                id: generateIdForNode(channel),
                type: channel.collection,
                data: { mode, channel: { ...channel.data, ...channel } },
                position: { x: 0, y: 0 },
              })
            );
            edges.push(
              createEdge({
                id: generatedIdForEdge(message, channel),
                source: messageId,
                target: generateIdForNode(channel),
                label: 'routes to',
                data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
              })
            );
            edges.push(
              createEdge({
                id: generatedIdForEdge(channel, entityConsumer),
                source: generateIdForNode(channel),
                target: entityConsumerId,
                label: 'subscribes to',
                data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
              })
            );
          }
        }
        continue;
      }

      // If source has channels but entity consumer doesn't, connect message directly to entity
      if (sourceHasChannels && !entityHasChannels) {
        edges.push(
          createEdge({
            id: generatedIdForEdge(message, entityConsumer),
            source: messageId,
            target: entityConsumerId,
            label: 'subscribes to',
            data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
          })
        );
        continue;
      }

      // Both source and entity consumer have channels - process each entity channel
      for (const entityChannel of entityConsumerChannels) {
        const channel = findInMap(map, entityChannel.id, entityChannel.version) as CollectionEntry<'channels'>;

        if (!channel) {
          // Channel not found, connect message directly to entity
          edges.push(
            createEdge({
              id: generatedIdForEdge(message, entityConsumer),
              source: messageId,
              target: entityConsumerId,
              label: 'subscribes to',
              data: { customColor: getColorFromString(message.data.id), rootSourceAndTarget },
            })
          );
          continue;
        }

        // Try to find channel chain from source channels to entity consumer channel
        for (const sourceChannel of hydratedChannelsFromSourceToMessage) {
          const channelChainToRender = getChannelChain(sourceChannel, channel, channels);

          if (channelChainToRender.length > 0) {
            const { nodes: channelNodes, edges: channelEdges } = getNodesAndEdgesForChannelChain({
              source: message,
              target: entityConsumer,
              channelChain: channelChainToRender,
              mode,
            });

            nodes.push(...channelNodes);
            edges.push(...channelEdges);
          } else {
            // No chain found - connect message to channel and channel to entity
            nodes.push(
              createNode({
                id: generateIdForNode(channel),
                type: channel.collection,
                data: { mode, channel: { ...channel.data, ...channel } },
                position: { x: 0, y: 0 },
              })
            );
            edges.push(
              createEdge({
                id: generatedIdForEdge(message, channel),
                source: messageId,
                target: generateIdForNode(channel),
                label: 'routes to',
                data: {
                  customColor: getColorFromString(message.data.id),
                  rootSourceAndTarget: {
                    source: { id: generateIdForNode(message), collection: message.collection },
                    target: { id: generateIdForNode(entityConsumer), collection: entityConsumer.collection },
                  },
                },
              })
            );
            edges.push(
              createEdge({
                id: generatedIdForEdge(channel, entityConsumer),
                source: generateIdForNode(channel),
                target: entityConsumerId,
                label: `${getEdgeLabelForMessageAsSource(message, true)} \n ${message.data.name}`,
                data: {
                  customColor: getColorFromString(message.data.id),
                  rootSourceAndTarget: {
                    source: { id: generateIdForNode(message), collection: message.collection },
                    target: { id: generateIdForNode(entityConsumer), collection: entityConsumer.collection },
                  },
                },
              })
            );
          }
        }
      }
    }
  }

  // Policy chain expansion: when source produces an event, show policies triggered by it,
  // the commands they dispatch, and the terminal consumers of those commands
  if (policies && allCommands && message.collection === 'events') {
    const policyCommandMap = createVersionedMap(allCommands);
    const { nodes: chainNodes, edges: chainEdges } = getPolicyChainNodesForEvent({
      message,
      messageNodeId: messageId,
      policies,
      commandMap: policyCommandMap,
      services,
      entities: entities || [],
      mode,
      edgeData: fullEdgeData,
      selfFilterPolicy: isSourcePolicy ? { id: source.data.id, version: source.data.version, collection: 'policies' } : undefined,
      selfFilterEntity: isSourceEntity ? { id: source.data.id, version: source.data.version, collection: 'entities' } : undefined,
    });
    nodes.push(...chainNodes);
    edges.push(...chainEdges);
  }

  // View/Actor chain expansion: when source produces an event, show views that subscribe and actors they inform
  if (views && allActors && message.collection === 'events') {
    const viewActorActorMap = createVersionedMap(allActors);
    const { nodes: vaNodes, edges: vaEdges } = getViewActorChainNodesForEvent({
      message,
      messageNodeId: messageId,
      views,
      actorMap: viewActorActorMap,
      mode,
      edgeData: viewActorFullEdgeData,
      selfFilterView: isSourceView ? { id: source.data.id, version: source.data.version } : undefined,
      selfFilterActor: isSourceActor ? { id: source.data.id, version: source.data.version } : undefined,
    });
    nodes.push(...vaNodes);
    edges.push(...vaEdges);
  }

  // Remove any nodes that are already in the current nodes (already on the UI)
  nodes = nodes.filter((node) => !currentNodes.find((n) => n.id === node.id));

  //  Make sure all nodes are unique
  const uniqueNodes = nodes.filter((node, index, self) => index === self.findIndex((t) => t.id === node.id));

  const uniqueEdges = edges.filter(
    (edge: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === edge.id)
  );

  return { nodes: uniqueNodes, edges: uniqueEdges };
};
