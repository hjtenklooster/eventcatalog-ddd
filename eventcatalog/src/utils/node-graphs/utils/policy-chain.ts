import type { CollectionEntry } from 'astro:content';
import type { Node, Edge } from '@xyflow/react';
import {
  createNode,
  createEdge,
  generateIdForNode,
  generatedIdForEdge,
  getColorFromString,
  getEdgeLabelForServiceAsTarget,
  getEdgeLabelForMessageAsSource,
} from './utils';
import { findInMap } from '@utils/collections/util';
import { getProducersOfMessage, getConsumersOfMessage } from '@utils/collections/services';
import { getEntityProducersOfMessage, getEntityConsumersOfMessage } from '@utils/collections/entities';
import { getPoliciesDispatchingCommand, getPoliciesTriggeredByEvent } from '@utils/collections/policies';

type VersionedMap<T> = Map<string, T[]>;

interface EdgeDataFactory {
  (
    colorSource: string,
    source: { id: string; collection: string },
    target: { id: string; collection: string }
  ): Record<string, any>;
}

/**
 * Creates a simple edge data factory (entity-node-graph style) that only includes customColor.
 */
export const simpleEdgeData: EdgeDataFactory = (colorSource) => ({
  customColor: getColorFromString(colorSource),
});

/**
 * Creates a full edge data factory (message-node-graph style) that includes rootSourceAndTarget.
 */
export const fullEdgeData: EdgeDataFactory = (colorSource, source, target) => ({
  customColor: getColorFromString(colorSource),
  rootSourceAndTarget: { source, target },
});

interface SelfFilter {
  id: string;
  version: string;
  collection: string;
}

interface PolicyChainForCommandParams {
  message: CollectionEntry<'commands'>;
  messageNodeId: string;
  policies: CollectionEntry<'policies'>[];
  eventMap: VersionedMap<CollectionEntry<'events'>>;
  services: CollectionEntry<'services'>[];
  entities: CollectionEntry<'entities'>[];
  mode: 'simple' | 'full';
  edgeData?: EdgeDataFactory;
  /** If provided, policies matching this identity are excluded */
  selfFilterPolicy?: SelfFilter;
  /** If provided, terminal producers matching this identity are excluded */
  selfFilterEntity?: SelfFilter;
}

/**
 * Generates nodes/edges for the policy chain when a command is received:
 * command ← policy ← event ← [terminal service/entity producers]
 */
export function getPolicyChainNodesForCommand({
  message,
  messageNodeId,
  policies,
  eventMap,
  services,
  entities,
  mode,
  edgeData = simpleEdgeData,
  selfFilterPolicy,
  selfFilterEntity,
}: PolicyChainForCommandParams): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let dispatchingPolicies = getPoliciesDispatchingCommand(policies, message);

  if (selfFilterPolicy) {
    dispatchingPolicies = dispatchingPolicies.filter(
      (p) => !(p.data.id === selfFilterPolicy.id && p.data.version === selfFilterPolicy.version)
    );
  }

  for (const policy of dispatchingPolicies) {
    const policyId = generateIdForNode(policy);

    nodes.push(
      createNode({
        id: policyId,
        type: 'policies',
        data: { mode, policy: { ...policy.data } },
        position: { x: 0, y: 0 },
      })
    );

    // policy --dispatches--> command
    edges.push(
      createEdge({
        id: generatedIdForEdge(policy, message),
        source: policyId,
        target: messageNodeId,
        label: 'dispatches',
        data: edgeData(
          message.data.id,
          { id: policyId, collection: 'policies' },
          { id: messageNodeId, collection: message.collection }
        ),
      })
    );

    // Events that trigger this policy
    const policyReceives = policy.data.receives || [];
    for (const receive of policyReceives) {
      const event = findInMap(eventMap, receive.id, receive.version);
      if (!event) continue;

      const eventId = generateIdForNode(event);

      nodes.push(
        createNode({
          id: eventId,
          type: event.collection,
          data: { mode, message: { ...event.data } },
          position: { x: 0, y: 0 },
        })
      );

      // event --triggers--> policy
      edges.push(
        createEdge({
          id: generatedIdForEdge(event, policy),
          source: eventId,
          target: policyId,
          label: 'triggers',
          data: edgeData(event.data.id, { id: eventId, collection: event.collection }, { id: policyId, collection: 'policies' }),
        })
      );

      // Terminal producers of the event (services + entities, not policies)
      const eventServiceProducers = getProducersOfMessage(services, event);
      let eventEntityProducers = getEntityProducersOfMessage(entities, event);

      if (selfFilterEntity) {
        eventEntityProducers = eventEntityProducers.filter(
          (ep) => !(ep.data.id === selfFilterEntity.id && ep.data.version === selfFilterEntity.version)
        );
      }

      const terminalProducers = [...eventServiceProducers, ...eventEntityProducers];

      for (const terminal of terminalProducers) {
        const terminalId = generateIdForNode(terminal);
        const isTermEntity = terminal.collection === 'entities';

        nodes.push(
          createNode({
            id: terminalId,
            type: terminal.collection,
            data: isTermEntity ? { mode, entity: { ...terminal.data } } : { mode, service: { ...terminal.data } },
            position: { x: 0, y: 0 },
          })
        );

        edges.push(
          createEdge({
            id: generatedIdForEdge(terminal, event),
            source: terminalId,
            target: eventId,
            label: isTermEntity ? 'emits' : getEdgeLabelForServiceAsTarget(event),
            data: edgeData(
              event.data.id,
              { id: terminalId, collection: terminal.collection },
              { id: eventId, collection: event.collection }
            ),
          })
        );
      }
    }
  }

  return { nodes, edges };
}

