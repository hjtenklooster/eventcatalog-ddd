import { Handle, Position, type XYPosition } from '@xyflow/react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { buildUrl } from '@utils/url-builder';

import { nodeComponents } from '@eventcatalog/visualizer';
const ActorComponent = nodeComponents.actor;

interface Data {
  data: {
    actor: {
      name: string;
      summary?: string;
      id?: string;
      version?: string;
    };
    mode: 'simple' | 'full';
  };
  type: 'actor';
  id: string;
  position: XYPosition;
}

export default function ActorNode(props: Data) {
  const { id, version } = props.data.actor;

  const componentData = {
    ...props,
    data: {
      ...props.data,
      name: props.data.actor.name,
      summary: props.data.actor.summary,
    },
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            style={{ width: 10, height: 10, background: 'orange', zIndex: 10 }}
            className="bg-gray-500"
          />
          <Handle
            type="source"
            position={Position.Right}
            style={{ width: 10, height: 10, background: 'orange', zIndex: 10 }}
            className="bg-gray-500"
          />
          <ActorComponent {...componentData} />
        </div>
      </ContextMenu.Trigger>
      {id && version && (
        <ContextMenu.Portal>
          <ContextMenu.Content
            className="min-w-[220px] bg-white rounded-md p-1 shadow-md border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ContextMenu.Item
              asChild
              className="text-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-yellow-100 rounded-sm flex items-center"
            >
              <a href={buildUrl(`/docs/actors/${id}/${version}`)}>Read documentation</a>
            </ContextMenu.Item>
            <ContextMenu.Item
              asChild
              className="text-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-yellow-100 rounded-sm flex items-center"
            >
              <a href={buildUrl(`/visualiser/actors/${id}/${version}`)}>View in visualiser</a>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
}
