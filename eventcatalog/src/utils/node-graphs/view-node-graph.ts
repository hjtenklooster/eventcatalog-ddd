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
import { getProducersOfMessage, getConsumersOfMessage } from '@utils/collections/services';
import { getEntityProducersOfMessage, getEntityConsumersOfMessage } from '@utils/collections/entities';

type DagreGraph = any;

interface Props {
  id: string;
  version: string;
  mode?: 'simple' | 'full';
  defaultFlow?: DagreGraph;
}

export const getNodesAndEdges = async ({ id, version, mode = 'simple', defaultFlow }: Props) => {
  const flow = defaultFlow || createDagreGraph({ ranksep: 300, nodesep: 50 });
  let nodes: Node[] = [];
  let edges: Edge[] = [];

  const [views, events, actors, entities, services, commands] = await Promise.all([
    getCollection('views'),
    getCollection('events'),
    getCollection('actors'),
    getCollection('entities'),
    getCollection('services'),
    getCollection('commands'),
  ]);

  const viewMap = createVersionedMap(views);
  const eventMap = createVersionedMap(events);
  const actorMap = createVersionedMap(actors);
  const commandMap = createVersionedMap(commands);

  const view = findInMap(viewMap, id, version);
  if (!view) return { nodes: [], edges: [] };

  const subscribesRaw = view.data.subscribes || [];
  const informsRaw = view.data.informs || [];

  // Hydrate
  const subscribes = subscribesRaw
    .map((e: { id: string; version?: string }) => findInMap(eventMap, e.id, e.version))
    .filter((e): e is CollectionEntry<'events'> => !!e);

  const informs = informsRaw
    .map((a: { id: string; version?: string }) => findInMap(actorMap, a.id, a.version))
    .filter((a): a is CollectionEntry<'actors'> => !!a);

  // Center: view node
  const viewNodeId = generateIdForNode(view);
  nodes.push({
    id: viewNodeId,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { mode, view: { ...view.data } },
    position: { x: 0, y: 0 },
    type: 'view',
  });

  // Left: events that this view subscribes to + their producers
  for (const event of subscribes) {
    const eventNodeId = generateIdForNode(event);

    nodes.push(createNode({
      id: eventNodeId,
      type: event.collection,
      data: { mode, message: { ...event.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(event, view),
      source: eventNodeId,
      target: viewNodeId,
      label: 'subscribes',
      data: { customColor: getColorFromString(event.data.id) },
    }));

    // Left expansion: service producers of this event
    const serviceProducers = getProducersOfMessage(services, event);
    for (const producer of serviceProducers) {
      const producerId = generateIdForNode(producer);
      nodes.push(createNode({
        id: producerId,
        type: 'services',
        data: { mode, service: { ...producer.data } },
        position: { x: 0, y: 0 },
      }));

      edges.push(createEdge({
        id: generatedIdForEdge(producer, event),
        source: producerId,
        target: eventNodeId,
        label: getEdgeLabelForServiceAsTarget(event),
        data: { customColor: getColorFromString(event.data.id) },
      }));
    }

    // Left expansion: entity producers of this event
    const entityProducers = getEntityProducersOfMessage(entities, event);
    for (const ep of entityProducers) {
      const epId = generateIdForNode(ep);
      nodes.push(createNode({
        id: epId,
        type: 'entities',
        data: { mode, entity: { ...ep.data } },
        position: { x: 0, y: 0 },
      }));

      edges.push(createEdge({
        id: generatedIdForEdge(ep, event),
        source: epId,
        target: eventNodeId,
        label: 'emits',
        data: { customColor: getColorFromString(event.data.id) },
      }));
    }
  }

  // Right: actors this view informs + their issued commands + terminal consumers
  for (const actor of informs) {
    const actorNodeId = generateIdForNode(actor);

    nodes.push(createNode({
      id: actorNodeId,
      type: 'actor',
      data: { mode, actor: { ...actor.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(view, actor),
      source: viewNodeId,
      target: actorNodeId,
      label: 'informs',
      data: { customColor: getColorFromString(view.data.id) },
    }));

    // Right expansion: commands this actor issues
    const actorIssues = actor.data.issues || [];
    for (const issueRef of actorIssues) {
      const command = findInMap(commandMap, issueRef.id, issueRef.version);
      if (!command) continue;

      const commandNodeId = generateIdForNode(command);

      nodes.push(createNode({
        id: commandNodeId,
        type: command.collection,
        data: { mode, message: { ...command.data } },
        position: { x: 0, y: 0 },
      }));

      // actor --issues--> command
      edges.push(createEdge({
        id: generatedIdForEdge(actor, command),
        source: actorNodeId,
        target: commandNodeId,
        label: 'issues',
        data: { customColor: getColorFromString(command.data.id) },
      }));

      // Terminal consumers of the command: entities
      const cmdEntityConsumers = getEntityConsumersOfMessage(entities, command);
      for (const ec of cmdEntityConsumers) {
        const ecId = generateIdForNode(ec);
        nodes.push(createNode({
          id: ecId,
          type: 'entities',
          data: { mode, entity: { ...ec.data } },
          position: { x: 0, y: 0 },
        }));

        edges.push(createEdge({
          id: generatedIdForEdge(command, ec),
          source: commandNodeId,
          target: ecId,
          label: 'subscribes to',
          data: { customColor: getColorFromString(command.data.id) },
        }));
      }

      // Terminal consumers of the command: services
      const cmdServiceConsumers = getConsumersOfMessage(services, command);
      for (const sc of cmdServiceConsumers) {
        const scId = generateIdForNode(sc);
        nodes.push(createNode({
          id: scId,
          type: 'services',
          data: { mode, service: { ...sc.data } },
          position: { x: 0, y: 0 },
        }));

        edges.push(createEdge({
          id: generatedIdForEdge(command, sc),
          source: commandNodeId,
          target: scId,
          label: getEdgeLabelForMessageAsSource(command),
          data: { customColor: getColorFromString(command.data.id) },
        }));
      }
    }
  }

  // Deduplicate
  const uniqueNodes = nodes.filter((n, i, self) => i === self.findIndex((t) => t.id === n.id));
  const uniqueEdges = edges.filter((e, i, self) => i === self.findIndex((t) => t.id === e.id));

  uniqueNodes.forEach((n) => flow.setNode(n.id, { width: 150, height: 100 }));
  uniqueEdges.forEach((e) => flow.setEdge(e.source, e.target));
  dagre.layout(flow);

  return { nodes: calculatedNodes(flow, uniqueNodes), edges: uniqueEdges };
};