interface PolicyChainForEventParams {
  message: CollectionEntry<'events'>;
  messageNodeId: string;
  policies: CollectionEntry<'policies'>[];
  commandMap: VersionedMap<CollectionEntry<'commands'>>;
  services: CollectionEntry<'services'>[];
  entities: CollectionEntry<'entities'>[];
  mode: 'simple' | 'full';
  edgeData?: EdgeDataFactory;
  /** If provided, policies matching this identity are excluded */
  selfFilterPolicy?: SelfFilter;
  /** If provided, terminal consumers matching this identity are excluded */
  selfFilterEntity?: SelfFilter;
}

/**
 * Generates nodes/edges for the policy chain when an event is sent:
 * event → policy → command → [terminal service/entity consumers]
 */
export function getPolicyChainNodesForEvent({
  message,
  messageNodeId,
  policies,
  commandMap,
  services,
  entities,
  mode,
  edgeData = simpleEdgeData,
  selfFilterPolicy,
  selfFilterEntity,
}: PolicyChainForEventParams): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let triggeredPolicies = getPoliciesTriggeredByEvent(policies, message);

  if (selfFilterPolicy) {
    triggeredPolicies = triggeredPolicies.filter(
      (p) => !(p.data.id === selfFilterPolicy.id && p.data.version === selfFilterPolicy.version)
    );
  }

  for (const policy of triggeredPolicies) {
    const policyId = generateIdForNode(policy);

    nodes.push(
      createNode({
        id: policyId,
        type: 'policies',
        data: { mode, policy: { ...policy.data } },
        position: { x: 0, y: 0 },
      })
    );

    // event --triggers--> policy
    edges.push(
      createEdge({
        id: generatedIdForEdge(message, policy),
        source: messageNodeId,
        target: policyId,
        label: 'triggers',
        data: edgeData(
          message.data.id,
          { id: messageNodeId, collection: message.collection },
          { id: policyId, collection: 'policies' }
        ),
      })
    );

    // Commands the policy dispatches
    const policySends = policy.data.sends || [];
    for (const send of policySends) {
      const command = findInMap(commandMap, send.id, send.version);
      if (!command) continue;

      const commandId = generateIdForNode(command);

      nodes.push(
        createNode({
          id: commandId,
          type: command.collection,
          data: { mode, message: { ...command.data } },
          position: { x: 0, y: 0 },
        })
      );

      // policy --dispatches--> command
      edges.push(
        createEdge({
          id: generatedIdForEdge(policy, command),
          source: policyId,
          target: commandId,
          label: 'dispatches',
          data: edgeData(
            command.data.id,
            { id: policyId, collection: 'policies' },
            { id: commandId, collection: command.collection }
          ),
        })
      );

      // Terminal consumers of the command (services + entities, not policies)
      const cmdServiceConsumers = getConsumersOfMessage(services, command);
      let cmdEntityConsumers = getEntityConsumersOfMessage(entities, command);

      if (selfFilterEntity) {
        cmdEntityConsumers = cmdEntityConsumers.filter(
          (ec) => !(ec.data.id === selfFilterEntity.id && ec.data.version === selfFilterEntity.version)
        );
      }

      const terminalConsumers = [...cmdServiceConsumers, ...cmdEntityConsumers];

      for (const terminal of terminalConsumers) {
        const terminalId = generateIdForNode(terminal);
        const isTermEntity = terminal.collection === 'entities';

        nodes.push(
          createNode({
            id: terminalId,
            type: terminal.collection,
            data: isTermEntity ? { mode, entity: { ...terminal.data } } : { mode, service: { ...terminal.data } },
            position: { x: 0, y: 0 },
          })
        );

        edges.push(
          createEdge({
            id: generatedIdForEdge(command, terminal),
            source: commandId,
            target: terminalId,
            label: isTermEntity ? 'subscribes to' : getEdgeLabelForMessageAsSource(command),
            data: edgeData(
              command.data.id,
              { id: commandId, collection: command.collection },
              { id: terminalId, collection: terminal.collection }
            ),
          })
        );
      }
    }
  }

  return { nodes, edges };
}
