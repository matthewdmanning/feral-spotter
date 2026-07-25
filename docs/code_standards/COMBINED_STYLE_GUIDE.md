# Google TypeScript Style Guide — Categorized Summary

Source: <https://github.com/google/styleguide/blob/gh-pages/tsguide.html>

Apply RFC 2119 meanings to **must**, **must not**, **should**, **should not**, and **may**. Treat **prefer** as **should** and **avoid** as **should not**. Treat imperative and declarative statements as mandatory. Treat examples as illustrative rather than exhaustive.

## 1. Semantic rules

### Use `const` and `let`

Use `const` by default. Use `let` only when reassignment is required. Never use `var`. Declare variables before use.

```ts
// Good
const endpoint = "/api";
let attempts = 0;
attempts++;
```

```ts
// Bad
var endpoint = "/api";
value = 3;
let value;
```

### Do not use the `Array` constructor

Use array literals or `Array.from`.

```ts
// Good
const values = [2, 3];
const zeros = Array.from<number>({ length: 5 }).fill(0);
```

```ts
// Bad
const values = new Array(2, 3);
const empty = new Array(5);
```

### Do not add named properties to arrays

Use `Map` or an object.

```ts
// Good
const labels = new Map<number, string>();
labels.set(0, "first");
```

```ts
// Bad
const labels: string[] = [];
(labels as any).first = "value";
```

### Spread only compatible values

Spread iterables into arrays and objects into object literals.

```ts
// Good
const optionalValues = includeExtra ? [7] : [];
const combined = [5, ...optionalValues];

const extra = includeExtra ? { retries: 3 } : {};
const options = { timeout: 1000, ...extra };
```

```ts
// Bad
const combined = [5, ...(includeExtra && [7])];
const options = { timeout: 1000, ...(includeExtra && { retries: 3 }) };
const objectFromArray = { ...["a", "b"] };
```

### Iterate objects safely

Prefer `Object.keys`, `Object.values`, or `Object.entries`.

```ts
// Good
for (const [key, value] of Object.entries(record)) {
  useEntry(key, value);
}
```

```ts
// Bad
for (const key in record) {
  use(record[key]);
}
```

Filter inherited properties when `for...in` is required.

```ts
for (const key in record) {
  if (!record.hasOwnProperty(key)) continue;
  use(record[key]);
}
```

### Keep getters pure

Do not mutate observable state in getters.

```ts
// Good
class Account {
  constructor(private readonly balanceCents: number) {}

  get balance() {
    return this.balanceCents / 100;
  }
}
```

```ts
// Bad
class Sequence {
  private nextId = 0;

  get next() {
    return this.nextId++;
  }
}
```

Do not create pass-through accessors solely to hide a property.

```ts
// Good
class Label {
  private storedValue = "";

  get value() {
    return this.storedValue || "untitled";
  }

  set value(next: string) {
    this.storedValue = next.trim();
  }
}
```

```ts
// Bad
class Label {
  private storedValue = "";

  get value() {
    return this.storedValue;
  }

  set value(next: string) {
    this.storedValue = next;
  }
}
```

### Make `toString` safe

Ensure `toString` always succeeds and has no visible side effects.

```ts
// Good
class User {
  constructor(private readonly name: string) {}

  toString() {
    return `User(${this.name})`;
  }
}
```

```ts
// Bad
class User {
  toString() {
    this.logAccess();
    return this.loadRemoteName();
  }
}
```

### Do not rely on static dynamic dispatch

Call static methods on the class that defines them. Do not use `this` in static contexts.

```ts
// Good
class Inventory {
  private static readonly storage = new Map<string, Item>();

  static has(item: Item) {
    return Inventory.storage.has(item.id);
  }
}
```

```ts
// Bad
class Inventory {
  private static readonly storage = new Map<string, Item>();

  static has(item: Item) {
    return this.storage.has(item.id);
  }
}
```

### Use `readonly`

Mark properties that are not reassigned after construction.

```ts
// Good
class Config {
  constructor(readonly endpoint: string) {}
}
```

```ts
// Bad
class Config {
  endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }
}
```

### Initialize fields at declaration

```ts
// Good
class Queue {
  private readonly items: string[] = [];
  private selected: string | undefined = undefined;
}
```

