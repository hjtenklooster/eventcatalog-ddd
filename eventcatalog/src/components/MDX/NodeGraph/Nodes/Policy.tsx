import { Cog6ToothIcon } from '@heroicons/react/16/solid';
import { Handle, Position } from '@xyflow/react';
import { getIcon } from '@utils/badges';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { buildUrl } from '@utils/url-builder';

interface PolicyData {
  id: string;
  name: string;
  version: string;
  conditions?: string[];
  styles?: {
    node?: {
      color?: string;
      label?: string;
    };
    icon?: string;
  };
  sidebar?: unknown;
}

interface Data {
  title: string;
  label: string;
  bgColor: string;
  color: string;
  mode: 'simple' | 'full';
  policy: PolicyData;
  showTarget?: boolean;
  showSource?: boolean;
  externalToDomain?: boolean;
  domainName?: string;
  domainId?: string;
  group?: {
    type: string;
    value: string;
  };
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ');
}

export default function PolicyNode({ data, sourcePosition, targetPosition }: any) {
  const { mode, policy, externalToDomain, domainName } = data as Data;
  const { id, name, version, conditions = [], styles } = policy;

  const { node: { color = 'purple', label } = {}, icon = 'Cog6ToothIcon' } = styles || {};

  const Icon = getIcon(icon);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div
          className={classNames(
            'bg-white border border-violet-300 rounded-lg shadow-sm min-w-[200px]',
            externalToDomain ? 'border-yellow-400' : ''
          )}
        >
          {/* Header */}
          <div
            className={classNames(
              'bg-gradient-to-br from-violet-500 to-violet-600 px-4 py-2 rounded-t-lg',
              externalToDomain ? 'bg-yellow-400' : ''
            )}
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4 text-white" />}
              <span className="font-semibold text-white text-sm">{name || id}</span>
              <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded">Policy</span>
            </div>
            {externalToDomain && domainName && (
              <div className="text-xs text-yellow-800 font-medium mt-1">from {domainName} domain</div>
            )}
            {mode === 'full' && <div className="text-xs text-white/80 mt-1">v{version}</div>}
          </div>

          {/* Conditions List */}
          {conditions.length > 0 ? (
            <div className="px-4 py-2 space-y-1">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span className="font-mono">{condition}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">No conditions defined</div>
          )}

          {/* Handles */}
          <Handle
            type="target"
            position={targetPosition || Position.Left}
            className="!w-3 !h-3 !bg-white !border-2 !border-violet-400 !rounded-full"
          />
          <Handle
            type="source"
            position={sourcePosition || Position.Right}
            className="!w-3 !h-3 !bg-white !border-2 !border-violet-400 !rounded-full"
          />
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="min-w-[220px] bg-white rounded-md p-1 shadow-md border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenu.Item
            asChild
            className="text-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-violet-100 rounded-sm flex items-center"
          >
            <a href={buildUrl(`/docs/policies/${id}/${version}`)}>Read documentation</a>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
