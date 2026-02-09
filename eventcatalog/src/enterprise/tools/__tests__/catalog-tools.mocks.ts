/**
 * Mock data for catalog-tools tests
 * Follows the Astro content collection structure
 */

// ============================================
// Mock Events
// ============================================
export const mockEvents = [
  {
    id: 'OrderCreated-1.0.0',
    slug: 'events/OrderCreated',
    collection: 'events',
    body: 'Order created event description',
    data: {
      id: 'OrderCreated',
      name: 'Order Created',
      version: '1.0.0',
      summary: 'Fired when an order is created',
      owners: ['order-team', { id: 'user-jane' }],
    },
  },
  {
    id: 'OrderCreated-2.0.0',
    slug: 'events/OrderCreated',
    collection: 'events',
    body: 'Order created event v2 description',
    data: {
      id: 'OrderCreated',
      name: 'Order Created V2',
      version: '2.0.0',
      summary: 'Updated order created event',
      owners: ['order-team'],
    },
  },
  {
    id: 'PaymentProcessed-1.0.0',
    slug: 'events/PaymentProcessed',
    collection: 'events',
    body: 'Payment processed event description',
    data: {
      id: 'PaymentProcessed',
      name: 'Payment Processed',
      version: '1.0.0',
      summary: 'Fired when a payment is processed',
      owners: ['payment-team'],
    },
  },
  {
    id: 'InventoryUpdated-1.0.0',
    slug: 'events/InventoryUpdated',
    collection: 'events',
    body: 'Inventory updated event description',
    data: {
      id: 'InventoryUpdated',
      name: 'Inventory Updated',
      version: '1.0.0',
      summary: 'Fired when inventory is updated',
      owners: [{ id: 'inventory-team' }],
    },
  },
];

// ============================================
// Mock Services
// ============================================
export const mockServices = [
  {
    id: 'OrderService-1.0.0',
    slug: 'services/OrderService',
    collection: 'services',
    body: 'Order service description',
    data: {
      id: 'OrderService',
      name: 'Order Service',
      version: '1.0.0',
      summary: 'Handles order processing',
      owners: ['order-team'],
      sends: [{ id: 'OrderCreated', version: '1.0.0' }],
      receives: [{ id: 'PaymentProcessed', version: '1.0.0' }],
      flows: [{ id: 'OrderFlow' }],
    },
  },
  {
    id: 'PaymentService-1.0.0',
    slug: 'services/PaymentService',
    collection: 'services',
    body: 'Payment service description',
    data: {
      id: 'PaymentService',
      name: 'Payment Service',
      version: '1.0.0',
      summary: 'Handles payment processing',
      owners: ['payment-team', { id: 'user-bob' }],
      sends: [{ id: 'PaymentProcessed', version: 'latest' }],
      receives: [{ id: 'OrderCreated' }], // No version = all versions
    },
  },
  {
    id: 'InventoryService-1.0.0',
    slug: 'services/InventoryService',
    collection: 'services',
    body: 'Inventory service description',
    data: {
      id: 'InventoryService',
      name: 'Inventory Service',
      version: '1.0.0',
      summary: 'Handles inventory management',
      owners: [{ id: 'inventory-team' }],
      sends: [{ id: 'InventoryUpdated', version: '1.0.0' }],
      receives: [{ id: 'OrderCreated', version: '1.0.0' }],
    },
  },
  {
    id: 'NotificationService-1.0.0',
    slug: 'services/NotificationService',
    collection: 'services',
    body: 'Notification service description',
    data: {
      id: 'NotificationService',
      name: 'Notification Service',
      version: '1.0.0',
      summary: 'Sends notifications',
      owners: [],
      receives: [{ id: 'OrderCreated', version: '2.0.0' }],
    },
  },
];

// ============================================
// Mock Commands
// ============================================
export const mockCommands = [
  {
    id: 'CreateOrder-1.0.0',
    slug: 'commands/CreateOrder',
    collection: 'commands',
    body: 'Create order command description',
    data: {
      id: 'CreateOrder',
      name: 'Create Order',
      version: '1.0.0',
      summary: 'Command to create an order',
      owners: ['order-team'],
    },
  },
];

// ============================================
// Mock Queries
// ============================================
export const mockQueries = [
  {
    id: 'GetOrder-1.0.0',
    slug: 'queries/GetOrder',
    collection: 'queries',
    body: 'Get order query description',
    data: {
      id: 'GetOrder',
      name: 'Get Order',
      version: '1.0.0',
      summary: 'Query to get an order',
      owners: ['order-team'],
    },
  },
];