```ts
// Bad
class Queue {
  private readonly items: string[];

  constructor() {
    this.items = [];
  }
}
```

### Use appropriate visibility

Do not mark externally accessed members `private`. Never bypass visibility through bracket access.

```ts
// Good
class Component {
  protected status = "ready";
}
```

```ts
// Bad
class Component {
  private status = "ready";
}

component["status"];
```

### Prefer function declarations for named functions

```ts
// Good
function calculateTotal() {
  return 42;
}
```

```ts
// Bad
const calculateTotal = () => 42;
```

Use an arrow when an explicit callable type is required.

```ts
interface SearchFunction {
  (source: string, query: string): boolean;
}

const search: SearchFunction = (source, query) => source.includes(query);
```

### Do not use function expressions

Use arrow functions unless dynamic `this` rebinding or generator syntax requires otherwise.

```ts
// Good
run(() => {
  performWork();
});
```

```ts
// Bad
run(function () {
  performWork();
});
```

### Choose arrow bodies based on return use

Use concise bodies when the return value is used. Use block bodies when it is not.

```ts
// Good
const names = users.map((user) => user.name);

promise.then((value) => {
  log(value);
});
```

```ts
// Bad
promise.then((value) => log(value));

let callback: () => void;
callback = () => 1;
```

### Avoid rebinding `this`

Prefer arrows or explicit parameters.

```ts
// Good
document.body.onclick = () => {
  document.body.textContent = "hello";
};
```

```ts
// Bad
function clickHandler() {
  this.textContent = "hello";
}

document.body.onclick = clickHandler;
```

### Wrap callbacks when signatures may differ

```ts
// Good
const numbers = ["11", "5", "3"].map((value) => parseInt(value, 10));
```

```ts
// Bad
const numbers = ["11", "5", "3"].map(parseInt);
```

### Use stable references for removable handlers

```ts
// Good
class Component {
  attach() {
    window.addEventListener("beforeunload", this.listener);
  }

  detach() {
    window.removeEventListener("beforeunload", this.listener);
  }

  private readonly listener = () => {
    confirm("Do you want to exit?");
  };
}
```

```ts
// Bad
class Component {
  attach() {
    window.addEventListener("beforeunload", this.listener.bind(this));
  }

  detach() {
    window.removeEventListener("beforeunload", this.listener.bind(this));
  }

  private listener() {}
}
```

### Keep parameter initializers simple

Avoid side effects and shared mutable state.

```ts
// Good
function process(name: string, context: string[] = []) {
  return { name, context };
}
```

```ts
// Bad
let counter = 0;
function process(name: string, id = counter++) {
  return { name, id };
}
```

### Prefer rest and spread

```ts
// Good
function combine(prefix: string, ...values: number[]) {
  return `${prefix}:${values.join(",")}`;
}

combine("values", ...numbers);
```

```ts
// Bad
function combine(prefix: string) {
  return Array.prototype.slice.call(arguments, 1);
}

combine.apply(null, ["values", ...numbers]);
```

### Use explicit enum comparisons

Do not coerce enum values to booleans.

```ts
// Good
enum SupportLevel {
  NONE,
  BASIC,
  ADVANCED,
}

if (level !== SupportLevel.NONE) {
  enable();
}
```

```ts
// Bad
if (level) {
  enable();
}
```

### Parse numbers with `Number()`

Check for invalid or non-finite results.

```ts
// Good
const parsed = Number(input);
if (!Number.isFinite(parsed)) {
  throw new Error("Expected a finite number.");
}
```

```ts
// Bad
const parsed = +input;
const integer = parseInt(input, 10);
const decimal = parseFloat(input);
```

Validate non-base-10 inputs before using `parseInt`.

```ts
if (!/^[a-fA-F0-9]+$/.test(hexValue)) {
  throw new Error("Invalid hexadecimal input.");
}

const parsedHex = parseInt(hexValue, 16);
```

### Avoid redundant boolean coercion

```ts
// Good
if (value) {
  use(value);
}
```

```ts
// Bad
if (!!value) {
  use(value);
}
```

### Avoid assignments in conditions

```ts
// Good
result = getResult();
if (result) {
  process(result);
}
```

