export const mockEvents = [
  {
    id: 'OrderConfirmed-0.0.1',
    slug: 'OrderConfirmed',
    collection: 'events',
    data: {
      id: 'OrderConfirmed',
      name: 'Order Confirmed',
      version: '0.0.1',
    },
  },
  {
    id: 'OrderAmended-0.0.1',
    slug: 'OrderAmended',
    collection: 'events',
    data: {
      id: 'OrderAmended',
      name: 'Order Amended',
      version: '0.0.1',
    },
  },
];

export const mockActors = [
  {
    id: 'CustomerSupportAgent-1.0.0',
    slug: 'CustomerSupportAgent',
    collection: 'actors',
    data: {
      id: 'CustomerSupportAgent',
      name: 'Customer Support Agent',
      version: '1.0.0',
      reads: [{ id: 'OrderSummaryView', version: '1.0.0' }],
      issues: [{ id: 'UpdateInventory', version: '1.0.0' }],
    },
  },
];

export const mockViews = [
  {
    id: 'OrderSummaryView-1.0.0',
    slug: 'OrderSummaryView',
    collection: 'views',
    data: {
      id: 'OrderSummaryView',
      name: 'Order Summary View',
      version: '1.0.0',
      subscribes: [
        { id: 'OrderConfirmed', version: '0.0.1' },
        { id: 'OrderAmended', version: '0.0.1' },
      ],
      informs: [{ id: 'CustomerSupportAgent', version: '1.0.0' }],
    },
  },
];

export const mockCommands = [
  {
    id: 'UpdateInventory-1.0.0',
    slug: 'UpdateInventory',
    collection: 'commands',
    data: {
      id: 'UpdateInventory',
      name: 'Update Inventory',
      version: '1.0.0',
    },
  },
];

export const mockServices = [
  {
    id: 'OrderService-1.0.0',
    slug: 'OrderService',
    collection: 'services',
    data: {
      id: 'OrderService',
      name: 'Order Service',
      version: '1.0.0',
      sends: [{ id: 'OrderConfirmed', version: '0.0.1' }],
      receives: [{ id: 'UpdateInventory', version: '1.0.0' }],
    },
  },
];

export const mockEntities = [
  {
    id: 'OrderEntity-1.0.0',
    slug: 'OrderEntity',
    collection: 'entities',
    data: {
      id: 'OrderEntity',
      name: 'Order Entity',
      version: '1.0.0',
      sends: [{ id: 'OrderConfirmed', version: '0.0.1' }],
      receives: [{ id: 'UpdateInventory', version: '1.0.0' }],
    },
  },
];

export const mockChannels: any[] = [];
