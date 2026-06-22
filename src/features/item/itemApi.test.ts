import { itemApi } from './itemApi';
import { store } from '../../app/store';
import { setupStore } from 'testUtil';

jest.mock('../../app/store', () => ({
  store: {
    getState: jest.fn(),
  },
}));

describe('itemApi', () => {
  let mockStore: ReturnType<typeof setupStore>;
  const initialState = {
    api: {
      queries: {
        'searchItems("xxx")': {
          fulfilledTimeStamp: Date.now(),
          data: [
            { id: '1', name: 'Item 1' },
            { id: '2', name: 'Item 2' },
          ],
        },
      },
    },
  };

  beforeEach(() => {
    mockStore = setupStore(initialState);
    (store.getState as jest.Mock).mockReturnValue(mockStore.getState());
  });

  it.only('searchItems should have data from cache', async () => {
    const { data } = await mockStore.dispatch(
      itemApi.endpoints.searchItems.initiate({ orderId: 'xxx' })
    );
    expect(data!.length).toBe(2);
  });
});