```ts
// Bad
if ((result = getResult())) {
  process(result);
}
```

Use extra parentheses when assignment in a condition is intentional.

```ts
while ((result = getResult())) {
  process(result);
}
```

### Prefer `for...of` for arrays

```ts
// Good
for (const item of items) {
  process(item);
}
```

```ts
// Bad
for (const index in items) {
  process(items[index]);
}
```

### Use exceptions for exceptional conditions

Throw `Error` instances and instantiate them with `new`.

```ts
// Good
throw new Error("Invalid configuration.");
```

```ts
// Bad
throw "Invalid configuration.";
throw Error("Invalid configuration.");
```

Reject promises with `Error` instances.

```ts
// Good
Promise.reject(new Error("Request failed."));
```

```ts
// Bad
Promise.reject("Request failed.");
```

### Narrow caught errors

```ts
// Good
function assertIsError(value: unknown): asserts value is Error {
  if (!(value instanceof Error)) {
    throw new Error("Expected an Error instance.");
  }
}

try {
  run();
} catch (error: unknown) {
  assertIsError(error);
  display(error.message);
}
```

```ts
// Bad
try {
  run();
} catch (error) {
  display(error.message);
}
```

Handle non-`Error` values only for known violating APIs, and document the source.

### Explain empty catch blocks

```ts
// Good
try {
  return parseNumber(response);
} catch (error: unknown) {
  // The response is not numeric. Continue with text parsing.
}

return parseText(response);
```

```ts
// Bad
try {
  return parseNumber(response);
} catch (error: unknown) {}
```

### Make switch statements exhaustive in structure

Include a final `default` group. Terminate non-empty cases.

```ts
// Good
switch (kind) {
  case Kind.ACTIVE:
    activate();
    break;
  default:
    break;
}
```

```ts
// Bad
switch (kind) {
  case Kind.ACTIVE:
    activate();
}
```

Allow fallthrough only between empty case groups.

```ts
switch (kind) {
  case Kind.ACTIVE:
  case Kind.PENDING:
    process();
    break;
  default:
    break;
}
```

### Use strict equality

```ts
// Good
if (status === "ready" || current !== expected) {
  update();
}
```

```ts
// Bad
if (status == "ready" || current != expected) {
  update();
}
```

Use `== null` only when intentionally matching both `null` and `undefined`.

```ts
if (value == null) {
  return;
}
```

### Avoid unsafe assertions

Prefer runtime checks.

```ts
// Good
if (value instanceof Parser) {
  value.parse();
}

if (result) {
  result.commit();
}
```

```ts
// Bad
(value as Parser).parse();
result!.commit();
```

Use `as` syntax, not angle brackets.

```ts
// Good
const name = (value as User).name;
```

```ts
// Bad
const name = (<User>value).name;
```

Use `unknown` for double assertions.

```ts
// Good
(value as unknown as User).save();
```

```ts
// Bad
(value as any as User).save();
```

Annotate object literals instead of asserting them.

```ts
// Good
const user: User = {
  id: 123,
};
```

```ts
// Bad
const user = {
  id: 123,
  obsoleteField: true,
} as User;
```

### Keep `try` blocks focused

```ts
// Good
let result: Result;

try {
  result = methodThatMayThrow();
} catch (error: unknown) {
  handleError(error);
  throw error;
}

use(result);
```

```ts
// Bad
try {
  const result = methodThatMayThrow();
  use(result);
} catch (error: unknown) {
  handleError(error);
}
```

### Do not instantiate primitive wrappers

```ts
// Good
const text = String(value);
const enabled = Boolean(value);
const count = Number(value);
```

```ts
// Bad
const text = new String(value);
const enabled = new Boolean(value);
const count = new Number(value);
```

### Do not use `const enum`

```ts
// Good
enum Status {
  READY,
  RUNNING,
}
```

```ts
// Bad
const enum Status {
  READY,
  RUNNING,
}
```

### Remove debugger statements from production code

```ts
// Good
function inspect(value: unknown) {
  log(value);
}
```

```ts
// Bad
function inspect(value: unknown) {
  debugger;
}
```

### Do not use dynamic code evaluation

Do not use `eval` or `Function(string)` except in code loaders.

```ts
// Good
const result = parseExpression(input);
```

