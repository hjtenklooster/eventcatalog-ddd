import type { Policy } from '@utils/collections/policies';
import { buildUrl } from '@utils/url-builder';
import { isVisualiserEnabled } from '@utils/feature';
import { pluralizeMessageType } from '@utils/collections/messages';
import type { NavNode, ChildRef, ResourceGroupContext } from './shared';
import {
  buildQuickReferenceSection,
  buildOwnersSection,
  shouldRenderSideBarSection,
  buildRepositorySection,
  buildAttachmentsSection,
  buildDiagramNavItems,
} from './shared';

export const buildPolicyNode = (policy: Policy, owners: any[], context: ResourceGroupContext): NavNode => {
  const sendsMessages = policy.data.sends || [];
  const receivesMessages = policy.data.receives || [];

  const hasAttachments = (policy.data.attachments?.length ?? 0) > 0;
  const policyDiagrams = policy.data.diagrams || [];
  const diagramNavItems = buildDiagramNavItems(policyDiagrams, context.diagrams);
  const hasDiagrams = diagramNavItems.length > 0;

  const renderVisualiser = isVisualiserEnabled();
  const renderMessages = shouldRenderSideBarSection(policy, 'messages');
  const renderOwners = owners.length > 0 && shouldRenderSideBarSection(policy, 'owners');
  const renderRepository = policy.data.repository && shouldRenderSideBarSection(policy, 'repository');

  return {
    type: 'item',
    title: policy.data.name || policy.data.id,
    badge: 'Policy',
    summary: policy.data.summary,
    pages: [
      buildQuickReferenceSection([
        { title: 'Overview', href: buildUrl(`/docs/policies/${policy.data.id}/${policy.data.version}`) },
      ]),
      // Architecture section (always available, like services)
      {
        type: 'group',
        title: 'Architecture',
        icon: 'Workflow',
        pages: [
          {
            type: 'item',
            title: 'Overview',
            href: buildUrl(`/architecture/policies/${policy.data.id}/${policy.data.version}`),
          },
          renderVisualiser && {
            type: 'item',
            title: 'Map',
            href: buildUrl(`/visualiser/policies/${policy.data.id}/${policy.data.version}`),
          },
        ].filter(Boolean) as ChildRef[],
      },
      // Diagrams
      hasDiagrams && {
        type: 'group',
        title: 'Diagrams',
        icon: 'FileImage',
        pages: diagramNavItems,
      },
      // Triggered By (receives events)
      receivesMessages.length > 0 &&
        renderMessages && {
          type: 'group',
          title: 'Triggered By',
          icon: 'Zap',
          pages: receivesMessages.map((message) => `${pluralizeMessageType(message)}:${message.data.id}:${message.data.version}`),
        },
      // Dispatches (sends commands)
      sendsMessages.length > 0 &&
        renderMessages && {
          type: 'group',
          title: 'Dispatches',
          icon: 'Terminal',
          pages: sendsMessages.map((message) => `${pluralizeMessageType(message)}:${message.data.id}:${message.data.version}`),
        },
      // Owners
      renderOwners && buildOwnersSection(owners),
      // Repository
      renderRepository && buildRepositorySection(policy.data.repository as { url: string; language: string }),
      // Attachments
      hasAttachments && buildAttachmentsSection(policy.data.attachments as any[]),
    ].filter(Boolean) as ChildRef[],
  };
};
