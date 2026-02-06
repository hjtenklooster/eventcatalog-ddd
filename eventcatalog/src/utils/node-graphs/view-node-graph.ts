import { getCollection, type CollectionEntry } from 'astro:content';
import dagre from 'dagre';
import { type Node, type Edge, Position } from '@xyflow/react';
import { createDagreGraph, generateIdForNode, calculatedNodes, createNode, createEdge, generatedIdForEdge, getColorFromString } from '@utils/node-graphs/utils/utils';
import { findInMap, createVersionedMap } from '@utils/collections/util';

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

  const [views, events, actors] = await Promise.all([
    getCollection('views'),
    getCollection('events'),
    getCollection('actors'),
  ]);

  const viewMap = createVersionedMap(views);
  const eventMap = createVersionedMap(events);
  const actorMap = createVersionedMap(actors);

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

  // Left: events that this view subscribes to
  for (const event of subscribes) {
    nodes.push(createNode({
      id: generateIdForNode(event),
      type: event.collection,
      data: { mode, message: { ...event.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(event, view),
      source: generateIdForNode(event),
      target: viewNodeId,
      label: 'subscribes',
      data: { customColor: getColorFromString(event.data.id) },
    }));
  }

  // Right: actors this view informs
  for (const actor of informs) {
    nodes.push(createNode({
      id: generateIdForNode(actor),
      type: 'actor',
      data: { mode, actor: { ...actor.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(view, actor),
      source: viewNodeId,
      target: generateIdForNode(actor),
      label: 'informs',
      data: { customColor: getColorFromString(view.data.id) },
    }));
  }

  // Deduplicate
  const uniqueNodes = nodes.filter((n, i, self) => i === self.findIndex((t) => t.id === n.id));
  const uniqueEdges = edges.filter((e, i, self) => i === self.findIndex((t) => t.id === e.id));

  uniqueNodes.forEach((n) => flow.setNode(n.id, { width: 150, height: 100 }));
  uniqueEdges.forEach((e) => flow.setEdge(e.source, e.target));
  dagre.layout(flow);

  return { nodes: calculatedNodes(flow, uniqueNodes), edges: uniqueEdges };
};