```ts
// Bad
const result = eval(input);
const fn = new Function(input);
```

### Do not modify built-ins

```ts
// Good
function first<T>(items: T[]): T | undefined {
  return items[0];
}
```

```ts
// Bad
(Array.prototype as any).first = function () {
  return this[0];
};
```

### Avoid `any`

Prefer specific types or `unknown`.

```ts
// Good
const value: unknown = input;

if (typeof value === "string") {
  useString(value);
}
```

```ts
// Bad
const value: any = input;
value.nonexistentMethod();
```

Use `any` only when necessary, suppress locally, and explain why.

```ts
// This test intentionally supplies only the method exercised by the subject.
// tslint:disable-next-line:no-any
const partialService = { get: () => mockValue } as any as Service;
```

### Avoid `{}` as a general type

Use `unknown`, `Record<string, T>`, or `object`.

```ts
// Good
function acceptOpaque(value: unknown) {
  return value;
}

const scores: Record<string, number> = {};
```

```ts
// Bad
function acceptAnything(value: {}) {
  return value;
}
```

## 2. Structural rules

### Organize files consistently

Order files as:

1. `@fileoverview`, when present.
2. Imports, when present.
3. Implementation.

Omit copyright material from this summary.

### Use ES modules

Organize code with imports and exports. Do not use namespaces, triple-slash references, or `require` imports except when required for third-party interoperability.

```ts
// Good: rocket.ts
export function launch() {
  return "launched";
}

// mission.ts
import { launch } from "./rocket";

launch();
```

```ts
// Bad
namespace Rocket {
  export function launch() {}
}

/// <reference path="./rocket.ts" />
import Rocket = require("./rocket");
```

### Choose imports deliberately

Prefer named imports for frequently used or clearly named symbols.

```ts
// Good
import { describe, expect, it } from "./testing";
```

Prefer namespace imports when using many symbols from a broad API.

```ts
// Good
import * as table from "./table";

let row: table.Row | undefined;
```

Avoid overlong named imports that merely recreate a namespace.

```ts
// Bad
import {
  Item as TableItem,
  Model as TableModel,
  Row as TableRow,
} from "./table";
```

Use named imports for Apps JSPB protos.

```ts
import { Bar, Foo } from "./messages.proto";
```

### Use sensible import paths

Prefer relative paths within the same logical project. Limit long parent traversal.

```ts
// Good
import { Config } from "./config";
import { Logger } from "../logging/logger";
```

```ts
// Bad
import { Config } from "application/features/config";
import { Logger } from "../../../../../../logging/logger";
```

### Use named exports

```ts
// Good
export class Parser {}
export function parseConfig() {}
```

```ts
// Bad
export default class Parser {}
```

Export only symbols used outside the module. Minimize the API surface.

### Do not export mutable bindings

```ts
// Good
let retryCount = 0;

export function getRetryCount() {
  return retryCount;
}
```

```ts
// Bad
export let retryCount = 0;
```

Resolve conditional exports before exporting them.

```ts
function selectTransport() {
  return useSecureTransport() ? SecureTransport : DefaultTransport;
}

export const Transport = selectTransport();
```

### Do not create static container classes

```ts
// Good
export const MAX_ATTEMPTS = 3;

export function retry() {
  return true;
}
```

```ts
// Bad
export class RetryUtilities {
  static readonly MAX_ATTEMPTS = 3;

  static retry() {
    return true;
  }
}
```

### Use type-only imports and exports

```ts
// Good
import type { RequestOptions } from "./types";
import { sendRequest } from "./request";

export type { Response } from "./types";
```

```ts
// Bad
import { RequestOptions } from "./types";
export { Response } from "./types";
```

### Prefer module-local functions over private static methods

```ts
// Good
function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export class UserService {
  create(name: string) {
    return normalizeName(name);
  }
}
```

```ts
// Bad
export class UserService {
  private static normalizeName(name: string) {
    return name.trim().toLowerCase();
  }
}
```

### Omit unnecessary constructors

```ts
// Good
class EmptyService {}

class ChildService extends BaseService {}
```

```ts
// Bad
class EmptyService {
  constructor() {}
}

class ChildService extends BaseService {
  constructor() {
    super();
  }
}
```

