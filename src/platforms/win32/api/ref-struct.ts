// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as ref from "ref-napi";
import ref_struct_di from "ref-struct-di";

export type { StructObject, StructObjectBase } from "ref-struct-di";
export const StructType = ref_struct_di(ref);
export type StructType<TDefinition extends ref_struct_di.StructTypeDefinitionBase> = ref_struct_di.StructType<TDefinition>;
