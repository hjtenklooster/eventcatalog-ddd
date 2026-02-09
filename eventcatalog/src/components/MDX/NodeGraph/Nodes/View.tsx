import { Handle, Position } from '@xyflow/react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { buildUrl } from '@utils/url-builder';

import { nodeComponents, type ViewNode } from '@eventcatalog/visualizer';
const ViewComponent = nodeComponents.view;

export default function ViewNode(props: ViewNode) {
  const { id, version } = props.data.view as any;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div className="relative">
          <Handle
            type="target"
            position={Position.Left}
            style={{ width: 10, height: 10, background: 'blue', zIndex: 10 }}
            className="bg-gray-500"
          />
          <Handle
            type="source"
            position={Position.Right}
            style={{ width: 10, height: 10, background: 'blue', zIndex: 10 }}
            className="bg-gray-500"
          />
          <ViewComponent {...props} />
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
              className="text-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-blue-100 rounded-sm flex items-center"
            >
              <a href={buildUrl(`/docs/views/${id}/${version}`)}>Read documentation</a>
            </ContextMenu.Item>
            <ContextMenu.Item
              asChild
              className="text-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-blue-100 rounded-sm flex items-center"
            >
              <a href={buildUrl(`/visualiser/views/${id}/${version}`)}>View in visualiser</a>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
}
