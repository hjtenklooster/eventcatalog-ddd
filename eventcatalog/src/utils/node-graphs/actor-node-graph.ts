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

  const [actors, views, commands] = await Promise.all([
    getCollection('actors'),
    getCollection('views'),
    getCollection('commands'),
  ]);

  const actorMap = createVersionedMap(actors);
  const viewMap = createVersionedMap(views);
  const commandMap = createVersionedMap(commands);

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

  // Left: views this actor reads
  for (const view of reads) {
    nodes.push(createNode({
      id: generateIdForNode(view),
      type: 'view',
      data: { mode, view: { ...view.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(view, actor),
      source: generateIdForNode(view),
      target: actorNodeId,
      label: 'informs',
      data: { customColor: getColorFromString(view.data.id) },
    }));
  }

  // Right: commands this actor issues
  for (const command of issues) {
    nodes.push(createNode({
      id: generateIdForNode(command),
      type: command.collection,
      data: { mode, message: { ...command.data } },
      position: { x: 0, y: 0 },
    }));

    edges.push(createEdge({
      id: generatedIdForEdge(actor, command),
      source: actorNodeId,
      target: generateIdForNode(command),
      label: 'issues',
      data: { customColor: getColorFromString(command.data.id) },
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
