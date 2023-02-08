// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ref_array_di from "ref-array-di";
import * as ref from "ref-napi";

export type { FixedLengthArrayType, TypedArray } from "ref-array-di";
export const ArrayType = ref_array_di(ref);
export type ArrayType<T> = ref_array_di.ArrayType<T>;
