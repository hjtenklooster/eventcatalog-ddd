import { Handle } from '@xyflow/react';
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

  const { node: { color = 'violet', label } = {}, icon = 'Cog6ToothIcon' } = styles || {};

  const Icon = getIcon(icon);
  const nodeLabel = label || (policy as any).sidebar?.badge || 'Policy';
  const fontSize = nodeLabel.length > 10 ? '7px' : '9px';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div
          className={classNames(
            `w-full rounded-md border flex justify-start bg-white text-black border-${color}-400`,
            externalToDomain ? 'border-yellow-400' : ''
          )}
        >
          <div
            className={classNames(
              `relative flex items-center w-5 justify-center rounded-l-sm text-${color}-100`,
              `border-r-[1px] border-${color}-500`,
              externalToDomain ? 'bg-yellow-400' : `bg-gradient-to-b from-${color}-500 to-${color}-700`
            )}
          >
            {Icon && <Icon className="w-4 h-4 opacity-90 text-white absolute top-1" />}
            {mode === 'full' && (
              <span
                className={`rotate -rotate-90 w-1/2 text-center absolute bottom-1 text-[${fontSize}] text-white font-bold uppercase tracking-[3px]`}
              >
                {nodeLabel}
              </span>
            )}
          </div>
          <div className="p-1 min-w-60 max-w-[min-content]">
            {targetPosition && <Handle type="target" position={targetPosition} />}
            {sourcePosition && <Handle type="source" position={sourcePosition} />}
            <div className={classNames(mode === 'full' ? 'border-b border-gray-200' : '')}>
              <span className="text-xs font-bold block pt-0.5 pb-0.5">{name || id}</span>
              <div className="flex justify-between">
                <span className="text-[10px] font-light block pt-0.5 pb-0.5">v{version}</span>
                {mode === 'simple' && (
                  <span className="text-[10px] text-gray-500 font-light block pt-0.5 pb-0.5">{nodeLabel}</span>
                )}
              </div>
              {externalToDomain && domainName && (
                <div className="text-[8px] text-yellow-800 font-medium pb-0.5">from {domainName} domain</div>
              )}
            </div>
            {mode === 'full' && (
              <div className="divide-y divide-gray-200">
                {conditions.length > 0 ? (
                  <div className="py-1 space-y-0.5">
                    {conditions.map((condition, index) => (
                      <div key={index} className="flex items-start gap-1 text-[8px] text-gray-600">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span className="font-mono">{condition}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="leading-3 py-1">
                    <span className="text-[8px] font-light">No conditions defined</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 py-1">
                  <span className="text-xs" style={{ fontSize: '0.2em' }}>
                    Conditions: {conditions.length}
                  </span>
                </div>
              </div>
            )}
          </div>
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
          <ContextMenu.Item
            asChild
            className="text-sm px-2 py-1.5 outline-none cursor-pointer hover:bg-violet-100 rounded-sm flex items-center"
          >
            <a href={buildUrl(`/visualiser/policies/${id}/${version}`)}>View in visualiser</a>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
