# 1. Simple formatting

## Encode files as UTF-8

Use UTF-8 for every source file.

## Restrict whitespace

Use only line terminators and ASCII horizontal spaces outside string escapes.

## Use standard escape sequences

Use standard escapes instead of numeric equivalents. Never use legacy octal escapes.

```ts
// Good
const lineBreak = "\n";
const tab = "\t";
```

```ts
// Bad
const lineBreak = "\u000a";
const tab = "\x09";
```

## Use readable Unicode

Write printable non-ASCII characters directly. Escape non-printable characters and explain them.

```ts
// Good
const duration = "25 μs";
const text = "\ufeff" + content; // byte order mark
```

```ts
// Bad
const duration = "25 \u03bcs";
const text = "\ufeff" + content;
```

## Separate file sections with one blank line

Place `@fileoverview`, imports, and implementation in that order. Separate present sections with exactly one blank line.

```ts
/** @fileoverview Parses configuration files. */

import { readFile } from "./files";

export function parse() {
  return readFile();
}
```

```ts
/** @fileoverview Parses configuration files. */

import { readFile } from "./files";
export function parse() {
  return readFile();
}
```

## Use semicolons

Terminate statements explicitly. Do not rely on Automatic Semicolon Insertion.

```ts
// Good
const value = compute();
use(value);
```

```ts
// Bad
const value = compute();
use(value);
```

## Use single quotes

Use single quotes for ordinary string literals.

```ts
// Good
const status = "ready";
```

```ts
// Bad
const status = "ready";
```

Use a template literal when it avoids awkward escaping or supports interpolation.

```ts
// Good
const message = `It's ready`;
const summary = `Status: ${status}`;
```

## Do not use line continuations

Concatenate strings or keep a searchable string on one line.

```ts
// Good
const message =
  "This sentence is split through concatenation, " +
  "so indentation does not alter its contents.";
```

```ts
// Bad
const message =
  "This sentence uses a line continuation \
    and includes indentation in surprising ways.";
```

## Format number literals correctly

Use lowercase `0x`, `0o`, and `0b` prefixes. Do not add leading zeroes otherwise.

```ts
// Good
const decimal = 10;
const hexadecimal = 0xff;
const octal = 0o755;
const binary = 0b1010;
```

```ts
// Bad
const hexadecimal = 0XFF;
const octal = 0755;
```

## Declare one variable at a time

```ts
// Good
const width = 10;
const height = 20;
```

```ts
// Bad
const width = 10,
  height = 20;
```

## Format classes correctly

Do not terminate class declarations with semicolons.

```ts
// Good
class Service {}
```

```ts
// Bad
class Service {}
```

Terminate statements containing class expressions.

```ts
// Good
const ServiceFactory = class extends BaseFactory {};
```

```ts
// Bad
const ServiceFactory = class extends BaseFactory {};
```

Do not place semicolons after method declarations. Separate methods with one blank line.

```ts
// Good
class Counter {
  increment() {
    this.value++;
  }

  getValue() {
    return this.value;
  }

  private value = 0;
}
```

```ts
// Bad
class Counter {
  increment() {
    this.value++;
  }
  getValue() {
    return this.value;
  }
}
```

## Use constructor parentheses

```ts
// Good
const service = new Service();
```

```ts
// Bad
const service = new Service();
```

## Format functions consistently

Do not begin or end function bodies with blank lines. Use internal blank lines sparingly for logical grouping.

Attach `*` to `function` and `yield`.

```ts
// Good
function* values() {
  yield* source;
}
```

```ts
// Bad
function* values() {
  yield* source;
}
```

Do not add spaces after `...`.

```ts
// Good
function collect(...items: number[]) {
  return items;
}

collect(...array);
```

```ts
// Bad
function collect(...items: number[]) {
  return items;
}

collect(...array);
```

## Always use blocks for control flow

Use braces for control-flow bodies. Start non-empty blocks on a new line.

```ts
// Good
if (value) {
  handle(value);
}
```

```ts
// Bad
if (value) handle(value);
```

Allow a one-line `if` without braces only when it fits clearly on one line.

```ts
if (value) value.reset();
```

## Use grouping parentheses when they improve readability

Do not assume readers know every precedence rule.

```ts
// Good
const result = (a && b) || c;
```

```ts
// Bad
const result = (a && b) || c;
```

Do not wrap entire expressions unnecessarily after keywords such as `return`, `throw`, `typeof`, or `yield`.

```ts
// Good
return value;
```

```ts
// Bad
return value;
```

## Apply identifier casing consistently

Use:

- `UpperCamelCase` for classes, interfaces, types, enums, decorators, and type parameters.
- `lowerCamelCase` for variables, parameters, functions, methods, properties, and module aliases.
- `CONSTANT_CASE` for module-level constants and enum values.

```ts
// Good
class UserService {}
interface UserRecord {}
const userCount = 5;
const MAX_RETRIES = 3;
```

```ts
// Bad
class user_service {}
interface IUserRecord {}
const UserCount = 5;
const max_retries = 3;
```

## Treat acronyms as words

```ts
// Good
function loadHttpUrl() {}
```

```ts
// Bad
function loadHTTPURL() {}
```

## Do not prefix or suffix identifiers with `_`

```ts
// Good
const [first, , third] = values;
```

```ts
// Bad
const [first, _, third] = values;
const _privateValue = 1;
```