Keep constructors that declare parameter properties, apply decorators, restrict instantiation, or perform work.

### Use parameter properties

```ts
// Good
class Controller {
  constructor(private readonly service: Service) {}
}
```

```ts
// Bad
class Controller {
  private readonly service: Service;

  constructor(service: Service) {
    this.service = service;
  }
}
```

### Do not use ECMAScript `#private` fields

```ts
// Good
class Session {
  private token = "";
}
```

```ts
// Bad
class Session {
  #token = "";
}
```

### Use computed class members only for symbols

```ts
// Good
class Collection implements Iterable<string> {
  *[Symbol.iterator]() {
    yield "value";
  }
}
```

```ts
// Bad
class Collection {
  ["value"]() {
    return 1;
  }
}
```

### Do not manipulate prototypes

Use classes instead of modifying prototypes.

```ts
// Good
class User {
  greet() {
    return "hello";
  }
}
```

```ts
// Bad
function User() {}

User.prototype.greet = function () {
  return "hello";
};
```

### Prefer interfaces for object shapes

```ts
// Good
interface User {
  firstName: string;
  lastName: string;
}
```

```ts
// Bad
type User = {
  firstName: string;
  lastName: string;
};
```

Use type aliases for unions, primitives, tuples, and type expressions interfaces cannot model.

### Use structural typing explicitly

Annotate structural implementations at declaration sites.

```ts
// Good
interface Point {
  x: number;
  y: number;
}

const origin: Point = {
  x: 0,
  y: 0,
};
```

```ts
// Bad
const origin = {
  x: 0,
  y: 0,
};
```

Use interfaces, not classes, to define structural shapes.

### Choose array type syntax by complexity

Use `T[]` or `readonly T[]` for simple element types. Use `Array<T>` or `ReadonlyArray<T>` for complex types.

```ts
// Good
let names: string[];
let models: app.Model[];
let records: Array<{ id: number; name: string }>;
let values: Array<string | number>;
```

```ts
// Bad
let names: Array<string>;
let models: Array<app.Model>;
let records: { id: number; name: string }[];
let values: (string | number)[];
```

### Use meaningful index signatures

```ts
// Good
const fileSizes: { [fileName: string]: number } = {};
```

```ts
// Bad
const fileSizes: { [key: string]: number } = {};
```

Prefer `Map` or `Set` when their semantics fit better. Use `Record<Keys, Value>` when keys are statically known.

### Prefer simple types over mapped and conditional types

Use explicit interfaces when they communicate the design more clearly.

```ts
// Good
interface FoodPreferences {
  favoriteChocolate: string;
  favoriteIceCream: string;
}

interface User extends FoodPreferences {
  shoeSize: number;
}
```

```ts
// Bad
interface User {
  shoeSize: number;
  favoriteChocolate: string;
  favoriteIceCream: string;
}

type FoodPreferences = Pick<User, "favoriteChocolate" | "favoriteIceCream">;
```

### Use tuples only when positional meaning is clear

```ts
// Good
function splitInHalf(input: string): [string, string] {
  return [input.slice(0, 2), input.slice(2)];
}
```

Prefer object properties when names improve clarity.

```ts
// Good
function splitHostPort(address: string): { host: string; port: number } {
  return { host: "localhost", port: 8080 };
}
```

```ts
// Bad
function splitHostPort(address: string): [string, number] {
  return ["localhost", 8080];
}
```

### Keep nullable unions at use sites

```ts
// Good
type CoffeeResponse = Latte | Americano;

class CoffeeService {
  getCoffee(): CoffeeResponse | undefined {
    return undefined;
  }
}
```

```ts
// Bad
type CoffeeResponse = Latte | Americano | undefined;
```

### Prefer optional properties and parameters

```ts
// Good
interface CoffeeOrder {
  milk?: Whole | LowFat | HalfHalf;
}

function pourCoffee(volume?: Milliliter) {}
```

```ts
// Bad
interface CoffeeOrder {
  milk: Whole | LowFat | HalfHalf | undefined;
}

function pourCoffee(volume: Milliliter | undefined) {}
```

### Avoid return-type-only generics

Do not define APIs whose generic parameter appears only in the return type.

