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
  getEdgeLabelForMessageAsSource,
} from '@utils/node-graphs/utils/utils';
import { findInMap, createVersionedMap } from '@utils/collections/util';
import { getConsumersOfMessage } from '@utils/collections/services';
import { getEntityConsumersOfMessage } from '@utils/collections/entities';

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

  const [actors, views, commands, events, entities, services] = await Promise.all([
    getCollection('actors'),
    getCollection('views'),
    getCollection('commands'),
    getCollection('events'),
    getCollection('entities'),
    getCollection('services'),
  ]);

  const actorMap = createVersionedMap(actors);
  const viewMap = createVersionedMap(views);
  const commandMap = createVersionedMap(commands);
  const eventMap = createVersionedMap(events);

  const actor = findInMap(actorMap, id, version);
  if (!actor) return { nodes: [], edges: [] };

  const readsRaw = actor.data.reads || [];
  const issuesRaw = actor.data.issues || [];

  const reads = readsRaw
    .map((v: { id: string; version?: string }) => findInMap(viewMap, v.id, v.version))
    .filter((v): v is CollectionEntry<'views'> => !!v);

  const issues = issuesRaw
    .map((c: { id: string; version?: string }) => findInMap(commandMap, c.id, c.version))
    .filter((c): c is CollectionEntry<'commands'> => !!c);

  // Center: actor node
  const actorNodeId = generateIdForNode(actor);
  nodes.push({
    id: actorNodeId,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { mode, actor: { ...actor.data } },
    position: { x: 0, y: 0 },
    type: 'actor',
  });

  // Left: views this actor reads + events those views subscribe to
  for (const view of reads) {
    const viewNodeId = generateIdForNode(view);

    nodes.push(createNode({
      id: viewNodeId,
      type: 'view',
      data: { mode, view: { ...view.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(view, actor),
      source: viewNodeId,
      target: actorNodeId,
      label: 'informs',
      data: { customColor: getColorFromString(view.data.id) },
    }));

    // Left expansion: events this view subscribes to
    const viewSubscribes = view.data.subscribes || [];
    for (const subRef of viewSubscribes) {
      const event = findInMap(eventMap, subRef.id, subRef.version);
      if (!event) continue;

      const eventNodeId = generateIdForNode(event);

      nodes.push(createNode({
        id: eventNodeId,
        type: event.collection,
        data: { mode, message: { ...event.data } },
        position: { x: 0, y: 0 },
      }));

      // event --subscribes--> view
      edges.push(createEdge({
        id: generatedIdForEdge(event, view),
        source: eventNodeId,
        target: viewNodeId,
        label: 'subscribes',
        data: { customColor: getColorFromString(event.data.id) },
      }));
    }
  }

  // Right: commands this actor issues + terminal consumers
  for (const command of issues) {
    const commandNodeId = generateIdForNode(command);

    nodes.push(createNode({
      id: commandNodeId,
      type: command.collection,
      data: { mode, message: { ...command.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(actor, command),
      source: actorNodeId,
      target: commandNodeId,
      label: 'issues',
      data: { customColor: getColorFromString(command.data.id) },
    }));

    // Right expansion: entity consumers of this command
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

    // Right expansion: service consumers of this command
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

  // Deduplicate
  const uniqueNodes = nodes.filter((n, i, self) => i === self.findIndex((t) => t.id === n.id));
  const uniqueEdges = edges.filter((e, i, self) => i === self.findIndex((t) => t.id === e.id));

  uniqueNodes.forEach((n) => flow.setNode(n.id, { width: 150, height: 100 }));
  uniqueEdges.forEach((e) => flow.setEdge(e.source, e.target));
  dagre.layout(flow);

  return { nodes: calculatedNodes(flow, uniqueNodes), edges: uniqueEdges };
};
