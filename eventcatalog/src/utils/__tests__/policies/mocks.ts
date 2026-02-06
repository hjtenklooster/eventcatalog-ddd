export const mockServices = [
  {
    id: 'NotificationService-1.0.0',
    slug: 'NotificationService',
    collection: 'services',
    data: {
      id: 'NotificationService',
      name: 'Notification Service',
      version: '1.0.0',
      // Sends OrderCreated (same event that triggers OrderPolicy)
      sends: [{ id: 'OrderCreated', version: '1.0.0' }],
      // Receives ProcessOrder (same command that OrderPolicy dispatches)
      receives: [{ id: 'ProcessOrder', version: '1.0.0' }],
    },
  },
];

export const mockDomains = [
  {
    id: 'OrderDomain',
    slug: 'OrderDomain',
    collection: 'domains',
    data: {
      id: 'OrderDomain',
      version: '0.0.1',
      policies: [
        {
          id: 'OrderPolicy',
          version: '1.0.0',
        },
      ],
    },
  },
];

export const mockEvents = [
  {
    id: 'OrderCreated-1.0.0',
    slug: 'OrderCreated',
    collection: 'events',
    data: {
      id: 'OrderCreated',
      name: 'Order Created',
      version: '1.0.0',
    },
  },
  {
    id: 'PaymentReceived-1.0.0',
    slug: 'PaymentReceived',
    collection: 'events',
    data: {
      id: 'PaymentReceived',
      name: 'Payment Received',
      version: '1.0.0',
    },
  },
];

export const mockCommands = [
  {
    id: 'ProcessOrder-1.0.0',
    slug: 'ProcessOrder',
    collection: 'commands',
    data: {
      id: 'ProcessOrder',
      name: 'Process Order',
      version: '1.0.0',
    },
  },
  {
    id: 'ChargePayment-1.0.0',
    slug: 'ChargePayment',
    collection: 'commands',
    data: {
      id: 'ChargePayment',
      name: 'Charge Payment',
      version: '1.0.0',
    },
  },
];

export const mockChannels = [
  {
    id: 'OrderChannel-1.0.0',
    slug: 'OrderChannel',
    collection: 'channels',
    data: {
      id: 'OrderChannel',
      version: '1.0.0',
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
    },
  },
];

export const mockPolicies = [
  {
    id: 'OrderPolicy-1.0.0',
    slug: 'OrderPolicy',
    collection: 'policies',
    data: {
      id: 'OrderPolicy',
      name: 'Order Policy',
      version: '1.0.0',
      conditions: ['Order total > $100'],
      receives: [{ id: 'OrderCreated', version: '1.0.0' }],
      sends: [{ id: 'ProcessOrder', version: '1.0.0' }],
    },
  },
  {
    id: 'SimplePolicy-1.0.0',
    slug: 'SimplePolicy',
    collection: 'policies',
    data: {
      id: 'SimplePolicy',
      name: 'Simple Policy',
      version: '1.0.0',
      // No sends/receives - testing policies without messaging
    },
  },
  {
    id: 'ChannelPolicy-1.0.0',
    slug: 'ChannelPolicy',
    collection: 'policies',
    data: {
      id: 'ChannelPolicy',
      name: 'Channel Policy',
      version: '1.0.0',
      receives: [
        {
          id: 'PaymentReceived',
          version: '1.0.0',
          from: [
            {
              id: 'OrderChannel',
              version: '1.0.0',
            },
          ],
        },
      ],
      sends: [
        {
          id: 'ChargePayment',
          version: '1.0.0',
          to: [
            {
              id: 'OrderChannel',
              version: '1.0.0',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'OrderPolicy-0.0.1',
    slug: 'OrderPolicy',
    collection: 'policies',
    data: {
      id: 'OrderPolicy',
      name: 'Order Policy',
      version: '0.0.1',
      receives: [{ id: 'OrderCreated', version: '0.0.1' }],
      sends: [{ id: 'ProcessOrder', version: '0.0.1' }],
    },
  },
];
