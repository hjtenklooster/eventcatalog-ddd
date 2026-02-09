import type { View } from '@utils/collections/views';
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

export const buildViewNode = (view: View, owners: any[], context: ResourceGroupContext): NavNode => {
  const subscribesMessages = view.data.subscribes || [];
  const informsActors = view.data.informs || [];
  const readByActors = view.data.readByActors || [];

  const hasAttachments = (view.data.attachments?.length ?? 0) > 0;
  const viewDiagrams = view.data.diagrams || [];
  const diagramNavItems = buildDiagramNavItems(viewDiagrams, context.diagrams);
  const hasDiagrams = diagramNavItems.length > 0;

  const renderVisualiser = isVisualiserEnabled();
  const renderMessages = shouldRenderSideBarSection(view, 'messages');
  const renderActors = shouldRenderSideBarSection(view, 'actors');
  const renderOwners = owners.length > 0 && shouldRenderSideBarSection(view, 'owners');
  const renderRepository = view.data.repository && shouldRenderSideBarSection(view, 'repository');

  return {
    type: 'item',
    title: view.data.name || view.data.id,
    badge: 'View',
    summary: view.data.summary,
    pages: [
      buildQuickReferenceSection([
        { title: 'Overview', href: buildUrl(`/docs/views/${view.data.id}/${view.data.version}`) },
      ]),
      {
        type: 'group',
        title: 'Architecture',
        icon: 'Workflow',
        pages: [
          {
            type: 'item',
            title: 'Overview',
            href: buildUrl(`/architecture/views/${view.data.id}/${view.data.version}`),
          },
          renderVisualiser && {
            type: 'item',
            title: 'Map',
            href: buildUrl(`/visualiser/views/${view.data.id}/${view.data.version}`),
          },
        ].filter(Boolean) as ChildRef[],
      },
      hasDiagrams && {
        type: 'group',
        title: 'Diagrams',
        icon: 'FileImage',
        pages: diagramNavItems,
      },
      // Subscribes (events this view subscribes to)
      subscribesMessages.length > 0 &&
        renderMessages && {
          type: 'group',
          title: 'Subscribes',
          icon: 'Zap',
          pages: subscribesMessages.map((event) => `event:${event.data.id}:${event.data.version}`),
        },
      // Informs (actors this view informs)
      informsActors.length > 0 &&
        renderActors && {
          type: 'group',
          title: 'Informs',
          icon: 'User',
          pages: informsActors.map((actor) => `actor:${actor.data.id}:${actor.data.version}`),
        },
      // Read By Actors (actors that declare they read this view, excluding informs)
      readByActors.length > 0 &&
        renderActors && {
          type: 'group',
          title: 'Read By Actors',
          icon: 'User',
          pages: readByActors.map((actor: any) => `actor:${actor.data.id}:${actor.data.version}`),
        },
      renderOwners && buildOwnersSection(owners),
      renderRepository && buildRepositorySection(view.data.repository as { url: string; language: string }),
      hasAttachments && buildAttachmentsSection(view.data.attachments as any[]),
    ].filter(Boolean) as ChildRef[],
  };
};