// ============================================
// Mock Flows
// ============================================
export const mockFlows = [
  {
    id: 'OrderFlow-1.0.0',
    slug: 'flows/OrderFlow',
    collection: 'flows',
    body: '# Order Processing Flow\n\nDetailed flow description in markdown.',
    data: {
      id: 'OrderFlow',
      name: 'Order Processing Flow',
      version: '1.0.0',
      summary: 'End-to-end order processing workflow',
      owners: ['order-team'],
      steps: [
        { id: 1, title: 'Order Placed', next_step: 2 },
        { id: 2, title: 'Payment Processing', message: { id: 'PaymentProcessed', version: '1.0.0' }, next_step: 3 },
        { id: 3, title: 'Order Confirmed' },
      ],
      mermaid: 'graph TD; A[Order Placed]-->B[Payment Processing]; B-->C[Order Confirmed];',
    },
  },
  {
    id: 'PaymentFlow-1.0.0',
    slug: 'flows/PaymentFlow',
    collection: 'flows',
    body: 'Payment flow description',
    data: {
      id: 'PaymentFlow',
      name: 'Payment Flow',
      version: '1.0.0',
      summary: 'Payment processing workflow',
      owners: ['payment-team'],
      steps: [],
    },
  },
];

// ============================================
// Mock Domains (with subdomains for ubiquitous language testing)
// ============================================
export const mockDomains = [
  {
    id: 'OrderDomain-1.0.0',
    slug: 'domains/OrderDomain',
    collection: 'domains',
    filePath: '/domains/OrderDomain/index.mdx',
    body: 'Order domain description',
    data: {
      id: 'OrderDomain',
      name: 'Order Domain',
      version: '1.0.0',
      summary: 'Order management domain',
      owners: ['order-team'],
      // Subdomains reference
      domains: [
        {
          data: {
            id: 'FulfillmentSubdomain',
            name: 'Fulfillment Subdomain',
            version: '1.0.0',
          },
          filePath: '/domains/OrderDomain/FulfillmentSubdomain/index.mdx',
        },
      ],
    },
  },
  {
    id: 'FulfillmentSubdomain-1.0.0',
    slug: 'domains/FulfillmentSubdomain',
    collection: 'domains',
    filePath: '/domains/OrderDomain/FulfillmentSubdomain/index.mdx',
    body: 'Fulfillment subdomain description',
    data: {
      id: 'FulfillmentSubdomain',
      name: 'Fulfillment Subdomain',
      version: '1.0.0',
      summary: 'Handles order fulfillment',
      owners: ['order-team'],
    },
  },
  {
    id: 'EmptyDomain-1.0.0',
    slug: 'domains/EmptyDomain',
    collection: 'domains',
    filePath: '/domains/EmptyDomain/index.mdx',
    body: 'Empty domain description',
    data: {
      id: 'EmptyDomain',
      name: 'Empty Domain',
      version: '1.0.0',
      summary: 'Domain with no ubiquitous language',
      owners: [],
    },
  },
];

// ============================================
// Mock Ubiquitous Languages
// ============================================
export const mockUbiquitousLanguages = [
  {
    id: 'OrderDomain-language',
    slug: 'ubiquitousLanguages/OrderDomain',
    collection: 'ubiquitousLanguages',
    filePath: '/domains/OrderDomain/language.mdx',
    body: 'Order domain ubiquitous language',
    data: {
      dictionary: [
        {
          id: 'order',
          name: 'Order',
          summary: 'A request to purchase goods or services',
          icon: 'ShoppingCart',
        },
        {
          id: 'line-item',
          name: 'Line Item',
          summary: 'An individual product or service within an order',
          icon: 'Package',
        },
        {
          id: 'customer',
          name: 'Customer',
          summary: 'A person or entity placing an order',
        },
      ],
    },
  },
  {
    id: 'FulfillmentSubdomain-language',
    slug: 'ubiquitousLanguages/FulfillmentSubdomain',
    collection: 'ubiquitousLanguages',
    filePath: '/domains/OrderDomain/FulfillmentSubdomain/language.mdx',
    body: 'Fulfillment subdomain ubiquitous language',
    data: {
      dictionary: [
        {
          id: 'shipment',
          name: 'Shipment',
          summary: 'A package sent to fulfill an order',
          icon: 'Truck',
        },
        {
          id: 'customer',
          name: 'Customer',
          summary: 'Duplicate term - recipient of a shipment',
        },
      ],
    },
  },
];

