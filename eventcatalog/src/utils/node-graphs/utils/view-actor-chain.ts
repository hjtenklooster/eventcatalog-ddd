import type { CollectionEntry } from 'astro:content';
import type { Node, Edge } from '@xyflow/react';
import {
  createNode,
  createEdge,
  generateIdForNode,
  generatedIdForEdge,
  getColorFromString,
} from './utils';
import { findInMap } from '@utils/collections/util';
import { getViewsSubscribedToEvent } from '@utils/collections/views';
import { getActorsIssuingCommand } from '@utils/collections/actors';

type VersionedMap<T> = Map<string, T[]>;

interface EdgeDataFactory {
  (
    colorSource: string,
    source: { id: string; collection: string },
    target: { id: string; collection: string }
  ): Record<string, any>;
}

interface SelfFilter {
  id: string;
  version: string;
}

const simpleEdgeData: EdgeDataFactory = (colorSource) => ({
  customColor: getColorFromString(colorSource),
});

const fullEdgeData: EdgeDataFactory = (colorSource, source, target) => ({
  customColor: getColorFromString(colorSource),
  rootSourceAndTarget: { source, target },
});

export { fullEdgeData as viewActorFullEdgeData };

interface ViewActorChainForEventParams {
  message: CollectionEntry<'events'>;
  messageNodeId: string;
  views: CollectionEntry<'views'>[];
  actorMap: VersionedMap<CollectionEntry<'actors'>>;
  mode: 'simple' | 'full';
  edgeData?: EdgeDataFactory;
  selfFilterView?: SelfFilter;
  selfFilterActor?: SelfFilter;
}

/**
 * Generates nodes/edges for the view/actor chain when an event is sent:
 * event → view → actor
 */
export function getViewActorChainNodesForEvent({
  message,
  messageNodeId,
  views,
  actorMap,
  mode,
  edgeData = simpleEdgeData,
  selfFilterView,
  selfFilterActor,
}: ViewActorChainForEventParams): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let subscribedViews = getViewsSubscribedToEvent(views, message);

  if (selfFilterView) {
    subscribedViews = subscribedViews.filter(
      (v) => !(v.data.id === selfFilterView.id && v.data.version === selfFilterView.version)
    );
  }

  for (const view of subscribedViews) {
    const viewId = generateIdForNode(view);

    nodes.push(
      createNode({
        id: viewId,
        type: 'view',
        data: { mode, view: { ...view.data } },
        position: { x: 0, y: 0 },
      })
    );

    // event --subscribes--> view
    edges.push(
      createEdge({
        id: generatedIdForEdge(message, view),
        source: messageNodeId,
        target: viewId,
        label: 'subscribes',
        data: edgeData(
          message.data.id,
          { id: messageNodeId, collection: message.collection },
          { id: viewId, collection: 'views' }
        ),
      })
    );

    // For each actor this view informs
    const viewInforms = view.data.informs || [];
    for (const informRef of viewInforms) {
      const actor = findInMap(actorMap, informRef.id, informRef.version);
      if (!actor) continue;

      if (selfFilterActor) {
        if (actor.data.id === selfFilterActor.id && actor.data.version === selfFilterActor.version) continue;
      }

      const actorId = generateIdForNode(actor);

      nodes.push(
        createNode({
          id: actorId,
          type: 'actor',
          data: { mode, actor: { ...actor.data } },
          position: { x: 0, y: 0 },
        })
      );

      // view --informs--> actor
      edges.push(
        createEdge({
          id: generatedIdForEdge(view, actor),
          source: viewId,
          target: actorId,
          label: 'informs',
          data: edgeData(
            view.data.id,
            { id: viewId, collection: 'views' },
            { id: actorId, collection: 'actors' }
          ),
        })
      );
    }
  }

  return { nodes, edges };
}

interface ViewActorChainForCommandParams {
  message: CollectionEntry<'commands'>;
  messageNodeId: string;
  actors: CollectionEntry<'actors'>[];
  viewMap: VersionedMap<CollectionEntry<'views'>>;
  mode: 'simple' | 'full';
  edgeData?: EdgeDataFactory;
  selfFilterActor?: SelfFilter;
  selfFilterView?: SelfFilter;
}

/**
 * Generates nodes/edges for the view/actor chain when a command is received:
 * view → actor → command
 */
export function getViewActorChainNodesForCommand({
  message,
  messageNodeId,
  actors,
  viewMap,
  mode,
  edgeData = simpleEdgeData,
  selfFilterActor,
  selfFilterView,
}: ViewActorChainForCommandParams): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let issuingActors = getActorsIssuingCommand(actors, message);

  if (selfFilterActor) {
    issuingActors = issuingActors.filter(
      (a) => !(a.data.id === selfFilterActor.id && a.data.version === selfFilterActor.version)
    );
  }

  for (const actor of issuingActors) {
    const actorId = generateIdForNode(actor);

    nodes.push(
      createNode({
        id: actorId,
        type: 'actor',
        data: { mode, actor: { ...actor.data } },
        position: { x: 0, y: 0 },
      })
    );

    // actor --issues--> command
    edges.push(
      createEdge({
        id: generatedIdForEdge(actor, message),
        source: actorId,
        target: messageNodeId,
        label: 'issues',
        data: edgeData(
          message.data.id,
          { id: actorId, collection: 'actors' },
          { id: messageNodeId, collection: message.collection }
        ),
      })
    );

    // For each view this actor reads
    const actorReads = actor.data.reads || [];
    for (const readRef of actorReads) {
      const view = findInMap(viewMap, readRef.id, readRef.version);
      if (!view) continue;

      if (selfFilterView) {
        if (view.data.id === selfFilterView.id && view.data.version === selfFilterView.version) continue;
      }

      const viewId = generateIdForNode(view);

      nodes.push(
        createNode({
          id: viewId,
          type: 'view',
          data: { mode, view: { ...view.data } },
          position: { x: 0, y: 0 },
        })
      );

      // view --informs--> actor
      edges.push(
        createEdge({
          id: generatedIdForEdge(view, actor),
          source: viewId,
          target: actorId,
          label: 'informs',
          data: edgeData(
            view.data.id,
            { id: viewId, collection: 'views' },
            { id: actorId, collection: 'actors' }
          ),
        })
      );
    }
  }

  return { nodes, edges };
}
