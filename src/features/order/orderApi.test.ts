import { trackableUpdateQueryData } from 'edits/trackableUpdate';
import { updateOrderAction } from './orderApi';
import type { Order } from 'types';

jest.mock('edits/trackableUpdate', () => ({
  trackableUpdateQueryData: jest.fn(),
}));

const mockTUQD = trackableUpdateQueryData as jest.Mock;

/** Call updateOrderAction and return the recipe it passed to trackableUpdateQueryData. */
const getRecipe = (
  orderId: string,
  arg?: Partial<Order> | ((draft: Order) => void),
): ((draft: Order[]) => void) => {
  updateOrderAction(orderId, arg as any);
  return mockTUQD.mock.calls[0][2];
};

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: '1',
  name: 'Original',
  ...overrides,
});

describe('updateOrderAction', () => {
  it('passes endpointName "getOrders" with undefined arg to trackableUpdateQueryData', () => {
    updateOrderAction('1', { name: 'x' });
    expect(mockTUQD).toHaveBeenCalledWith('getOrders', undefined, expect.any(Function));
  });

  it('with a partial object: merges the fields and sets __isDirty', () => {
    const recipe = getRecipe('1', { name: 'Updated' });
    const draft = [makeOrder()];
    recipe(draft);
    expect(draft[0].name).toBe('Updated');
    expect(draft[0].__isDirty).toBe(true);
  });

  it('with a function: calls the updater on the matching order and sets __isDirty', () => {
    const recipe = getRecipe('1', o => { o.name = 'Via Fn'; });
    const draft = [makeOrder()];
    recipe(draft);
    expect(draft[0].name).toBe('Via Fn');
    expect(draft[0].__isDirty).toBe(true);
  });

  it('with no second argument: only sets __isDirty', () => {
    const recipe = getRecipe('1');
    const draft = [makeOrder()];
    recipe(draft);
    expect(draft[0].name).toBe('Original');
    expect(draft[0].__isDirty).toBe(true);
  });

  it('with an unknown orderId: is a no-op (returns without modifying the draft)', () => {
    const recipe = getRecipe('unknown', { name: 'Should not apply' });
    const draft = [makeOrder({ id: '1' })];
    recipe(draft);
    expect(draft[0].name).toBe('Original');
    expect(draft[0].__isDirty).toBeUndefined();
  });

  it('only updates the matching order when the draft contains multiple orders', () => {
    const recipe = getRecipe('2', { name: 'Order 2 Updated' });
    const draft = [makeOrder({ id: '1' }), makeOrder({ id: '2', name: 'Order 2' })];
    recipe(draft);
    expect(draft[0].__isDirty).toBeUndefined();
    expect(draft[1].name).toBe('Order 2 Updated');
    expect(draft[1].__isDirty).toBe(true);
  });
});
