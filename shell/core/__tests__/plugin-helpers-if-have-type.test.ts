import { getApplicableExtensionEnhancements } from '@shell/core/plugin-helpers';
import { ExtensionPoint, TabLocation } from '@shell/core/types';
import { SCHEMA } from '@shell/config/types';

const WIDGET = 'repro.example.com.widget';

const route: any = {
  params: { resource: 'configmap' },
  query:  {},
  hash:   '',
  name:   'c-cluster-product-resource',
  meta:   {},
};

/**
 * Store getters exposing the given schemas: `{ store: [{ id, collectionMethods, resourceMethods }] }`.
 * The current product keeps its resources in `cluster`.
 */
const gettersWith = (schemasByStore: { [store: string]: any[] }): any => {
  const getters: any = { currentStore: () => 'cluster' };

  Object.entries(schemasByStore).forEach(([store, schemas]) => {
    getters[`${ store }/schemaFor`] = (id: string) => schemas.find((s) => s.id === id);
    getters[`${ store }/all`] = (type: string) => (type === SCHEMA ? schemas : []);
  });

  return getters;
};

/**
 * Run the matcher for a single registered enhancement and report whether it applied: through a
 * component (`pluginCtx.$store`), or through a resource's table actions (`context.$rootGetters`).
 */
const matches = (locationConfig: any, getters: any, via: 'component' | 'resource' | 'none' = 'component'): boolean => {
  const $extension = { getUIConfig: () => [{ name: 'x', locationConfig }] };
  const pluginCtx: any = via === 'component' ? { $extension, $store: { getters } } : { $extension };
  const context: any = via === 'resource' ? { $rootGetters: getters } : undefined;

  return getApplicableExtensionEnhancements(
    pluginCtx, ExtensionPoint.TAB, TabLocation.OTHER as any, route, pluginCtx, context
  ).length === 1;
};

const widget = {
  id: WIDGET, collectionMethods: ['GET'], resourceMethods: ['GET']
};

describe('fx: getApplicableExtensionEnhancements, ifHaveType', () => {
  it('should apply when the type has a schema', () => {
    expect(matches({ resource: ['configmap'], ifHaveType: WIDGET }, gettersWith({ cluster: [widget] }))).toBe(true);
  });

  it('should not apply when the type has no schema (CRD missing or not readable)', () => {
    expect(matches({ resource: ['configmap'], ifHaveType: WIDGET }, gettersWith({ cluster: [] }))).toBe(false);
  });

  it('should still AND ifHaveType with the route params', () => {
    expect(matches({ resource: ['pod'], ifHaveType: WIDGET }, gettersWith({ cluster: [widget] }))).toBe(false);
  });

  it('should not change enhancements that do not ask for a type', () => {
    expect(matches({ resource: ['configmap'] }, gettersWith({ cluster: [] }))).toBe(true);
    expect(matches({ resource: ['configmap'] }, undefined, 'none')).toBe(true);
  });

  it('should require every type of an array', () => {
    const other = { id: 'other.example.com.thing' };

    expect(matches({ ifHaveType: [WIDGET, other.id] }, gettersWith({ cluster: [widget, other] }))).toBe(true);
    expect(matches({ ifHaveType: [WIDGET, other.id] }, gettersWith({ cluster: [widget] }))).toBe(false);
  });

  it('should match a RegExp against the schema ids', () => {
    expect(matches({ ifHaveType: /^repro\.example\.com\./ }, gettersWith({ cluster: [widget] }))).toBe(true);
    expect(matches({ ifHaveType: /^nope\./ }, gettersWith({ cluster: [widget] }))).toBe(false);
  });

  it('should look in the store given with { type, store }', () => {
    const getters = gettersWith({ cluster: [], management: [widget] });

    expect(matches({ ifHaveType: { type: WIDGET, store: 'management' } }, getters)).toBe(true);
    expect(matches({ ifHaveType: WIDGET }, getters)).toBe(false);
  });

  it('should require ifHaveVerb on the matching schemas', () => {
    const getters = gettersWith({ cluster: [widget] });

    expect(matches({ ifHaveType: WIDGET, ifHaveVerb: 'GET' }, getters)).toBe(true);
    expect(matches({ ifHaveType: WIDGET, ifHaveVerb: 'POST' }, getters)).toBe(false);
  });

  it('should treat a blocked verb as present, as the type-map does', () => {
    const getters = gettersWith({ cluster: [{ id: WIDGET, collectionMethods: ['blocked-POST'] }] });

    expect(matches({ ifHaveType: WIDGET, ifHaveVerb: 'POST' }, getters)).toBe(true);
  });

  it('should read the getters of a resource for its table actions', () => {
    expect(matches({ ifHaveType: WIDGET }, gettersWith({ cluster: [widget] }), 'resource')).toBe(true);
    expect(matches({ ifHaveType: WIDGET }, gettersWith({ cluster: [] }), 'resource')).toBe(false);
  });

  it('should not apply when a type is asked for but there are no getters to check it with', () => {
    expect(matches({ ifHaveType: WIDGET }, undefined, 'none')).toBe(false);
  });
});