// ============================================
// Mock Channels
// ============================================
export const mockChannels = [
  {
    id: 'OrderChannel-1.0.0',
    slug: 'channels/OrderChannel',
    collection: 'channels',
    body: 'Order channel description',
    data: {
      id: 'OrderChannel',
      name: 'Order Channel',
      version: '1.0.0',
      summary: 'Channel for order events',
      owners: ['order-team'],
    },
  },
];

// ============================================
// Mock Entities
// ============================================
export const mockEntities = [
  {
    id: 'Order-1.0.0',
    slug: 'entities/Order',
    collection: 'entities',
    body: 'Order entity description',
    data: {
      id: 'Order',
      name: 'Order',
      version: '1.0.0',
      summary: 'Order aggregate root entity',
      owners: ['order-team'],
      // Entity sends OrderCreated event (same as OrderService)
      sends: [{ id: 'OrderCreated', version: '1.0.0' }],
      // Entity receives CreateOrder command
      receives: [{ id: 'CreateOrder', version: '1.0.0' }],
    },
  },
  {
    id: 'InventoryItem-1.0.0',
    slug: 'entities/InventoryItem',
    collection: 'entities',
    body: 'Inventory item entity description',
    data: {
      id: 'InventoryItem',
      name: 'Inventory Item',
      version: '1.0.0',
      summary: 'Inventory item entity',
      owners: ['inventory-team'],
      // Entity sends InventoryUpdated event
      sends: [{ id: 'InventoryUpdated', version: '1.0.0' }],
      // Entity receives OrderCreated to reserve stock
      receives: [{ id: 'OrderCreated', version: '1.0.0' }],
    },
  },
];

// ============================================
// Mock Policies
// ============================================
export const mockPolicies = [
  {
    id: 'AutoConfirmOrder-1.0.0',
    slug: 'policies/AutoConfirmOrder',
    collection: 'policies',
    body: 'Auto confirm order policy description',
    data: {
      id: 'AutoConfirmOrder',
      name: 'Auto Confirm Order',
      version: '1.0.0',
      summary: 'Automatically confirms orders when payment is completed',
      owners: ['order-team'],
      // Policy receives PaymentProcessed event (triggered by)
      receives: [{ id: 'PaymentProcessed', version: '1.0.0' }],
      // Policy sends CreateOrder command (dispatches)
      sends: [{ id: 'CreateOrder', version: '1.0.0' }],
      conditions: ["Order.status = 'pending'", 'Payment.amount >= Order.total'],
    },
  },
  {
    id: 'NotifyInventory-1.0.0',
    slug: 'policies/NotifyInventory',
    collection: 'policies',
    body: 'Notify inventory policy description',
    data: {
      id: 'NotifyInventory',
      name: 'Notify Inventory',
      version: '1.0.0',
      summary: 'Notifies inventory when an order is created',
      owners: ['inventory-team'],
      // Policy receives OrderCreated event
      receives: [{ id: 'OrderCreated', version: '1.0.0' }],
      // Policy sends no commands (just reacts)
      sends: [],
    },
  },
];

// ============================================
// Mock Views
// ============================================
export const mockViews = [
  {
    id: 'OrderSummary-1.0.0',
    slug: 'views/OrderSummary',
    collection: 'views',
    body: 'Order summary view description',
    data: {
      id: 'OrderSummary',
      name: 'Order Summary',
      version: '1.0.0',
      summary: 'Read model showing current order status and details',
      owners: ['order-team'],
      subscribes: [{ id: 'OrderCreated', version: '1.0.0' }],
      informs: [{ id: 'CustomerSupport', version: '1.0.0' }],
    },
  },
  {
    id: 'InventoryStatus-1.0.0',
    slug: 'views/InventoryStatus',
    collection: 'views',
    body: 'Inventory status view description',
    data: {
      id: 'InventoryStatus',
      name: 'Inventory Status',
      version: '1.0.0',
      summary: 'Read model showing current inventory levels',
      owners: ['inventory-team'],
      subscribes: [{ id: 'InventoryUpdated', version: '1.0.0' }],
      informs: [],
    },
  },
];

