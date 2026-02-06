export type CollectionTypes =
  | 'commands'
  | 'events'
  | 'queries'
  | 'domains'
  | 'services'
  | 'flows'
  | 'channels'
  | 'entities'
  | 'policies'
  | 'views'
  | 'actors'
  | 'containers'
  | 'diagrams'
  | 'data-products';
export type CollectionMessageTypes = 'commands' | 'events' | 'queries';
export type CollectionUserTypes = 'users';
export type PageTypes =
  | 'events'
  | 'commands'
  | 'queries'
  | 'services'
  | 'domains'
  | 'channels'
  | 'flows'
  | 'entities'
  | 'policies'
  | 'views'
  | 'actors'
  | 'containers'
  | 'diagrams'
  | 'data-products';

export type TableConfiguration = {
  columns: {
    [key: string]: {
      label?: string;
      visible?: boolean;
    };
  };
};
