import type { Actor } from '@utils/collections/actors';
import { buildUrl } from '@utils/url-builder';
import { isVisualiserEnabled } from '@utils/feature';
import type { NavNode, ChildRef, ResourceGroupContext } from './shared';
import {
  buildQuickReferenceSection,
  buildOwnersSection,
  shouldRenderSideBarSection,
  buildRepositorySection,
  buildAttachmentsSection,
  buildDiagramNavItems,
} from './shared';

export const buildActorNode = (actor: Actor, owners: any[], context: ResourceGroupContext): NavNode => {
  const readsViews = actor.data.reads || [];
  const issuesCommands = actor.data.issues || [];

  const hasAttachments = (actor.data.attachments?.length ?? 0) > 0;
  const actorDiagrams = actor.data.diagrams || [];
  const diagramNavItems = buildDiagramNavItems(actorDiagrams, context.diagrams);
  const hasDiagrams = diagramNavItems.length > 0;

  const renderVisualiser = isVisualiserEnabled();
  const renderOwners = owners.length > 0 && shouldRenderSideBarSection(actor, 'owners');
  const renderRepository = actor.data.repository && shouldRenderSideBarSection(actor, 'repository');

  return {
    type: 'item',
    title: actor.data.name || actor.data.id,
    badge: 'Actor',
    summary: actor.data.summary,
    pages: [
      buildQuickReferenceSection([
        { title: 'Overview', href: buildUrl(`/docs/actors/${actor.data.id}/${actor.data.version}`) },
      ]),
      {
        type: 'group',
        title: 'Architecture',
        icon: 'Workflow',
        pages: [
          {
            type: 'item',
            title: 'Overview',
            href: buildUrl(`/architecture/actors/${actor.data.id}/${actor.data.version}`),
          },
          renderVisualiser && {
            type: 'item',
            title: 'Map',
            href: buildUrl(`/visualiser/actors/${actor.data.id}/${actor.data.version}`),
          },
        ].filter(Boolean) as ChildRef[],
      },
      hasDiagrams && {
        type: 'group',
        title: 'Diagrams',
        icon: 'FileImage',
        pages: diagramNavItems,
      },
      // Reads (views this actor reads)
      readsViews.length > 0 && {
        type: 'group',
        title: 'Reads',
        icon: 'Eye',
        pages: readsViews.map((view) => `view:${view.data.id}:${view.data.version}`),
      },
      // Issues (commands this actor issues)
      issuesCommands.length > 0 && {
        type: 'group',
        title: 'Issues',
        icon: 'Terminal',
        pages: issuesCommands.map((cmd) => `commands:${cmd.data.id}:${cmd.data.version}`),
      },
      renderOwners && buildOwnersSection(owners),
      renderRepository && buildRepositorySection(actor.data.repository as { url: string; language: string }),
      hasAttachments && buildAttachmentsSection(actor.data.attachments as any[]),
    ].filter(Boolean) as ChildRef[],
  };
};
