import { vehicleApi } from './vehicleApi';
import { store } from '../../app/store';
import { setupStore } from 'testUtil';

jest.mock('../../app/store', () => ({
  store: {
    getState: jest.fn(),
  },
}));

describe('vehicleApi', () => {
  let mockStore: ReturnType<typeof setupStore>;
  const initialState = {
    api: {
      queries: {
        'searchVehicles("xxx")': {
          fulfilledTimeStamp: Date.now(),
          data: [
            { id: '1', name: 'Vehicle 1', engines: [] },
            { id: '2', name: 'Vehicle 2', engines: [] },
          ],
        },
      },
    },
  };

  beforeEach(() => {
    mockStore = setupStore(initialState);
    (store.getState as jest.Mock).mockReturnValue(mockStore.getState());
  });

  it.only('searchVehicles should have data from cache', async () => {
    const { data } = await mockStore.dispatch(
      vehicleApi.endpoints.searchVehicles.initiate({ orderId: 'xxx' })
    );
    expect(data!.length).toBe(2);
  });
});