// ============================================
// Mock Actors
// ============================================
export const mockActors = [
  {
    id: 'CustomerSupport-1.0.0',
    slug: 'actors/CustomerSupport',
    collection: 'actors',
    body: 'Customer support actor description',
    data: {
      id: 'CustomerSupport',
      name: 'Customer Support',
      version: '1.0.0',
      summary: 'Support agent handling customer inquiries',
      owners: ['support-team'],
      reads: [{ id: 'OrderSummary', version: '1.0.0' }],
      issues: [{ id: 'CreateOrder', version: '1.0.0' }],
    },
  },
  {
    id: 'WarehouseManager-1.0.0',
    slug: 'actors/WarehouseManager',
    collection: 'actors',
    body: 'Warehouse manager actor description',
    data: {
      id: 'WarehouseManager',
      name: 'Warehouse Manager',
      version: '1.0.0',
      summary: 'Manager overseeing warehouse operations',
      owners: ['inventory-team'],
      reads: [{ id: 'InventoryStatus', version: '1.0.0' }],
      issues: [],
    },
  },
];

// ============================================
// Mock Teams
// ============================================
export const mockTeams = [
  {
    id: 'order-team',
    slug: 'teams/order-team',
    collection: 'teams',
    body: 'The order team handles all order-related services.',
    data: {
      id: 'order-team',
      name: 'Order Team',
      email: 'order-team@company.com',
      slackDirectMessageUrl: 'https://slack.com/dm/order-team',
      members: ['user-jane', 'user-john'],
      summary: 'Handles order processing',
    },
  },
  {
    id: 'payment-team',
    slug: 'teams/payment-team',
    collection: 'teams',
    body: 'The payment team handles all payment-related services.',
    data: {
      id: 'payment-team',
      name: 'Payment Team',
      email: 'payment-team@company.com',
      slackDirectMessageUrl: 'https://slack.com/dm/payment-team',
      members: ['user-bob'],
      summary: 'Handles payment processing',
    },
  },
  {
    id: 'inventory-team',
    slug: 'teams/inventory-team',
    collection: 'teams',
    body: 'The inventory team handles all inventory-related services.',
    data: {
      id: 'inventory-team',
      name: 'Inventory Team',
      email: 'inventory-team@company.com',
      members: [],
      summary: 'Handles inventory management',
    },
  },
];

// ============================================
// Mock Users
// ============================================
export const mockUsers = [
  {
    id: 'user-jane',
    slug: 'users/user-jane',
    collection: 'users',
    body: 'Jane is the lead engineer on the order team.',
    data: {
      id: 'user-jane',
      name: 'Jane Doe',
      email: 'jane@company.com',
      role: 'Lead Engineer',
      slackDirectMessageUrl: 'https://slack.com/dm/jane',
      summary: 'Lead engineer on order team',
    },
  },
  {
    id: 'user-john',
    slug: 'users/user-john',
    collection: 'users',
    body: 'John is a senior engineer on the order team.',
    data: {
      id: 'user-john',
      name: 'John Smith',
      email: 'john@company.com',
      role: 'Senior Engineer',
      slackDirectMessageUrl: 'https://slack.com/dm/john',
      summary: 'Senior engineer on order team',
    },
  },
  {
    id: 'user-bob',
    slug: 'users/user-bob',
    collection: 'users',
    body: 'Bob is the lead engineer on the payment team.',
    data: {
      id: 'user-bob',
      name: 'Bob Johnson',
      email: 'bob@company.com',
      role: 'Lead Engineer',
      summary: 'Lead engineer on payment team',
    },
  },
];

// ============================================
// Mock Containers (for completeness)
// ============================================
export const mockContainers = [
  {
    id: 'OrderDatabase-1.0.0',
    slug: 'containers/OrderDatabase',
    collection: 'containers',
    body: 'Order database description',
    data: {
      id: 'OrderDatabase',
      name: 'Order Database',
      version: '1.0.0',
      summary: 'Order data storage',
    },
  },
];

// ============================================
// Mock Diagrams (for completeness)
// ============================================
export const mockDiagrams = [
  {
    id: 'SystemOverview-1.0.0',
    slug: 'diagrams/SystemOverview',
    collection: 'diagrams',
    body: 'System overview diagram',
    data: {
      id: 'SystemOverview',
      name: 'System Overview',
      version: '1.0.0',
      summary: 'High-level system diagram',
    },
  },
];

// ============================================
// Helper to get all mocks by collection
// ============================================
export const mockCollections: Record<string, any[]> = {
  events: mockEvents,
  services: mockServices,
  commands: mockCommands,
  queries: mockQueries,
  flows: mockFlows,
  domains: mockDomains,
  channels: mockChannels,
  entities: mockEntities,
  policies: mockPolicies,
  views: mockViews,
  actors: mockActors,
  containers: mockContainers,
  diagrams: mockDiagrams,
  teams: mockTeams,
  users: mockUsers,
  ubiquitousLanguages: mockUbiquitousLanguages,
};
