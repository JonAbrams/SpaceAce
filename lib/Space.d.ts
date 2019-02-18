// Type definitions for Space.js
// Project: SpaceAce

export as namespace SpaceAce;

interface ActionParams {
  merge(mergeObj: object): Space;
  replace(newState: object): Space;
  getSpace(): Space;
  space: Space;
  rootSpace: Space;
}

export interface CustomAction {
  (actionParams: ActionParams, ...args: any[]): Space | void;
}

interface Event {
  target: { checked?: boolean; value?: string; type: string };
}

interface SimpleEventHandler {
  (event: Event | any): Space;
}
interface EventHandler {
  (...args: any[]): Space | Promise<Space>;
}

interface Space {
  (mergeObj: object, actionName?: string): Space;
  (attributeName: string): SimpleEventHandler;
  (customAction: CustomAction, ...args: any[]): EventHandler;
  toJSON(): object;
  toString(): string;
  [attribute: string]: Space | Space[] | any;
}

interface SubscriberParams {
  newSpace: Space;
  oldSpace?: Space;
  causedBy?: string;
  cancel?(): void;
}

interface Subscriber {
  (subscriberParams: SubscriberParams): object | void;
}

export function rootOf(space: Space): Space;
export function newestSpace(space: Space): Space;
export function isSpace(space: Space | any): boolean;
export function subscribe(space: Space, subscriber: Subscriber): boolean;
export function createSpace(initialState: object): Space;