```ts
// Good
function decode<T>(text: string, validator: (value: unknown) => value is T): T {
  const value: unknown = JSON.parse(text);
  if (!validator(value)) {
    throw new Error("Invalid decoded value.");
  }
  return value;
}
```

```ts
// Bad
function readValue<T>(): T {
  return storage.read() as T;
}
```

When using an existing return-type-only generic API, specify the generic explicitly.

## 3. Informational and documentation rules

### Use `@fileoverview` when useful

Describe the file, its uses, or its dependencies. Do not indent wrapped lines.

```ts
// Good
/**
 * @fileoverview Provides parsing utilities for application configuration.
 * Depends on the shared validation package.
 */
```

```ts
// Bad
/**
 * @fileoverview
 *     Configuration helpers.
 */
```

### Distinguish JSDoc from implementation comments

Use JSDoc for user-facing documentation.

```ts
// Good
/** Returns the current account balance. */
function getBalance() {
  return balance;
}
```

Use line comments for implementation details.

```ts
// Good
// Cache the result because this calculation is expensive.
const result = calculate();
```

Do not use JSDoc for local implementation notes.

```ts
// Bad
/** Cache this because it is expensive. */
const result = calculate();
```

### Use line comments for multi-line implementation comments

```ts
// Good
// Validate the identifier first.
// Then load the associated record.
```

```ts
// Bad
/*
 * Validate the identifier first.
 * Then load the associated record.
 */
```

Do not draw boxes around comments.

### Format JSDoc correctly

```ts
// Good
/**
 * Computes the adjusted value.
 * @param input The value to adjust.
 */
function adjust(input: number) {
  return input * 2;
}
```

```ts
// Bad
/** Computes the adjusted value.
 * @param input The value to adjust. */
function adjust(input: number) {
  return input * 2;
}
```

Use single-line JSDoc only when it fits on one line.

### Write JSDoc in Markdown

```ts
// Good
/**
 * Computes the score from:
 *
 * - items sent
 * - items received
 * - the latest timestamp
 */
function computeScore() {}
```

```ts
// Bad
/**
 * Computes the score from:
 *   items sent
 *   items received
 *   the latest timestamp
 */
function computeScore() {}
```

### Put JSDoc tags on separate lines

```ts
// Good
/**
 * Adds two values.
 * @param left The left operand.
 * @param right The right operand.
 */
function add(left: number, right: number) {
  return left + right;
}
```

```ts
// Bad
/**
 * Adds two values.
 * @param left @param right
 */
function add(left: number, right: number) {
  return left + right;
}
```

### Wrap JSDoc tag descriptions correctly

Indent wrapped block-tag descriptions by four spaces. Do not indent wrapped `@desc` or `@fileoverview` text.

```ts
// Good
/**
 * Loads a record.
 * @param identifier The identifier used to locate the record when the ordinary
 *     lookup key is unavailable.
 * @return The matching record, or undefined when none exists.
 */
function load(identifier: string): RecordValue | undefined {
  return undefined;
}
```

```ts
// Bad
/**
 * Loads a record.
 * @param identifier The identifier used to locate the record when the ordinary
 * lookup key is unavailable.
 */
function load(identifier: string): RecordValue | undefined {
  return undefined;
}
```

### Document top-level exports

Document exported APIs and non-obvious members. Do not merely restate names or types.

```ts
// Good
/** Parses and validates a user-provided configuration file. */
export function parseConfiguration(text: string): Configuration {
  return parse(text);
}
```

```ts
// Bad
/** Parses configuration. */
export function parseConfiguration(text: string): Configuration {
  return parse(text);
}
```

Omit comments for symbols exported only for tooling when the framework makes their purpose obvious.

### Document classes for use

Explain how and when to use the class and any constraints needed for correct use.

```ts
// Good
/**
 * Coordinates retryable network requests.
 *
 * Create one instance per remote service.
 */
export class RequestCoordinator {}
```

```ts
// Bad
/** Request coordinator. */
export class RequestCoordinator {}
```

### Start method descriptions with third-person verb phrases

```ts
// Good
/** Returns the active session. */
function getActiveSession() {
  return session;
}
```

```ts
// Bad
/** Return the active session. */
function getActiveSession() {
  return session;
}
```

### Document parameter properties with `@param`

```ts
// Good
/** Brews coffee from a configured bean source. */
class Brewer {
  /**
   * @param grinder The grinder used to prepare beans.
   * @param beans The beans available for brewing.
   */
  constructor(
    private readonly grinder: Grinder,
    private readonly beans: CoffeeBean[],
  ) {}
}
```

Document ordinary fields at their declaration.

```ts
class Brewer {
  /** The bean used by the next brew operation. */
  nextBean: CoffeeBean;
}
```

### Do not duplicate TypeScript types in JSDoc

Do not add JSDoc type annotations when TypeScript already expresses the type.

```ts
// Good
/**
 * Returns the total.
 * @param values Values to add.
 */
function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
```

```ts
// Bad
/**
 * @param {number[]} values Values to add.
 * @return {number}
 */
function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
```

Do not repeat `implements`, `enum`, `private`, or `override` in JSDoc.

### Add information, not repetition

```ts
// Good
/**
 * Starts brewing through the remote controller.
 * @param amountLitres The amount to brew; it must not exceed pot capacity.
 */
function brew(amountLitres: number, logger: Logger) {}
```

```ts
// Bad
/** @param logger The logger. */
function brew(amountLitres: number, logger: Logger) {}
```

Omit `@param` and `@return` tags when they add no useful information.

### Clarify unclear call-site arguments

Prefer an options object when practical.

```ts
// Good
render(content, {
  shouldAnimate: true,
  themeName: "dark",
});
```

When preserving positional parameters, add parameter-name comments before ambiguous values.

```ts
// Good
render(content, /* shouldAnimate= */ true, /* themeName= */ "dark");
```

```ts
// Bad
render(content, true, "dark");
```

Keep the legacy after-value style only for consistency within an existing file.

### Place documentation before decorators

```ts
// Good
/** Displays the status message. */
@Component({
  selector: "status-view",
  template: "{{message}}",
})
export class StatusView {
  message = "";
}
```

```ts
// Bad
@Component({
  selector: "status-view",
  template: "{{message}}",
})
/** Displays the status message. */
export class StatusView {
  message = "";
}
```

### Do not define new decorators

Use only framework-provided decorators where required.

```ts
// Good
@Component({
  selector: "user-card",
  template: "{{name}}",
})
class UserCard {
  @Input() name = "";
}
```

```ts
// Bad
function LogCalls() {
  return function () {};
}

@LogCalls()
class UserService {}
```

### Mark deprecations clearly

Use `@deprecated` and give direct migration instructions.

```ts
// Good
/**
 * @deprecated Use createSession() instead.
 */
export function openSession() {
  return createSession();
}
```

```ts
// Bad
/** @deprecated */
export function openSession() {
  return createSession();
}
```

### Do not suppress compiler errors broadly

Do not use `@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error` in production code.

```ts
// Good
const value = input as unknown;
if (typeof value === "string") {
  process(value);
}
```

```ts
// Bad
// @ts-ignore
process(input);
```

Use `@ts-expect-error` in unit tests only when necessary, and prefer precise casts or documented local lint suppressions.

### Follow conformance rules

Comply with applicable global and framework-local conformance checks, including restrictions on globals, dynamic evaluation, unsafe DOM writes, and other security-sensitive APIs.

### Preserve local consistency without violating the guide

Follow existing file style for unresolved questions. Then consult nearby files.

Use Google Style in new files. When modifying non-conforming files, prefer reformatting first when practical. Do not introduce new violations merely to match existing code.

### Separate broad reformatting from focused changes

Do not let unrelated style cleanup obscure the purpose of a change. Move broad formatting updates into a separate change.

### Treat generated code as mostly exempt

Do not require generated source to follow all style rules. Require generated identifiers referenced by handwritten code to follow naming rules. Allow underscores in generated identifiers when needed to avoid collisions.

### Optimize for maintainability

Avoid patterns known to cause problems.

Choose one form when equivalent alternatives would create pointless variation.

Optimize for long-term maintainability, automated refactoring, consistent compiler assumptions, explicit dependencies, and reliable tests.

Keep code review focused on code quality rather than arbitrary formatting disputes.

Leave situation-dependent choices local unless a global rule materially improves correctness, consistency, maintainability, automation, or review quality.
